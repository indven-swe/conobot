import { useEffect, useMemo, useRef, useState } from "react";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import css from "highlight.js/lib/languages/css";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import go from "highlight.js/lib/languages/go";
import ini from "highlight.js/lib/languages/ini";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import kotlin from "highlight.js/lib/languages/kotlin";
import markdown from "highlight.js/lib/languages/markdown";
import php from "highlight.js/lib/languages/php";
import plaintext from "highlight.js/lib/languages/plaintext";
import powershell from "highlight.js/lib/languages/powershell";
import python from "highlight.js/lib/languages/python";
import ruby from "highlight.js/lib/languages/ruby";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import swift from "highlight.js/lib/languages/swift";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";
import { Check, Copy, Download, FileCode } from "@/components/Icons";
import { saveCodeToDisk } from "@/services/persistence";
import { cn, copyText, filenameFor } from "@/lib/utils";

let registered = false;

function registerLanguages() {
  if (registered) return;
  registered = true;
  const languages: Record<string, Parameters<typeof hljs.registerLanguage>[1]> = {
    bash,
    c,
    cpp,
    csharp,
    css,
    dockerfile,
    go,
    ini,
    java,
    javascript,
    json,
    kotlin,
    markdown,
    php,
    plaintext,
    powershell,
    python,
    ruby,
    rust,
    sql,
    swift,
    typescript,
    xml,
    yaml,
  };
  for (const [name, definition] of Object.entries(languages)) {
    hljs.registerLanguage(name, definition);
  }
  hljs.registerAliases(["ts", "tsx"], { languageName: "typescript" });
  hljs.registerAliases(["js", "jsx"], { languageName: "javascript" });
  hljs.registerAliases(["sh", "shell", "zsh", "console"], { languageName: "bash" });
  hljs.registerAliases(["html", "svg", "vue"], { languageName: "xml" });
  hljs.registerAliases(["yml"], { languageName: "yaml" });
  hljs.registerAliases(["py"], { languageName: "python" });
  hljs.registerAliases(["rs"], { languageName: "rust" });
  hljs.registerAliases(["md"], { languageName: "markdown" });
  hljs.registerAliases(["toml"], { languageName: "ini" });
  hljs.registerAliases(["cs", "c#"], { languageName: "csharp" });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function highlightCode(code: string, language: string): { html: string; resolved: string } {
  registerLanguages();
  const name = language.toLowerCase();
  try {
    if (name && hljs.getLanguage(name)) {
      return { html: hljs.highlight(code, { language: name, ignoreIllegals: true }).value, resolved: name };
    }
    return { html: escapeHtml(code), resolved: "text" };
  } catch {
    return { html: escapeHtml(code), resolved: "text" };
  }
}

interface CodeBlockProps {
  language: string;
  code: string;
  filename?: string;
  compact?: boolean;
  showSave?: boolean;
  className?: string;
  /** Constrain the scroll area; used inside chat bubbles. */
  maxHeight?: number;
}

export function CodeBlock({
  language,
  code,
  filename,
  compact = false,
  showSave = true,
  className,
  maxHeight,
}: CodeBlockProps) {
  const highlighted = useMemo(() => highlightCode(code, language), [code, language]);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  const flash = (setter: (value: boolean) => void) => {
    setter(true);
    const timer = window.setTimeout(() => setter(false), 1600);
    timers.current.push(timer);
  };

  const onCopy = async () => {
    if (await copyText(code)) flash(setCopied);
  };

  const onSave = async () => {
    const name = filename ?? filenameFor(language, code);
    const result = await saveCodeToDisk(name, code);
    if (result.saved) flash(setSaved);
  };

  const label = (language || "text").toLowerCase();

  return (
    <div
      className={cn(
        "group/code my-3 overflow-hidden rounded-xl border border-line bg-ink-900/90",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-line-soft bg-white/[0.018] px-3 py-1.5">
        <FileCode size={13} className="text-mint-400/80" />
        <span className="font-mono text-2xs uppercase tracking-[0.12em] text-haze-500">{label}</span>
        <div className="ml-auto flex items-center gap-0.5 opacity-70 transition group-hover/code:opacity-100">
          <button type="button" onClick={onCopy} className="icon-btn h-6 w-6" title="Copy code">
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
          {showSave && (
            <button type="button" onClick={onSave} className="icon-btn h-6 w-6" title="Save to file">
              {saved ? <Check size={13} /> : <Download size={13} />}
            </button>
          )}
        </div>
      </div>
      <pre
        className={cn("overflow-auto px-3.5 py-3 text-[12px] leading-[1.65]", compact && "py-2")}
        style={maxHeight ? { maxHeight } : undefined}
      >
        <code
          className={cn("hljs font-mono", `language-${label}`)}
          // highlight.js output is escaped by the library itself.
          dangerouslySetInnerHTML={{ __html: highlighted.html }}
        />
      </pre>
    </div>
  );
}
