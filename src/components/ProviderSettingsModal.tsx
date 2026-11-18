import { useEffect, useMemo, useState } from "react";
import type { ConnectionReport, ProviderKind, ProviderProfile } from "@/types";
import { Modal } from "@/components/ui/Modal";
import {
  Alert,
  Check,
  ChevronDown,
  Close,
  Delete,
  Globe,
  Info,
  Key,
  Lock,
  PROVIDER_ICONS,
  ProviderKey,
  Plus,
  Refresh,
  Settings,
  Sparkles,
} from "@/components/Icons";
import { useApp } from "@/state/AppState";
import { testConnection } from "@/services/llmClient";
import { PROVIDER_KIND_ORDER, PROVIDER_PRESETS, createProvider, hostOf } from "@/lib/providers";
import { cn, modKey } from "@/lib/utils";

interface ProviderSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

interface TestResult {
  report: ConnectionReport;
  at: number;
}

export function ProviderSettingsModal({ open, onClose }: ProviderSettingsModalProps) {
  const {
    store,
    connections,
    upsertProvider,
    deleteProvider,
    notify,
    refreshAllConnections,
    activeSession,
    patchSession,
  } = useApp();
  const [selectedId, setSelectedId] = useState<string>(store.providers[0]?.id ?? "");
  const [draft, setDraft] = useState<ProviderProfile | null>(store.providers[0] ?? null);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<TestResult | null>(null);
  const [revealKey, setRevealKey] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [dirty, setDirty] = useState(false);

  const providers = store.providers;
  const selected = useMemo(
    () => providers.find((provider) => provider.id === selectedId) ?? providers[0] ?? null,
    [providers, selectedId],
  );

  useEffect(() => {
    if (!open) return;
    if (!providers.length) {
      const created = createProvider("ollama");
      upsertProvider(created);
      setSelectedId(created.id);
      return;
    }
    if (!providers.some((provider) => provider.id === selectedId)) {
      setSelectedId(providers[0].id);
    }
  }, [open, providers, selectedId, upsertProvider]);

  useEffect(() => {
    setDraft(selected);
    setDirty(false);
    setRevealKey(false);
    setTest(null);
  }, [selected]);

  const patchDraft = (patch: Partial<ProviderProfile>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
    setDirty(true);
  };

  const addProvider = (kind: ProviderKind) => {
    const preset = PROVIDER_PRESETS[kind];
    const count = providers.filter((provider) => provider.kind === kind).length;
    const provider = createProvider(kind, {
      label: count ? `${preset.label} ${count + 1}` : preset.label,
      enabled: true,
    });
    upsertProvider(provider);
    setSelectedId(provider.id);
    notify(`${provider.label} endpoint added.`, "success");
  };

  const save = () => {
    if (!draft) return;
    const label = draft.label.trim() || PROVIDER_PRESETS[draft.kind].label;
    upsertProvider({
      ...draft,
      label,
      baseUrl: draft.baseUrl.trim(),
      model: draft.model.trim(),
      apiKey: draft.apiKey.trim(),
    });
    if (activeSession && activeSession.providerId === draft.id && !activeSession.model && draft.model) {
      patchSession(activeSession.id, { model: draft.model });
    }
    setDirty(false);
    notify(`${label} saved.`, "success");
  };

  const runTest = async () => {
    if (!draft) return;
    setTesting(true);
    setTest(null);
    try {
      const report = await testConnection({ ...draft, baseUrl: draft.baseUrl.trim() });
      setTest({ report, at: Date.now() });
      if (report.ok && report.models.length) {
        setDraft((current) =>
          current
            ? { ...current, models: report.models, model: current.model || report.models[0] }
            : current,
        );
        setDirty(true);
      }
    } finally {
      setTesting(false);
    }
  };

  const remove = () => {
    if (!draft || providers.length <= 1) {
      notify("Keep at least one endpoint configured.", "info");
      return;
    }
    const next = providers.find((provider) => provider.id !== draft.id);
    deleteProvider(draft.id);
    if (next) setSelectedId(next.id);
    notify(`${draft.label} removed.`, "info");
  };

  const ProviderIcon = draft ? PROVIDER_ICONS[draft.kind] : Settings;
  const preset = draft ? PROVIDER_PRESETS[draft.kind] : PROVIDER_PRESETS.ollama;
  const connection = draft ? connections[draft.id] : undefined;
  const requiresKey = draft?.kind === "anthropic";
  const supportsKey = draft?.kind === "anthropic" || draft?.kind === "openai";
  const discovered = useMemo(() => {
    const merged = [...(test?.report.models ?? []), ...(connection?.models ?? []), ...(draft?.models ?? [])];
    return [...new Set(merged.filter(Boolean))];
  }, [test, connection, draft?.models]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      label="Provider and endpoint settings"
      className="h-[680px] max-w-[940px]"
      hideClose
    >
      <div className="flex min-h-0 flex-1">
        {/* ---------------- left rail ---------------- */}
        <div className="flex w-[248px] shrink-0 flex-col border-r border-line bg-ink-950/40">
          <div className="flex h-12 items-center gap-2 border-b border-line px-4">
            <Settings size={15} className="text-mint-400/80" />
            <span className="text-[12px] font-semibold tracking-tight text-haze-100">Endpoints</span>
            <span className="ml-auto font-mono text-[10px] text-haze-600">{providers.length}</span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {providers.map((provider) => {
              const Icon = PROVIDER_ICONS[provider.kind];
              const state = connections[provider.id]?.state ?? "unknown";
              const active = provider.id === selected?.id;
              return (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => setSelectedId(provider.id)}
                  className={cn(
                    "group relative mb-0.5 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition",
                    active ? "bg-white/[0.06]" : "hover:bg-white/[0.025]",
                  )}
                >
                  {active && (
                    <span className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-mint-400" />
                  )}
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border",
                      active
                        ? "border-mint-500/25 bg-mint-500/[0.08] text-mint-300"
                        : "border-line bg-ink-900 text-haze-400",
                    )}
                  >
                    <Icon size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "truncate text-[11.5px] font-medium",
                          active ? "text-haze-100" : "text-haze-300",
                        )}
                      >
                        {provider.label}
                      </span>
                      {!provider.enabled && (
                        <span className="rounded bg-ink-800 px-1 text-[8.5px] text-haze-600">off</span>
                      )}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 font-mono text-[9px] text-haze-600">
                      <span
                        className={cn(
                          "h-1 w-1 rounded-full",
                          state === "online"
                            ? "bg-mint-400"
                            : state === "checking"
                              ? "bg-iris-400"
                              : "bg-haze-600",
                        )}
                      />
                      <span className="truncate">{hostOf(provider.baseUrl)}</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="border-t border-line p-2">
            <p className="label-xs px-2 pb-1.5">Add endpoint</p>
            <div className="grid grid-cols-2 gap-1">
              {PROVIDER_KIND_ORDER.map((kind) => {
                const Icon = PROVIDER_ICONS[kind];
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => addProvider(kind)}
                    className="flex items-center gap-1.5 rounded-md border border-line/70 bg-ink-900/60 px-1.5 py-1.5 text-[10px] text-haze-400 transition hover:border-mint-500/30 hover:text-mint-300"
                    title={`Add ${PROVIDER_PRESETS[kind].label} endpoint`}
                  >
                    <Icon size={12} />
                    <span className="truncate">{PROVIDER_PRESETS[kind].label}</span>
                    <Plus size={9} className="ml-auto text-haze-600" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ---------------- form ---------------- */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-12 shrink-0 items-center gap-3 border-b border-line px-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-mint-500/25 bg-gradient-to-br from-mint-500/[0.12] to-iris-500/[0.06] text-mint-300">
              <ProviderIcon size={17} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-haze-100">
                {draft?.label ?? "Provider"}
              </p>
              <p className="text-[10px] text-haze-600">
                {preset.blurb}
                {draft?.kind === "anthropic" && " · key required"}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="chip py-0.5 text-[9.5px] font-mono uppercase tracking-wide">
                {draft?.kind ?? "—"}
              </span>
              <button type="button" onClick={onClose} className="icon-btn h-7 w-7" aria-label="Close">
                <Close size={14} />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {!draft ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <Sparkles size={22} className="text-haze-600" />
                <p className="text-xs text-haze-400">Add an endpoint to get started.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-[1fr_auto] items-end gap-3">
                  <label className="block">
                    <span className="label-xs">Display name</span>
                    <input
                      value={draft.label}
                      onChange={(event) => patchDraft({ label: event.target.value })}
                      className="field mt-1.5 font-sans text-[12.5px]"
                      placeholder="My endpoint"
                    />
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-ink-850/60 px-3 py-2">
                    <span className="text-[11px] text-haze-400">Enabled</span>
                    <input
                      type="checkbox"
                      checked={draft.enabled}
                      onChange={(event) => patchDraft({ enabled: event.target.checked })}
                      className="peer sr-only"
                    />
                    <span
                      className={cn(
                        "relative h-4 w-7 rounded-full border transition",
                        draft.enabled
                          ? "border-mint-500/40 bg-mint-500/30"
                          : "border-line bg-ink-800",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full transition-all",
                          draft.enabled
                            ? "left-3.5 bg-mint-300 shadow-[0_0_8px_rgba(92,232,180,0.8)]"
                            : "left-0.5 bg-haze-600",
                        )}
                      />
                    </span>
                  </label>
                </div>

                <label className="block">
                  <span className="flex items-center gap-1.5">
                    <span className="label-xs flex items-center gap-1">
                      <Globe size={11} /> Base URL
                    </span>
                    <span className="ml-auto font-mono text-[9.5px] text-haze-600">
                      {hostOf(draft.baseUrl)}
                    </span>
                  </span>
                  <input
                    value={draft.baseUrl}
                    onChange={(event) => patchDraft({ baseUrl: event.target.value })}
                    className="field mt-1.5"
                    placeholder={preset.placeholder}
                    spellCheck={false}
                  />
                  <span className="mt-1 block text-[10px] leading-relaxed text-haze-600">
                    {draft.kind === "ollama" && "Ollama root URL — ConoBot appends /api/chat and /api/tags."}
                    {draft.kind === "lmstudio" && "LM Studio server root — ConoBot appends /v1/chat/completions."}
                    {draft.kind === "anthropic" && "Claude root URL — ConoBot appends /v1/messages."}
                    {draft.kind === "openai" && "Any OpenAI-compatible root. A trailing /v1 is detected automatically."}
                  </span>
                </label>

                {supportsKey && (
                  <label className="block">
                    <span className="flex items-center gap-1.5">
                      <span className="label-xs flex items-center gap-1">
                        <Key size={11} /> API key
                      </span>
                      {requiresKey && !draft.apiKey && (
                        <span className="flex items-center gap-1 text-[9.5px] text-ember-400">
                          <Alert size={10} /> required
                        </span>
                      )}
                      <span className="ml-auto flex items-center gap-1 text-[9.5px] text-haze-600">
                        <Lock size={9} /> local only
                      </span>
                    </span>
                    <div className="relative mt-1.5">
                      <input
                        type={revealKey ? "text" : "password"}
                        value={draft.apiKey}
                        onChange={(event) => patchDraft({ apiKey: event.target.value })}
                        className="field pr-16"
                        placeholder={draft.kind === "anthropic" ? "sk-ant-…" : "optional bearer token"}
                        spellCheck={false}
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={() => setRevealKey((value) => !value)}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 font-mono text-[9.5px] text-haze-500 hover:text-haze-200"
                      >
                        {revealKey ? "hide" : "show"}
                      </button>
                    </div>
                    <span className="mt-1 flex items-start gap-1 text-[10px] leading-relaxed text-haze-600">
                      <Info size={10} className="mt-0.5 shrink-0" />
                      Stored in the local app-data store and sent only to this endpoint. Local
                      servers can leave this blank.
                    </span>
                  </label>
                )}

                <div>
                  <div className="flex items-center gap-2">
                    <span className="label-xs">Model</span>
                    <button
                      type="button"
                      onClick={() => void runTest()}
                      disabled={testing}
                      className="ml-auto flex items-center gap-1 rounded-md border border-line bg-ink-850 px-2 py-1 text-[10px] text-haze-400 transition hover:border-line-bright hover:text-haze-100 disabled:opacity-50"
                    >
                      <Refresh size={11} className={testing ? "animate-spin" : ""} />
                      {testing ? "probing…" : "discover"}
                    </button>
                  </div>
                  <input
                    value={draft.model}
                    onChange={(event) => patchDraft({ model: event.target.value })}
                    className="field mt-1.5"
                    placeholder="model id, e.g. llama3.2 or claude-sonnet-4-5"
                    spellCheck={false}
                    list={`models-${draft.id}`}
                  />
                  <datalist id={`models-${draft.id}`}>
                    {discovered.map((model) => (
                      <option key={model} value={model} />
                    ))}
                  </datalist>

                  {discovered.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {discovered.slice(0, 12).map((model) => (
                        <button
                          key={model}
                          type="button"
                          onClick={() => patchDraft({ model })}
                          className={cn(
                            "rounded-md border px-1.5 py-0.5 font-mono text-[9.5px] transition",
                            draft.model === model
                              ? "border-mint-500/40 bg-mint-500/[0.08] text-mint-300"
                              : "border-line bg-ink-900/60 text-haze-500 hover:border-line-bright hover:text-haze-200",
                          )}
                        >
                          {model}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-line bg-ink-950/40 p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-haze-300">Connection</span>
                    <span
                      className={cn(
                        "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9.5px]",
                        testing
                          ? "border-iris-500/30 text-iris-300"
                          : test?.report.ok
                            ? "border-mint-500/30 text-mint-300"
                            : test
                              ? "border-ember-500/30 text-ember-400"
                              : "border-line text-haze-500",
                      )}
                    >
                      <span
                        className={cn(
                          "h-1 w-1 rounded-full",
                          testing
                            ? "bg-iris-400 animate-pulse"
                            : test?.report.ok
                              ? "bg-mint-400"
                              : test
                                ? "bg-ember-400"
                                : "bg-haze-600",
                        )}
                      />
                      {testing
                        ? "testing"
                        : test
                          ? test.report.ok
                            ? `online · ${test.report.latencyMs}ms`
                            : "unreachable"
                          : connection?.state ?? "not tested"}
                    </span>
                    <button
                      type="button"
                      onClick={() => void runTest()}
                      disabled={testing}
                      className="btn-outline ml-auto h-6 px-2 text-[10px]"
                    >
                      Test connection
                    </button>
                  </div>

                  {test ? (
                    <div className="mt-2 space-y-1 text-[10.5px] leading-relaxed">
                      {test.report.ok ? (
                        <p className="flex items-center gap-1.5 text-mint-300">
                          <Check size={12} />
                          {test.report.models.length} model
                          {test.report.models.length === 1 ? "" : "s"} reported by the endpoint.
                        </p>
                      ) : (
                        <p className="break-words font-mono text-[10px] text-ember-400/90">
                          {test.report.error ?? "No response."}
                        </p>
                      )}
                      {test.report.detail && (
                        <p className="font-mono text-[9.5px] text-haze-600">{test.report.detail}</p>
                      )}
                      {!test.report.ok && (
                        <p className="text-haze-500">
                          {draft.kind === "ollama" || draft.kind === "lmstudio"
                            ? "Is the local server running? Start it, then test again."
                            : "Verify the base URL, key and account access."}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-1.5 text-[10.5px] leading-relaxed text-haze-600">
                      {requiresKey
                        ? "Enter a key to probe the Messages API."
                        : "Probe the endpoint to discover available models before saving."}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setAdvanced((value) => !value)}
                  className="flex w-full items-center gap-1.5 text-[10.5px] text-haze-500 transition hover:text-haze-200"
                >
                  <ChevronDown
                    size={12}
                    className={cn("transition", advanced && "rotate-180")}
                  />
                  Advanced sampling & instructions
                </button>

                {advanced && (
                  <div className="grid animate-fade-up gap-3 rounded-xl border border-line bg-ink-950/30 p-3">
                    <label className="block">
                      <span className="flex items-center justify-between text-[10px] text-haze-500">
                        <span>Temperature</span>
                        <span className="font-mono text-haze-300">{draft.temperature.toFixed(2)}</span>
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={1.5}
                        step={0.05}
                        value={draft.temperature}
                        onChange={(event) => patchDraft({ temperature: Number(event.target.value) })}
                        className="mt-2 h-1 w-full cursor-pointer appearance-none rounded-full bg-ink-700 accent-mint-400"
                      />
                    </label>

                    <label className="block">
                      <span className="label-xs">Max output tokens</span>
                      <input
                        type="number"
                        min={128}
                        max={200_000}
                        step={128}
                        value={draft.maxTokens}
                        onChange={(event) => patchDraft({ maxTokens: Number(event.target.value) || 4096 })}
                        className="field mt-1.5"
                      />
                    </label>

                    <label className="block">
                      <span className="label-xs">Endpoint system prompt</span>
                      <textarea
                        value={draft.systemPrompt}
                        onChange={(event) => patchDraft({ systemPrompt: event.target.value })}
                        rows={3}
                        className="field mt-1.5 resize-y font-sans text-[11px] leading-relaxed"
                        placeholder="Extra instructions appended for this endpoint (optional)"
                      />
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2 border-t border-line bg-ink-950/40 px-4 py-2.5">
            <button
              type="button"
              onClick={remove}
              disabled={providers.length <= 1}
              className="flex h-7 items-center gap-1 rounded-md px-1.5 text-[10.5px] text-haze-500 transition hover:text-ember-400 disabled:opacity-30"
            >
              <Delete size={12} /> Remove
            </button>
            <button
              type="button"
              onClick={() => void refreshAllConnections()}
              className="flex h-7 items-center gap-1 rounded-md px-1.5 text-[10.5px] text-haze-500 transition hover:text-mint-300"
            >
              <Refresh size={12} /> Re-test all
            </button>
            <div className="ml-auto flex items-center gap-2">
              {dirty && <span className="text-[10px] text-iris-300/80">unsaved changes</span>}
              <button type="button" onClick={onClose} className="btn-ghost h-7 px-2.5 text-[11px]">
                Close
              </button>
              <button
                type="button"
                onClick={save}
                disabled={!draft || !dirty}
                className="btn-accent h-7 px-3 text-[11px]"
              >
                Save endpoint
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-line px-4 py-2 text-[9.5px] text-haze-600">
        <ProviderKey size={11} className="text-haze-600" />
        Keys stay on this machine · sent only to the configured base URL
        <span className="ml-auto flex items-center gap-1 font-mono">
          <kbd className="rounded border border-line bg-ink-900 px-1">{modKey()},</kbd> opens this panel
        </span>
      </div>
    </Modal>
  );
}
