import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ChatAddToolApproveResponseFunction,
  ChatStatus,
  UIMessage
} from "ai";
import type {
  AgentChatMessageModel,
  AgentChatMessageRole,
  AgentChatViewModel
} from "../agent-chat";
import type { AgentMessagePart } from "../agent-message";
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
  /**
   * Maximum number of recent messages adapted into browser-side view models.
   * Defaults to `100`; pass `false` to adapt the complete transcript. This
   * does not mutate or truncate the canonical chat state.
   */
  maxMessages?: number | false;
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
function isDefaultOpen(part: AgentMessagePart): boolean {
  if (part.type === "tool") return part.toolCall.status === "failed";
  if (part.type === "reasoning") return Boolean(part.reasoning.isStreaming);
  return false;
}

/**
 * Expansion-free normalized content for a single `UIMessage`, memoized by the
 * message object's identity. This holds the parts that do *not* depend on
 * expansion state: tool/reasoning parts carry their default `expanded` value
 * and no `onExpandedChange` wiring, while text/file/custom parts are final.
 *
 * The memoization is by reference only. Tool `input`/`output` payloads are
 * re-used by reference (a shallow reference is *not* a deep copy), and
 * mutations to a cached payload would leak across renders. Consumers must
 * treat `UIMessage` values as immutable.
 */
interface CachedMessageContent {
  id: string;
  role: AgentChatMessageRole;
  getText: () => string;
  parts: AgentMessagePart[];
}

/** The options that affect cached content and must invalidate it when they change. */
interface ContentOptions {
  toolDescriptions?: Record<string, string>;
  addToolApprovalResponse?: ChatAddToolApproveResponseFunction;
  onExpandedChange?: (id: string, open: boolean) => void;
}

const DEFAULT_MAX_MESSAGES = 100;

function normalizeMaxMessages(value: number | false | undefined): number | false {
  if (value === false) return false;
  if (value === undefined || !Number.isFinite(value)) return DEFAULT_MAX_MESSAGES;
  return Math.max(1, Math.floor(value));
}

/**
 * Overlay the resolved expansion state + `onExpandedChange` wiring onto a
 * cached, expansion-free part. This is the only per-render rework done for
 * unchanged messages: the heavy part normalization (text join, tool
 * payload mapping, reasoning text) stays cached, while expansion toggles
 * only re-create this thin wrapper.
 */
function applyExpansion(
  part: AgentMessagePart,
  expanded: Record<string, boolean>
): AgentMessagePart {
  const id = part.id ?? "";
  if (!Object.prototype.hasOwnProperty.call(expanded, id)) return part;

  if (part.type === "tool") {
    if (expanded[id] === part.toolCall.expanded) return part;
    return {
      ...part,
      toolCall: {
        ...part.toolCall,
        expanded: expanded[id]
      }
    };
  }
  if (part.type === "reasoning") {
    if (expanded[id] === part.reasoning.expanded) return part;
    return {
      ...part,
      reasoning: {
        ...part.reasoning,
        expanded: expanded[id]
      }
    };
  }
  return part;
}

/**
 * Headless adapter that maps the structural AI SDK / Cloudflare Agents chat
 * state into the SDK-free `AgentChatViewModel`. It owns the uncontrolled
 * expansion state (or honors controlled `expanded` + `onExpandedChange`) and
 * derives phase, busy/idle/recovering, pending, per-message flags, and
 * copy/retry/edit availability. Raw AI types exist only at this adapter's
 * input; the returned view model and its action callbacks use package types.
 *
 * Normalized content (text, part payloads, reasoning text) is memoized per
 * `UIMessage` object reference, so unchanged historical messages are not
 * re-normalized on every streaming update or expansion toggle — only the thin
 * expansion overlay is re-applied. The memo re-uses payload references by
 * identity (a shallow reference is not a deep copy) and is invalidated when
 * `toolDescriptions` or `addToolApprovalResponse` change. Cache entries and
 * internal expansion state are pruned when their messages disappear.
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
    onEdit,
    maxMessages
  } = options;

  const [internalExpanded, setInternalExpanded] = useState<Record<string, boolean>>({});

  const expandedOverrides = controlledExpanded ?? internalExpanded;
  const isExpansionControlled = controlledExpanded !== undefined;

  const setExpanded = useCallback(
    (id: string, open: boolean) => {
      if (!isExpansionControlled) {
        setInternalExpanded((previous) => ({ ...previous, [id]: open }));
      }
      controlledOnExpandedChange?.(id, open);
    },
    [isExpansionControlled, controlledOnExpandedChange]
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

  const normalizedMaxMessages = normalizeMaxMessages(maxMessages);
  const adaptedMessages = useMemo(
    () => normalizedMaxMessages === false || messages.length <= normalizedMaxMessages
      ? messages
      : messages.slice(messages.length - normalizedMaxMessages),
    [messages, normalizedMaxMessages]
  );

  // Per-hook cache of normalized, expansion-free message content keyed by the
  // `UIMessage` object reference. Unchanged historical messages are not
  // re-normalized on every streaming update or expansion toggle. The cache is
  // pruned (below) so entries vanish when their messages disappear.
  const contentCache = useRef<Map<UIMessage, CachedMessageContent>>(new Map());
  const contentOptions = useRef<ContentOptions>({});

  // Invalidate the content cache whenever an option that shapes the cached
  // content changes. Everything that is re-wired per render (expansion +
  // `onExpandedChange`) intentionally lives outside the cache.
  if (
    contentOptions.current.toolDescriptions !== toolDescriptions ||
    contentOptions.current.addToolApprovalResponse !== addToolApprovalResponse ||
    contentOptions.current.onExpandedChange !== onExpandedChange
  ) {
    contentCache.current = new Map();
    contentOptions.current = { toolDescriptions, addToolApprovalResponse, onExpandedChange };
  }

  const model = useMemo<AgentChatViewModel>(() => {
    const mapped: AgentChatMessageModel[] = [];

    for (let index = 0; index < adaptedMessages.length; index++) {
      const message = adaptedMessages[index];
      const isAssistant = message.role === "assistant";
      const isLast = index === adaptedMessages.length - 1;
      const isStreamingMessage = isAssistant && isStreaming && isLast;

      let content = contentCache.current.get(message);
      if (!content) {
        let joinedText: string | undefined;
        content = {
          id: message.id,
          role:
            message.role === "system" ? "system" : isAssistant ? "assistant" : "user",
          getText: () => {
            joinedText ??= getMessageText(message);
            return joinedText;
          },
          parts: toAgentMessageParts(message, {
            toolDescriptions,
            addToolApprovalResponse,
            onExpandedChange
          })
        };
        contentCache.current.set(message, content);
      }

      mapped.push({
        id: content.id,
        role: content.role,
        parts: content.parts.map((part) => applyExpansion(part, expandedOverrides)),
        get text() {
          return content.getText();
        },
        isStreaming: isStreamingMessage,
        isAssistant,
        canRetry: Boolean(isAssistant && isLast && !busy && effectiveRetry),
        canEdit: Boolean(message.role === "user" && effectiveEdit),
        isLast
      });
    }

    // Prune the content cache so entries for messages that disappeared are
    // dropped rather than retained indefinitely.
    if (contentCache.current.size > adaptedMessages.length) {
      const current = new Set(adaptedMessages);
      for (const key of contentCache.current.keys()) {
        if (!current.has(key)) contentCache.current.delete(key);
      }
    }

    // Expose the actual resolved expansion state (defaults applied) for every
    // toggleable part, so consumers can read the current open state and
    // `toggleExpanded` can flip a default-open (failed tool / streaming
    // reasoning) part closed.
    const resolvedExpansion: Record<string, boolean> = {};
    for (const msg of mapped) {
      for (const part of msg.parts) {
        if (part.type === "tool" || part.type === "reasoning") {
          const id = part.id ?? "";
          resolvedExpansion[id] = expandedOverrides[id] ?? isDefaultOpen(part);
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
    adaptedMessages,
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
    onCopy,
    controlledExpanded
  ]);

  // The set of toggleable part ids currently present in the view model. Used
  // to prune `internalExpanded` so entries for parts that disappeared (for
  // example, a message or tool call removed mid-turn) do not linger.
  const presentPartIds = useMemo(() => {
    const ids = new Set<string>();
    for (const message of model.messages) {
      for (const part of message.parts) {
        if (part.type === "tool" || part.type === "reasoning") {
          const id = part.id ?? "";
          if (id) ids.add(id);
        }
      }
    }
    return ids;
  }, [model.messages]);

  useEffect(() => {
    if (controlledExpanded !== undefined) return;
    setInternalExpanded((previous) => {
      if (
        Object.keys(previous).length === 0 ||
        Object.keys(previous).every((id) => presentPartIds.has(id))
      ) {
        return previous;
      }
      const next: Record<string, boolean> = {};
      for (const id of Object.keys(previous)) {
        if (presentPartIds.has(id)) next[id] = previous[id];
      }
      return next;
    });
  }, [presentPartIds, controlledExpanded]);

  return model;
}
