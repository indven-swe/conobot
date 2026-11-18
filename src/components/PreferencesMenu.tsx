import { useEffect, useRef, useState } from "react";
import { Sliders } from "@/components/Icons";
import { useApp } from "@/state/AppState";
import { cn } from "@/lib/utils";

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition hover:bg-white/[0.03]"
      role="switch"
      aria-checked={checked}
    >
      <span
        className={cn(
          "mt-0.5 relative h-4 w-7 shrink-0 rounded-full border transition",
          checked ? "border-mint-500/40 bg-mint-500/30" : "border-line bg-ink-800",
        )}
      >
        <span
          className={cn(
            "absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full transition-all",
            checked
              ? "left-3.5 bg-mint-300 shadow-[0_0_8px_rgba(92,232,180,0.8)]"
              : "left-0.5 bg-haze-600",
          )}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-medium text-haze-200">{label}</span>
        <span className="mt-0.5 block text-[10px] leading-snug text-haze-600">{hint}</span>
      </span>
    </button>
  );
}

export function PreferencesMenu() {
  const { settings, updateSettings } = useApp();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] transition",
          open ? "bg-white/[0.05] text-haze-100" : "text-haze-400 hover:bg-white/[0.025] hover:text-haze-200",
        )}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Sliders size={14} className="text-haze-500" />
        <span className="flex-1 text-left">Preferences</span>
        <span className="font-mono text-[9px] text-haze-600">stream · input</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Workspace preferences"
          className="absolute bottom-full left-0 right-0 z-40 mb-1.5 animate-fade-up rounded-xl border border-line bg-ink-850/98 p-2 shadow-panel backdrop-blur-xl"
        >
          <p className="label-xs px-1.5 pb-1">Workspace</p>
          <Toggle
            checked={settings.streamResponses}
            onChange={(streamResponses) => updateSettings({ streamResponses })}
            label="Native token streaming"
            hint="Render tokens as they arrive instead of buffering."
          />
          <Toggle
            checked={settings.sendOnEnter}
            onChange={(sendOnEnter) => updateSettings({ sendOnEnter })}
            label="Enter sends message"
            hint="Off: Enter adds a newline, Cmd/Ctrl+Enter sends."
          />
          <Toggle
            checked={settings.artifactPanelOpen}
            onChange={(artifactPanelOpen) => updateSettings({ artifactPanelOpen })}
            label="Code canvas"
            hint="Show the side-by-side artifact panel."
          />
          <div className="mt-1.5 border-t border-line/70 px-1.5 pt-2">
            <label className="label-xs block pb-1">Global system prompt</label>
            <textarea
              value={settings.systemPrompt}
              onChange={(event) => updateSettings({ systemPrompt: event.target.value })}
              rows={3}
              placeholder="Optional instructions added to every conversation…"
              className="field resize-y font-sans text-[10.5px] leading-relaxed"
            />
          </div>
        </div>
      )}
    </div>
  );
}
