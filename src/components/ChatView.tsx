import { useEffect, useRef, useState } from "react";
import { useApp } from "@/state/AppState";
import { MessageBubble } from "@/components/MessageBubble";
import {
  BrandMark,
  Bulb,
  ChevronDown,
  CodePanel,
  FileCode,
  Folder,
  PROVIDER_ICONS,
  Sparkles,
  Terminal,
} from "@/components/Icons";
import { cn } from "@/lib/utils";
import { hostOf } from "@/lib/providers";

interface ChatViewProps {
  onOpenSettings: () => void;
  onOpenModels: () => void;
  onToggleCanvas: () => void;
  onSuggestion: (text: string) => void;
  artifactCount: number;
}

const SUGGESTIONS = [
  {
    icon: Terminal,
    title: "Native Rust streaming",
    body: "Scaffold a Tauri command that streams SSE tokens into a React hook.",
    prompt:
      "Write a Tauri v2 Rust command that streams SSE tokens from an OpenAI-compatible endpoint and emits them as events. Then show the React hook that consumes them.",
  },
  {
    icon: CodePanel,
    title: "Refactor with a plan",
    body: "Turn a tangle of components into a modular, testable architecture.",
    prompt:
      "Here is a React component that has grown too large. Propose a modular file structure, then refactor it step by step with full code.",
  },
  {
    icon: FileCode,
    title: "Ship a CLI tool",
    body: "Build a fast, typed command-line utility from scratch.",
    prompt:
      "Build a TypeScript CLI that indexes a repository and prints a token-efficient summary for a language model. Include package.json, tests and usage docs.",
  },
  {
    icon: Bulb,
    title: "Debug an endpoint",
    body: "Trace a flaky API call down to its root cause.",
    prompt:
      "My local Ollama endpoint intermittently times out when streaming long responses. Walk through likely causes, then give me a diagnostic script and hardened client code.",
  },
];

export function ChatView({
  onOpenSettings,
  onOpenModels,
  onToggleCanvas,
  onSuggestion,
  artifactCount,
}: ChatViewProps) {
  const {
    activeSession,
    activeProvider,
    activeWorkspace,
    store,
    connections,
    generatingMessageId,
    regenerate,
    deleteMessage,
    generating,
  } = useApp();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [stick, setStick] = useState(true);
  const [showJump, setShowJump] = useState(false);

  const messages = activeSession?.messages ?? [];
  const lastAssistantId = [...messages].reverse().find((message) => message.role === "assistant")?.id;

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    if (!stick) {
      setShowJump(true);
      return;
    }
    node.scrollTop = node.scrollHeight;
  }, [messages, stick, generatingMessageId]);

  const onScroll = () => {
    const node = scrollRef.current;
    if (!node) return;
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
    const nearBottom = distance < 96;
    setStick(nearBottom);
    setShowJump(!nearBottom);
  };

  const jumpToLatest = () => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
    setStick(true);
  };

  const onlineLocal = store.providers.filter(
    (provider) =>
      provider.enabled &&
      (provider.kind === "ollama" || provider.kind === "lmstudio") &&
      connections[provider.id]?.state === "online",
  );

  const ProviderIcon = activeProvider ? PROVIDER_ICONS[activeProvider.kind] : PROVIDER_ICONS.ollama;

  return (
    <section className="relative flex min-w-0 flex-1 flex-col bg-transparent">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line/60 bg-ink-900/25 px-4 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-mint-400/80 shadow-[0_0_8px_rgba(92,232,180,0.8)]" />
          <h1 className="truncate text-[12px] font-medium text-haze-200">
            {activeSession?.title ?? "New conversation"}
          </h1>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {activeWorkspace && (
            <span className="chip max-w-[220px] gap-1 py-0.5 text-[10px]">
              <Folder size={11} className="text-mint-400/70" />
              <span className="truncate">{activeWorkspace.path}</span>
            </span>
          )}
          <button
            type="button"
            onClick={onOpenModels}
            className="chip gap-1 py-0.5 text-[10px] transition hover:border-line-bright hover:text-haze-100"
            title="Switch model"
          >
            <ProviderIcon size={11} className="text-mint-400/90" />
            <span className="max-w-[180px] truncate">
              {activeSession?.model || activeProvider?.model || "no model"}
            </span>
            <ChevronDown size={10} className="text-haze-600" />
          </button>
          <button
            type="button"
            onClick={onToggleCanvas}
            className={cn(
              "chip gap-1 py-0.5 text-[10px] transition hover:border-line-bright hover:text-haze-100",
              artifactCount > 0 && "border-mint-500/30 text-mint-300/90",
            )}
            title="Toggle code canvas"
          >
            <CodePanel size={11} />
            <span>Canvas</span>
            {artifactCount > 0 && (
              <span className="rounded bg-mint-500/15 px-1 font-mono text-[9px] text-mint-300">
                {artifactCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        {messages.length === 0 ? (
          <div className="mx-auto flex min-h-full w-full max-w-[760px] flex-col items-center justify-center px-6 py-12">
            <div className="relative mb-6 flex h-20 w-20 items-center justify-center">
              <span className="absolute inset-0 rounded-2xl border border-mint-500/15" />
              <span className="absolute inset-2 rounded-xl border border-iris-500/15" />
              <span className="absolute inset-0 rounded-2xl bg-mint-500/[0.07] blur-2xl" />
              <span className="relative flex h-14 w-14 items-center justify-center rounded-xl border border-mint-500/30 bg-gradient-to-br from-mint-500/[0.2] to-iris-500/[0.1] text-mint-300 shadow-[0_0_40px_-8px_rgba(92,232,180,0.5)]">
                <BrandMark size={30} />
              </span>
            </div>

            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.28em] text-mint-400/70">
              local-first · multi-provider
            </p>
            <h2 className="text-center text-[26px] font-semibold tracking-[-0.02em] text-haze-100">
              What are we shipping?
            </h2>
            <p className="mt-2 max-w-[460px] text-center text-[12.5px] leading-relaxed text-haze-500">
              ConoBot runs inference through a native Rust bridge — no CORS, no browser sandbox.
              Point it at a local model or bring your own key.
            </p>

            <div className="mt-7 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((suggestion) => {
                const Icon = suggestion.icon;
                return (
                  <button
                    key={suggestion.title}
                    type="button"
                    onClick={() => onSuggestion(suggestion.prompt)}
                    className="group flex items-start gap-3 rounded-xl border border-line bg-ink-850/50 p-3 text-left transition hover:-translate-y-px hover:border-mint-500/30 hover:bg-ink-800/70 hover:shadow-glow"
                  >
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-line bg-ink-900 text-haze-400 transition group-hover:border-mint-500/30 group-hover:text-mint-300">
                      <Icon size={14} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[12px] font-medium text-haze-200">
                        {suggestion.title}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-haze-500">
                        {suggestion.body}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
              {onlineLocal.length ? (
                onlineLocal.map((provider) => (
                  <span key={provider.id} className="chip gap-1.5 py-1 text-[10px]">
                    <span className="h-1.5 w-1.5 rounded-full bg-mint-400 shadow-[0_0_8px_rgba(92,232,180,0.9)]" />
                    {provider.label}
                    <span className="font-mono text-haze-600">{hostOf(provider.baseUrl)}</span>
                  </span>
                ))
              ) : (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="chip gap-1.5 py-1 text-[10px] text-haze-400 transition hover:border-mint-500/30 hover:text-mint-300"
                >
                  <Sparkles size={11} />
                  No local model detected — configure an endpoint
                </button>
              )}
              <span className="chip gap-1.5 py-1 text-[10px] text-haze-500">
                <ProviderIcon size={11} />
                {activeProvider?.label ?? "No provider"}
              </span>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-[820px] flex-col gap-5 px-5 py-6">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                providerLabel={
                  store.providers.find((entry) => entry.id === message.providerId)?.label ??
                  activeProvider?.label ??
                  "assistant"
                }
                isLastAssistant={message.id === lastAssistantId && !generating}
                onRegenerate={() => void regenerate()}
                onDelete={() => activeSession && deleteMessage(activeSession.id, message.id)}
                onOpenSettings={onOpenSettings}
              />
            ))}
            <div className="h-2" />
          </div>
        )}
      </div>

      {showJump && (
        <button
          type="button"
          onClick={jumpToLatest}
          className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full border border-line-bright bg-ink-800/95 px-3 py-1.5 text-[10.5px] text-haze-200 shadow-panel backdrop-blur transition hover:border-mint-500/40 hover:text-mint-300 animate-fade-up"
        >
          Jump to latest <span aria-hidden="true">↓</span>
        </button>
      )}
    </section>
  );
}
