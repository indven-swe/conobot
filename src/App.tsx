import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { TitleBar } from "@/components/TitleBar";
import { Sidebar } from "@/components/Sidebar";
import { ChatView } from "@/components/ChatView";
import { Composer } from "@/components/Composer";
import { ArtifactPanel } from "@/components/ArtifactPanel";
import { ProviderSettingsModal } from "@/components/ProviderSettingsModal";
import { ModelSwitcher } from "@/components/ModelSwitcher";
import { ToastStack } from "@/components/ToastStack";
import { BrandMark, ThinkingPulse } from "@/components/Icons";
import { useApp } from "@/state/AppState";
import { artifactsForSession } from "@/lib/artifacts";
import { cn, isTauri, modKey } from "@/lib/utils";

export default function App() {
  const {
    ready,
    settings,
    activeSession,
    updateSettings,
    newSession,
    generating,
  } = useApp();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modelsOpen, setModelsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const artifacts = useMemo(
    () => artifactsForSession(activeSession?.messages ?? []),
    [activeSession?.messages],
  );

  const openSettings = useCallback(() => {
    setModelsOpen(false);
    setSettingsOpen(true);
  }, []);

  const toggleCanvas = useCallback(() => {
    updateSettings({ artifactPanelOpen: !settings.artifactPanelOpen });
  }, [settings.artifactPanelOpen, updateSettings]);

  const handleSuggestion = useCallback((text: string) => {
    setDraft(text);
    window.setTimeout(() => inputRef.current?.focus(), 20);
  }, []);

  /* ---------------- global shortcuts ---------------- */

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      const key = event.key.toLowerCase();

      if (key === "k") {
        event.preventDefault();
        setSettingsOpen(false);
        setModelsOpen((value) => !value);
        return;
      }
      if (key === "n") {
        event.preventDefault();
        newSession();
        setModelsOpen(false);
        return;
      }
      if (key === "," || (event.shiftKey && key === "/")) {
        event.preventDefault();
        openSettings();
        return;
      }
      if (key === "b") {
        event.preventDefault();
        updateSettings({ sidebarCollapsed: !settings.sidebarCollapsed });
        return;
      }
      if (key === "j") {
        event.preventDefault();
        toggleCanvas();
        return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [newSession, openSettings, settings.sidebarCollapsed, toggleCanvas, updateSettings]);

  useEffect(() => {
    if (activeSession?.title) {
      document.title = `${activeSession.title} · ConoBot`;
    } else {
      document.title = "ConoBot";
    }
  }, [activeSession?.title]);

  /* Native shell events: tray "New conversation" and global quick summon. */
  useEffect(() => {
    if (!isTauri()) return;
    let offQuick: (() => void) | undefined;
    let offNew: (() => void) | undefined;
    let cancelled = false;
    void listen("app:quick-chat", () => {
      window.setTimeout(() => inputRef.current?.focus(), 40);
    }).then((unlisten) => {
      if (cancelled) unlisten();
      else offQuick = unlisten;
    });
    void listen("app:new-chat", () => {
      setDraft("");
      newSession();
      window.setTimeout(() => inputRef.current?.focus(), 40);
    }).then((unlisten) => {
      if (cancelled) unlisten();
      else offNew = unlisten;
    });
    return () => {
      cancelled = true;
      offQuick?.();
      offNew?.();
    };
  }, [newSession]);

  if (!ready) {
    return (
      <div className="relative flex h-full flex-col items-center justify-center gap-4">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <span className="absolute inset-0 animate-pulse-soft rounded-2xl bg-mint-500/10 blur-xl" />
          <span className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-mint-500/30 bg-ink-850 text-mint-300">
            <BrandMark size={26} />
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] tracking-wide text-haze-500">
          <ThinkingPulse size={14} />
          <span className="shimmer-text">restoring workspace</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-10 flex h-full flex-col overflow-hidden">
      <TitleBar onOpenModels={() => setModelsOpen(true)} onOpenSettings={openSettings} />

      <div className="flex min-h-0 flex-1">
        <div
          className={cn(
            "h-full overflow-hidden transition-[width] duration-200 ease-out",
            settings.sidebarCollapsed ? "w-0" : "w-[268px]",
          )}
          aria-hidden={settings.sidebarCollapsed}
        >
          <Sidebar onOpenSettings={openSettings} />
        </div>

        <main className="flex min-w-0 flex-1 flex-col">
          <ChatView
            onOpenSettings={openSettings}
            onOpenModels={() => setModelsOpen(true)}
            onToggleCanvas={toggleCanvas}
            onSuggestion={handleSuggestion}
            artifactCount={artifacts.length}
          />
          <Composer
            draft={draft}
            setDraft={setDraft}
            onOpenModels={() => setModelsOpen(true)}
            onOpenSettings={openSettings}
            onToggleCanvas={toggleCanvas}
            inputRef={inputRef}
          />
        </main>

        <div
          className={cn(
            "h-full overflow-hidden transition-[width] duration-200 ease-out",
            settings.artifactPanelOpen ? "" : "w-0",
          )}
          style={{ width: settings.artifactPanelOpen ? `${settings.artifactWidth}%` : 0 }}
        >
          {settings.artifactPanelOpen && (
            <ArtifactPanel
              artifacts={artifacts}
              onClose={() => updateSettings({ artifactPanelOpen: false })}
              onResize={(width) => updateSettings({ artifactWidth: width })}
            />
          )}
        </div>
      </div>

      <ProviderSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ModelSwitcher
        open={modelsOpen}
        onClose={() => setModelsOpen(false)}
        onOpenSettings={openSettings}
      />
      <ToastStack />

      {generating && (
        <div className="pointer-events-none fixed bottom-3 left-1/2 z-20 -translate-x-1/2 text-[9.5px] text-haze-600">
          <span className="flex items-center gap-1.5 rounded-full border border-line bg-ink-900/80 px-2.5 py-1 backdrop-blur">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint-400" />
            native stream active · Esc to stop · {modKey()}+K to switch models
          </span>
        </div>
      )}
    </div>
  );
}
