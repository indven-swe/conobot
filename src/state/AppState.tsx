import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  AppSettings,
  ChatMessage,
  ChatSession,
  ChatTurn,
  PersistedStore,
  ProviderConnection,
  ProviderProfile,
  Workspace,
} from "@/types";
import {
  DEFAULT_SYSTEM_PROMPT,
  defaultProviders,
  makeId,
} from "@/lib/providers";
import { titleFromContent } from "@/lib/utils";
import { hydrateStore, loadStore, saveStore } from "@/services/persistence";
import { LlmError, streamChat, testConnection } from "@/services/llmClient";

/* ------------------------------------------------------------------ */
/*  Reducer                                                           */
/* ------------------------------------------------------------------ */

type Action =
  | { type: "hydrate"; store: PersistedStore }
  | { type: "settings"; patch: Partial<AppSettings> }
  | { type: "upsertProvider"; provider: ProviderProfile }
  | { type: "deleteProvider"; id: string }
  | { type: "newSession"; session: ChatSession }
  | { type: "deleteSession"; id: string }
  | { type: "renameSession"; id: string; title: string }
  | { type: "patchSession"; id: string; patch: Partial<ChatSession> }
  | { type: "addMessage"; sessionId: string; message: ChatMessage }
  | { type: "patchMessage"; sessionId: string; messageId: string; patch: Partial<ChatMessage> }
  | { type: "removeMessage"; sessionId: string; messageId: string }
  | { type: "addWorkspace"; workspace: Workspace }
  | { type: "deleteWorkspace"; id: string }
  | { type: "clearSessions" };

function withSession(
  state: PersistedStore,
  id: string,
  updater: (session: ChatSession) => ChatSession,
): PersistedStore {
  return {
    ...state,
    sessions: state.sessions.map((session) => (session.id === id ? updater(session) : session)),
  };
}

function reducer(state: PersistedStore, action: Action): PersistedStore {
  switch (action.type) {
    case "hydrate":
      return action.store;

    case "settings":
      return { ...state, settings: { ...state.settings, ...action.patch } };

    case "upsertProvider": {
      const exists = state.providers.some((entry) => entry.id === action.provider.id);
      return {
        ...state,
        providers: exists
          ? state.providers.map((entry) =>
              entry.id === action.provider.id ? action.provider : entry,
            )
          : [...state.providers, action.provider],
      };
    }

    case "deleteProvider": {
      const providers = state.providers.filter((entry) => entry.id !== action.id);
      const fallback = providers[0]?.id ?? "ollama-default";
      return {
        ...state,
        providers,
        activeProviderId: state.activeProviderId === action.id ? fallback : state.activeProviderId,
        settings: {
          ...state.settings,
          activeProviderId:
            state.settings.activeProviderId === action.id ? fallback : state.settings.activeProviderId,
        },
      };
    }

    case "newSession":
      return {
        ...state,
        sessions: [action.session, ...state.sessions],
        settings: { ...state.settings, lastSessionId: action.session.id },
        activeProviderId: action.session.providerId,
      };

    case "deleteSession": {
      const sessions = state.sessions.filter((session) => session.id !== action.id);
      const nextId =
        state.settings.lastSessionId === action.id
          ? sessions[0]?.id ?? null
          : state.settings.lastSessionId;
      return { ...state, sessions, settings: { ...state.settings, lastSessionId: nextId } };
    }

    case "renameSession":
      return withSession(state, action.id, (session) => ({
        ...session,
        title: action.title.trim() || session.title,
        updatedAt: Date.now(),
      }));

    case "patchSession":
      return withSession(state, action.id, (session) => ({
        ...session,
        ...action.patch,
        updatedAt: Date.now(),
      }));

    case "addMessage":
      return withSession(state, action.sessionId, (session) => ({
        ...session,
        messages: [...session.messages, action.message],
        updatedAt: Date.now(),
      }));

    case "patchMessage":
      return withSession(state, action.sessionId, (session) => ({
        ...session,
        messages: session.messages.map((message) =>
          message.id === action.messageId ? { ...message, ...action.patch } : message,
        ),
        updatedAt: Date.now(),
      }));

    case "removeMessage":
      return withSession(state, action.sessionId, (session) => ({
        ...session,
        messages: session.messages.filter((message) => message.id !== action.messageId),
        updatedAt: Date.now(),
      }));

    case "addWorkspace":
      return { ...state, workspaces: [...state.workspaces, action.workspace] };

    case "deleteWorkspace":
      return {
        ...state,
        workspaces: state.workspaces.filter((workspace) => workspace.id !== action.id),
        sessions: state.sessions.map((session) =>
          session.workspaceId === action.id ? { ...session, workspaceId: null } : session,
        ),
      };

    case "clearSessions":
      return { ...state, sessions: [], settings: { ...state.settings, lastSessionId: null } };

    default:
      return state;
  }
}

/* ------------------------------------------------------------------ */
/*  Context                                                           */
/* ------------------------------------------------------------------ */

export interface Toast {
  id: string;
  message: string;
  tone: "info" | "error" | "success";
}

interface AppContextValue {
  store: PersistedStore;
  ready: boolean;
  activeSession: ChatSession | null;
  activeProvider: ProviderProfile | null;
  activeWorkspace: Workspace | null;
  connections: Record<string, ProviderConnection>;
  generating: boolean;
  generatingMessageId: string | null;
  toasts: Toast[];
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  newSession: (workspaceId?: string | null) => ChatSession;
  selectSession: (id: string) => void;
  deleteSession: (id: string) => void;
  renameSession: (id: string, title: string) => void;
  patchSession: (id: string, patch: Partial<ChatSession>) => void;
  deleteMessage: (sessionId: string, messageId: string) => void;
  sendMessage: (text: string) => Promise<{ ok: boolean; error?: string }>;
  regenerate: () => Promise<void>;
  stopStreaming: () => void;
  upsertProvider: (provider: ProviderProfile) => void;
  deleteProvider: (id: string) => void;
  selectModel: (providerId: string, model: string) => void;
  addWorkspace: (path: string) => void;
  deleteWorkspace: (id: string) => void;
  refreshConnection: (provider: ProviderProfile, silent?: boolean) => Promise<ProviderConnection>;
  refreshAllConnections: (silent?: boolean) => Promise<void>;
  notify: (message: string, tone?: Toast["tone"]) => void;
  dismissToast: (id: string) => void;
  clearAllSessions: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const CLOUD_KINDS = new Set(["anthropic", "openai"]);

export function AppProvider({ children }: { children: ReactNode }) {
  const [store, dispatch] = useReducer(reducer, undefined, () => hydrateStore(null));
  const [ready, setReady] = useState(false);
  const [connections, setConnections] = useState<Record<string, ProviderConnection>>({});
  const [generating, setGenerating] = useState(false);
  const [generatingMessageId, setGeneratingMessageId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const storeRef = useRef(store);
  storeRef.current = store;

  /* ---------------- boot ---------------- */

  useEffect(() => {
    let cancelled = false;
    void loadStore().then((persisted) => {
      if (cancelled) return;
      dispatch({ type: "hydrate", store: persisted });
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /* ---------------- persistence ---------------- */

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      void saveStore(store);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [store, ready]);

  /* ---------------- toasts ---------------- */

  const notify = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = makeId("toast");
    setToasts((current) => [...current.slice(-3), { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 5200);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  /* ---------------- connections ---------------- */

  const refreshConnection = useCallback(
    async (provider: ProviderProfile, silent = false): Promise<ProviderConnection> => {
      if (!silent) {
        setConnections((current) => ({
          ...current,
          [provider.id]: {
            providerId: provider.id,
            state: "checking",
            latencyMs: null,
            models: current[provider.id]?.models ?? provider.models,
            error: null,
            checkedAt: Date.now(),
          },
        }));
      }
      let report;
      try {
        report = await testConnection(provider);
      } catch (error) {
        report = {
          ok: false,
          latencyMs: 0,
          models: [],
          error: error instanceof Error ? error.message : String(error),
          detail: null,
        };
      }
      const connection: ProviderConnection = {
        providerId: provider.id,
        state: report.ok ? "online" : provider.apiKey || !CLOUD_KINDS.has(provider.kind) ? "offline" : "error",
        latencyMs: report.ok ? report.latencyMs : null,
        models: report.models,
        error: report.error,
        checkedAt: Date.now(),
      };
      setConnections((current) => ({ ...current, [provider.id]: connection }));

      if (report.ok && report.models.length) {
        const known = new Set(provider.models);
        const missing = report.models.filter((model) => !known.has(model));
        if (missing.length) {
          dispatch({
            type: "upsertProvider",
            provider: { ...provider, models: [...report.models] },
          });
        }
        const current = storeRef.current.sessions.find(
          (session) => session.id === storeRef.current.settings.lastSessionId,
        );
        if (current && current.providerId === provider.id && !current.model) {
          dispatch({
            type: "patchSession",
            id: current.id,
            patch: { model: report.models[0] },
          });
        }
      }
      return connection;
    },
    [],
  );

  const refreshAllConnections = useCallback(
    async (silent = false) => {
      const providers = storeRef.current.providers.filter((provider) => provider.enabled);
      await Promise.all(providers.map((provider) => refreshConnection(provider, silent)));
    },
    [refreshConnection],
  );

  useEffect(() => {
    if (!ready) return;
    void refreshAllConnections(true);
    const interval = window.setInterval(() => {
      void refreshAllConnections(true);
    }, 45_000);
    return () => window.clearInterval(interval);
    // Providers are read through a ref; re-running on every edit would spam endpoints.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, refreshAllConnections]);

  /* ---------------- derived ---------------- */

  const activeSession = useMemo(
    () =>
      store.sessions.find((session) => session.id === store.settings.lastSessionId) ??
      store.sessions[0] ??
      null,
    [store.sessions, store.settings.lastSessionId],
  );

  const activeProvider = useMemo(
    () =>
      store.providers.find(
        (provider) => provider.id === (activeSession?.providerId ?? store.settings.activeProviderId),
      ) ??
      store.providers[0] ??
      null,
    [store.providers, store.settings.activeProviderId, activeSession?.providerId],
  );

  const activeWorkspace = useMemo(
    () =>
      store.workspaces.find((workspace) => workspace.id === activeSession?.workspaceId) ?? null,
    [store.workspaces, activeSession?.workspaceId],
  );

  /* ---------------- sessions ---------------- */

  const newSession = useCallback(
    (workspaceId: string | null = null) => {
      const current = storeRef.current;
      const provider =
        current.providers.find((entry) => entry.id === current.settings.activeProviderId) ??
        current.providers[0] ??
        defaultProviders()[0];
      const session: ChatSession = {
        id: makeId("chat"),
        title: "New conversation",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [],
        providerId: provider.id,
        model: provider.model || provider.models[0] || "",
        workspaceId: workspaceId ?? activeSession?.workspaceId ?? null,
      };
      dispatch({ type: "newSession", session });
      return session;
    },
    [activeSession?.workspaceId],
  );

  const selectSession = useCallback((id: string) => {
    dispatch({ type: "settings", patch: { lastSessionId: id } });
  }, []);

  const deleteSession = useCallback((id: string) => {
    dispatch({ type: "deleteSession", id });
  }, []);

  const renameSession = useCallback((id: string, title: string) => {
    dispatch({ type: "renameSession", id, title });
  }, []);

  const patchSession = useCallback((id: string, patch: Partial<ChatSession>) => {
    dispatch({ type: "patchSession", id, patch });
  }, []);

  const deleteMessage = useCallback((sessionId: string, messageId: string) => {
    dispatch({ type: "removeMessage", sessionId, messageId });
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    dispatch({ type: "settings", patch });
  }, []);

  const upsertProvider = useCallback((provider: ProviderProfile) => {
    dispatch({ type: "upsertProvider", provider });
  }, []);

  const deleteProvider = useCallback((id: string) => {
    dispatch({ type: "deleteProvider", id });
  }, []);

  const addWorkspace = useCallback((path: string) => {
    const name = path.split(/[\\/]/).filter(Boolean).pop() ?? "workspace";
    dispatch({
      type: "addWorkspace",
      workspace: { id: makeId("ws"), name, path, addedAt: Date.now() },
    });
  }, []);

  const deleteWorkspace = useCallback((id: string) => {
    dispatch({ type: "deleteWorkspace", id });
  }, []);

  const clearAllSessions = useCallback(() => {
    dispatch({ type: "clearSessions" });
  }, []);

  const selectModel = useCallback((providerId: string, model: string) => {
    const current = storeRef.current;
    dispatch({ type: "settings", patch: { activeProviderId: providerId } });
    if (current.settings.lastSessionId) {
      dispatch({
        type: "patchSession",
        id: current.settings.lastSessionId,
        patch: { providerId, model },
      });
    }
  }, []);

  /* ---------------- streaming ---------------- */

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setGenerating(false);
    setGeneratingMessageId(null);
  }, []);

  const runCompletion = useCallback(
    async (session: ChatSession, history: ChatMessage[], assistantId: string) => {
      const provider =
        storeRef.current.providers.find((entry) => entry.id === session.providerId) ??
        activeProvider;
      if (!provider) {
        dispatch({
          type: "patchMessage",
          sessionId: session.id,
          messageId: assistantId,
          patch: {
            status: "error",
            error: "No provider is configured. Open Provider Settings to add one.",
          },
        });
        return;
      }
      const model = session.model || provider.model || provider.models[0] || "";
      if (!model) {
        dispatch({
          type: "patchMessage",
          sessionId: session.id,
          messageId: assistantId,
          patch: {
            status: "error",
            error: `No model selected for ${provider.label}. Refresh its model list in Provider Settings.`,
          },
        });
        return;
      }

      const turns: ChatTurn[] = history
        .filter((message) => message.role !== "assistant" || message.content.trim().length > 0)
        .slice(-32)
        .map((message) => ({ role: message.role, content: message.content }));

      const controller = new AbortController();
      abortRef.current = controller;
      setGenerating(true);
      setGeneratingMessageId(assistantId);

      let buffered = "";
      let flushTimer: number | null = null;
      const flush = () => {
        flushTimer = null;
        const text = buffered;
        dispatch({
          type: "patchMessage",
          sessionId: session.id,
          messageId: assistantId,
          patch: { content: text },
        });
      };
      // Coalesce token deltas: ~20 UI updates/second keeps markdown parsing cheap.
      const scheduleFlush = () => {
        if (flushTimer !== null) return;
        flushTimer = window.setTimeout(flush, 48);
      };

      try {
        const result = await streamChat({
          profile: provider,
          model,
          messages: turns,
          systemPrompt: [DEFAULT_SYSTEM_PROMPT, storeRef.current.settings.systemPrompt, provider.systemPrompt]
            .filter(Boolean)
            .join("\n\n"),
          signal: controller.signal,
          onDelta: (delta) => {
            // Buffered mode keeps the UI quiet until the full response lands.
            if (!storeRef.current.settings.streamResponses) return;
            buffered += delta;
            scheduleFlush();
          },
        });

        const finalText = (result.content || buffered || "").trim();
        const wasAborted = controller.signal.aborted;
        dispatch({
          type: "patchMessage",
          sessionId: session.id,
          messageId: assistantId,
          patch: {
            content: finalText || (wasAborted ? "_Generation stopped._" : "_No content returned._"),
            status: wasAborted ? "stopped" : "complete",
            model,
            providerId: provider.id,
          },
        });
        if (!wasAborted && /```/.test(finalText)) {
          dispatch({ type: "settings", patch: { artifactPanelOpen: true } });
        }
      } catch (error) {
        const aborted = controller.signal.aborted;
        const message =
          error instanceof LlmError
            ? error.message
            : error instanceof Error
              ? error.message
              : "The request failed for an unknown reason.";
        dispatch({
          type: "patchMessage",
          sessionId: session.id,
          messageId: assistantId,
          patch: {
            content: buffered,
            status: aborted ? "stopped" : "error",
            error: aborted ? undefined : message,
            model,
            providerId: provider.id,
          },
        });
        if (!aborted) notify(message, "error");
      } finally {
        if (flushTimer !== null) window.clearTimeout(flushTimer);
        if (abortRef.current === controller) abortRef.current = null;
        setGenerating(false);
        setGeneratingMessageId(null);
      }
    },
    [activeProvider, notify],
  );

  const sendMessage = useCallback(
    async (text: string): Promise<{ ok: boolean; error?: string }> => {
      const content = text.trim();
      if (!content) return { ok: false, error: "Nothing to send." };
      if (generating) return { ok: false, error: "Wait for the current response to finish." };

      let session = storeRef.current.sessions.find(
        (entry) => entry.id === storeRef.current.settings.lastSessionId,
      );
      if (!session) {
        session = newSession();
      }

      const provider =
        storeRef.current.providers.find((entry) => entry.id === session.providerId) ??
        storeRef.current.providers[0];
      const model = session.model || provider?.model || provider?.models[0] || "";
      if (!provider) {
        return { ok: false, error: "No provider configured yet." };
      }
      if (!model) {
        return {
          ok: false,
          error: `Pick a model for ${provider.label} first — open model switcher (${navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}+K).`,
        };
      }

      const userMessage: ChatMessage = {
        id: makeId("msg"),
        role: "user",
        content,
        createdAt: Date.now(),
        status: "complete",
      };
      const assistantMessage: ChatMessage = {
        id: makeId("msg"),
        role: "assistant",
        content: "",
        createdAt: Date.now(),
        status: "streaming",
        providerId: provider.id,
        model,
      };

      dispatch({ type: "addMessage", sessionId: session.id, message: userMessage });
      dispatch({ type: "addMessage", sessionId: session.id, message: assistantMessage });
      if (session.messages.length === 0) {
        dispatch({ type: "renameSession", id: session.id, title: titleFromContent(content) });
      }
      dispatch({
        type: "patchSession",
        id: session.id,
        patch: { providerId: provider.id, model },
      });
      dispatch({ type: "settings", patch: { activeProviderId: provider.id } });

      const history = [...session.messages, userMessage];
      await runCompletion({ ...session, providerId: provider.id, model }, history, assistantMessage.id);
      return { ok: true };
    },
    [generating, newSession, runCompletion],
  );

  const regenerate = useCallback(async () => {
    if (generating) return;
    const session = storeRef.current.sessions.find(
      (entry) => entry.id === storeRef.current.settings.lastSessionId,
    );
    if (!session) return;
    const lastUser = [...session.messages].reverse().find((message) => message.role === "user");
    if (!lastUser) return;
    const lastAssistant = [...session.messages].reverse().find((message) => message.role === "assistant");
    if (lastAssistant) {
      dispatch({ type: "removeMessage", sessionId: session.id, messageId: lastAssistant.id });
    }
    const assistantMessage: ChatMessage = {
      id: makeId("msg"),
      role: "assistant",
      content: "",
      createdAt: Date.now(),
      status: "streaming",
      providerId: session.providerId,
      model: session.model,
    };
    dispatch({ type: "addMessage", sessionId: session.id, message: assistantMessage });
    const history = [...session.messages.filter((message) => message.id !== lastAssistant?.id)];
    await runCompletion(session, history, assistantMessage.id);
  }, [generating, runCompletion]);

  /* ---------------- effects ---------------- */

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && abortRef.current) {
        event.preventDefault();
        stopStreaming();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [stopStreaming]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const value: AppContextValue = {
    store,
    ready,
    activeSession,
    activeProvider,
    activeWorkspace,
    connections,
    generating,
    generatingMessageId,
    toasts,
    settings: store.settings,
    updateSettings,
    newSession,
    selectSession,
    deleteSession,
    renameSession,
    patchSession,
    deleteMessage,
    sendMessage,
    regenerate,
    stopStreaming,
    upsertProvider,
    deleteProvider,
    selectModel,
    addWorkspace,
    deleteWorkspace,
    refreshConnection,
    refreshAllConnections,
    notify,
    dismissToast,
    clearAllSessions,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside <AppProvider>.");
  return context;
}
