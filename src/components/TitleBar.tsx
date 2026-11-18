import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  BrandMark,
  ChevronDown,
  Close,
  Folder,
  PROVIDER_ICONS,
  Settings,
  SidebarToggle,
  WindowMaximize,
  WindowMinimize,
  WindowRestore,
} from "@/components/Icons";
import { ConnectionPill } from "@/components/ConnectionPill";
import { useApp } from "@/state/AppState";
import { cn, isTauri, modKey } from "@/lib/utils";
import { hostOf } from "@/lib/providers";

interface TitleBarProps {
  onOpenModels: () => void;
  onOpenSettings: () => void;
}

export function TitleBar({ onOpenModels, onOpenSettings }: TitleBarProps) {
  const {
    store,
    settings,
    updateSettings,
    activeProvider,
    activeSession,
    activeWorkspace,
    connections,
    refreshConnection,
  } = useApp();
  const [maximized, setMaximized] = useState(false);
  const native = isTauri();

  useEffect(() => {
    if (!native) return;
    const appWindow = getCurrentWindow();
    let unlisten: (() => void) | undefined;
    appWindow
      .isMaximized()
      .then(setMaximized)
      .catch(() => undefined);
    appWindow
      .onResized(() => {
        appWindow
          .isMaximized()
          .then(setMaximized)
          .catch(() => undefined);
      })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => undefined);
    return () => unlisten?.();
  }, [native]);

  const windowAction = (action: "minimize" | "toggleMaximize" | "close") => {
    if (!native) return;
    const appWindow = getCurrentWindow();
    void appWindow[action]().catch(() => undefined);
  };

  const localProviders = store.providers.filter(
    (provider) => provider.enabled && (provider.kind === "ollama" || provider.kind === "lmstudio"),
  );
  const ProviderIcon = activeProvider ? PROVIDER_ICONS[activeProvider.kind] : PROVIDER_ICONS.ollama;
  const modelLabel = activeSession?.model || activeProvider?.model || "Select model";

  return (
    <header
      data-tauri-drag-region
      className="relative z-30 flex h-11 shrink-0 items-center gap-3 border-b border-line/80 bg-ink-900/70 px-3 backdrop-blur-xl"
    >
      <div className="flex items-center gap-2.5 pl-0.5" data-tauri-drag-region>
        <button
          type="button"
          onClick={() => updateSettings({ sidebarCollapsed: !settings.sidebarCollapsed })}
          className="icon-btn -ml-1 h-7 w-7"
          title={`Toggle sidebar (${modKey()}+B)`}
          aria-label="Toggle sidebar"
        >
          <SidebarToggle size={16} />
        </button>
        <div className="flex items-center gap-2" data-tauri-drag-region>
          <span className="relative flex h-7 w-7 items-center justify-center rounded-lg border border-mint-500/25 bg-gradient-to-br from-mint-500/[0.16] to-iris-500/[0.08] text-mint-300 shadow-[0_0_18px_-6px_rgba(92,232,180,0.6)]">
            <BrandMark size={17} />
          </span>
          <span className="text-[12.5px] font-semibold uppercase tracking-[0.22em] text-haze-100">
            ConoBot
          </span>
        </div>
      </div>

      <span className="h-4 w-px bg-line" />

      {activeWorkspace ? (
        <div className="flex min-w-0 items-center gap-1.5 rounded-md border border-line bg-ink-850/60 px-2 py-1 text-2xs text-haze-400">
          <Folder size={12} className="text-mint-400/70" />
          <span className="max-w-[220px] truncate font-medium text-haze-300">
            {activeWorkspace.name}
          </span>
          <span className="max-w-[260px] truncate font-mono text-[10px] text-haze-600">
            {activeWorkspace.path}
          </span>
        </div>
      ) : (
        <span className="truncate text-2xs tracking-tight text-haze-600">
          {activeSession?.title ?? "Local-first AI coding cockpit"}
        </span>
      )}

      <div className="ml-auto flex items-center gap-2">
        <div className="hidden items-center gap-1.5 lg:flex">
          {localProviders.map((provider) => (
            <ConnectionPill
              key={provider.id}
              provider={provider}
              connection={connections[provider.id]}
              onClick={() => void refreshConnection(provider)}
            />
          ))}
          {!localProviders.length && (
            <span className="chip border-dashed text-haze-500">No local endpoints</span>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenModels}
          title={`Quick-switch model (${modKey()}+K)`}
          className="flex h-7 max-w-[260px] items-center gap-1.5 rounded-lg border border-line bg-ink-850/80 pl-2 pr-1.5 text-2xs text-haze-300 transition hover:border-line-bright hover:bg-ink-800 hover:text-haze-100"
        >
          <span className="text-mint-400">
            <ProviderIcon size={14} />
          </span>
          <span className="truncate font-medium">{modelLabel}</span>
          {activeProvider && (
            <span className="hidden truncate font-mono text-[10px] text-haze-600 xl:inline">
              {hostOf(activeProvider.baseUrl)}
            </span>
          )}
          <ChevronDown size={12} className="text-haze-500" />
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          className="icon-btn h-7 w-7"
          title={`Provider settings (${modKey()}+,)`}
          aria-label="Provider and endpoint settings"
        >
          <Settings size={16} />
        </button>

        {native && (
          <div className="ml-1 flex items-center gap-0.5 border-l border-line pl-1.5">
            <button
              type="button"
              onClick={() => windowAction("minimize")}
              className="flex h-7 w-8 items-center justify-center rounded-md text-haze-500 transition hover:bg-white/[0.05] hover:text-haze-200"
              aria-label="Minimize window"
            >
              <WindowMinimize size={11} />
            </button>
            <button
              type="button"
              onClick={() => windowAction("toggleMaximize")}
              className="flex h-7 w-8 items-center justify-center rounded-md text-haze-500 transition hover:bg-white/[0.05] hover:text-haze-200"
              aria-label={maximized ? "Restore window" : "Maximize window"}
            >
              {maximized ? <WindowRestore size={11} /> : <WindowMaximize size={11} />}
            </button>
            <button
              type="button"
              onClick={() => windowAction("close")}
              className={cn(
                "flex h-7 w-8 items-center justify-center rounded-md text-haze-500 transition",
                "hover:bg-ember-500/85 hover:text-white",
              )}
              aria-label="Close window"
            >
              <Close size={12} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
