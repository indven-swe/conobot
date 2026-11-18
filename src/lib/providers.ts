import type { ProviderKind, ProviderProfile } from "@/types";
import { titleFromContent } from "@/lib/utils";

export const APP_NAME = "ConoBot";
export const APP_VERSION = "0.1.0";

interface ProviderPreset {
  kind: ProviderKind;
  label: string;
  baseUrl: string;
  model: string;
  models: string[];
  maxTokens: number;
  temperature: number;
  requiresKey: boolean;
  blurb: string;
  placeholder: string;
}

export const PROVIDER_PRESETS: Record<ProviderKind, ProviderPreset> = {
  ollama: {
    kind: "ollama",
    label: "Ollama",
    baseUrl: "http://localhost:11434",
    model: "",
    models: [],
    maxTokens: 4096,
    temperature: 0.7,
    requiresKey: false,
    blurb: "Local runtime · automatic model discovery",
    placeholder: "http://localhost:11434",
  },
  lmstudio: {
    kind: "lmstudio",
    label: "LM Studio",
    baseUrl: "http://localhost:1234",
    model: "",
    models: [],
    maxTokens: 4096,
    temperature: 0.7,
    requiresKey: false,
    blurb: "Local OpenAI-compatible server",
    placeholder: "http://localhost:1234",
  },
  anthropic: {
    kind: "anthropic",
    label: "Claude",
    baseUrl: "https://api.anthropic.com",
    model: "claude-sonnet-4-5",
    models: [
      "claude-sonnet-4-5",
      "claude-opus-4-1",
      "claude-haiku-4-5",
      "claude-3-7-sonnet-latest",
      "claude-3-5-haiku-latest",
    ],
    maxTokens: 8192,
    temperature: 0.7,
    requiresKey: true,
    blurb: "Native Messages API · streaming",
    placeholder: "https://api.anthropic.com",
  },
  openai: {
    kind: "openai",
    label: "Custom endpoint",
    baseUrl: "https://api.openai.com",
    model: "",
    models: [],
    maxTokens: 4096,
    temperature: 0.7,
    requiresKey: false,
    blurb: "Any OpenAI-compatible API · local or cloud",
    placeholder: "https://api.openai.com",
  },
};

export const PROVIDER_KIND_ORDER: ProviderKind[] = [
  "ollama",
  "lmstudio",
  "anthropic",
  "openai",
];

let idCounter = 0;

/** Deterministic-enough unique id that does not depend on crypto availability. */
export function makeId(prefix = "id"): string {
  idCounter += 1;
  const random =
    typeof crypto !== "undefined" && "getRandomValues" in crypto
      ? Array.from(crypto.getRandomValues(new Uint8Array(6)))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")
      : Math.random().toString(16).slice(2, 14);
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}${random}`;
}

export function createProvider(kind: ProviderKind, overrides: Partial<ProviderProfile> = {}): ProviderProfile {
  const preset = PROVIDER_PRESETS[kind];
  return {
    id: `${kind}-${makeId("p").slice(-6)}`,
    kind,
    label: preset.label,
    baseUrl: preset.baseUrl,
    apiKey: "",
    model: preset.model,
    models: [...preset.models],
    temperature: preset.temperature,
    maxTokens: preset.maxTokens,
    enabled: true,
    systemPrompt: "",
    ...overrides,
  };
}

export function defaultProviders(): ProviderProfile[] {
  return PROVIDER_KIND_ORDER.map((kind, index) => {
    const provider = createProvider(kind);
    return { ...provider, id: `${kind}-default`, enabled: index < 2 };
  });
}

export const DEFAULT_SYSTEM_PROMPT = [
  "You are ConoBot, a precise senior software engineer embedded in a desktop coding cockpit.",
  "Answer with working code and short, concrete explanations.",
  "Use fenced code blocks with a language tag so artifacts can be saved to disk.",
  "When you are unsure, state the assumption instead of inventing APIs.",
].join(" ");

export function hostOf(baseUrl: string): string {
  try {
    const url = new URL(baseUrl);
    return url.host;
  } catch {
    return baseUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "") || "unset";
  }
}

export function providerKindLabel(kind: ProviderKind): string {
  return PROVIDER_PRESETS[kind].label;
}

export { titleFromContent };
