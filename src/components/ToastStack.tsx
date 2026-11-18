import { Alert, Check, Close, Info, ThinkingPulse } from "@/components/Icons";
import { useApp } from "@/state/AppState";
import { cn } from "@/lib/utils";

const TONE = {
  info: { icon: Info, ring: "border-line-bright", color: "text-haze-200" },
  success: { icon: Check, ring: "border-mint-500/40", color: "text-mint-300" },
  error: { icon: Alert, ring: "border-ember-500/40", color: "text-ember-400" },
} as const;

export function ToastStack() {
  const { toasts, dismissToast } = useApp();

  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-[min(360px,calc(100vw-40px))] flex-col gap-2">
      {toasts.map((toast) => {
        const tone = TONE[toast.tone];
        const Icon = tone.icon;
        return (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto flex items-start gap-2.5 rounded-xl border bg-ink-850/95 px-3.5 py-3 shadow-panel backdrop-blur animate-fade-up",
              tone.ring,
            )}
          >
            <span className={cn("mt-0.5", tone.color)}>
              <Icon size={15} />
            </span>
            <p className="flex-1 text-xs leading-relaxed text-haze-200">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="icon-btn -mr-1 -mt-1 h-6 w-6"
              aria-label="Dismiss notification"
            >
              <Close size={11} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function ThinkingIndicator({ label = "Thinking" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-haze-400">
      <span className="flex h-6 w-6 items-center justify-center rounded-md border border-mint-500/25 bg-mint-500/[0.07]">
        <ThinkingPulse size={14} />
      </span>
      <span className="shimmer-text font-medium">{label}</span>
      <span className="flex items-end gap-[3px] pb-0.5" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="h-1 w-1 rounded-full bg-mint-400/80 animate-pulse-soft"
            style={{ animationDelay: `${index * 160}ms` }}
          />
        ))}
      </span>
    </div>
  );
}
