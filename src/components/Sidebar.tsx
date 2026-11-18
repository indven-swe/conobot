import { useMemo, useRef, useState } from "react";
import {
  Close,
  Delete,
  Folder,
  NewChat,
  Pencil,
  Plus,
  PROVIDER_ICONS,
  Search,
  Settings,
  Sparkles,
} from "@/components/Icons";
import { useApp } from "@/state/AppState";
import { pickWorkspaceFolder } from "@/services/persistence";
import { PreferencesMenu } from "@/components/PreferencesMenu";
import { cn, modKey, relativeTime, truncate } from "@/lib/utils";
import type { ChatSession } from "@/types";
import { APP_VERSION } from "@/lib/providers";

interface SidebarProps {
  onOpenSettings: () => void;
}

function bucketFor(timestamp: number): string {
  const now = new Date();
  const date = new Date(timestamp);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (timestamp >= startOfToday) return "Today";
  if (timestamp >= startOfToday - 86_400_000) return "Yesterday";
  if (timestamp >= startOfToday - 7 * 86_400_000) return "Previous 7 days";
  if (date.getFullYear() === now.getFullYear()) return "Earlier this year";
  return String(date.getFullYear());
}

export function Sidebar({ onOpenSettings }: SidebarProps) {
  const {
    store,
    activeSession,
    connections,
    newSession,
    selectSession,
    deleteSession,
    renameSession,
    addWorkspace,
    deleteWorkspace,
    notify,
  } = useApp();
  const [query, setQuery] = useState("");
  const [workspaceFilter, setWorkspaceFilter] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const sessions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return store.sessions
      .filter((session) => (workspaceFilter ? session.workspaceId === workspaceFilter : true))
      .filter((session) => {
        if (!needle) return true;
        return (
          session.title.toLowerCase().includes(needle) ||
          session.messages.some((message) => message.content.toLowerCase().includes(needle))
        );
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [store.sessions, query, workspaceFilter]);

  const grouped = useMemo(() => {
    const groups = new Map<string, ChatSession[]>();
    for (const session of sessions) {
      const key = bucketFor(session.updatedAt);
      const list = groups.get(key) ?? [];
      list.push(session);
      groups.set(key, list);
    }
    return [...groups.entries()];
  }, [sessions]);

  const onlineCount = Object.values(connections).filter((entry) => entry.state === "online").length;

  const startRename = (session: ChatSession) => {
    setEditingId(session.id);
    setDraft(session.title);
    window.setTimeout(() => inputRef.current?.select(), 30);
  };

  const commitRename = () => {
    if (editingId) renameSession(editingId, draft);
    setEditingId(null);
  };

  const addFolder = async () => {
    const path = await pickWorkspaceFolder();
    if (path) {
      addWorkspace(path);
      return;
    }
    if (!("__TAURI_INTERNALS__" in window)) {
      const manual = window.prompt("Workspace folder path");
      if (manual?.trim()) addWorkspace(manual.trim());
      return;
    }
    notify("Folder selection was cancelled.", "info");
  };

  return (
    <aside className="relative z-20 flex h-full w-[268px] shrink-0 flex-col border-r border-line/80 bg-ink-900/55 backdrop-blur-xl">
      <div className="px-3 pb-2 pt-3">
        <button
          type="button"
          onClick={() => newSession(workspaceFilter)}
          className="group flex w-full items-center gap-2 rounded-xl border border-mint-500/25 bg-gradient-to-br from-mint-500/[0.12] to-iris-500/[0.06] px-3 py-2.5 text-left transition hover:border-mint-400/45 hover:from-mint-500/[0.18]"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-md border border-mint-500/30 bg-ink-900/60 text-mint-300 transition group-hover:shadow-[0_0_16px_-4px_rgba(92,232,180,0.7)]">
            <NewChat size={14} />
          </span>
          <span className="flex-1">
            <span className="block text-xs font-semibold text-haze-100">New conversation</span>
            <span className="block text-[10px] text-haze-500">fresh context window</span>
          </span>
          <kbd className="rounded border border-line bg-ink-950/60 px-1.5 py-0.5 font-mono text-[10px] text-haze-500">
            {modKey()}N
          </kbd>
        </button>
      </div>

      <div className="px-3 pb-3">
        <div className="relative">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-haze-600">
            <Search size={13} />
          </span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search sessions…"
            className="field h-8 py-1.5 pl-8 pr-7 font-sans text-[11.5px] placeholder:text-haze-600"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-haze-500 hover:text-haze-200"
              aria-label="Clear search"
            >
              <Close size={11} />
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        <div className="mb-1 flex items-center justify-between px-2 pt-1">
          <span className="label-xs">Workspaces</span>
          <button
            type="button"
            onClick={() => void addFolder()}
            className="text-haze-500 transition hover:text-mint-300"
            title="Add workspace folder"
            aria-label="Add workspace folder"
          >
            <Plus size={13} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setWorkspaceFilter(null)}
          className={cn(
            "group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11.5px] transition",
            workspaceFilter === null
              ? "bg-white/[0.045] text-haze-100"
              : "text-haze-400 hover:bg-white/[0.025] hover:text-haze-200",
          )}
        >
          <Sparkles size={13} className="text-iris-400/80" />
          <span className="flex-1 text-left">All sessions</span>
          <span className="font-mono text-[10px] text-haze-600">{store.sessions.length}</span>
        </button>

        {store.workspaces.map((workspace) => (
          <div key={workspace.id} className="group/ws relative">
            <button
              type="button"
              onClick={() => setWorkspaceFilter(workspaceFilter === workspace.id ? null : workspace.id)}
              title={workspace.path}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11.5px] transition",
                workspaceFilter === workspace.id
                  ? "bg-white/[0.045] text-haze-100"
                  : "text-haze-400 hover:bg-white/[0.025] hover:text-haze-200",
              )}
            >
              <Folder size={13} className="text-mint-400/70" />
              <span className="flex-1 truncate text-left">{workspace.name}</span>
              <span className="font-mono text-[10px] text-haze-600">
                {store.sessions.filter((session) => session.workspaceId === workspace.id).length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => deleteWorkspace(workspace.id)}
              className="absolute right-1 top-1/2 hidden -translate-y-1/2 rounded p-1 text-haze-600 hover:text-ember-400 group-hover/ws:block"
              title="Remove workspace"
              aria-label="Remove workspace"
            >
              <Close size={10} />
            </button>
          </div>
        ))}

        {store.workspaces.length === 0 && (
          <p className="px-2 py-1 text-[10.5px] leading-relaxed text-haze-600">
            Add a local folder to keep related chats together.
          </p>
        )}

        <div className="mt-4 flex items-center justify-between px-2">
          <span className="label-xs">Sessions</span>
          <span className="font-mono text-[10px] text-haze-600">{sessions.length}</span>
        </div>

        <div className="mt-1 space-y-3">
          {grouped.length === 0 && (
            <p className="px-2 py-4 text-center text-[11px] leading-relaxed text-haze-600">
              {query ? "No sessions match that search." : "No conversations yet. Start one above."}
            </p>
          )}

          {grouped.map(([bucket, items]) => (
            <div key={bucket}>
              <div className="px-2 pb-1 text-[10px] font-medium tracking-wide text-haze-600">
                {bucket}
              </div>
              <div className="space-y-0.5">
                {items.map((session) => {
                  const provider =
                    store.providers.find((entry) => entry.id === session.providerId) ??
                    store.providers[0];
                  const ProviderIcon = provider ? PROVIDER_ICONS[provider.kind] : PROVIDER_ICONS.ollama;
                  const active = activeSession?.id === session.id;
                  return (
                    <div
                      key={session.id}
                      className={cn(
                        "group relative flex items-center gap-2 rounded-lg px-2 py-1.5 transition",
                        active
                          ? "bg-white/[0.055] text-haze-100"
                          : "text-haze-400 hover:bg-white/[0.025] hover:text-haze-200",
                      )}
                    >
                      {active && (
                        <span className="absolute inset-y-1.5 left-0 w-[2px] rounded-full bg-mint-400 shadow-[0_0_10px_rgba(92,232,180,0.9)]" />
                      )}
                      <span className={cn("mt-0.5 self-start pt-0.5", active ? "text-mint-300" : "text-haze-600")}>
                        <ProviderIcon size={13} />
                      </span>

                      {editingId === session.id ? (
                        <input
                          ref={inputRef}
                          value={draft}
                          autoFocus
                          onChange={(event) => setDraft(event.target.value)}
                          onBlur={commitRename}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") commitRename();
                            if (event.key === "Escape") setEditingId(null);
                          }}
                          className="min-w-0 flex-1 rounded border border-mint-500/40 bg-ink-950 px-1 py-0.5 text-[11.5px] text-haze-100 outline-none"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => selectSession(session.id)}
                          onDoubleClick={() => startRename(session)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <span className="block truncate text-[11.5px] leading-tight">
                            {session.title}
                          </span>
                          <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[9.5px] text-haze-600">
                            <span className="truncate">
                              {truncate(session.model || provider?.model || "no model", 22)}
                            </span>
                            <span className="text-haze-700">·</span>
                            <span className="shrink-0">{relativeTime(session.updatedAt)}</span>
                          </span>
                        </button>
                      )}

                      <div className="absolute right-1 top-1.5 hidden items-center gap-0.5 rounded-md bg-ink-900/90 pl-1 group-hover:flex">
                        <button
                          type="button"
                          onClick={() => startRename(session)}
                          className="rounded p-1 text-haze-500 hover:text-haze-100"
                          title="Rename session"
                          aria-label="Rename session"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSession(session.id)}
                          className="rounded p-1 text-haze-500 hover:text-ember-400"
                          title="Delete session"
                          aria-label="Delete session"
                        >
                          <Delete size={11} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-line/80 p-2.5">
        <PreferencesMenu />
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex w-full items-center gap-2 rounded-lg border border-line/70 bg-ink-850/60 px-2.5 py-2 text-left transition hover:border-line-bright hover:bg-ink-800"
        >
          <Settings size={14} className="text-haze-400" />
          <span className="flex-1">
            <span className="block text-[11.5px] font-medium text-haze-200">
              Providers & endpoints
            </span>
            <span className="block text-[10px] text-haze-600">
              {onlineCount} online · {store.providers.length} configured
            </span>
          </span>
          <kbd className="rounded border border-line bg-ink-950/60 px-1.5 py-0.5 font-mono text-[10px] text-haze-500">
            {modKey()},
          </kbd>
        </button>
        <div className="mt-2 flex items-center justify-between px-1 text-[9.5px] text-haze-600">
          <span className="font-mono">v{APP_VERSION} · MIT</span>
          <span className="flex items-center gap-1">
            <span className="h-1 w-1 rounded-full bg-mint-400/80" />
            local-first
          </span>
        </div>
      </div>
    </aside>
  );
}
