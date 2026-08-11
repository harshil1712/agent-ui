import { useCallback, useMemo, useState } from "react";
import type {
  ChatAddToolApproveResponseFunction,
  ChatStatus,
  UIMessage
} from "ai";
import type {
  AgentChatMessageModel,
  AgentChatViewModel
} from "../agent-chat";
import type { AgentReasoningPart, AgentToolPart } from "../agent-message";
import { getMessageText, mapChatStatus, toAgentMessageParts } from "./map";
import type { AgentComposerSendMessage } from "./use-agent-composer";

/**
 * The structural AI SDK / Cloudflare Agents chat state accepted by
 * `useAgentChatUI`. It matches the shape returned by `useChat` (AI SDK)
 * and `useAgentChat` (Cloudflare Agents). `sendMessage`, `stop`, and
 * `regenerate` are only required by `AgentChat.Preset`.
 */
export interface AgentChatInput {
  messages: UIMessage[];
  status: ChatStatus;
  error?: unknown;
  isStreaming?: boolean;
  isRecovering?: boolean;
  isToolContinuation?: boolean;
  addToolApprovalResponse?: ChatAddToolApproveResponseFunction;
  /** Only needed when `AgentChat.Preset` should render a default composer. */
  sendMessage?: AgentComposerSendMessage;
  /** Only needed when `AgentChat.Preset` renders a stop button. */
  stop?: () => void;
  /** Used to derive `canRetry` and wire the retry action when no `onRetry` is given. */
  regenerate?: () => void;
}

export interface UseAgentChatUIOptions {
  /** Optional one-line description per tool name, forwarded to tool parts. */
  toolDescriptions?: Record<string, string>;
  /** Controlled expansion overrides keyed by part id. */
  expanded?: Record<string, boolean>;
  /** Called with a part id and its new open state when a disclosure toggles. */
  onExpandedChange?: (id: string, open: boolean) => void;
  /** Called with the normalized message when a copy action is activated. */
  onCopy?: (message: AgentChatMessageModel) => void;
  /** Called with the normalized message when a retry action is activated. */
  onRetry?: (message: AgentChatMessageModel) => void;
  /** Called with the normalized message when an edit action is activated. */
  onEdit?: (message: AgentChatMessageModel) => void;
}

/** Whether a mapped part is open by default, independent of any override. */
function isDefaultOpen(part: AgentToolPart | AgentReasoningPart): boolean {
  if (part.type === "tool") return part.toolCall.status === "failed";
  return Boolean(part.reasoning.isStreaming);
}

/**
 * Headless adapter that maps the structural AI SDK / Cloudflare Agents chat
 * state into the SDK-free `AgentChatViewModel`. It owns the uncontrolled
 * expansion state (or honors controlled `expanded` + `onExpandedChange`) and
 * derives phase, busy/idle/recovering, pending, per-message flags, and
 * copy/retry/edit availability. Raw AI types exist only at this adapter's
 * input; the returned view model and its action callbacks use package types.
 */
export function useAgentChatUI(
  chat: AgentChatInput,
  options: UseAgentChatUIOptions = {}
): AgentChatViewModel {
  const {
    toolDescriptions,
    expanded: controlledExpanded,
    onExpandedChange: controlledOnExpandedChange,
    onCopy,
    onRetry,
    onEdit
  } = options;

  const [internalExpanded, setInternalExpanded] = useState<Record<string, boolean>>({});

  const expandedOverrides = controlledExpanded ?? internalExpanded;

  const setExpanded = useCallback(
    (id: string, open: boolean) => {
      if (controlledExpanded === undefined) {
        setInternalExpanded((previous) => ({ ...previous, [id]: open }));
      }
      controlledOnExpandedChange?.(id, open);
    },
    [controlledExpanded, controlledOnExpandedChange]
  );

  const {
    messages,
    status,
    error,
    isStreaming = false,
    isRecovering = false,
    isToolContinuation = false,
    addToolApprovalResponse,
    regenerate
  } = chat;

  // Effective retry: a custom `onRetry` wins; otherwise wrap `chat.regenerate`.
  const effectiveRetry = onRetry
    ? onRetry
    : regenerate
      ? () => regenerate()
      : undefined;
  const effectiveEdit = onEdit;

  const phase = mapChatStatus({ status, isRecovering });
  const busy =
    isStreaming || isRecovering || status === "submitted" || status === "streaming";
  const isIdle = messages.length === 0;
  const showPending =
    status === "submitted" && !isToolContinuation && messages.at(-1)?.role !== "assistant";

  const onExpandedChange = useCallback(
    (id: string, open: boolean) => setExpanded(id, open),
    [setExpanded]
  );

  const model = useMemo<AgentChatViewModel>(() => {
    const mapped: AgentChatMessageModel[] = messages.map((message, index) => {
      const isAssistant = message.role === "assistant";
      const isLast = index === messages.length - 1;
      const isStreamingMessage = isAssistant && isStreaming && isLast;
      return {
        id: message.id,
        role: message.role === "system" ? "system" : isAssistant ? "assistant" : "user",
        parts: toAgentMessageParts(message, {
          toolDescriptions,
          expanded: expandedOverrides,
          onExpandedChange,
          addToolApprovalResponse
        }),
        text: getMessageText(message),
        isStreaming: isStreamingMessage,
        isAssistant,
        canRetry: Boolean(isAssistant && isLast && !busy && effectiveRetry),
        canEdit: Boolean(message.role === "user" && effectiveEdit),
        isLast
      };
    });

    // Expose the actual resolved expansion state (defaults applied) for every
    // toggleable part, so consumers can read the current open state and
    // `toggleExpanded` can flip a default-open (failed tool / streaming
    // reasoning) part closed.
    const resolvedExpansion: Record<string, boolean> = {};
    for (const msg of mapped) {
      for (const part of msg.parts) {
        if (part.type === "tool" || part.type === "reasoning") {
          resolvedExpansion[part.id ?? ""] =
            expandedOverrides[part.id ?? ""] ?? isDefaultOpen(part);
        }
      }
    }

    const toggleExpanded = (id: string) => {
      const current = resolvedExpansion[id] ?? false;
      setExpanded(id, !current);
    };

    return {
      messages: mapped,
      phase,
      busy,
      isRecovering,
      showPending,
      isIdle,
      error,
      expanded: resolvedExpansion,
      setExpanded,
      toggleExpanded,
      actions: {
        copy: onCopy,
        retry: effectiveRetry,
        edit: effectiveEdit
      }
    };
  }, [
    messages,
    status,
    isStreaming,
    isRecovering,
    isToolContinuation,
    addToolApprovalResponse,
    toolDescriptions,
    expandedOverrides,
    phase,
    busy,
    showPending,
    isIdle,
    error,
    onExpandedChange,
    setExpanded,
    effectiveRetry,
    effectiveEdit,
    onCopy
  ]);

  return model;
}
