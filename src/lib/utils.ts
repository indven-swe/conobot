import clsx, { type ClassValue } from "clsx";

export function cn(...values: ClassValue[]): string {
  return clsx(values);
}

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function isMac(): boolean {
  return typeof navigator !== "undefined" && /mac/i.test(navigator.platform || navigator.userAgent);
}

/** Platform-aware label for shortcut hints. */
export function modKey(): string {
  return isMac() ? "⌘" : "Ctrl";
}

export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function relativeTime(timestamp: number): string {
  const delta = Date.now() - timestamp;
  if (delta < 45_000) return "just now";
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString([], { month: "short", day: "numeric" });
}

export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/** Derive a human title from the first user message. */
export function titleFromContent(content: string): string {
  const firstLine = content
    .replace(/```[\s\S]*?```/g, " code ")
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) return "New conversation";
  return truncate(firstLine.replace(/^#+\s*/, "").replace(/[*_`>]/g, ""), 64);
}

export function languageFromFence(language: string | undefined, code: string): string {
  if (language) return language.toLowerCase();
  if (/^\s*<(!doctype|html|div|section)/i.test(code)) return "html";
  if (/^\s*[{\[]/.test(code)) return "json";
  return "text";
}

export function filenameFor(language: string, code: string, index = 0): string {
  const extension: Record<string, string> = {
    typescript: "ts",
    ts: "ts",
    tsx: "tsx",
    javascript: "js",
    js: "js",
    jsx: "jsx",
    python: "py",
    py: "py",
    rust: "rs",
    rs: "rs",
    go: "go",
    java: "java",
    c: "c",
    cpp: "cpp",
    csharp: "cs",
    cs: "cs",
    html: "html",
    css: "css",
    scss: "scss",
    json: "json",
    yaml: "yml",
    yml: "yml",
    toml: "toml",
    bash: "sh",
    sh: "sh",
    shell: "sh",
    powershell: "ps1",
    sql: "sql",
    md: "md",
    markdown: "md",
    swift: "swift",
    kotlin: "kt",
    php: "php",
    ruby: "rb",
    xml: "xml",
    dockerfile: "Dockerfile",
  };
  const declared = /(?:filename|file|path)\s*[:=]\s*["']?([\w./-]+\.[A-Za-z0-9]+)/i.exec(code.slice(0, 400));
  if (declared) return declared[1];
  const ext = extension[language] ?? "txt";
  const suffix = index > 0 ? `-${index + 1}` : "";
  return ext === "Dockerfile" ? "Dockerfile" : `snippet${suffix}.${ext}`;
}

export function isProbablyHtml(language: string, code: string): boolean {
  if (["html", "htm", "svg"].includes(language)) return true;
  return /<html[\s>]|<body[\s>]|<div[\s>]|<!doctype html/i.test(code);
}

export function isProbablyMarkdown(language: string): boolean {
  return ["md", "markdown"].includes(language);
}

export function downloadTextFile(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = value;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
