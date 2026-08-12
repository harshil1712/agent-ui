import { AgentChatRoot, AgentChatMessages } from "../agent-chat";
import { AgentChatPreset } from "./agent-chat-preset";

export { AgentChatRoot, AgentChatMessages } from "../agent-chat";
export type {
  AgentChatActions,
  AgentChatContextBase,
  AgentChatCustomPartContext,
  AgentChatFileContext,
  AgentChatMessageContext,
  AgentChatMessageModel,
  AgentChatMessageRole,
  AgentChatMessagesProps,
  AgentChatPartContext,
  AgentChatPendingContext,
  AgentChatPhase,
  AgentChatReasoningContext,
  AgentChatRootProps,
  AgentChatTextContext,
  AgentChatToolContext,
  AgentChatViewModel
} from "../agent-chat";
export { AgentChatPreset } from "./agent-chat-preset";
export type {
  AgentChatComposerContext,
  AgentChatPresetProps
} from "./agent-chat-preset";
export { mapChatStatus, mapToolState, toAgentMessageParts, getMessageText } from "./map";
export type {
  AgentChatDisplayStatus,
  ChatStatusInput,
  ToAgentMessagePartsOptions
} from "./map";
export { useAgentChatUI } from "./use-agent-chat-ui";
export type { AgentChatInput, UseAgentChatUIOptions } from "./use-agent-chat-ui";
export { useAgentComposer } from "./use-agent-composer";
export type {
  AgentComposerSendMessage,
  AgentRejectedFile,
  AgentRejectedFileReason,
  UseAgentComposerOptions,
  UseAgentComposerResult
} from "./use-agent-composer";

/**
 * The full composable `AgentChat` compound, including the zero-config `Preset`
 * that requires the headless adapter. `Root` and `Messages` are the same
 * SDK-free components exported from the package root; `Preset` bridges a raw
 * chat object.
 */
export const AgentChat = {
  Root: AgentChatRoot,
  Messages: AgentChatMessages,
  Preset: AgentChatPreset
};