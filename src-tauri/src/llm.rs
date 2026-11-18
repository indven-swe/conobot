//! Native LLM bridge.
//!
//! Every provider request is executed here, inside Rust, and streamed back to
//! the webview as `llm:chunk` / `llm:done` / `llm:error` events. This bypasses
//! browser CORS entirely and gives the UI real cancellation.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, State};
use tokio::sync::Mutex;
use tokio_util::sync::CancellationToken;

/* ------------------------------------------------------------------ */
/*  Wire types                                                        */
/* ------------------------------------------------------------------ */

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderProfile {
    // Present in the payload so the shape mirrors the frontend profile; the
    // bridge only needs kind/baseUrl/key.
    #[serde(default)]
    #[allow(dead_code)]
    pub id: String,
    pub kind: String,
    pub label: String,
    pub base_url: String,
    #[serde(default)]
    pub api_key: String,
    // Mirrors the frontend profile; the bridge only needs kind/baseUrl/key.
    #[serde(default)]
    #[allow(dead_code)]
    pub model: String,
    #[serde(default)]
    #[allow(dead_code)]
    pub models: Vec<String>,
    #[serde(default)]
    #[allow(dead_code)]
    pub enabled: bool,
    #[serde(default)]
    #[allow(dead_code)]
    pub system_prompt: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ChatTurn {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatRequest {
    pub request_id: String,
    pub provider: ProviderProfile,
    pub model: String,
    pub messages: Vec<ChatTurn>,
    #[serde(default)]
    pub system_prompt: Option<String>,
    #[serde(default = "default_temperature")]
    pub temperature: f32,
    #[serde(default = "default_max_tokens")]
    pub max_tokens: u32,
}

fn default_temperature() -> f32 {
    0.7
}

fn default_max_tokens() -> u32 {
    4096
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ChunkPayload {
    request_id: String,
    delta: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DonePayload {
    request_id: String,
    content: String,
    model: Option<String>,
    prompt_tokens: Option<u32>,
    completion_tokens: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ErrorPayload {
    request_id: String,
    message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionReport {
    ok: bool,
    latency_ms: u128,
    models: Vec<String>,
    error: Option<String>,
    detail: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Wire {
    /// Ollama `/api/chat` — newline-delimited JSON.
    Ollama,
    /// Server-sent events: Anthropic Messages and OpenAI-compatible APIs.
    Sse,
}

struct BuiltRequest {
    builder: reqwest::RequestBuilder,
    wire: Wire,
    url: String,
}

#[derive(Default)]
struct Accumulator {
    content: String,
    model: String,
    prompt_tokens: Option<u32>,
    completion_tokens: Option<u32>,
    done: bool,
}

enum StreamOutcome {
    Complete {
        content: String,
        model: String,
        prompt_tokens: Option<u32>,
        completion_tokens: Option<u32>,
    },
    Cancelled {
        content: String,
        model: String,
    },
}

/* ------------------------------------------------------------------ */
/*  Cancellation registry                                             */
/* ------------------------------------------------------------------ */

#[derive(Default)]
pub struct StreamRegistry {
    active: Mutex<HashMap<String, CancellationToken>>,
}

impl StreamRegistry {
    pub async fn cancel(&self, request_id: &str) {
        if let Some(token) = self.active.lock().await.get(request_id) {
            token.cancel();
        }
    }
}

/* ------------------------------------------------------------------ */
/*  Commands                                                          */
/* ------------------------------------------------------------------ */

#[tauri::command]
pub async fn start_chat_stream(
    app: AppHandle,
    registry: State<'_, Arc<StreamRegistry>>,
    request: ChatRequest,
) -> Result<(), String> {
    if request.model.trim().is_empty() {
        return Err("No model selected.".into());
    }

    let request_id = request.request_id.clone();
    let token = CancellationToken::new();
    {
        let mut active = registry.active.lock().await;
        if let Some(previous) = active.insert(request_id.clone(), token.clone()) {
            previous.cancel();
        }
    }

    let registry = Arc::clone(registry.inner());
    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let outcome = run_stream(&app_handle, &request, &token).await;
        match outcome {
            Ok(StreamOutcome::Complete {
                content,
                model,
                prompt_tokens,
                completion_tokens,
            }) => {
                let _ = app_handle.emit(
                    "llm:done",
                    DonePayload {
                        request_id: request_id.clone(),
                        content,
                        model: Some(model),
                        prompt_tokens,
                        completion_tokens,
                    },
                );
            }
            Ok(StreamOutcome::Cancelled { content, model }) => {
                let _ = app_handle.emit(
                    "llm:done",
                    DonePayload {
                        request_id: request_id.clone(),
                        content,
                        model: Some(model),
                        prompt_tokens: None,
                        completion_tokens: None,
                    },
                );
            }
            Err(message) => {
                let _ = app_handle.emit(
                    "llm:error",
                    ErrorPayload {
                        request_id: request_id.clone(),
                        message,
                    },
                );
            }
        }
        registry.active.lock().await.remove(&request_id);
    });

    Ok(())
}

#[tauri::command]
pub async fn stop_generation(
    registry: State<'_, Arc<StreamRegistry>>,
    request_id: String,
) -> Result<(), String> {
    registry.cancel(&request_id).await;
    Ok(())
}

#[tauri::command]
pub async fn test_connection(profile: ProviderProfile) -> ConnectionReport {
    let started = Instant::now();
    let base = normalise_base(&profile.base_url);
    if base.is_empty() {
        return report_error(started, "Base URL is empty.", None);
    }
    if profile.kind == "anthropic" && profile.api_key.trim().is_empty() {
        return report_error(started, "Claude requires an API key.", Some("add a key in Provider Settings".into()));
    }

    let client = match reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(8))
        .timeout(Duration::from_secs(25))
        .build()
    {
        Ok(client) => client,
        Err(error) => return report_error(started, &format!("HTTP client error: {error}"), None),
    };

    let url = models_url(&profile.kind, &base);
    let mut builder = client.get(&url).header("accept", "application/json");
    if !profile.api_key.trim().is_empty() {
        builder = match profile.kind.as_str() {
            "anthropic" => builder
                .header("x-api-key", profile.api_key.trim())
                .header("anthropic-version", "2023-06-01"),
            _ => builder.bearer_auth(profile.api_key.trim()),
        };
    }

    let detail = Some(format!("GET {url}"));

    match builder.send().await {
        Ok(response) => {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            if !status.is_success() {
                return ConnectionReport {
                    ok: false,
                    latency_ms: started.elapsed().as_millis(),
                    models: Vec::new(),
                    error: Some(http_error(status.as_u16(), &body, &profile.label)),
                    detail,
                };
            }
            ConnectionReport {
                ok: true,
                latency_ms: started.elapsed().as_millis(),
                models: parse_models(&profile.kind, &body),
                error: None,
                detail,
            }
        }
        Err(error) => ConnectionReport {
            ok: false,
            latency_ms: started.elapsed().as_millis(),
            models: Vec::new(),
            error: Some(transport_error(&error, &url)),
            detail,
        },
    }
}

fn report_error(started: Instant, message: &str, detail: Option<String>) -> ConnectionReport {
    ConnectionReport {
        ok: false,
        latency_ms: started.elapsed().as_millis(),
        models: Vec::new(),
        error: Some(message.to_string()),
        detail,
    }
}

/* ------------------------------------------------------------------ */
/*  Streaming                                                         */
/* ------------------------------------------------------------------ */

async fn run_stream(
    app: &AppHandle,
    request: &ChatRequest,
    token: &CancellationToken,
) -> Result<StreamOutcome, String> {
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(15))
        // Long generations are allowed; the user can always cancel.
        .timeout(Duration::from_secs(900))
        .build()
        .map_err(|error| format!("Could not initialise the HTTP client: {error}"))?;

    let BuiltRequest { builder, wire, url } = build_request(&client, request)?;
    let response = builder
        .send()
        .await
        .map_err(|error| transport_error(&error, &url))?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(http_error(
            status.as_u16(),
            &body,
            &request.provider.label,
        ));
    }

    let mut accumulator = Accumulator {
        model: request.model.clone(),
        ..Accumulator::default()
    };
    let mut stream = response.bytes_stream();
    let mut buffer = String::new();
    let mut emitted = String::new();

    while !accumulator.done {
        let next = tokio::select! {
            _ = token.cancelled() => {
                return Ok(StreamOutcome::Cancelled {
                    content: accumulator.content,
                    model: accumulator.model,
                });
            }
            next = stream.next() => next,
        };

        let Some(item) = next else { break };
        let bytes = item.map_err(|error| {
            format!(
                "The stream from {} was interrupted: {error}",
                pretty_host(&url)
            )
        })?;

        // Normalise CRLF so the event boundary logic only deals with "\n\n".
        buffer.push_str(&String::from_utf8_lossy(&bytes).replace('\r', ""));
        emitted.clear();

        let result = match wire {
            Wire::Ollama => drain_ollama(&mut buffer, &mut accumulator, &mut emitted),
            Wire::Sse => drain_sse(&mut buffer, &mut accumulator, &mut emitted),
        };
        result?;

        if !emitted.is_empty() {
            let _ = app.emit(
                "llm:chunk",
                ChunkPayload {
                    request_id: request.request_id.clone(),
                    delta: emitted.clone(),
                },
            );
        }
    }

    // Some servers omit the final newline / blank line.
    if !accumulator.done {
        emitted.clear();
        match wire {
            Wire::Ollama => {
                let remainder = buffer.trim().to_string();
                if !remainder.is_empty() {
                    ingest_ollama_line(&remainder, &mut accumulator, &mut emitted)?;
                }
            }
            Wire::Sse => {
                if !buffer.trim().is_empty() {
                    ingest_sse_event(&buffer, &mut accumulator, &mut emitted)?;
                }
            }
        }
        if !emitted.is_empty() {
            let _ = app.emit(
                "llm:chunk",
                ChunkPayload {
                    request_id: request.request_id.clone(),
                    delta: emitted,
                },
            );
        }
    }

    Ok(StreamOutcome::Complete {
        content: accumulator.content,
        model: accumulator.model,
        prompt_tokens: accumulator.prompt_tokens,
        completion_tokens: accumulator.completion_tokens,
    })
}

fn build_request(
    client: &reqwest::Client,
    request: &ChatRequest,
) -> Result<BuiltRequest, String> {
    let provider = &request.provider;
    let base = normalise_base(&provider.base_url);
    if base.is_empty() {
        return Err("No base URL configured for this provider.".into());
    }

    let system = compose_system_prompt(request);

    match provider.kind.as_str() {
        "ollama" => {
            let url = format!("{base}/api/chat");
            let mut messages: Vec<Value> = Vec::new();
            if let Some(system) = system {
                messages.push(json!({ "role": "system", "content": system }));
            }
            messages.extend(
                request
                    .messages
                    .iter()
                    .filter(|turn| !turn.content.trim().is_empty())
                    .map(|turn| json!({ "role": turn.role, "content": turn.content })),
            );
            let body = json!({
                "model": request.model,
                "stream": true,
                "messages": messages,
                "options": {
                    "temperature": request.temperature.clamp(0.0, 2.0),
                    "num_predict": request.max_tokens.max(1),
                }
            });
            Ok(BuiltRequest {
                builder: client
                    .post(&url)
                    .header("accept", "application/x-ndjson")
                    .json(&body),
                wire: Wire::Ollama,
                url,
            })
        }

        "anthropic" => {
            let key = provider.api_key.trim();
            if key.is_empty() {
                return Err("Claude requires an API key. Add one in Provider Settings.".into());
            }
            let url = anthropic_url(&base);
            // The Messages API requires strictly alternating roles.
            let messages = merge_anthropic_turns(&request.messages);
            let mut body = json!({
                "model": request.model,
                "max_tokens": request.max_tokens.max(1),
                "temperature": request.temperature.clamp(0.0, 1.0),
                "stream": true,
                "messages": messages,
            });
            if let Some(system) = system {
                body["system"] = json!(system);
            }
            Ok(BuiltRequest {
                builder: client
                    .post(&url)
                    .header("accept", "text/event-stream")
                    .header("content-type", "application/json")
                    .header("x-api-key", key)
                    .header("anthropic-version", "2023-06-01")
                    .json(&body),
                wire: Wire::Sse,
                url,
            })
        }

        _ => {
            let url = openai_chat_url(&base);
            let mut messages: Vec<Value> = Vec::new();
            if let Some(system) = system {
                messages.push(json!({ "role": "system", "content": system }));
            }
            messages.extend(
                request
                    .messages
                    .iter()
                    .map(|turn| json!({ "role": turn.role, "content": turn.content })),
            );
            let body = json!({
                "model": request.model,
                "stream": true,
                "temperature": request.temperature.clamp(0.0, 2.0),
                "max_tokens": request.max_tokens.max(1),
                "messages": messages,
            });
            let mut builder = client
                .post(&url)
                .header("accept", "text/event-stream")
                .header("content-type", "application/json")
                .json(&body);
            if !provider.api_key.trim().is_empty() {
                builder = builder.bearer_auth(provider.api_key.trim());
            }
            Ok(BuiltRequest {
                builder,
                wire: Wire::Sse,
                url,
            })
        }
    }
}

fn merge_anthropic_turns(turns: &[ChatTurn]) -> Vec<Value> {
    let mut merged: Vec<(&'static str, String)> = Vec::new();
    for turn in turns {
        if turn.role == "system" || turn.content.trim().is_empty() {
            continue;
        }
        let role: &'static str = if turn.role == "assistant" {
            "assistant"
        } else {
            "user"
        };
        match merged.last_mut() {
            Some((last_role, last_content)) if *last_role == role => {
                last_content.push_str("\n\n");
                last_content.push_str(&turn.content);
            }
            _ => merged.push((role, turn.content.clone())),
        }
    }
    while merged
        .first()
        .map(|(role, _)| *role == "assistant")
        .unwrap_or(false)
    {
        merged.remove(0);
    }
    merged
        .into_iter()
        .map(|(role, content)| json!({ "role": role, "content": content }))
        .collect()
}

fn compose_system_prompt(request: &ChatRequest) -> Option<String> {
    // The frontend already merges the global prompt, the per-provider prompt and
    // the session prompt into one string, so there is nothing to add here.
    request
        .system_prompt
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn drain_ollama(
    buffer: &mut String,
    accumulator: &mut Accumulator,
    emitted: &mut String,
) -> Result<(), String> {
    while let Some(index) = buffer.find('\n') {
        let line: String = buffer.drain(..=index).collect();
        ingest_ollama_line(line.trim(), accumulator, emitted)?;
        if accumulator.done {
            break;
        }
    }
    Ok(())
}

fn ingest_ollama_line(
    line: &str,
    accumulator: &mut Accumulator,
    emitted: &mut String,
) -> Result<(), String> {
    if line.is_empty() {
        return Ok(());
    }
    let value: Value = serde_json::from_str(line)
        .map_err(|_| format!("Unexpected response from Ollama: {}", truncate(line, 240)))?;

    if let Some(error) = value.get("error").and_then(Value::as_str) {
        return Err(error.to_string());
    }
    if let Some(model) = value.get("model").and_then(Value::as_str) {
        if !model.is_empty() {
            accumulator.model = model.to_string();
        }
    }
    if let Some(delta) = value.pointer("/message/content").and_then(Value::as_str) {
        if !delta.is_empty() {
            accumulator.content.push_str(delta);
            emitted.push_str(delta);
        }
    }
    if value
        .get("done")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        accumulator.done = true;
        accumulator.prompt_tokens = value
            .get("prompt_eval_count")
            .and_then(Value::as_u64)
            .map(|value| value as u32);
        accumulator.completion_tokens = value
            .get("eval_count")
            .and_then(Value::as_u64)
            .map(|value| value as u32);
    }
    Ok(())
}

fn drain_sse(
    buffer: &mut String,
    accumulator: &mut Accumulator,
    emitted: &mut String,
) -> Result<(), String> {
    while let Some(index) = buffer.find("\n\n") {
        let event: String = buffer.drain(..index + 2).collect();
        ingest_sse_event(&event, accumulator, emitted)?;
        if accumulator.done {
            break;
        }
    }
    Ok(())
}

fn ingest_sse_event(
    event: &str,
    accumulator: &mut Accumulator,
    emitted: &mut String,
) -> Result<(), String> {
    let mut data = String::new();
    for line in event.lines() {
        let line = line.trim_start();
        if let Some(rest) = line.strip_prefix("data:") {
            if !data.is_empty() {
                data.push('\n');
            }
            data.push_str(rest.trim_start());
        }
    }
    if data.is_empty() {
        return Ok(());
    }
    if data.trim() == "[DONE]" {
        accumulator.done = true;
        return Ok(());
    }

    let value: Value = match serde_json::from_str(&data) {
        Ok(value) => value,
        // Ignore keep-alive comments and unknown payloads.
        Err(_) => return Ok(()),
    };

    let kind = value.get("type").and_then(Value::as_str).unwrap_or_default();
    match kind {
        "error" => {
            let message = value
                .pointer("/error/message")
                .and_then(Value::as_str)
                .unwrap_or("The provider reported an error.");
            return Err(message.to_string());
        }
        "message_start" => {
            if let Some(model) = value.pointer("/message/model").and_then(Value::as_str) {
                accumulator.model = model.to_string();
            }
            if let Some(tokens) = value
                .pointer("/message/usage/input_tokens")
                .and_then(Value::as_u64)
            {
                accumulator.prompt_tokens = Some(tokens as u32);
            }
        }
        "content_block_delta" => {
            if let Some(delta) = value.pointer("/delta/text").and_then(Value::as_str) {
                push_delta(accumulator, emitted, delta);
            }
        }
        "message_delta" => {
            if let Some(tokens) = value
                .pointer("/usage/output_tokens")
                .and_then(Value::as_u64)
            {
                accumulator.completion_tokens = Some(tokens as u32);
            }
            if value
                .pointer("/delta/stop_reason")
                .map(|reason| !reason.is_null())
                .unwrap_or(false)
            {
                accumulator.done = true;
            }
        }
        "message_stop" => {
            accumulator.done = true;
            return Ok(());
        }
        _ => {}
    }

    // OpenAI-compatible chunks (LM Studio, OpenAI, OpenRouter, vLLM, …).
    if let Some(choices) = value.get("choices").and_then(Value::as_array) {
        if let Some(choice) = choices.first() {
            if let Some(delta) = choice.pointer("/delta/content").and_then(Value::as_str) {
                push_delta(accumulator, emitted, delta);
            } else if let Some(text) = choice.get("text").and_then(Value::as_str) {
                push_delta(accumulator, emitted, text);
            }
            if choice
                .get("finish_reason")
                .map(|reason| !reason.is_null())
                .unwrap_or(false)
            {
                accumulator.done = true;
            }
        }
    }

    if let Some(usage) = value.get("usage") {
        if let Some(tokens) = usage.get("prompt_tokens").and_then(Value::as_u64) {
            accumulator.prompt_tokens = Some(tokens as u32);
        }
        if let Some(tokens) = usage.get("completion_tokens").and_then(Value::as_u64) {
            accumulator.completion_tokens = Some(tokens as u32);
        }
    }

    Ok(())
}

fn push_delta(accumulator: &mut Accumulator, emitted: &mut String, delta: &str) {
    if delta.is_empty() {
        return;
    }
    accumulator.content.push_str(delta);
    emitted.push_str(delta);
}

/* ------------------------------------------------------------------ */
/*  URL / error helpers                                               */
/* ------------------------------------------------------------------ */

fn normalise_base(base_url: &str) -> String {
    base_url.trim().trim_end_matches('/').to_string()
}

fn openai_chat_url(base: &str) -> String {
    if base.ends_with("/chat/completions") {
        base.to_string()
    } else if base.ends_with("/v1") {
        format!("{base}/chat/completions")
    } else {
        format!("{base}/v1/chat/completions")
    }
}

fn anthropic_url(base: &str) -> String {
    if base.ends_with("/messages") {
        base.to_string()
    } else if base.ends_with("/v1") {
        format!("{base}/messages")
    } else {
        format!("{base}/v1/messages")
    }
}

fn models_url(kind: &str, base: &str) -> String {
    match kind {
        "ollama" => format!("{base}/api/tags"),
        _ if base.ends_with("/models") => base.to_string(),
        _ if base.ends_with("/v1") => format!("{base}/models"),
        _ => format!("{base}/v1/models"),
    }
}

fn parse_models(kind: &str, body: &str) -> Vec<String> {
    let Ok(value) = serde_json::from_str::<Value>(body) else {
        return Vec::new();
    };
    let mut models: Vec<String> = if kind == "ollama" {
        value
            .get("models")
            .and_then(Value::as_array)
            .map(|entries| {
                entries
                    .iter()
                    .filter_map(|entry| {
                        entry
                            .get("name")
                            .or_else(|| entry.get("model"))
                            .and_then(Value::as_str)
                            .map(str::to_string)
                    })
                    .collect()
            })
            .unwrap_or_default()
    } else {
        value
            .get("data")
            .and_then(Value::as_array)
            .map(|entries| {
                entries
                    .iter()
                    .filter_map(|entry| {
                        entry
                            .get("id")
                            .and_then(Value::as_str)
                            .map(str::to_string)
                    })
                    .collect()
            })
            .unwrap_or_default()
    };
    models.retain(|model| !model.trim().is_empty());
    models.sort_by_key(|model| model.to_lowercase());
    models.dedup();
    models
}

fn pretty_host(url: &str) -> String {
    url.split("://")
        .nth(1)
        .and_then(|rest| rest.split('/').next())
        .unwrap_or(url)
        .to_string()
}

fn truncate(value: &str, max: usize) -> String {
    let trimmed: String = value.trim().chars().take(max).collect();
    if value.trim().chars().count() > max {
        format!("{trimmed}…")
    } else {
        trimmed
    }
}

fn http_error(status: u16, body: &str, label: &str) -> String {
    let hint = match status {
        400 => "The endpoint rejected the request payload.",
        401 | 403 => "Authentication failed. Check the API key for this endpoint.",
        404 => "Endpoint or model not found. Check the base URL and model id.",
        408 => "The endpoint timed out.",
        413 => "The request exceeded the endpoint's context limit.",
        429 => "Rate limited or out of quota. Wait a moment and retry.",
        500..=599 => "The provider reported a server error. Retry in a moment.",
        _ => "The endpoint returned an unexpected status.",
    };
    let detail = truncate(body, 500);
    if detail.is_empty() {
        format!("{label}: HTTP {status}. {hint}")
    } else {
        format!("{label}: HTTP {status}. {hint}\n{detail}")
    }
}

fn transport_error(error: &reqwest::Error, url: &str) -> String {
    if error.is_connect() {
        format!(
            "Could not connect to {}. Is the server running and reachable?",
            pretty_host(url)
        )
    } else if error.is_timeout() {
        format!(
            "The request to {} timed out before the model responded.",
            pretty_host(url)
        )
    } else if error.is_decode() {
        format!("Could not decode the response from {}: {error}", pretty_host(url))
    } else {
        format!("Request to {} failed: {error}", pretty_host(url))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalises_urls() {
        assert_eq!(openai_chat_url("http://localhost:1234"), "http://localhost:1234/v1/chat/completions");
        assert_eq!(openai_chat_url("https://api.openai.com/v1"), "https://api.openai.com/v1/chat/completions");
        assert_eq!(anthropic_url("https://api.anthropic.com"), "https://api.anthropic.com/v1/messages");
        assert_eq!(models_url("ollama", "http://localhost:11434"), "http://localhost:11434/api/tags");
    }

    #[test]
    fn parses_ollama_models() {
        let body = r#"{"models":[{"name":"llama3.2:latest"},{"name":"qwen2.5-coder"}]}"#;
        assert_eq!(parse_models("ollama", body), vec!["llama3.2:latest", "qwen2.5-coder"]);
    }

    #[test]
    fn parses_sse_deltas() {
        let mut accumulator = Accumulator::default();
        let mut emitted = String::new();
        ingest_sse_event(
            "data: {\"choices\":[{\"delta\":{\"content\":\"hi\"},\"finish_reason\":null}]}",
            &mut accumulator,
            &mut emitted,
        )
        .unwrap();
        assert_eq!(emitted, "hi");
        assert_eq!(accumulator.content, "hi");
    }

    #[test]
    fn parses_anthropic_events() {
        let mut accumulator = Accumulator::default();
        let mut emitted = String::new();
        ingest_sse_event(
            "event: content_block_delta\ndata: {\"type\":\"content_block_delta\",\"delta\":{\"type\":\"text_delta\",\"text\":\"hello\"}}",
            &mut accumulator,
            &mut emitted,
        )
        .unwrap();
        assert_eq!(accumulator.content, "hello");
    }
}
