import { invoke } from "@tauri-apps/api/core";
import { save, open } from "@tauri-apps/plugin-dialog";
import type { ChatMessage, PersistedStore, ProviderKind } from "@/types";
import { defaultProviders, makeId } from "@/lib/providers";
import { downloadTextFile, isTauri } from "@/lib/utils";

const LOCAL_KEY = "conobot:store:v1";

const PROVIDER_KINDS: ProviderKind[] = ["ollama", "lmstudio", "anthropic", "openai"];

export const EMPTY_STORE: PersistedStore = {
  version: 1,
  activeProviderId: "ollama-default",
  sessions: [],
  workspaces: [],
  providers: defaultProviders(),
  settings: {
    activeProviderId: "ollama-default",
    sidebarCollapsed: false,
    artifactPanelOpen: false,
    artifactWidth: 44,
    sendOnEnter: true,
    streamResponses: true,
    systemPrompt: "",
    lastSessionId: null,
  },
};

/** Defensive merge so a partial/corrupt store never bricks the app. */
export function hydrateStore(raw: unknown): PersistedStore {
  const source = (raw ?? {}) as Partial<PersistedStore>;
  const providers =
    Array.isArray(source.providers) && source.providers.length
      ? source.providers
          .filter((entry) => entry && typeof entry === "object")
          .map((entry, index) => {
            const fallback = defaultProviders()[Math.min(index, 3)];
            const kind: ProviderKind = PROVIDER_KINDS.includes(entry.kind)
              ? entry.kind
              : fallback.kind;
            return {
              ...fallback,
              ...entry,
              id: typeof entry.id === "string" && entry.id ? entry.id : fallback.id,
              kind,
              label: typeof entry.label === "string" && entry.label ? entry.label : fallback.label,
              baseUrl: typeof entry.baseUrl === "string" ? entry.baseUrl : fallback.baseUrl,
              apiKey: typeof entry.apiKey === "string" ? entry.apiKey : "",
              model: typeof entry.model === "string" ? entry.model : fallback.model,
              models: Array.isArray(entry.models)
                ? entry.models.filter((model): model is string => typeof model === "string")
                : [],
              temperature: Number(entry.temperature) || fallback.temperature,
              maxTokens: Number(entry.maxTokens) || fallback.maxTokens,
              enabled: typeof entry.enabled === "boolean" ? entry.enabled : fallback.enabled,
              systemPrompt: typeof entry.systemPrompt === "string" ? entry.systemPrompt : "",
            };
          })
      : defaultProviders();

  const sessions = Array.isArray(source.sessions)
    ? source.sessions
        .filter((session) => session && typeof session === "object")
        .map((session) => {
          const messages: ChatMessage[] = Array.isArray(session.messages)
            ? session.messages
                .filter((message) => message && typeof message === "object")
                .map((message): ChatMessage => ({
                  ...message,
                  id: typeof message.id === "string" ? message.id : makeId("msg"),
                  role:
                    message.role === "user" || message.role === "system"
                      ? message.role
                      : "assistant",
                  content: typeof message.content === "string" ? message.content : "",
                  createdAt: Number(message.createdAt) || Date.now(),
                  status:
                    message.status === "error" || message.status === "stopped"
                      ? message.status
                      : "complete",
                }))
            : [];

          return {
            ...session,
            id: typeof session.id === "string" ? session.id : makeId("chat"),
            title: typeof session.title === "string" ? session.title : "Conversation",
            createdAt: Number(session.createdAt) || Date.now(),
            updatedAt: Number(session.updatedAt) || Date.now(),
            providerId:
              typeof session.providerId === "string" ? session.providerId : providers[0]?.id ?? "",
            model: typeof session.model === "string" ? session.model : "",
            workspaceId: typeof session.workspaceId === "string" ? session.workspaceId : null,
            messages,
          };
        })
    : [];

  return {
    version: 1,
    sessions,
    workspaces: Array.isArray(source.workspaces)
      ? source.workspaces.filter((workspace) => workspace && typeof workspace === "object")
      : [],
    providers,
    settings: { ...EMPTY_STORE.settings, ...(source.settings ?? {}) },
    activeProviderId: source.activeProviderId ?? providers[0]?.id ?? "ollama-default",
  };
}

export async function loadStore(): Promise<PersistedStore> {
  if (isTauri()) {
    try {
      const raw = await invoke<string | null>("load_store");
      if (raw) return hydrateStore(JSON.parse(raw));
    } catch (error) {
      console.warn("Native store unavailable, falling back to local storage.", error);
    }
  }
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (raw) return hydrateStore(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return hydrateStore(null);
}

export async function saveStore(store: PersistedStore): Promise<void> {
  const payload = JSON.stringify(store);
  if (isTauri()) {
    try {
      await invoke("save_store", { payload });
      return;
    } catch (error) {
      console.warn("Could not write the native store; using local storage.", error);
    }
  }
  try {
    window.localStorage.setItem(LOCAL_KEY, payload);
  } catch {
    /* storage full or blocked */
  }
}

export interface SaveResult {
  saved: boolean;
  path?: string;
}

/** Native save dialog + Rust file write; falls back to a browser download. */
export async function saveCodeToDisk(filename: string, contents: string): Promise<SaveResult> {
  if (!isTauri()) {
    downloadTextFile(filename, contents);
    return { saved: true };
  }
  try {
    const path = await save({
      defaultPath: filename,
      filters: [
        { name: "Source", extensions: extensionFilters(filename) },
        { name: "All files", extensions: ["*"] },
      ],
    });
    if (!path) return { saved: false };
    await invoke("write_text_file", { path, contents });
    return { saved: true, path };
  } catch (error) {
    console.error("Save failed", error);
    downloadTextFile(filename, contents);
    return { saved: true };
  }
}

function extensionFilters(filename: string): string[] {
  const ext = filename.includes(".") ? filename.split(".").pop() ?? "" : "";
  return ext ? [ext] : ["txt"];
}

export async function pickWorkspaceFolder(): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    const result = await open({ directory: true, multiple: false, title: "Add a workspace folder" });
    return typeof result === "string" ? result : null;
  } catch {
    return null;
  }
}

export async function openExternalUrl(url: string): Promise<void> {
  if (isTauri()) {
    try {
      await invoke("open_external_url", { url });
      return;
    } catch {
      /* fall through */
    }
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
