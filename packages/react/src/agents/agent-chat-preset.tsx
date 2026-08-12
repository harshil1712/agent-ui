import { type CSSProperties, type ReactNode } from "react";
import {
  AgentChatRoot,
  AgentChatMessages,
  type AgentChatContextBase,
  type AgentChatCustomPartContext,
  type AgentChatFileContext,
  type AgentChatMessageContext,
  type AgentChatPendingContext,
  type AgentChatReasoningContext,
  type AgentChatTextContext,
  type AgentChatToolContext,
  type AgentChatViewModel,
  type AgentChatMessageModel
} from "../agent-chat";
import {
  AgentComposer,
  type AgentComposerProps
} from "../agent-composer";
import type { AgentMarkdownProps } from "../agent-markdown";
import type { AgentFileProps } from "../agent-file";
import type { AgentMessageProps } from "../agent-message";
import type { AgentPendingProps } from "../agent-pending";
import type { AgentReasoningProps } from "../agent-reasoning";
import type { ToolCallProps } from "../tool-call";
import {
  useAgentChatUI,
  type AgentChatInput,
  type UseAgentChatUIOptions
} from "./use-agent-chat-ui";
import {
  useAgentComposer,
  type UseAgentComposerResult
} from "./use-agent-composer";

/** Context for the composer resolver and full composer override. */
export interface AgentChatComposerContext extends AgentChatContextBase {
  /** The reusable composer hook result (input, attachments, submit, …). */
  composer: UseAgentComposerResult;
  /** The merged default composer props (defaults + `composerProps` resolver). */
  composerProps: AgentComposerProps;
}

export interface AgentChatPresetProps {
  /** The raw AI SDK / Cloudflare Agents chat state. */
  chat: AgentChatInput;
  /** Options forwarded to `useAgentChatUI`. */
  options?: UseAgentChatUIOptions;
  /** Whole-transcript render override. Takes precedence over all default content. */
  render?: (viewModel: AgentChatViewModel) => ReactNode;
  /** Full override for an entire message. */
  renderMessage?: (message: AgentChatMessageModel, messageIndex: number) => ReactNode;
  messageProps?: (context: AgentChatMessageContext) => Partial<AgentMessageProps>;
  toolProps?: (context: AgentChatToolContext) => Partial<ToolCallProps>;
  reasoningProps?: (context: AgentChatReasoningContext) => Partial<AgentReasoningProps>;
  textProps?: (context: AgentChatTextContext) => Partial<AgentMarkdownProps>;
  fileProps?: (context: AgentChatFileContext) => Partial<AgentFileProps>;
  pendingProps?: (context: AgentChatPendingContext) => Partial<AgentPendingProps>;
  renderPart?: (context: AgentChatCustomPartContext) => ReactNode;
  renderText?: (context: AgentChatTextContext) => ReactNode;
  renderTool?: (context: AgentChatToolContext) => ReactNode;
  renderReasoning?: (context: AgentChatReasoningContext) => ReactNode;
  renderFile?: (context: AgentChatFileContext) => ReactNode;
  renderPending?: (context: AgentChatPendingContext) => ReactNode;
  /** Custom empty-state content shown when there are no messages. */
  empty?: ReactNode;
  renderEmpty?: () => ReactNode;
  /** Label for the recovery notice. */
  recoveringLabel?: string;
  /**
   * Maximum recent messages mounted initially. Defaults to `50`; pass `false`
   * to mount every message adapted by `useAgentChatUI`.
   */
  maxVisibleMessages?: number | false;
  /** Resolver returning props merged onto the default `AgentComposer`. */
  composerProps?: (context: AgentChatComposerContext) => Partial<AgentComposerProps>;
  /**
   * Full override replacing the default composer (only when `sendMessage` is
   * supplied). Receives the composer context so a fully custom composer can
   * reuse the input/attachment/submit plumbing.
   */
  renderComposer?: (context: AgentChatComposerContext) => ReactNode;
  className?: string;
  style?: CSSProperties;
}

function joinClass(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Zero-config path over a raw chat object. Calls `useAgentChatUI`, wraps
 * the result in `AgentChat.Root`, renders `AgentChat.Messages`, and adds a
 * default `AgentComposer` wired through `useAgentComposer` whenever
 * `chat.sendMessage` is supplied. Every piece stays customizable via the
 * per-primitive prop resolvers and full render overrides.
 */
export function AgentChatPreset({
  chat,
  options,
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
  recoveringLabel,
  maxVisibleMessages = 50,
  composerProps,
  renderComposer,
  className,
  style
}: AgentChatPresetProps) {
  const viewModel = useAgentChatUI(chat, options);

  const hasComposer = Boolean(chat.sendMessage);

  // Always call the hook so its state stays stable even if `sendMessage`
  // appears/disappears across renders; the no-op sendMessage is never exposed
  // because the composer is only rendered when `hasComposer` is true.
  const composer = useAgentComposer({
    sendMessage: chat.sendMessage ?? (() => undefined),
    busy: viewModel.busy,
    disabled: viewModel.isRecovering
  });

  const defaultComposer: AgentComposerProps = {
    value: composer.input,
    onValueChange: composer.setInput,
    attachments: composer.attachments,
    onAddAttachments: composer.handleAddAttachments,
    onRemoveAttachment: composer.handleRemoveAttachment,
    onSubmit: (value) => void composer.submit(value),
    busy: viewModel.busy,
    onStop: chat.stop,
    disabled: viewModel.isRecovering
  };

  // The `composerProps` resolver merges onto the defaults; the resulting
  // merged props are exposed to consumers through the composer context so a
  // full custom composer can reuse the resolved plumbing.
  const baseComposerContext: AgentChatComposerContext = {
    chat: viewModel,
    composer,
    composerProps: defaultComposer
  };
  const mergedComposer: AgentComposerProps = {
    ...defaultComposer,
    ...composerProps?.(baseComposerContext)
  };
  const composerContext: AgentChatComposerContext = {
    chat: viewModel,
    composer,
    composerProps: mergedComposer
  };

  return (
    <AgentChatRoot viewModel={viewModel}>
      <div className={joinClass("agent-ui-chat-preset", className)} style={style}>
        <AgentChatMessages
          viewModel={viewModel}
          render={renderTranscript}
          renderMessage={renderMessage}
          messageProps={messageProps}
          toolProps={toolProps}
          reasoningProps={reasoningProps}
          textProps={textProps}
          fileProps={fileProps}
          pendingProps={pendingProps}
          renderPart={renderPart}
          renderText={renderText}
          renderTool={renderTool}
          renderReasoning={renderReasoning}
          renderFile={renderFile}
          renderPending={renderPending}
          empty={empty}
          renderEmpty={renderEmpty}
          recoveringLabel={recoveringLabel}
          maxVisibleMessages={maxVisibleMessages === false ? undefined : maxVisibleMessages}
        />
        {hasComposer &&
          (renderComposer
            ? renderComposer(composerContext)
            : <AgentComposer className="agent-ui-chat-preset__composer" {...mergedComposer} />)}
      </div>
    </AgentChatRoot>
  );
}
