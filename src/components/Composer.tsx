import { useEffect, useRef, type MutableRefObject } from "react";
import { useApp } from "@/state/AppState";
import {
  CodePanel,
  Folder,
  PROVIDER_ICONS,
  Send,
  Settings,
  Sparkles,
  Stop,
} from "@/components/Icons";
import { cn, modKey, truncate } from "@/lib/utils";

interface ComposerProps {
  draft: string;
  setDraft: React.Dispatch<React.SetStateAction<string>>;
  onOpenModels: () => void;
  onOpenSettings: () => void;
  onToggleCanvas: () => void;
  inputRef: MutableRefObject<HTMLTextAreaElement | null>;
}

export function Composer({
  draft,
  setDraft,
  onOpenModels,
  onOpenSettings,
  onToggleCanvas,
  inputRef,
}: ComposerProps) {
  const {
    sendMessage,
    stopStreaming,
    generating,
    activeProvider,
    activeSession,
    activeWorkspace,
    settings,
    store,
    notify,
  } = useApp();
  const localRef = useRef<HTMLTextAreaElement | null>(null);
  const ProviderIcon = activeProvider ? PROVIDER_ICONS[activeProvider.kind] : PROVIDER_ICONS.ollama;
  const model = activeSession?.model || activeProvider?.model || "";

  useEffect(() => {
    const node = inputRef.current ?? localRef.current;
    if (!node) return;
    node.style.height = "0px";
    node.style.height = `${Math.min(node.scrollHeight, 200)}px`;
  }, [draft, inputRef]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [inputRef, activeSession?.id]);

  const submit = async () => {
    if (generating) {
      stopStreaming();
      return;
    }
    const value = draft;
    if (!value.trim()) return;
    // Clear immediately for snappy UX; restore only if the send was rejected.
    setDraft("");
    const result = await sendMessage(value);
    if (!result.ok) {
      setDraft((current) => (current ? current : value));
      if (result.error) notify(result.error, "error");
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter") return;
    if (generating) return;
    const withModifier = event.metaKey || event.ctrlKey;
    const shouldSend = settings.sendOnEnter ? !event.shiftKey : withModifier;
    if (shouldSend) {
      event.preventDefault();
      void submit();
    }
  };

  const online = Object.values(store.providers).length > 0;

  return (
    <div className="shrink-0 border-t border-line/60 bg-gradient-to-t from-ink-950/90 to-ink-900/40 px-4 pb-3.5 pt-3 backdrop-blur-sm">
      <div className="mx-auto w-full max-w-[820px]">
        <div
          className={cn(
            "group relative rounded-xl border bg-ink-850/85 shadow-inset transition duration-200",
            generating
              ? "border-mint-500/35 shadow-[0_0_0_1px_rgba(92,232,180,0.12),0_0_34px_-16px_rgba(92,232,180,0.55)]"
              : "border-line focus-within:border-mint-500/40 focus-within:shadow-[0_0_0_1px_rgba(92,232,180,0.1),0_0_30px_-18px_rgba(92,232,180,0.5)]",
          )}
        >
          <textarea
            ref={(node) => {
              localRef.current = node;
              inputRef.current = node;
            }}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            spellCheck={false}
            placeholder={
              generating
                ? "Streaming… press Esc or the stop button to interrupt"
                : "Ask for code, a refactor, a debugging plan…"
            }
            className="block max-h-[200px] w-full resize-none bg-transparent px-3.5 pb-1 pt-3 text-[13px] leading-relaxed text-haze-100 outline-none placeholder:text-haze-600"
            aria-label="Message composer"
          />

          <div className="flex items-center gap-1.5 px-2.5 pb-2 pt-1">
            <button
              type="button"
              onClick={onOpenModels}
              title={`Switch model (${modKey()}+K)`}
              className="flex h-7 max-w-[220px] items-center gap-1.5 rounded-md border border-line/80 bg-ink-900/80 px-2 text-[10.5px] text-haze-300 transition hover:border-line-bright hover:text-haze-100"
            >
              <ProviderIcon size={12} className="text-mint-400/90" />
              <span className="truncate">{truncate(model || "select model", 26)}</span>
            </button>

            <span
              className="hidden items-center gap-1 rounded-md border border-line/60 px-1.5 py-1 font-mono text-[9.5px] text-haze-600 sm:flex"
              title="Sampling temperature"
            >
              T {activeProvider?.temperature?.toFixed(2) ?? "0.70"}
            </span>

            {activeWorkspace && (
              <span
                className="hidden max-w-[180px] items-center gap-1 rounded-md border border-line/60 px-1.5 py-1 text-[9.5px] text-haze-500 md:flex"
                title={activeWorkspace.path}
              >
                <Folder size={10} className="text-mint-400/60" />
                <span className="truncate">{activeWorkspace.name}</span>
              </span>
            )}

            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={onToggleCanvas}
                className={cn("icon-btn h-7 w-7", settings.artifactPanelOpen && "text-mint-300")}
                title="Toggle code canvas"
                aria-label="Toggle code canvas"
              >
                <CodePanel size={15} />
              </button>
              <button
                type="button"
                onClick={onOpenSettings}
                className="icon-btn h-7 w-7"
                title="Provider settings"
                aria-label="Provider settings"
              >
                <Settings size={15} />
              </button>

              <button
                type="button"
                onClick={() => void submit()}
                disabled={!generating && !draft.trim()}
                className={cn(
                  "ml-1 flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40",
                  generating
                    ? "border border-ember-500/40 bg-ember-500/10 text-ember-400 hover:bg-ember-500/20"
                    : "bg-mint-400 text-ink-950 hover:bg-mint-300 shadow-[0_0_22px_-8px_rgba(92,232,180,0.8)]",
                )}
                aria-label={generating ? "Stop generating" : "Send message"}
              >
                {generating ? <Stop size={14} /> : <Send size={14} />}
                <span className="hidden sm:inline">{generating ? "Stop" : "Send"}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-1.5 flex items-center gap-3 px-1 text-[9.5px] text-haze-600">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-line/80 bg-ink-900 px-1 font-mono text-[9px] text-haze-500">
              Enter
            </kbd>
            send
            <kbd className="ml-1 rounded border border-line/80 bg-ink-900 px-1 font-mono text-[9px] text-haze-500">
              Shift+Enter
            </kbd>
            newline
          </span>
          <span className="hidden items-center gap-1 sm:flex">
            <kbd className="rounded border border-line/80 bg-ink-900 px-1 font-mono text-[9px] text-haze-500">
              Esc
            </kbd>
            stop
          </span>
          <span className="ml-auto flex items-center gap-1">
            <Sparkles size={10} className={online ? "text-mint-400/60" : "text-haze-600"} />
            {settings.streamResponses ? "native streaming" : "buffered mode"}
            <span className="text-haze-700">·</span>
            <span className="font-mono">{draft.length} chars</span>
          </span>
        </div>
      </div>
    </div>
  );
}
