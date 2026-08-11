import {
  createContext,
  useContext,
  useMemo,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ReactNode
} from "react";
import {
  AgentMessage,
  type AgentCustomPart,
  type AgentFilePart,
  type AgentMessagePart,
  type AgentMessageProps,
  type AgentMessageRole,
  type AgentReasoningPart,
  type AgentTextPart,
  type AgentToolPart
} from "./agent-message";
import { AgentMarkdown, type AgentMarkdownProps } from "./agent-markdown";
import type { AgentFileProps } from "./agent-file";
import type { AgentPendingProps } from "./agent-pending";
import type { AgentReasoningProps } from "./agent-reasoning";
import type { ToolCallProps } from "./tool-call";

/**
 * The roles a transcript message can take. This is intentionally SDK-free:
 * the adapter maps raw AI SDK roles onto these before they reach the view.
 */
export type AgentChatMessageRole = "user" | "assistant" | "system";

/**
 * A normalized, SDK-free message in the chat view model. Produced by the
 * adapter (for example `useAgentChatUI` in the `@agent-ui/react/agents`
 * entry point) and consumed by `AgentChat` presentational components.
 */
export interface AgentChatMessageModel {
  id: string;
  role: AgentChatMessageRole;
  /** Mapped parts ready for the primitive renderers. */
  parts: AgentMessagePart[];
  /** Joined text of the text parts, useful for copy-to-clipboard. */
  text: string;
  /** Whether this is the actively streaming assistant message. */
  isStreaming: boolean;
  /** Convenience flag for `role === "assistant"`. */
  isAssistant: boolean;
  /** Whether the retry action should be offered for this message. */
  canRetry: boolean;
  /** Whether the edit action should be offered for this message. */
  canEdit: boolean;
  /** Whether this is the last message in the transcript. */
  isLast: boolean;
}

/**
 * The compact lifecycle phases an agent chat UI usually cares about.
 * `"thinking"` is the first-token wait after a submission, `"streaming"` is an
 * in-flight response, `"recovering"` is a durable turn resuming, `"ready"` is
 * idle, and `"error"` is a failed submission.
 */
export type AgentChatPhase =
  | "thinking"
  | "streaming"
  | "recovering"
  | "ready"
  | "error";

export interface AgentChatActions {
  /** Copies the normalized message. Present when a copy handler is wired. */
  copy?: (message: AgentChatMessageModel) => void;
  /** Regenerates the last assistant message. Present when a retry handler is wired. */
  retry?: (message: AgentChatMessageModel) => void;
  /** Edits the message. Present when an edit handler is wired. */
  edit?: (message: AgentChatMessageModel) => void;
}

/**
 * The normalized, SDK-free view model of an agent chat. `AgentChat.Root` makes
 * this available to `AgentChat.Messages` via context, and it can also be passed
 * directly as the `viewModel` prop.
 */
export interface AgentChatViewModel {
  messages: AgentChatMessageModel[];
  phase: AgentChatPhase;
  /** True while any assistant turn is in flight (thinking, streaming, recovering). */
  busy: boolean;
  isRecovering: boolean;
  /** Whether to render the first-token pending placeholder. */
  showPending: boolean;
  /** True when there are no messages yet. */
  isIdle: boolean;
  /** The submission error, if any. */
  error?: unknown;
  /**
   * Resolved expansion state keyed by part id. This is the *actual* open state
   * of every toggleable tool/reasoning part, with defaults applied (failed
   * tools and streaming reasoning are open by default). `toggleExpanded` flips
   * this resolved state, so it closes a default-open part on first toggle.
   */
  expanded: Record<string, boolean>;
  /** Sets a part's open state by id. */
  setExpanded: (id: string, open: boolean) => void;
  /** Toggles a part's resolved open state by id. */
  toggleExpanded: (id: string) => void;
  actions: AgentChatActions;
}

/* ---------------------------------------------------------------------------
 * Resolver contexts
 * ------------------------------------------------------------------------- */

/** Shared context for every prop resolver: the whole view model. */
export interface AgentChatContextBase {
  chat: AgentChatViewModel;
}

/** Context for the per-message resolver. */
export interface AgentChatMessageContext extends AgentChatContextBase {
  message: AgentChatMessageModel;
  /** Index of the message within `chat.messages`. */
  messageIndex: number;
}

/** Context for a per-part resolver. */
export interface AgentChatPartContext<P> extends AgentChatMessageContext {
  part: P;
  /** Index of the part within `message.parts`. */
  partIndex: number;
}

export interface AgentChatToolContext extends AgentChatPartContext<AgentToolPart> {}
export interface AgentChatReasoningContext extends AgentChatPartContext<AgentReasoningPart> {}
export interface AgentChatTextContext extends AgentChatPartContext<AgentTextPart> {}
export interface AgentChatFileContext extends AgentChatPartContext<AgentFilePart> {}
export interface AgentChatCustomPartContext extends AgentChatPartContext<AgentCustomPart> {}

/**
 * Context for the pending resolver. `message` is the synthetic assistant
 * placeholder, `messageIndex` is its position at the end of the transcript.
 */
export interface AgentChatPendingContext extends AgentChatMessageContext {}

/* ---------------------------------------------------------------------------
 * Context + Root
 * ------------------------------------------------------------------------- */

const AgentChatViewModelContext = createContext<AgentChatViewModel | null>(null);

/** Reads the view model provided by the nearest `AgentChat.Root`, or `null`. */
function useAgentChatViewModelContext(): AgentChatViewModel | null {
  return useContext(AgentChatViewModelContext);
}

/**
 * Reads the view model provided by the nearest `AgentChat.Root`. Throws when
 * no `AgentChat.Root` is present.
 */
export function useAgentChatViewModel(): AgentChatViewModel {
  const value = useAgentChatViewModelContext();
  if (!value) {
    throw new Error(
      "AgentChat.Messages must be rendered inside <AgentChat.Root>, or given an explicit `viewModel` prop."
    );
  }
  return value;
}

export interface AgentChatRootProps {
  viewModel: AgentChatViewModel;
  children?: ReactNode;
}

/**
 * Provides the `AgentChatViewModel` to descendant components via context.
 * This wrapper is layout-neutral: it renders no markup of its own, so it does
 * not disturb a consumer's shell, header, or grid layout.
 */
export function AgentChatRoot({ viewModel, children }: AgentChatRootProps) {
  return (
    <AgentChatViewModelContext.Provider value={viewModel}>
      {children}
    </AgentChatViewModelContext.Provider>
  );
}

/* ---------------------------------------------------------------------------
 * Messages
 * ------------------------------------------------------------------------- */

export interface AgentChatMessagesProps
  extends Omit<ComponentPropsWithoutRef<"div">, "className" | "style"> {
  /**
   * Explicit view model. When omitted, the view model is read from the
   * nearest `AgentChat.Root` context.
   */
  viewModel?: AgentChatViewModel;
  /**
   * Whole-transcript render override. When provided, it replaces the default
   * empty/recovery/messages/pending contents entirely and takes precedence
   * over every other rendering path.
   */
  render?: (viewModel: AgentChatViewModel) => ReactNode;
  /** Full override for an entire message. Takes precedence over all other message rendering. */
  renderMessage?: (message: AgentChatMessageModel, messageIndex: number) => ReactNode;
  /**
   * Resolver returning props merged *onto* each `AgentMessage` after the
   * internal defaults and the primitive prop resolvers. It can intentionally
   * override any message prop — including `parts`, action callbacks
   * (`onCopy`/`onRetry`/`onEdit`), render callbacks (`renderText`/`renderTool`
   * …), slots, labels, variant, or density — for a single message. Props you
   * do not return stay as the wired defaults (copy/retry/edit actions remain
   * connected unless you override them).
   */
  messageProps?: (context: AgentChatMessageContext) => Partial<AgentMessageProps>;
  /** Resolver returning props merged onto each default `ToolCall`. */
  toolProps?: (context: AgentChatToolContext) => Partial<ToolCallProps>;
  /** Resolver returning props merged onto each default `AgentReasoning`. */
  reasoningProps?: (context: AgentChatReasoningContext) => Partial<AgentReasoningProps>;
  /** Resolver returning props merged onto each default `AgentMarkdown` text render. */
  textProps?: (context: AgentChatTextContext) => Partial<AgentMarkdownProps>;
  /** Resolver returning props merged onto each default `AgentFile`. */
  fileProps?: (context: AgentChatFileContext) => Partial<AgentFileProps>;
  /** Resolver returning props merged onto the built-in `AgentPending` placeholder. */
  pendingProps?: (context: AgentChatPendingContext) => Partial<AgentPendingProps>;
  /** Full override for a custom part, receiving the full part context. */
  renderPart?: (context: AgentChatCustomPartContext) => ReactNode;
  /** Full override for a text part, receiving the full part context. */
  renderText?: (context: AgentChatTextContext) => ReactNode;
  /** Full override for a tool part, receiving the full part context. */
  renderTool?: (context: AgentChatToolContext) => ReactNode;
  /** Full override for a reasoning part, receiving the full part context. */
  renderReasoning?: (context: AgentChatReasoningContext) => ReactNode;
  /** Full override for a file part, receiving the full part context. */
  renderFile?: (context: AgentChatFileContext) => ReactNode;
  /** Full override replacing the pending placeholder message. */
  renderPending?: (context: AgentChatPendingContext) => ReactNode;
  /** Custom empty-state content shown when there are no messages. */
  empty?: ReactNode;
  /** Function returning custom empty-state content when there are no messages. */
  renderEmpty?: () => ReactNode;
  /** Label for the recovery notice. Defaults to `"Recovering interrupted turn…"`. */
  recoveringLabel?: string;
  className?: string;
  style?: CSSProperties;
}

function joinClass(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Compound entry point for the SDK-free agent chat presentational layer:
 * `AgentChat.Root` (context provider) and `AgentChat.Messages` (transcript).
 * The headless adapter (`useAgentChatUI`) and zero-config `AgentChat.Preset`
 * live in the `@agent-ui/react/agents` entry point.
 */
export const AgentChat = {
  Root: AgentChatRoot,
  Messages: AgentChatMessages
};

/**
 * Renders a normalized `AgentChatViewModel` as an agent transcript using
 * the SDK-free primitives. Consumes the view model from `AgentChat.Root` or an
 * explicit `viewModel` prop, owns no expansion state itself, and exposes
 * per-primitive prop resolvers plus full render overrides.
 */
export function AgentChatMessages({
  viewModel: explicitViewModel,
  render: renderTranscript,
  renderMessage,
  messageProps,
  toolProps,
  reasoningProps,
  textProps,
  fileProps,
  pendingProps,
  renderPart,
  renderText,
  renderTool,
  renderReasoning,
  renderFile,
  renderPending,
  empty,
  renderEmpty,
  recoveringLabel = "Recovering interrupted turn…",
  className,
  style,
  role = "region",
  "aria-label": ariaLabel = "Conversation",
  ...rest
}: AgentChatMessagesProps) {
  const contextViewModel = useAgentChatViewModelContext();
  const viewModel = explicitViewModel ?? contextViewModel;
  if (!viewModel) {
    throw new Error(
      "AgentChat.Messages must be rendered inside <AgentChat.Root>, or given an explicit `viewModel` prop."
    );
  }

  const {
    messages,
    isRecovering,
    showPending,
    isIdle,
    actions
  } = viewModel;

  const rendered = useMemo(
    () =>
      messages.map((message, messageIndex) => {
        if (renderMessage) return renderMessage(message, messageIndex);

        const transformedParts = message.parts.map((part, partIndex) => {
          const messageContext = { chat: viewModel, message, messageIndex };
          if (part.type === "tool") {
            const context: AgentChatToolContext = { ...messageContext, part, partIndex };
            return { ...part, toolCall: { ...part.toolCall, ...toolProps?.(context) } };
          }
          if (part.type === "reasoning") {
            const context: AgentChatReasoningContext = { ...messageContext, part, partIndex };
            return { ...part, reasoning: { ...part.reasoning, ...reasoningProps?.(context) } };
          }
          if (part.type === "file") {
            const context: AgentChatFileContext = { ...messageContext, part, partIndex };
            return { ...part, file: { ...part.file, ...fileProps?.(context) } };
          }
          return part;
        });

        const messageContext: AgentChatMessageContext = { chat: viewModel, message, messageIndex };

        const defaultProps: AgentMessageProps = {
          role: message.role as AgentMessageRole,
          parts: transformedParts,
          isStreaming: message.isStreaming,
          showActions: message.isAssistant || message.canEdit,
          onCopy:
            message.isAssistant && actions.copy
              ? () => actions.copy?.(message)
              : undefined,
          onRetry:
            message.canRetry && actions.retry
              ? () => actions.retry?.(message)
              : undefined,
          onEdit:
            message.canEdit && actions.edit ? () => actions.edit?.(message) : undefined
        };

        // Merge precedence: internal defaults -> primitive prop resolvers
        // (already folded into `parts`) -> `messageProps` for the actual
        // AgentMessage props. A `messageProps` return can intentionally
        // override any AgentMessage prop (parts, actions, render callbacks,
        // slots, labels); props it does not return stay as the wired defaults.
        const mergedProps: AgentMessageProps = {
          ...defaultProps,
          ...messageProps?.(messageContext)
        };

        // The parts actually rendered by this message (messageProps may have
        // replaced `parts`). Used so the default text render and the top-level
        // `renderText` override resolve the *rendered* text part, never a
        // stale original.
        const resolvedParts = mergedProps.parts ?? transformedParts;

        // Default text render driven by the `textProps` resolver. Only applied
        // when neither `messageProps` nor a top-level `renderText` supplies one.
        const defaultTextPropsRender =
          mergedProps.renderText || renderText
            ? undefined
            : (text: string, partIndex: number) => {
                const part = resolvedParts[partIndex];
                const context: AgentChatTextContext = {
                  chat: viewModel,
                  message,
                  messageIndex,
                  part: part as AgentTextPart,
                  partIndex
                };
                return (
                  <AgentMarkdown isStreaming={message.isStreaming} {...textProps?.(context)}>
                    {text}
                  </AgentMarkdown>
                );
              };

        // AgentChat full render overrides, when provided, take precedence over
        // both `messageProps` and the defaults. They are context-adapted here;
        // the underlying `AgentMessage` primitive signatures stay unchanged.
        const finalProps: AgentMessageProps = {
          ...mergedProps,
          ...(defaultTextPropsRender ? { renderText: defaultTextPropsRender } : {}),
          ...(renderText
            ? {
                renderText: (text: string, partIndex: number) =>
                  renderText({
                    chat: viewModel,
                    message,
                    messageIndex,
                    part: resolvedParts[partIndex] as AgentTextPart,
                    partIndex
                  })
              }
            : {}),
          ...(renderTool
            ? {
                renderTool: (part: AgentToolPart, partIndex: number) =>
                  renderTool({ chat: viewModel, message, messageIndex, part, partIndex })
              }
            : {}),
          ...(renderReasoning
            ? {
                renderReasoning: (part: AgentReasoningPart, partIndex: number) =>
                  renderReasoning({ chat: viewModel, message, messageIndex, part, partIndex })
              }
            : {}),
          ...(renderFile
            ? {
                renderFile: (part: AgentFilePart, partIndex: number) =>
                  renderFile({ chat: viewModel, message, messageIndex, part, partIndex })
              }
            : {}),
          ...(renderPart
            ? {
                renderPart: (part: AgentMessagePart, partIndex: number) =>
                  renderPart({
                    chat: viewModel,
                    message,
                    messageIndex,
                    part: part as AgentCustomPart,
                    partIndex
                  })
              }
            : {})
        };

        return <AgentMessage key={message.id} {...finalProps} />;
      }),
    [
      viewModel,
      messages,
      actions,
      renderMessage,
      messageProps,
      toolProps,
      reasoningProps,
      textProps,
      fileProps,
      renderPart,
      renderText,
      renderTool,
      renderReasoning,
      renderFile
    ]
  );

  const emptyState = renderEmpty ? renderEmpty() : empty;

  const pendingMessage: AgentChatMessageModel = {
    id: "agent-chat-pending",
    role: "assistant",
    parts: [],
    text: "",
    isStreaming: true,
    isAssistant: true,
    canRetry: false,
    canEdit: false,
    isLast: false
  };

  let content: ReactNode;
  if (renderTranscript) {
    content = renderTranscript(viewModel);
  } else if (isIdle) {
    content =
      emptyState ?? (
        <div className="agent-ui-chat-messages__empty">
          <p className="agent-ui-chat-messages__empty-title">Start a conversation</p>
          <p className="agent-ui-chat-messages__empty-hint">
            Ask a question and the agent will respond here.
          </p>
        </div>
      );
  } else {
    const pendingContext: AgentChatPendingContext = {
      chat: viewModel,
      message: pendingMessage,
      messageIndex: messages.length
    };
    content = (
      <>
        {rendered}
        {showPending &&
          (renderPending
            ? renderPending(pendingContext)
            : (
                <AgentMessage
                  role="assistant"
                  parts={[]}
                  isStreaming
                  pendingProps={pendingProps?.(pendingContext)}
                />
              ))}
      </>
    );
  }

  return (
    <div
      className={joinClass("agent-ui-chat-messages", className)}
      data-idle={isIdle ? "true" : "false"}
      data-recovering={isRecovering ? "true" : "false"}
      role={role}
      aria-label={ariaLabel}
      style={style}
      {...rest}
    >
      {!renderTranscript && isRecovering && (
        <span className="agent-ui-chat-messages__recovering" role="status">
          {recoveringLabel}
        </span>
      )}
      {content}
    </div>
  );
}
