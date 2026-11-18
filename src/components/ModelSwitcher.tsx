import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import {
  Check,
  ChevronRight,
  Close,
  PROVIDER_ICONS,
  Refresh,
  Search,
  Settings,
  Sparkles,
} from "@/components/Icons";
import { useApp } from "@/state/AppState";
import { hostOf } from "@/lib/providers";
import { cn, modKey } from "@/lib/utils";

interface ModelSwitcherProps {
  open: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
}

interface Row {
  providerId: string;
  model: string;
}

export function ModelSwitcher({ open, onClose, onOpenSettings }: ModelSwitcherProps) {
  const { store, connections, activeSession, selectModel, refreshConnection, notify } = useApp();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const providers = store.providers.filter((provider) => provider.enabled || provider.id === activeSession?.providerId);

  const rows = useMemo<Row[]>(() => {
    const needle = query.trim().toLowerCase();
    return providers.flatMap((provider) => {
      const discovered = connections[provider.id]?.models ?? [];
      const models = [...new Set([...provider.models, ...discovered, provider.model].filter(Boolean))];
      return models
        .filter((model) => !needle || model.toLowerCase().includes(needle))
        .map((model) => ({ providerId: provider.id, model }));
    });
  }, [providers, connections, query]);

  const activeRowIndex = rows.findIndex(
    (row) => row.providerId === activeSession?.providerId && row.model === activeSession?.model,
  );

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setCursor(0);
    window.setTimeout(() => inputRef.current?.focus(), 40);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setCursor(activeRowIndex >= 0 ? activeRowIndex : 0);
    // Only re-seed the cursor when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-row-index="${cursor}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const choose = (row: Row) => {
    selectModel(row.providerId, row.model);
    notify(`${row.model} is now active.`, "success");
    onClose();
  };

  const useCustom = () => {
    const model = query.trim();
    if (!model) return;
    const providerId = activeSession?.providerId ?? providers[0]?.id;
    if (!providerId) {
      notify("Add a provider before choosing a model.", "error");
      return;
    }
    selectModel(providerId, model);
    notify(`Using custom model id “${model}”.`, "success");
    onClose();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((value) => Math.min(value + 1, Math.max(rows.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((value) => Math.max(value - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (rows[cursor]) choose(rows[cursor]);
      else useCustom();
    }
  };

  const refresh = async (providerId: string) => {
    const provider = store.providers.find((entry) => entry.id === providerId);
    if (!provider) return;
    setBusy(providerId);
    try {
      const connection = await refreshConnection(provider);
      notify(
        connection.state === "online"
          ? `${provider.label}: ${connection.models.length} model${connection.models.length === 1 ? "" : "s"} discovered.`
          : `${provider.label} is unreachable. Check the endpoint.`,
        connection.state === "online" ? "success" : "error",
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} label="Switch model" className="max-w-[620px]" hideClose>
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span className="text-mint-400">
          <Search size={15} />
        </span>
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setCursor(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="Search models across providers…"
          className="flex-1 bg-transparent text-[13px] text-haze-100 outline-none placeholder:text-haze-600"
        />
        <kbd className="rounded border border-line bg-ink-900 px-1.5 py-0.5 font-mono text-[10px] text-haze-500">
          {modKey()}K
        </kbd>
        <button type="button" onClick={onClose} className="icon-btn h-7 w-7" aria-label="Close">
          <Close size={13} />
        </button>
      </div>

      <div ref={listRef} className="min-h-[220px] flex-1 overflow-y-auto p-2">
        {providers.map((provider) => {
          const Icon = PROVIDER_ICONS[provider.kind];
          const connection = connections[provider.id];
          const discovered = connections[provider.id]?.models ?? [];
          const models = [...new Set([...provider.models, ...discovered, provider.model].filter(Boolean))].filter(
            (model) => !query.trim() || model.toLowerCase().includes(query.trim().toLowerCase()),
          );
          const providerRows = rows.filter((row) => row.providerId === provider.id);

          return (
            <div key={provider.id} className="mb-1.5">
              <div className="flex items-center gap-2 px-2 py-1.5">
                <span className="text-mint-400/80">
                  <Icon size={14} />
                </span>
                <span className="text-[11px] font-semibold text-haze-300">{provider.label}</span>
                <span className="font-mono text-[9.5px] text-haze-600">{hostOf(provider.baseUrl)}</span>
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    connection?.state === "online"
                      ? "bg-mint-400 shadow-[0_0_8px_rgba(92,232,180,0.8)]"
                      : connection?.state === "checking"
                        ? "bg-iris-400"
                        : "bg-haze-600",
                  )}
                  title={connection?.error ?? connection?.state ?? "unknown"}
                />
                <span className="ml-auto font-mono text-[9.5px] text-haze-600">
                  {connection?.latencyMs != null ? `${connection.latencyMs}ms` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => void refresh(provider.id)}
                  className="icon-btn h-6 w-6"
                  title="Refresh model list"
                  aria-label="Refresh model list"
                >
                  <Refresh size={12} className={busy === provider.id ? "animate-spin" : ""} />
                </button>
              </div>

              {models.length === 0 ? (
                <p className="px-3 pb-1.5 pt-0.5 text-[10.5px] text-haze-600">
                  {connection?.state === "online"
                    ? "Endpoint is online but reports no models."
                    : provider.kind === "anthropic"
                      ? "Add an API key, then refresh."
                      : "No models discovered yet — refresh after starting the server."}
                </p>
              ) : (
                <div className="space-y-0.5">
                  {models.map((model) => {
                    const row = providerRows.find((entry) => entry.model === model);
                    const index = row ? rows.indexOf(row) : -1;
                    const isActive =
                      provider.id === activeSession?.providerId && model === activeSession?.model;
                    return (
                      <button
                        key={`${provider.id}:${model}`}
                        data-row-index={index}
                        type="button"
                        onMouseEnter={() => index >= 0 && setCursor(index)}
                        onClick={() => choose({ providerId: provider.id, model })}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] transition",
                          index === cursor && "bg-white/[0.055] text-haze-100",
                          !isActive && index !== cursor && "text-haze-400",
                        )}
                      >
                        <span
                          className={cn(
                            "h-1 w-1 rounded-full",
                            isActive ? "bg-mint-400" : "bg-haze-700",
                          )}
                        />
                        <span className="truncate font-mono text-[11.5px]">{model}</span>
                        {isActive && (
                          <span className="ml-auto flex items-center gap-1 text-[9.5px] text-mint-300">
                            <Check size={11} /> active
                          </span>
                        )}
                        {!isActive && index === cursor && (
                          <span className="ml-auto text-[9.5px] text-haze-500">
                            Enter <ChevronRight size={10} className="inline" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {providers.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <Sparkles size={20} className="text-haze-600" />
            <p className="text-xs text-haze-400">No providers are enabled.</p>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSettings();
              }}
              className="btn-outline mt-1 h-7 text-[11px]"
            >
              <Settings size={12} /> Open provider settings
            </button>
          </div>
        )}

        {query.trim() && (
          <button
            type="button"
            onClick={useCustom}
            className="mt-1 flex w-full items-center gap-2 rounded-lg border border-dashed border-line px-2.5 py-2 text-left text-[11.5px] text-haze-400 transition hover:border-mint-500/30 hover:text-mint-300"
          >
            <Sparkles size={12} />
            Use custom model id
            <span className="truncate font-mono text-[11px] text-haze-200">{query.trim()}</span>
            <span className="ml-auto font-mono text-[9.5px] text-haze-600">
              {activeSession?.providerId ?? providers[0]?.id}
            </span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-[10px] text-haze-600">
        <span className="flex items-center gap-1">
          <kbd className="rounded border border-line bg-ink-900 px-1 font-mono">↑↓</kbd> navigate
        </span>
        <span className="flex items-center gap-1">
          <kbd className="rounded border border-line bg-ink-900 px-1 font-mono">↵</kbd> switch
        </span>
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenSettings();
          }}
          className="ml-auto flex items-center gap-1 text-haze-500 transition hover:text-mint-300"
        >
          <Settings size={11} /> manage endpoints
        </button>
      </div>
    </Modal>
  );
}
