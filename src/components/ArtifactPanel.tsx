import { useEffect, useMemo, useRef, useState } from "react";
import type { Artifact } from "@/types";
import { Markdown } from "@/components/Markdown";
import { CodeBlock } from "@/components/CodeBlock";
import {
  Check,
  Close,
  CodePanel,
  Copy,
  Download,
  FileCode,
  Play,
} from "@/components/Icons";
import { saveCodeToDisk } from "@/services/persistence";
import { cn, copyText, filenameFor, isProbablyHtml, isProbablyMarkdown } from "@/lib/utils";

interface ArtifactPanelProps {
  artifacts: Artifact[];
  onClose: () => void;
  onResize: (widthPercent: number) => void;
}

export function ArtifactPanel({ artifacts, onClose, onResize }: ArtifactPanelProps) {
  const [activeId, setActiveId] = useState<string | null>(artifacts[0]?.id ?? null);
  const [view, setView] = useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const dragging = useRef(false);

  useEffect(() => {
    if (!activeId && artifacts[0]) setActiveId(artifacts[0].id);
    if (activeId && !artifacts.some((artifact) => artifact.id === activeId)) {
      setActiveId(artifacts[0]?.id ?? null);
    }
  }, [artifacts, activeId]);

  const active = useMemo(
    () => artifacts.find((artifact) => artifact.id === activeId) ?? artifacts[0] ?? null,
    [artifacts, activeId],
  );

  useEffect(() => {
    setCopied(false);
    setSaved(false);
    if (active) {
      setView(isProbablyHtml(active.language, active.code) || isProbablyMarkdown(active.language) ? "preview" : "code");
    }
  }, [active?.id]);

  const previewKind: "html" | "markdown" | "code" = active
    ? isProbablyHtml(active.language, active.code)
      ? "html"
      : isProbablyMarkdown(active.language)
        ? "markdown"
        : "code"
    : "code";

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (!dragging.current) return;
      const width = ((window.innerWidth - event.clientX) / window.innerWidth) * 100;
      onResize(Math.min(66, Math.max(28, width)));
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [onResize]);

  const filename = active
    ? /\.\w{1,5}$/.test(active.title)
      ? active.title
      : filenameFor(active.language, active.code)
    : "artifact.txt";

  const copy = async () => {
    if (active && (await copyText(active.code))) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  };

  const save = async () => {
    if (!active) return;
    const result = await saveCodeToDisk(filename, active.code);
    if (result.saved) {
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1600);
    }
  };

  return (
    <aside
      className="relative z-20 flex h-full min-w-[320px] flex-col border-l border-line/80 bg-ink-900/60 backdrop-blur-xl"
      style={{ width: "100%" }}
    >
      <div
        onPointerDown={() => {
          dragging.current = true;
          document.body.style.cursor = "col-resize";
          document.body.style.userSelect = "none";
        }}
        className="absolute -left-[3px] top-0 z-30 h-full w-[6px] cursor-col-resize transition hover:bg-mint-500/25"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize code canvas"
      />

      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line/70 px-3">
        <CodePanel size={14} className="text-mint-400/90" />
        <span className="text-[11.5px] font-semibold tracking-tight text-haze-200">Code canvas</span>
        <span className="chip py-0 text-[9.5px] text-haze-500">{artifacts.length}</span>
        <div className="ml-auto flex items-center gap-0.5">
          <div className="mr-1 flex items-center rounded-md border border-line bg-ink-950/60 p-0.5">
            {(["preview", "code"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                disabled={mode === "preview" && previewKind === "code"}
                className={cn(
                  "rounded px-2 py-0.5 text-[10px] transition disabled:opacity-35",
                  view === mode ? "bg-white/[0.07] text-haze-100" : "text-haze-500 hover:text-haze-200",
                )}
              >
                {mode}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => void copy()} className="icon-btn h-7 w-7" title="Copy artifact">
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
          <button type="button" onClick={() => void save()} className="icon-btn h-7 w-7" title="Save to disk">
            {saved ? <Check size={13} /> : <Download size={13} />}
          </button>
          <button type="button" onClick={onClose} className="icon-btn h-7 w-7" title="Close canvas">
            <Close size={13} />
          </button>
        </div>
      </div>

      {artifacts.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-ink-850 text-haze-600">
            <FileCode size={22} />
          </span>
          <p className="text-[12px] font-medium text-haze-300">No artifacts yet</p>
          <p className="max-w-[240px] text-[11px] leading-relaxed text-haze-600">
            Every fenced code block in a response lands here with syntax highlighting, copy and
            save-to-file.
          </p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <div className="w-[172px] shrink-0 overflow-y-auto border-r border-line/70 p-1.5">
            {artifacts.map((artifact) => {
              const selected = active?.id === artifact.id;
              return (
                <button
                  key={artifact.id}
                  type="button"
                  onClick={() => setActiveId(artifact.id)}
                  className={cn(
                    "group mb-0.5 flex w-full items-start gap-1.5 rounded-md px-1.5 py-1.5 text-left transition",
                    selected ? "bg-white/[0.06]" : "hover:bg-white/[0.025]",
                  )}
                >
                  <span className={cn("mt-0.5", selected ? "text-mint-300" : "text-haze-600")}>
                    <FileCode size={12} />
                  </span>
                  <span className="min-w-0">
                    <span
                      className={cn(
                        "block truncate text-[10.5px] leading-tight",
                        selected ? "text-haze-100" : "text-haze-400",
                      )}
                    >
                      {artifact.title}
                    </span>
                    <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-wide text-haze-600">
                      {artifact.language || "text"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            {active && (
              <>
                <div className="flex items-center gap-2 border-b border-line/60 px-3 py-1.5">
                  <span className="truncate font-mono text-[10px] text-haze-500">{filename}</span>
                  <span className="ml-auto chip py-0 text-[9px] uppercase tracking-wide">
                    {active.language || "text"}
                  </span>
                </div>

                <div className="min-h-0 flex-1 overflow-auto p-2.5">
                  {view === "preview" && previewKind === "html" && (
                    <div className="flex h-full flex-col gap-2">
                      <div className="flex items-center gap-2 rounded-md border border-line/70 bg-ink-950/60 px-2 py-1">
                        <Play size={10} className="text-mint-400/80" />
                        <span className="text-[9.5px] text-haze-500">
                          Sandboxed preview · scripts isolated from the app
                        </span>
                        <span className="ml-auto font-mono text-[9px] text-haze-600">srcdoc</span>
                      </div>
                      <iframe
                        title={active.title}
                        srcDoc={active.code}
                        sandbox="allow-scripts allow-forms allow-modals"
                        className="min-h-0 w-full flex-1 rounded-lg border border-line bg-white"
                      />
                    </div>
                  )}

                  {view === "preview" && previewKind === "markdown" && (
                    <div className="rounded-lg border border-line/70 bg-ink-950/40 p-3">
                      <Markdown>{active.code}</Markdown>
                    </div>
                  )}

                  {(view === "code" || previewKind === "code") && (
                    <CodeBlock
                      language={active.language}
                      code={active.code}
                      showSave={false}
                      className="my-0"
                    />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
