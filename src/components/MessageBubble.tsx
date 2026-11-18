import { useState } from "react";
import type { ChatMessage } from "@/types";
import { Markdown } from "@/components/Markdown";
import { ThinkingIndicator } from "@/components/ToastStack";
import {
  Alert,
  BrandMark,
  Check,
  Copy,
  Delete,
  FileCode,
  Refresh,
  Settings,
  StreamPulse,
} from "@/components/Icons";
import { CodeBlock } from "@/components/CodeBlock";
import { extractArtifacts } from "@/lib/artifacts";
import { saveCodeToDisk } from "@/services/persistence";
import { cn, copyText, formatTime } from "@/lib/utils";

interface MessageBubbleProps {
  message: ChatMessage;
  providerLabel: string;
  isLastAssistant: boolean;
  onRegenerate: () => void;
  onDelete: () => void;
  onOpenSettings: () => void;
}

export function MessageBubble({
  message,
  providerLabel,
  isLastAssistant,
  onRegenerate,
  onDelete,
  onOpenSettings,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const streaming = message.status === "streaming";
  const artifacts = message.role === "assistant" ? extractArtifacts(message) : [];

  const copy = async () => {
    if (await copyText(message.content)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  };

  const saveResponse = async () => {
    const result = await saveCodeToDisk("conobot-response.md", message.content);
    if (result.saved) {
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1600);
    }
  };

  if (message.role === "user") {
    return (
      <article className="group flex animate-fade-up justify-end">
        <div className="flex max-w-[85%] flex-col items-end gap-1">
          <div className="rounded-2xl rounded-br-md border border-line bg-ink-800/90 px-3.5 py-2.5 shadow-inset">
            <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-haze-100">
              {message.content}
            </p>
          </div>
          <div className="flex items-center gap-2 pr-1 text-[10px] text-haze-600 opacity-0 transition group-hover:opacity-100">
            <button
              type="button"
              onClick={copy}
              className="flex items-center gap-1 hover:text-haze-300"
            >
              {copied ? <Check size={10} /> : <Copy size={10} />}
              {copied ? "copied" : "copy"}
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="flex items-center gap-1 hover:text-ember-400"
            >
              <Delete size={10} /> delete
            </button>
            <span>{formatTime(message.createdAt)}</span>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="group flex animate-fade-up gap-3">
      <div className="relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-mint-500/25 bg-gradient-to-br from-mint-500/[0.14] to-iris-500/[0.07] text-mint-300">
        <BrandMark size={17} />
        {streaming && (
          <span className="absolute -inset-px rounded-lg border border-mint-400/40 animate-pulse-soft" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-[12px] font-semibold tracking-tight text-haze-100">ConoBot</span>
          <span className="rounded border border-line bg-ink-850 px-1.5 py-px font-mono text-[9.5px] text-haze-500">
            {message.model || providerLabel}
          </span>
          {streaming ? (
            <span className="flex items-center gap-1 text-[10px] text-mint-300/80">
              <StreamPulse size={11} />
              streaming
            </span>
          ) : message.status === "stopped" ? (
            <span className="text-[10px] text-haze-600">stopped</span>
          ) : (
            <span className="text-[10px] text-haze-600">{formatTime(message.createdAt)}</span>
          )}
        </div>

        {message.status === "error" ? (
          <div className="rounded-xl border border-ember-500/30 bg-ember-500/[0.055] p-3">
            <div className="flex items-start gap-2 text-xs text-ember-400">
              <Alert size={15} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">The request could not be completed.</p>
                <p className="mt-1 break-words font-mono text-[11px] leading-relaxed text-ember-400/80">
                  {message.error ?? "Unknown provider error."}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <button type="button" onClick={onRegenerate} className="btn-outline h-7 px-2 text-[11px]">
                    <Refresh size={12} /> Retry
                  </button>
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="btn-ghost h-7 px-2 text-[11px]"
                  >
                    <Settings size={12} /> Check endpoint
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : streaming && !message.content ? (
          <ThinkingIndicator label={`${providerLabel} is composing`} />
        ) : (
          <div className="relative">
            <Markdown>{message.content}</Markdown>
            {streaming && <span className="stream-caret" aria-hidden="true" />}
          </div>
        )}

        {message.status !== "streaming" && message.status !== "error" && (
          <div
            className={cn(
              "mt-2 flex items-center gap-1 text-[10.5px] text-haze-600",
              "opacity-0 transition duration-150 group-hover:opacity-100 focus-within:opacity-100",
            )}
          >
            <button
              type="button"
              onClick={copy}
              className="flex items-center gap-1 rounded px-1.5 py-1 hover:bg-white/[0.04] hover:text-haze-200"
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={saveResponse}
              className="flex items-center gap-1 rounded px-1.5 py-1 hover:bg-white/[0.04] hover:text-haze-200"
            >
              {saved ? <Check size={11} /> : <FileCode size={11} />}
              {saved ? "Saved" : "Save .md"}
            </button>
            {isLastAssistant && (
              <button
                type="button"
                onClick={onRegenerate}
                className="flex items-center gap-1 rounded px-1.5 py-1 hover:bg-white/[0.04] hover:text-haze-200"
              >
                <Refresh size={11} /> Regenerate
              </button>
            )}
            <button
              type="button"
              onClick={onDelete}
              className="flex items-center gap-1 rounded px-1.5 py-1 hover:bg-white/[0.04] hover:text-ember-400"
            >
              <Delete size={11} /> Delete
            </button>
            {artifacts.length > 0 && (
              <span className="ml-auto flex items-center gap-1 font-mono text-[9.5px] text-haze-600">
                <FileCode size={10} /> {artifacts.length} artifact{artifacts.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
        )}

        {message.status === "error" && message.content && (
          <div className="mt-2">
            <CodeBlock language="text" code={message.content} maxHeight={220} showSave={false} />
          </div>
        )}
      </div>
    </article>
  );
}
