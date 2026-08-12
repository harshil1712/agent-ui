import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import type { UIMessage } from "ai";
import { AgentChatPreset } from "./agent-chat-preset";
import type { AgentComposerSendMessage } from "./use-agent-composer";
import { useAgentComposer } from "./use-agent-composer";
import { AgentComposer } from "../agent-composer";
import { useState } from "react";

const meta = {
  title: "Agent UI/AgentChatPreset",
  component: AgentChatPreset,
  tags: ["autodocs"],
} satisfies Meta<typeof AgentChatPreset>;

export default meta;
type Story = StoryObj<typeof meta>;

function user(text: string, id = "u1"): UIMessage {
  return { id, role: "user", parts: [{ type: "text", text }] };
}

function assistant(parts: UIMessage["parts"], id = "a1"): UIMessage {
  return { id, role: "assistant", parts };
}

const SEND: AgentComposerSendMessage = () => undefined;

const baseChat = {
  messages: [
    user("What is Workers AI?"),
    assistant([
      { type: "text", text: "Let me check the docs." },
      {
        type: "reasoning",
        text: "Read the current Workers AI documentation before answering.",
        state: "done",
      },
      {
        type: "tool-checkCloudflareDocs",
        toolCallId: "call_1",
        state: "output-available",
        input: {},
        output: {
          source: "https://developers.cloudflare.com/workers-ai/index.md",
          markdown: "Workers AI runs machine learning models on Cloudflare's global network.",
        },
      },
      { type: "text", text: "Workers AI is AI inference on the edge." },
    ]),
  ],
  status: "ready" as const,
  sendMessage: SEND,
};

export const ZeroConfig: Story = {
  name: "Zero-config",
  args: { chat: baseChat },
};

export const WithComposer: Story = {
  name: "Zero-config with composer",
  args: { chat: { ...baseChat, sendMessage: SEND } },
};

export const Thinking: Story = {
  args: {
    chat: {
      messages: [user("Can you schedule a daily report at 09:00 UTC?")],
      status: "submitted",
      sendMessage: SEND,
    },
  },
};

export const CustomizedPerRole: Story = {
  name: "messageProps: user vs assistant",
  args: {
    chat: baseChat,
    messageProps: ({ message: msg }) => ({
      variant: msg.role === "user" ? "plain" : "bubble",
      density: "comfortable",
    }),
  },
};

export const CustomizedTools: Story = {
  name: "toolProps + reasoningProps + textProps",
  args: {
    chat: baseChat,
    toolProps: ({ part }) => ({
      labels: { details: `Tool: ${part.toolCall.name}` },
    }),
    reasoningProps: () => ({ labels: { show: "Show", hide: "Hide" } }),
    textProps: ({ message: msg }) => ({
      className: msg.role === "assistant" ? "assistant-copy" : undefined,
    }),
  },
};

export const CustomizedComposer: Story = {
  name: "composerProps",
  args: {
    chat: { ...baseChat, sendMessage: SEND },
    composerProps: () => ({
      placeholder: "Ask the agent anything…",
      labels: { send: "Go", stop: "Halt" },
      submitOnEnter: true,
    }),
  },
};

function ValidatedComposer() {
  const composer = useAgentComposer({
    sendMessage: SEND,
    maxFiles: 2,
  });
  const [value, setValue] = useState("");
  return (
    <div style={{ display: "grid", gap: 8, width: "100%" }}>
      <AgentComposer
        value={value}
        onValueChange={setValue}
        attachments={composer.attachments}
        onAddAttachments={composer.handleAddAttachments}
        onRemoveAttachment={composer.handleRemoveAttachment}
        multiple
        onSubmit={(v) => void composer.submit(v)}
      />
      {composer.rejectedFiles.length > 0 && (
        <p style={{ fontSize: 12, color: "var(--color-kumo-danger)" }}>
          {composer.rejectedFiles.length} file(s) rejected (max {2} files allowed).
        </p>
      )}
    </div>
  );
}

export const AttachmentValidation: Story = {
  name: "useAgentComposer: maxFiles client-side rejection",
  args: { chat: { ...baseChat, sendMessage: SEND } },
  render: () => <ValidatedComposer />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const fileInput = canvasElement.querySelector<HTMLInputElement>("[data-agent-ui-file-input]");
    if (!fileInput) throw new Error("file input not found");
    await userEvent.upload(fileInput, [
      new File(["a"], "a.txt", { type: "text/plain" }),
      new File(["b"], "b.txt", { type: "text/plain" }),
      new File(["c"], "c.txt", { type: "text/plain" }),
    ]);
    await expect(canvas.getByText(/1 file\(s\) rejected/)).toBeInTheDocument();
  },
};

export const FullMessageOverride: Story = {
  name: "renderMessage",
  args: {
    chat: baseChat,
    renderMessage: (msg, index) => (
      <div style={{ fontFamily: "monospace", fontSize: 13, padding: "8px 0" }}>
        [{index}] {msg.role}: {msg.text}
      </div>
    ),
  },
};

export const FullComposerOverride: Story = {
  name: "renderComposer: reuse the composer plumbing",
  args: {
    chat: { ...baseChat, sendMessage: SEND },
    renderComposer: ({ composer }) => (
      <div>
        <label htmlFor="custom-prompt">Custom composer</label>
        <textarea
          id="custom-prompt"
          aria-label="Custom prompt"
          placeholder="Type a message…"
          value={composer.input}
          onChange={(e) => composer.setInput(e.target.value)}
          style={{
            width: "100%",
            minHeight: 48,
            padding: 8,
            boxSizing: "border-box",
          }}
        />
        <button
          type="button"
          disabled={!composer.canSubmit}
          onClick={() => void composer.submit()}
        >
          Send
        </button>
      </div>
    ),
  },
};

export const Recovering: Story = {
  args: {
    chat: {
      messages: [
        assistant([
          { type: "text", text: "Partial response from an interrupted turn…" },
        ]),
      ],
      status: "ready",
      isRecovering: true,
      sendMessage: SEND,
    },
  },
};
