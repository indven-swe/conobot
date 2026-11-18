import type { Artifact, ChatMessage } from "@/types";
import { filenameFor, languageFromFence } from "@/lib/utils";

const FENCE = /```([^\n`]*)\n([\s\S]*?)```/g;

export interface CodeFence {
  language: string;
  code: string;
  start: number;
  end: number;
}

export function findCodeFences(markdown: string): CodeFence[] {
  const fences: CodeFence[] = [];
  let match: RegExpExecArray | null;
  FENCE.lastIndex = 0;
  while ((match = FENCE.exec(markdown)) !== null) {
    fences.push({
      language: languageFromFence(match[1].trim(), match[2]),
      code: match[2].replace(/\n$/, ""),
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return fences;
}

/** Turn every code fence in a message into a first-class saveable artifact. */
export function extractArtifacts(message: ChatMessage): Artifact[] {
  return findCodeFences(message.content).map((fence, index) => {
    const filename = filenameFor(fence.language, fence.code, index);
    const titled = /^\s*(?:\/\/|#|--|\/\*)\s*(.+)$/.exec(fence.code.split("\n")[0] ?? "");
    return {
      id: `${message.id}_art_${index}`,
      messageId: message.id,
      title: titled && titled[1].length < 60 ? titled[1].replace(/\*\/$/, "").trim() : filename,
      language: fence.language,
      code: fence.code,
    };
  });
}

export function artifactsForSession(messages: ChatMessage[]): Artifact[] {
  const artifacts: Artifact[] = [];
  for (const message of messages) {
    if (message.role !== "assistant") continue;
    artifacts.push(...extractArtifacts(message));
  }
  return artifacts.reverse();
}
