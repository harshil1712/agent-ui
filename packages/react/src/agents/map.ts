import {
  getToolName,
  isCustomContentUIPart,
  isDataUIPart,
  isFileUIPart,
  isReasoningUIPart,
  isTextUIPart,
  isToolUIPart,
  type ChatAddToolApproveResponseFunction,
  type ChatStatus,
  type UIDataTypes,
  type UIMessage,
  type UIMessagePart,
  type UITools
} from "ai";
import type {
  AgentCustomPart,
  AgentFilePart,
  AgentMessagePart,
  AgentReasoningPart,
  AgentTextPart,
  AgentToolPart
} from "../agent-message";
import type { ToolCallProps, ToolCallStatus } from "../tool-call";

/**
 * Map an AI SDK tool UI part state onto the lifecycle status our `ToolCall`
 * component understands. Unknown states fall back to `"running"`.
 */
export function mapToolState(state: string): ToolCallStatus {
  switch (state) {
    case "input-streaming":
      return "running";
    case "input-available":
      return "pending";
    case "approval-requested":
      return "awaiting-approval";
    case "approval-responded":
      // The user answered the approval prompt; the tool is now re-running and
      // the continuation is still in flight, so it is not complete yet.
      return "running";
    case "output-available":
      return "completed";
    case "output-error":
    case "output-denied":
      return "failed";
    default:
      return "running";
  }
}

/**
 * The simplified lifecycle states an agent chat UI usually cares about.
 * Derived from the AI SDK `ChatStatus` plus the Cloudflare Agents chat flags.
 */
export type AgentChatDisplayStatus =
  | "thinking"
  | "streaming"
  | "recovering"
  | "ready"
  | "error";

export interface ChatStatusInput {
  /** The AI SDK chat status. */
  status: ChatStatus;
  /** Whether a durable turn is being recovered (not producing tokens yet). */
  isRecovering?: boolean;
}

/**
 * Map an AI SDK chat status (plus recovery flag) to a compact display status.
 * `isRecovering` wins over `"thinking"`/`"ready"`; `error` always wins.
 */
export function mapChatStatus({
  status,
  isRecovering = false
}: ChatStatusInput): AgentChatDisplayStatus {
  if (status === "error") return "error";
  if (isRecovering) return "recovering";
  if (status === "submitted") return "thinking";
  if (status === "streaming") return "streaming";
  return "ready";
}

/**
 * Options for `toAgentMessageParts`. Callbacks and expansion overrides
 * are optional so the utility can be used purely (no React).
 */
export interface ToAgentMessagePartsOptions {
  /** Optional one-line description per tool name. */
  toolDescriptions?: Record<string, string>;
  /** Controlled expansion overrides keyed by part id. */
  expanded?: Record<string, boolean>;
  /** Called with a part id and its new open state when a disclosure is toggled. */
  onExpandedChange?: (id: string, open: boolean) => void;
  /**
   * Function for answering human-in-the-loop tool approvals. When provided,
   * `approval-requested` tool parts get wired `onApprove`/`onReject` handlers
   * that call it with `{ id, approved }` using the part's `approval.id`.
   */
  addToolApprovalResponse?: ChatAddToolApproveResponseFunction;
}

function fileNameFromUrl(url: string): string {
  try {
    const name = decodeURIComponent(url.split("/").pop() ?? "");
    return name || "file";
  } catch {
    return "file";
  }
}

function buildToolPart(
  part: Extract<UIMessagePart<UIDataTypes, UITools>, { state: string }>,
  name: string,
  expanded: boolean,
  onExpandedChange: ((open: boolean) => void) | undefined,
  addToolApprovalResponse?: ChatAddToolApproveResponseFunction
): AgentToolPart {
  const status = mapToolState(part.state);
  const toolCall: ToolCallProps = {
    name,
    status,
    input: "input" in part ? part.input : undefined,
    output: "output" in part ? part.output : undefined,
    error: "errorText" in part ? part.errorText : undefined,
    expanded,
    onExpandedChange
  };

  if (
    part.state === "approval-requested" &&
    part.approval &&
    addToolApprovalResponse
  ) {
    const approvalId = part.approval.id;
    toolCall.onApprove = () => addToolApprovalResponse({ id: approvalId, approved: true });
    toolCall.onReject = () => addToolApprovalResponse({ id: approvalId, approved: false });
  }

  return { id: "toolCallId" in part ? part.toolCallId : undefined, type: "tool", toolCall };
}

/**
 * Translate an AI SDK `UIMessage` into the parts our `AgentMessage`
 * component understands. Text, reasoning, tool, and file parts are mapped
 * directly; data, custom, and source parts become `AgentCustomPart`
 * values so `renderPart` is a real escape hatch. Only the `step-start` marker
 * is skipped safely.
 */
export function toAgentMessageParts(
  message: UIMessage,
  options: ToAgentMessagePartsOptions = {}
): AgentMessagePart[] {
  const { toolDescriptions, expanded = {}, onExpandedChange, addToolApprovalResponse } = options;
  const parts: AgentMessagePart[] = [];

  for (const [sourceIndex, part] of message.parts.entries()) {
    if (isTextUIPart(part)) {
      const textPart: AgentTextPart = {
        id: `text-${parts.length}`,
        type: "text",
        text: part.text
      };
      parts.push(textPart);
      continue;
    }

    if (isReasoningUIPart(part)) {
      const id = `${message.id}:reasoning:${sourceIndex}`;
      const isPartStreaming = part.state === "streaming";
      const reasoningPart: AgentReasoningPart = {
        id,
        type: "reasoning",
        reasoning: {
          text: part.text,
          isStreaming: isPartStreaming,
          expanded: expanded[id] ?? isPartStreaming,
          onExpandedChange: onExpandedChange
            ? (open) => onExpandedChange(id, open)
            : undefined
        }
      };
      parts.push(reasoningPart);
      continue;
    }

    if (isToolUIPart(part)) {
      const name = getToolName(part);
      const id = part.toolCallId;
      const open = expanded[id] ?? mapToolState(part.state) === "failed";
      const toolPart = buildToolPart(
        part,
        name,
        open,
        onExpandedChange ? (openState) => onExpandedChange(id, openState) : undefined,
        addToolApprovalResponse
      );
      toolPart.toolCall.description = toolDescriptions?.[name];
      parts.push(toolPart);
      continue;
    }

    if (isFileUIPart(part)) {
      const filePart: AgentFilePart = {
        id: part.url,
        type: "file",
        file: {
          name: part.filename ?? fileNameFromUrl(part.url),
          mediaType: part.mediaType,
          url: part.url
        }
      };
      parts.push(filePart);
      continue;
    }

    if (isDataUIPart(part)) {
      parts.push({ id: part.id, type: "custom", name: part.type, data: part.data });
      continue;
    }

    if (isCustomContentUIPart(part)) {
      parts.push({
        type: "custom",
        name: part.kind,
        data: part.providerMetadata
      });
      continue;
    }

    if (part.type === "source-url") {
      parts.push({ type: "custom", name: "source-url", data: { url: part.url } });
      continue;
    }

    if (part.type === "source-document") {
      parts.push({
        type: "custom",
        name: "source-document",
        data: {
          sourceId: part.sourceId,
          mediaType: part.mediaType,
          title: part.title,
          filename: part.filename
        }
      });
      continue;
    }

    if (part.type === "reasoning-file") {
      parts.push({
        type: "custom",
        name: "reasoning-file",
        data: { url: part.url, mediaType: part.mediaType }
      });
      continue;
    }

    // `step-start` is a structural marker with no renderable content.
  }

  return parts;
}

/**
 * Join the text parts of an AI SDK `UIMessage` into a single string,
 * preserving the order they appear in the transcript.
 */
export function getMessageText(message: UIMessage): string {
  return message.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join("\n");
}
