import type { ProviderConnection, ProviderProfile } from "@/types";
import { cn } from "@/lib/utils";

interface ConnectionPillProps {
  provider: ProviderProfile;
  connection?: ProviderConnection;
  onClick?: () => void;
  compact?: boolean;
}

const STATE_META = {
  online: { label: "online", dot: "bg-mint-400", text: "text-mint-300/90", glow: "shadow-[0_0_10px_rgba(92,232,180,0.8)]" },
  checking: { label: "linking", dot: "bg-iris-400", text: "text-iris-300/90", glow: "shadow-[0_0_10px_rgba(139,149,255,0.8)]" },
  offline: { label: "offline", dot: "bg-ember-500", text: "text-ember-400/90", glow: "" },
  error: { label: "no key", dot: "bg-ember-400", text: "text-ember-400/90", glow: "" },
  unknown: { label: "unknown", dot: "bg-haze-600", text: "text-haze-500", glow: "" },
} as const;

export function ConnectionPill({ provider, connection, onClick, compact }: ConnectionPillProps) {
  const state = connection?.state ?? "unknown";
  const meta = STATE_META[state];

  return (
    <button
      type="button"
      onClick={onClick}
      title={
        connection?.error
          ? `${provider.label}: ${connection.error}`
          : `${provider.label} · ${provider.baseUrl}`
      }
      className={cn(
        "group flex items-center gap-2 rounded-full border border-line bg-ink-850/70 py-1 pl-2 pr-2.5 transition hover:border-line-bright hover:bg-ink-800",
        compact && "pr-2",
      )}
    >
      <span className="relative flex h-2 w-2 items-center justify-center">
        <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot, meta.glow)} />
        {state === "checking" && (
          <span className="absolute inset-0 animate-ping rounded-full bg-iris-400/40" />
        )}
      </span>
      <span className="text-2xs font-medium tracking-tight text-haze-300">{provider.label}</span>
      {!compact && (
        <span className={cn("font-mono text-2xs tabular-nums", meta.text)}>
          {state === "online" && connection?.latencyMs != null
            ? `${connection.latencyMs}ms`
            : meta.label}
        </span>
      )}
    </button>
  );
}
