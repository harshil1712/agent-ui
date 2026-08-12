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

/** Why a file was rejected by the opt-in client-side attachment validation. */
export type AgentRejectedFileReason = "max-files" | "max-size";

/**
 * A file rejected by the opt-in client-side attachment validation. `reason` is
 * `"max-files"` when the configured `maxFiles` cap is reached and `"max-size"`
 * when a single file exceeds the configured `maxSize`. This is a purely
 * client-side UX guard; it is not server validation and does not replace
 * enforcement on the receiver.
 */
export interface AgentRejectedFile {
  file: File;
  reason: AgentRejectedFileReason;
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
  /**
   * Opt-in client-side cap on how many files can be pending at once. When set,
   * incoming files that would exceed the cap are rejected with reason
   * `"max-files"` instead of being added. Omit for no limit (default).
   */
  maxFiles?: number;
  /**
   * Opt-in client-side cap on a single attachment's size in bytes. Incoming
   * files larger than this are rejected with reason `"max-size"`. Omit for no
   * limit (default). This is a UX guard, not server validation.
   */
  maxSize?: number;
  /**
   * Called whenever the opt-in validation rejects one or more incoming files,
   * with the list of rejected files. Consumers can surface a notice; rejected
   * files never reach `sendMessage`.
   */
  onRejectedFiles?: (rejected: AgentRejectedFile[]) => void;
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
   * Sends the current draft via `sendMessage`. The submitted draft is cleared
   * immediately; on failure it is restored when doing so will not overwrite a
   * new draft, the `error` state is set, and `onError` is invoked. Never rejects.
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
  /**
   * Files rejected by the opt-in client-side validation during the most recent
   * `handleAddAttachments` call. Empty when no validation is configured or
   * nothing was rejected. Cleared on `clear` and on a successful submit.
   */
  rejectedFiles: AgentRejectedFile[];
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
 * Apply the opt-in client-side validation to a batch of files that have
 * already been deduped against the current pending list. Returns the accepted
 * files (to be added) and the rejected files (with reasons). Unrestricted when
 * `maxFiles` and `maxSize` are omitted.
 */
function validateFiles(
  files: File[],
  currentCount: number,
  maxFiles: number | undefined,
  maxSize: number | undefined
): { accepted: File[]; rejected: AgentRejectedFile[] } {
  const accepted: File[] = [];
  const rejected: AgentRejectedFile[] = [];
  let count = currentCount;

  for (const file of files) {
    if (maxSize !== undefined && file.size > maxSize) {
      rejected.push({ file, reason: "max-size" });
      continue;
    }
    if (maxFiles !== undefined && count >= maxFiles) {
      rejected.push({ file, reason: "max-files" });
      continue;
    }
    accepted.push(file);
    count += 1;
  }

  return { accepted, rejected };
}

/**
 * Owns the controlled state for an `AgentComposer` and the pending file
 * list, and sends composed messages through a provided `sendMessage`. Handles
 * file conversion to the AI SDK's native attachment transport, so consumers do
 * not need to read files or embed context markers themselves. Optional
 * client-side attachment validation (`maxFiles`/`maxSize`) rejects offending
 * files via `onRejectedFiles` and `rejectedFiles`; the default is unrestricted.
 */
export function useAgentComposer({
  sendMessage,
  busy = false,
  disabled = false,
  onError,
  maxFiles,
  maxSize,
  onRejectedFiles
}: UseAgentComposerOptions): UseAgentComposerResult {
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<unknown | null>(null);
  const [rejectedFiles, setRejectedFiles] = useState<AgentRejectedFile[]>([]);

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
      const submittedInput = input;
      const submittedFiles = files;
      const submittedRejectedFiles = rejectedFiles;
      try {
        const fileList = toFileList(submittedFiles);

        // Clear as soon as the message is accepted for sending. Some chat
        // transports resolve sendMessage only after the assistant finishes,
        // which would otherwise leave the sent message in the composer for the
        // entire response.
        setInput("");
        setFiles([]);
        setError(null);
        setRejectedFiles([]);

        await sendMessage({ text, ...(fileList ? { files: fileList } : {}) });
      } catch (err) {
        // Restore the submitted draft without replacing anything composed
        // while the request was pending.
        setInput((current) => current || submittedInput);
        setFiles((current) => {
          const currentIds = new Set(current.map(fileId));
          return [...submittedFiles.filter((file) => !currentIds.has(fileId(file))), ...current];
        });
        setRejectedFiles((current) =>
          current.length > 0 ? current : submittedRejectedFiles
        );
        setError(err);
        onError?.(err);
      }
    },
    [input, files, rejectedFiles, busy, disabled, sendMessage, onError]
  );

  const handleAddAttachments = useCallback(
    (incoming: FileList) => {
      const ids = new Set(files.map(fileId));
      const seenInBatch = new Set<string>();
      const fresh: File[] = [];
      // Dedupe against the current pending list and against duplicates within
      // this same incoming batch (both keyed by identity).
      for (const file of Array.from(incoming)) {
        const id = fileId(file);
        if (ids.has(id) || seenInBatch.has(id)) continue;
        seenInBatch.add(id);
        fresh.push(file);
      }
      const { accepted, rejected } = validateFiles(fresh, files.length, maxFiles, maxSize);
      if (accepted.length > 0) {
        setFiles((current) => [...current, ...accepted]);
      }
      // Always replace rejectedFiles so it reflects the most recent add
      // attempt: empty when nothing was rejected this time.
      setRejectedFiles(rejected);
      if (rejected.length > 0) {
        onRejectedFiles?.(rejected);
      }
    },
    [files, maxFiles, maxSize, onRejectedFiles]
  );

  const handleRemoveAttachment = useCallback((id: string) => {
    setFiles((current) => current.filter((file) => fileId(file) !== id));
  }, []);

  const clear = useCallback(() => {
    setInput("");
    setFiles([]);
    setError(null);
    setRejectedFiles([]);
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
    error,
    rejectedFiles
  };
}
