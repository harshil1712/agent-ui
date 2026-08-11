import { useCallback, useState } from "react";
import type { FileUIPart } from "ai";
import type { AgentAttachment } from "../agent-composer";

/**
 * The minimal submit surface required by `useAgentComposer`. It matches
 * the AI SDK's `sendMessage({ text, files })` shape so the hook stays
 * SDK-agnostic about where the message goes (an Agent, a `useChat` hook, etc.).
 */
export interface AgentComposerSendMessage {
  (input: { text: string; files?: FileList | FileUIPart[] }): void | Promise<void>;
}

export interface UseAgentComposerOptions {
  /** Sends a composed message, optionally with attached files. */
  sendMessage: AgentComposerSendMessage;
  /** Disables submitting while a turn is in progress. */
  busy?: boolean;
  /** Disables the composer entirely (for example while recovering). */
  disabled?: boolean;
  /** Called with the error if sending fails; the draft is preserved. */
  onError?: (error: unknown) => void;
}

export interface UseAgentComposerResult {
  /** Controlled textarea value. */
  input: string;
  setInput: (value: string) => void;
  /** Controlled attachment chips rendered by `AgentComposer`. */
  attachments: AgentAttachment[];
  /** Whether a non-empty, enabled submit is currently possible. */
  canSubmit: boolean;
  /**
   * Sends the current draft via `sendMessage`. On success the draft is
   * cleared; on failure the draft is preserved, the
   * `error` state is set, and `onError` is invoked. Never rejects.
   */
  submit: (value?: string) => Promise<void>;
  /** Merges new files into the pending attachments (deduped by identity). */
  handleAddAttachments: (files: FileList) => void;
  /** Removes a pending attachment by id. */
  handleRemoveAttachment: (id: string) => void;
  /** Clears the input, pending attachments, and any send error. */
  clear: () => void;
  /** The last send error, or `null` when the last send succeeded or none occurred. */
  error: unknown | null;
}

function fileId(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

/** Build a `FileList` from `File[]` so the AI SDK transports files natively. */
function toFileList(files: File[]): FileList | undefined {
  if (files.length === 0) return undefined;
  const transfer = new DataTransfer();
  for (const file of files) transfer.items.add(file);
  return transfer.files;
}

/**
 * Owns the controlled state for an `AgentComposer` and the pending file
 * list, and sends composed messages through a provided `sendMessage`. Handles
 * file conversion to the AI SDK's native attachment transport, so consumers do
 * not need to read files or embed context markers themselves.
 */
export function useAgentComposer({
  sendMessage,
  busy = false,
  disabled = false,
  onError
}: UseAgentComposerOptions): UseAgentComposerResult {
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<unknown | null>(null);

  const attachments: AgentAttachment[] = files.map((file) => ({
    id: fileId(file),
    name: file.name,
    size: file.size,
    mediaType: file.type
  }));

  const canSubmit = !busy && !disabled && (input.trim().length > 0 || files.length > 0);

  const submit = useCallback(
    async (value?: string) => {
      const text = (value ?? input).trim();
      if (!text && files.length === 0) return;
      if (busy || disabled) return;
      try {
        const fileList = toFileList(files);
        await sendMessage({ text, ...(fileList ? { files: fileList } : {}) });
        setError(null);
        setInput("");
        setFiles([]);
      } catch (err) {
        // Preserve the draft (input + files) so the user can retry or edit.
        setError(err);
        onError?.(err);
      }
    },
    [input, files, busy, disabled, sendMessage, onError]
  );

  const handleAddAttachments = useCallback((incoming: FileList) => {
    setFiles((current) => {
      const ids = new Set(current.map(fileId));
      const next = Array.from(incoming).filter((file) => !ids.has(fileId(file)));
      return [...current, ...next];
    });
  }, []);

  const handleRemoveAttachment = useCallback((id: string) => {
    setFiles((current) => current.filter((file) => fileId(file) !== id));
  }, []);

  const clear = useCallback(() => {
    setInput("");
    setFiles([]);
    setError(null);
  }, []);

  return {
    input,
    setInput,
    attachments,
    canSubmit,
    submit,
    handleAddAttachments,
    handleRemoveAttachment,
    clear,
    error
  };
}
