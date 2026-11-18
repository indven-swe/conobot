/**
 * Frontend wrapper around the native Rust LLM bridge.
 *
 * In Tauri: `start_chat_stream` runs the HTTP request in Rust and emits
 * `llm:chunk` / `llm:done` / `llm:error` events — no CORS, real cancellation.
 *
 * In a plain browser (`npm run dev`): a fetch-based fallback keeps the UI
 * usable for design work. Local servers must allow the dev origin in that mode.
 */
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  ChatTurn,
  ConnectionReport,
  ProviderProfile,
  StreamChunkEvent,
  StreamDoneEvent,
  StreamErrorEvent,
} from "@/types";
import { makeId } from "@/lib/providers";
import { isTauri } from "@/lib/utils";

export interface StreamChatOptions {
  profile: ProviderProfile;
  model: string;
  messages: ChatTurn[];
  systemPrompt?: string;
  onDelta: (delta: string) => void;
  signal?: AbortSignal;
}

export interface StreamChatResult {
  content: string;
  model: string | null;
}

export class LlmError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "LlmError";
    this.code = code;
  }
}

interface NativeChatRequest {
  requestId: string;
  provider: ProviderProfile;
  model: string;
  messages: ChatTurn[];
  systemPrompt: string | null;
  temperature: number;
  maxTokens: number;
}

function normaliseBase(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

function openAiCompletionsUrl(baseUrl: string): string {
  const base = normaliseBase(baseUrl);
  return /\/v1$/i.test(base) ? `${base}/chat/completions` : `${base}/v1/chat/completions`;
}

function anthropicUrl(baseUrl: string): string {
  const base = normaliseBase(baseUrl);
  return /\/v1$/i.test(base) ? `${base}/messages` : `${base}/v1/messages`;
}

/** Probe an endpoint and return its model catalogue. */
export async function testConnection(profile: ProviderProfile): Promise<ConnectionReport> {
  if (isTauri()) {
    try {
      return await invoke<ConnectionReport>("test_connection", { profile });
    } catch (error) {
      return {
        ok: false,
        latencyMs: 0,
        models: [],
        error: error instanceof Error ? error.message : String(error),
        detail: null,
      };
    }
  }
  return browserTestConnection(profile);
}

export async function discoverModels(profile: ProviderProfile): Promise<string[]> {
  const report = await testConnection(profile);
  return report.models;
}

/** Start a streamed completion. Resolves once the model finishes. */
export async function streamChat(options: StreamChatOptions): Promise<StreamChatResult> {
  if (!options.model.trim()) {
    throw new LlmError("Select a model before sending a message.", "NO_MODEL");
  }
  if (isTauri()) return nativeStream(options);
  return browserStream(options);
}

export async function stopGeneration(requestId: string): Promise<void> {
  if (!isTauri()) return;
  try {
    await invoke("stop_generation", { requestId });
  } catch {
    /* the stream may already be finished */
  }
}

/* ------------------------------------------------------------------ */
/*  Native (Tauri) transport                                          */
/* ------------------------------------------------------------------ */

async function nativeStream(options: StreamChatOptions): Promise<StreamChatResult> {
  const requestId = makeId("req");
  const unlisteners: UnlistenFn[] = [];
  let settled = false;
  let emitted = "";

  const request: NativeChatRequest = {
    requestId,
    provider: options.profile,
    model: options.model,
    messages: options.messages,
    systemPrompt: options.systemPrompt?.trim() ? options.systemPrompt : null,
    temperature: options.profile.temperature,
    maxTokens: options.profile.maxTokens,
  };

  return new Promise<StreamChatResult>((resolve, reject) => {
    const cleanup = () => {
      while (unlisteners.length) {
        const off = unlisteners.pop();
        try {
          off?.();
        } catch {
          /* ignore */
        }
      }
      options.signal?.removeEventListener("abort", onAbort);
    };

    const finish = (result: StreamChatResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const onAbort = () => {
      void stopGeneration(requestId);
      finish({ content: emitted, model: options.model });
    };

    if (options.signal?.aborted) {
      fail(new LlmError("Generation cancelled.", "ABORTED"));
      return;
    }
    options.signal?.addEventListener("abort", onAbort);

    void (async () => {
      try {
        unlisteners.push(
          await listen<StreamChunkEvent>("llm:chunk", (event) => {
            if (event.payload.requestId !== requestId) return;
            emitted += event.payload.delta;
            options.onDelta(event.payload.delta);
          }),
        );
        unlisteners.push(
          await listen<StreamDoneEvent>("llm:done", (event) => {
            if (event.payload.requestId !== requestId) return;
            const content = event.payload.content || emitted;
            if (content.length > emitted.length) {
              options.onDelta(content.slice(emitted.length));
            }
            finish({ content, model: event.payload.model ?? options.model });
          }),
        );
        unlisteners.push(
          await listen<StreamErrorEvent>("llm:error", (event) => {
            if (event.payload.requestId !== requestId) return;
            fail(new LlmError(event.payload.message || "The provider returned an error."));
          }),
        );

        await invoke("start_chat_stream", { request });
      } catch (error) {
        fail(
          error instanceof Error
            ? error
            : new LlmError(typeof error === "string" ? error : "Failed to reach the native bridge."),
        );
      }
    })();
  });
}

/* ------------------------------------------------------------------ */
/*  Browser fallback (development only)                               */
/* ------------------------------------------------------------------ */

async function browserTestConnection(profile: ProviderProfile): Promise<ConnectionReport> {
  const started = performance.now();
  const base = normaliseBase(profile.baseUrl);
  try {
    let response: Response;
    if (profile.kind === "ollama") {
      response = await fetch(`${base}/api/tags`);
    } else if (profile.kind === "anthropic") {
      response = await fetch(`${base}/v1/models`, {
        headers: {
          "x-api-key": profile.apiKey,
          "anthropic-version": "2023-06-01",
        },
      });
    } else {
      response = await fetch(`${base}${/\/v1$/i.test(base) ? "" : "/v1"}/models`, {
        headers: profile.apiKey ? { Authorization: `Bearer ${profile.apiKey}` } : undefined,
      });
    }
    const latencyMs = Math.round(performance.now() - started);
    if (!response.ok) {
      return {
        ok: false,
        latencyMs,
        models: [],
        error: `HTTP ${response.status} ${response.statusText}`,
        detail: "Browser fallback mode",
      };
    }
    const payload = (await response.json()) as Record<string, unknown>;
    const models = extractModels(profile, payload);
    return {
      ok: true,
      latencyMs,
      models,
      error: null,
      detail: "Browser fallback mode · CORS must be enabled on the endpoint",
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Math.round(performance.now() - started),
      models: [],
      error: error instanceof Error ? error.message : String(error),
      detail: "Browser fallback mode",
    };
  }
}

function extractModels(profile: ProviderProfile, payload: Record<string, unknown>): string[] {
  if (profile.kind === "ollama") {
    const models = Array.isArray(payload.models) ? payload.models : [];
    return models
      .map((entry) => (entry && typeof entry === "object" ? String((entry as { name?: string }).name ?? "") : ""))
      .filter(Boolean);
  }
  const data = Array.isArray(payload.data) ? payload.data : [];
  return data
    .map((entry) => (entry && typeof entry === "object" ? String((entry as { id?: string }).id ?? "") : ""))
    .filter(Boolean);
}

async function browserStream(options: StreamChatOptions): Promise<StreamChatResult> {
  const { profile, model, messages, systemPrompt } = options;
  const base = normaliseBase(profile.baseUrl);
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort);

  let url = "";
  let headers: Record<string, string> = { "Content-Type": "application/json" };
  let body: Record<string, unknown>;

  if (profile.kind === "ollama") {
    url = `${base}/api/chat`;
    body = {
      model,
      stream: true,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      options: { temperature: profile.temperature, num_predict: profile.maxTokens },
    };
  } else if (profile.kind === "anthropic") {
    url = anthropicUrl(profile.baseUrl);
    headers = {
      ...headers,
      "x-api-key": profile.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    };
    body = {
      model,
      max_tokens: profile.maxTokens,
      temperature: profile.temperature,
      stream: true,
      system: systemPrompt || undefined,
      messages: messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content })),
    };
  } else {
    url = openAiCompletionsUrl(profile.baseUrl);
    if (profile.apiKey) headers.Authorization = `Bearer ${profile.apiKey}`;
    body = {
      model,
      stream: true,
      temperature: profile.temperature,
      max_tokens: profile.maxTokens,
      messages: [
        ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    };
  }

  let content = "";
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok || !response.body) {
      const text = await response.text().catch(() => "");
      throw new LlmError(
        `HTTP ${response.status} ${response.statusText}${text ? ` — ${text.slice(0, 400)}` : ""}`,
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      if (profile.kind === "ollama") {
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const parsed = JSON.parse(line) as { message?: { content?: string }; error?: string };
          if (parsed.error) throw new LlmError(parsed.error);
          if (parsed.message?.content) {
            content += parsed.message.content;
            options.onDelta(parsed.message.content);
          }
        }
        continue;
      }

      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const event of events) {
        for (const line of event.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (!data || data === "[DONE]") continue;
          const parsed = JSON.parse(data) as {
            type?: string;
            delta?: { text?: string; content?: string; type?: string };
            choices?: Array<{ delta?: { content?: string } }>;
            error?: { message?: string };
          };
          if (parsed.error) throw new LlmError(parsed.error.message ?? "Provider error");
          const delta =
            parsed.type === "content_block_delta"
              ? parsed.delta?.text ?? ""
              : parsed.choices?.[0]?.delta?.content ?? "";
          if (delta) {
            content += delta;
            options.onDelta(delta);
          }
        }
      }
    }
    return { content, model };
  } finally {
    options.signal?.removeEventListener("abort", abort);
  }
}
