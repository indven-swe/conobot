export type ProviderKind = "ollama" | "lmstudio" | "anthropic" | "openai";

export type ConnectionState = "unknown" | "checking" | "online" | "offline" | "error";

export interface ProviderProfile {
  id: string;
  kind: ProviderKind;
  label: string;
  baseUrl: string;
  /** Stored on disk in the app-data JSON store. Never sent anywhere except the provider. */
  apiKey: string;
  model: string;
  /** Last known model catalogue for this endpoint. */
  models: string[];
  temperature: number;
  maxTokens: number;
  enabled: boolean;
  /** Optional extra system instruction scoped to this endpoint. */
  systemPrompt: string;
}

export interface ProviderConnection {
  providerId: string;
  state: ConnectionState;
  latencyMs: number | null;
  models: string[];
  error: string | null;
  checkedAt: number;
}

export type MessageRole = "user" | "assistant" | "system";
export type MessageStatus = "complete" | "streaming" | "error" | "stopped";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: number;
  status: MessageStatus;
  providerId?: string;
  model?: string;
  error?: string;
  /** Set when a saved artifact was written from this message. */
  artifacts?: Artifact[];
}

export interface Artifact {
  id: string;
  messageId: string;
  title: string;
  language: string;
  code: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  providerId: string;
  model: string;
  workspaceId: string | null;
}

export interface Workspace {
  id: string;
  name: string;
  path: string;
  addedAt: number;
}

export interface AppSettings {
  activeProviderId: string;
  sidebarCollapsed: boolean;
  artifactPanelOpen: boolean;
  artifactWidth: number;
  sendOnEnter: boolean;
  streamResponses: boolean;
  systemPrompt: string;
  lastSessionId: string | null;
}

export interface PersistedStore {
  version: number;
  sessions: ChatSession[];
  workspaces: Workspace[];
  providers: ProviderProfile[];
  settings: AppSettings;
  activeProviderId: string;
}

export interface StreamChunkEvent {
  requestId: string;
  delta: string;
}

export interface StreamDoneEvent {
  requestId: string;
  content: string;
  model: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
}

export interface StreamErrorEvent {
  requestId: string;
  message: string;
}

export interface ConnectionReport {
  ok: boolean;
  latencyMs: number;
  models: string[];
  error: string | null;
  /** Which wire protocol answered, useful when a URL was auto-normalised. */
  detail: string | null;
}

export interface ChatTurn {
  role: MessageRole;
  content: string;
}
