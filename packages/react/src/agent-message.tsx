import { Button } from "@cloudflare/kumo";
import {
  ArrowsClockwiseIcon,
  CopyIcon,
  PencilSimpleIcon
} from "@phosphor-icons/react";
import { forwardRef, type ComponentPropsWithoutRef, type CSSProperties, type ReactNode } from "react";
import { ToolCall, type ToolCallProps } from "./tool-call";
import { AgentPending, type AgentPendingProps } from "./agent-pending";
import { AgentReasoning, type AgentReasoningProps } from "./agent-reasoning";
import { AgentMarkdown } from "./agent-markdown";
import { AgentFile, type AgentFileData } from "./agent-file";

export type AgentMessageRole = "user" | "assistant" | "system" | "tool";

export interface AgentTextPart {
  type: "text";
  id?: string;
  text: string;
}

export interface AgentToolPart {
  type: "tool";
  id?: string;
  toolCall: ToolCallProps;
}

export interface AgentReasoningPart {
  type: "reasoning";
  id?: string;
  reasoning: AgentReasoningProps;
}

/** Re-exported for backwards compatibility. Prefer importing from `./agent-file`. */
export type { AgentFileData } from "./agent-file";

export interface AgentFilePart {
  type: "file";
  id?: string;
  file: AgentFileData;
}

export interface AgentCustomPart {
  type: "custom";
  id?: string;
  name: string;
  data?: unknown;
}

export type AgentMessagePart =
  | AgentTextPart
  | AgentToolPart
  | AgentReasoningPart
  | AgentFilePart
  | AgentCustomPart;

function isTextPart(part: AgentMessagePart): part is AgentTextPart {
  return part.type === "text";
}

function isToolPart(part: AgentMessagePart): part is AgentToolPart {
  return part.type === "tool";
}

function isReasoningPart(part: AgentMessagePart): part is AgentReasoningPart {
  return part.type === "reasoning";
}

function isFilePart(part: AgentMessagePart): part is AgentFilePart {
  return part.type === "file";
}

function isCustomPart(part: AgentMessagePart): part is AgentCustomPart {
  return part.type === "custom";
}

/**
 * Visual treatment for a message.
 * - `"plain"` — flat reading-column text.
 * - `"bubble"` — padded, rounded bubble aligned to the message side (user and assistant default).
 * - `"notice"` — narrow, muted inline notice (system/tool default).
 *
 * When omitted, the treatment follows the message `role`.
 */
export type AgentMessageVariant = "plain" | "bubble" | "notice";

/** Controls the vertical and part spacing inside a message. */
export type AgentMessageDensity = "comfortable" | "compact";

export interface AgentMessageRoleLabels {
  user: string;
  assistant: string;
  system: string;
  tool: string;
}

export interface AgentMessageActionLabels {
  copy: string;
  edit: string;
  retry: string;
}

/**
 * Localized labels for an `AgentMessage`. Every field is optional;
 * omitted fields fall back to English.
 */
export interface AgentMessageLabels {
  /** Base names for each role. The article label becomes `"{role} {message}"`. */
  role: Partial<AgentMessageRoleLabels>;
  /** Suffix appended to the role name for the article's accessible label. Defaults to `"message"`. */
  message: string;
  /** Labels for the copy/edit/retry actions. */
  actions: Partial<AgentMessageActionLabels>;
  /** Accessible name for the action button group. Defaults to `"Message actions"`. */
  actionsGroup: string;
  /** Live text announced while streaming. Defaults to `"Streaming"`. */
  streaming: string;
}

/**
 * Slots that let a consumer replace built-in content while preserving
 * accessible semantics.
 */
export interface AgentMessageSlots {
  /** Rendered above the message content. */
  leading?: ReactNode;
  /** Replaces the built-in copy/edit/retry buttons. */
  actions?: ReactNode;
  /** Rendered below the message content. */
  footer?: ReactNode;
  /** Replaces the visually-hidden streaming live region content. */
  streamingIndicator?: ReactNode;
}

export interface AgentMessageProps
  extends Omit<ComponentPropsWithoutRef<"article">, "role" | "color"> {
  role: AgentMessageRole;
  parts?: AgentMessagePart[];
  text?: string;
  isStreaming?: boolean;
  /** Renderer for custom parts. */
  renderPart?: (part: AgentMessagePart, index: number) => ReactNode;
  /** Renderer for text parts. */
  renderText?: (text: string, index: number) => ReactNode;
  /** Renderer for tool parts, replacing the default `ToolCall`. */
  renderTool?: (part: AgentToolPart, index: number) => ReactNode;
  /** Renderer for reasoning parts, replacing the default `AgentReasoning`. */
  renderReasoning?: (part: AgentReasoningPart, index: number) => ReactNode;
  /** Renderer for file parts, replacing the default `AgentFile`. */
  renderFile?: (part: AgentFilePart, index: number) => ReactNode;
  /** Props forwarded to the built-in `AgentPending` shown while streaming with no content. */
  pendingProps?: Partial<AgentPendingProps>;
  /** Full override replacing the built-in `AgentPending` shown while streaming with no content. */
  renderPending?: () => ReactNode;
  onRetry?: () => void;
  onEdit?: () => void;
  onCopy?: () => void;
  /** Hides all built-in and slotted message actions when false. */
  showActions?: boolean;
  variant?: AgentMessageVariant;
  density?: AgentMessageDensity;
  labels?: Partial<AgentMessageLabels>;
  slots?: Partial<AgentMessageSlots>;
  className?: string;
  style?: CSSProperties;
  /** Backward-compatible aliases for individual action labels. */
  copyLabel?: string;
  retryLabel?: string;
  editLabel?: string;
}

const defaultRoleLabels: AgentMessageRoleLabels = {
  user: "You",
  assistant: "Assistant",
  system: "System",
  tool: "Tool result"
};

const defaultActionLabels: AgentMessageActionLabels = {
  copy: "Copy message",
  edit: "Edit",
  retry: "Retry"
};

const defaultLabels: AgentMessageLabels = {
  role: defaultRoleLabels,
  message: "message",
  actions: defaultActionLabels,
  actionsGroup: "Message actions",
  streaming: "Streaming"
};

const variantByRole: Record<AgentMessageRole, AgentMessageVariant> = {
  user: "bubble",
  assistant: "bubble",
  system: "notice",
  tool: "notice"
};

function buildParts({ parts, text }: Pick<AgentMessageProps, "parts" | "text">): AgentMessagePart[] {
  if (parts) return parts;
  if (text !== undefined) return [{ type: "text", text }];
  return [];
}

function joinClass(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export const AgentMessage = forwardRef<HTMLElement, AgentMessageProps>(function AgentMessage(
  {
    role,
    parts,
    text,
    isStreaming,
    onRetry,
    onEdit,
    onCopy,
    showActions = true,
    renderPart,
    renderText,
    renderTool,
    renderReasoning,
    renderFile,
    pendingProps,
    renderPending,
    variant,
    density = "comfortable",
    labels,
    slots,
    className,
    style,
    copyLabel,
    retryLabel,
    editLabel,
    "aria-label": ariaLabel,
    ...rest
  },
  ref
) {
  const label: AgentMessageLabels = {
    ...defaultLabels,
    ...labels,
    role: { ...defaultLabels.role, ...labels?.role },
    actions: { ...defaultLabels.actions, ...labels?.actions }
  };

  // Backward-compatible aliases override the labels object for individual actions.
  const actions: AgentMessageActionLabels = {
    copy: copyLabel ?? label.actions.copy ?? defaultActionLabels.copy,
    edit: editLabel ?? label.actions.edit ?? defaultActionLabels.edit,
    retry: retryLabel ?? label.actions.retry ?? defaultActionLabels.retry
  };

  const resolvedVariant = variant ?? variantByRole[role];
  const resolvedParts = buildParts({ parts, text });
  const hasActions = Boolean(showActions && (onRetry || onEdit || onCopy || slots?.actions));
  const hasContent = resolvedParts.length > 0;
  const lastPart = resolvedParts[resolvedParts.length - 1];
  const showTextCursor = Boolean(isStreaming && lastPart && isTextPart(lastPart));

  const renderPartContent = (part: AgentMessagePart, index: number): ReactNode => {
    if (isTextPart(part)) {
      if (renderText) return renderText(part.text, index);
      return <AgentMarkdown isStreaming={isStreaming}>{part.text}</AgentMarkdown>;
    }
    if (isToolPart(part)) {
      if (renderTool) return renderTool(part, index);
      return <ToolCall {...part.toolCall} />;
    }
    if (isReasoningPart(part)) {
      if (renderReasoning) return renderReasoning(part, index);
      return (
        <AgentReasoning
          {...part.reasoning}
          announceUpdates={part.reasoning.announceUpdates ?? false}
        />
      );
    }
    if (isFilePart(part)) {
      if (renderFile) return renderFile(part, index);
      return <AgentFile {...part.file} />;
    }
    if (isCustomPart(part)) {
      if (renderPart) return renderPart(part, index);
      return null;
    }
    return null;
  };

  return (
    <article
      ref={ref}
      className={joinClass(
        "agent-ui-message",
        `agent-ui-message--${role}`,
        `agent-ui-message--${resolvedVariant}`,
        `agent-ui-message--${density}`,
        className
      )}
      data-role={role}
      data-streaming={isStreaming ? "true" : "false"}
      data-actionable={hasActions ? "true" : "false"}
      aria-label={ariaLabel ?? `${label.role[role]} ${label.message}`}
      style={style}
      {...rest}
    >
      {slots?.leading}

      {hasContent && (
        <div
          className="agent-ui-message__content"
          aria-live={isStreaming ? "polite" : "off"}
          aria-busy={isStreaming ? "true" : "false"}
        >
          {resolvedParts.map((part, index) => (
            <div key={part.id ?? index} className="agent-ui-message__part">
              {renderPartContent(part, index)}
            </div>
          ))}
          {showTextCursor && <span className="agent-ui-message__cursor" aria-hidden="true" />}
        </div>
      )}

      {isStreaming && !hasContent && (
        renderPending ? renderPending() : <AgentPending {...pendingProps} />
      )}

      {slots?.footer}

      {isStreaming && hasContent && (
        <span className="agent-ui-message__streaming" role="status">
          {slots?.streamingIndicator ?? label.streaming}
        </span>
      )}

      {(hasActions) && (
        <div className="agent-ui-message__actions" role="group" aria-label={label.actionsGroup}>
          {slots?.actions ?? (
            <>
              {onCopy && (
                <Button
                  variant="ghost"
                  size="sm"
                  shape="square"
                  icon={CopyIcon}
                  aria-label={actions.copy}
                  onClick={onCopy}
                />
              )}
              {onEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  shape="square"
                  icon={PencilSimpleIcon}
                  aria-label={actions.edit}
                  onClick={onEdit}
                />
              )}
              {onRetry && (
                <Button
                  variant="ghost"
                  size="sm"
                  shape="square"
                  icon={ArrowsClockwiseIcon}
                  aria-label={actions.retry}
                  onClick={onRetry}
                />
              )}
            </>
          )}
        </div>
      )}
    </article>
  );
});

AgentMessage.displayName = "AgentMessage";
