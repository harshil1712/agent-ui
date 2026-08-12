import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { useState, type ReactElement } from "react";
import {
  AgentChatRoot,
  AgentChatMessages,
  type AgentChatViewModel,
  type AgentChatMessageModel,
} from "./agent-chat";

const meta = {
  title: "Agent UI/AgentChat",
  component: AgentChatMessages,
  tags: ["autodocs"],
} satisfies Meta<typeof AgentChatMessages>;

export default meta;
type Story = StoryObj<typeof meta>;

function buildViewModel(): AgentChatViewModel {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  return {
    messages: [
      {
        id: "u1",
        role: "user",
        text: "What is Workers AI?",
        parts: [{ type: "text", text: "What is Workers AI?" }],
        isStreaming: false,
        isAssistant: false,
        canRetry: false,
        canEdit: true,
        isLast: false,
      },
      {
        id: "a1",
        role: "assistant",
        text: "Let me check the docs.\n\nWorkers AI is AI inference on the edge.",
        parts: [
          { type: "text", text: "Let me check the docs." },
          {
            type: "reasoning",
            reasoning: {
              text: "The user asked about Workers AI, so I should read the current official documentation before answering.",
              expanded: false,
              onExpandedChange: (open) =>
                setExpanded({ "a1:reasoning:1": open }),
            },
          },
          {
            type: "tool",
            toolCall: {
              name: "checkCloudflareDocs",
              status: "completed",
              description: "Check the Cloudflare docs for Workers AI",
              input: {},
              output: {
                source: "https://developers.cloudflare.com/workers-ai/index.md",
                markdown: "Workers AI runs machine learning models on Cloudflare's global network.",
              },
              expanded: expanded["call_1"] ?? false,
              onExpandedChange: (open) => setExpanded({ call_1: open }),
            },
          },
          { type: "text", text: "Workers AI is AI inference on the edge." },
        ],
        isStreaming: false,
        isAssistant: true,
        canRetry: false,
        canEdit: false,
        isLast: true,
      },
    ],
    phase: "ready",
    busy: false,
    isRecovering: false,
    showPending: false,
    isIdle: false,
    expanded,
    setExpanded: (id, open) => setExpanded((p) => ({ ...p, [id]: open })),
    toggleExpanded: (id) => setExpanded((p) => ({ ...p, [id]: !p[id] })),
    actions: {},
  };
}

const wrapper = (StoryComponent: () => ReactElement) => {
  const viewModel = buildViewModel();
  return (
    <AgentChatRoot viewModel={viewModel}>
      <StoryComponent />
    </AgentChatRoot>
  );
};

export const Transcript: Story = {
  render: () => wrapper(() => <AgentChatMessages />),
};

function buildLongViewModel(): AgentChatViewModel {
  const base = buildViewModel();
  const messages: AgentChatMessageModel[] = [];
  for (let i = 0; i < 8; i++) {
    messages.push({
      id: `m${i}`,
      role: i % 2 === 0 ? "user" : "assistant",
      text: i % 2 === 0 ? `Question ${i + 1}` : `Answer ${i + 1}`,
      parts: [{ type: "text", text: i % 2 === 0 ? `Question ${i + 1}` : `Answer ${i + 1}` }],
      isStreaming: false,
      isAssistant: i % 2 === 1,
      canRetry: false,
      canEdit: i % 2 === 0,
      isLast: i === 7,
    });
  }
  return { ...base, messages, isIdle: false };
}

export const TranscriptWindow: Story = {
  name: "maxVisibleMessages: show older",
  render: () => (
    <AgentChatRoot viewModel={buildLongViewModel()}>
      <AgentChatMessages maxVisibleMessages={3} />
    </AgentChatRoot>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Only the 3 most-recent messages are shown initially.
    await expect(canvas.getByText("Answer 6")).toBeInTheDocument();
    await expect(canvas.queryByText("Question 1")).not.toBeInTheDocument();
    // Older messages are revealed one page at a time.
    await userEvent.click(canvas.getByRole("button", { name: "Show older messages" }));
    await expect(canvas.getByText("Question 3")).toBeInTheDocument();
    await expect(canvas.queryByText("Question 1")).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Show older messages" }));
    await expect(canvas.getByText("Question 1")).toBeInTheDocument();
  },
};

export const Empty: Story = {
  render: () => (
    <AgentChatRoot
      viewModel={{ ...buildViewModel(), messages: [], isIdle: true }}
    >
      <AgentChatMessages />
    </AgentChatRoot>
  ),
};

export const UserAssistantVariants: Story = {
  name: "messageProps: user vs assistant variant",
  render: () =>
    wrapper(() => (
      <AgentChatMessages
        messageProps={({ message: msg }) => ({
          variant: msg.role === "user" ? "plain" : "bubble",
        })}
      />
    )),
};

export const CustomToolLabels: Story = {
  name: "toolProps: adjust a tool without rewiring",
  render: () =>
    wrapper(() => (
      <AgentChatMessages
        toolProps={({ part }) => ({
          labels: { details: `${part.toolCall.name} details` },
        })}
      />
    )),
};

export const CustomReasoningLabels: Story = {
  name: "reasoningProps: localized reasoning",
  render: () =>
    wrapper(() => (
      <AgentChatMessages
        reasoningProps={() => ({
          labels: { show: "Show", hide: "Hide", reasoning: "Reasoning" },
        })}
      />
    )),
};

export const LocalizedMessages: Story = {
  name: "messageProps: localized labels and actions",
  render: () =>
    wrapper(() => (
      <AgentChatMessages
        messageProps={({ message: msg }) => ({
          labels: {
            role: { user: "Vous", assistant: "Assistant" },
            actions: { copy: "Copier", retry: "Réessayer" },
          },
          variant: msg.role === "user" ? "plain" : "bubble",
        })}
      />
    )),
};

export const FullMessageOverride: Story = {
  name: "renderMessage: full message replacement",
  render: () =>
    wrapper(() => (
      <AgentChatMessages
        renderMessage={(msg, index) => (
          <div
            style={{ fontFamily: "monospace", fontSize: 13, padding: "8px 0" }}
          >
            [{index}] {msg.role}: {msg.text}
          </div>
        )}
      />
    )),
};

export const FullToolOverride: Story = {
  name: "renderTool: full tool replacement",
  render: () =>
    wrapper(() => (
      <AgentChatMessages
        renderTool={({ part }) => (
          <span style={{ fontFamily: "monospace", fontSize: 12 }}>
            ⚙ {part.toolCall.name} · {part.toolCall.status}
          </span>
        )}
      />
    )),
};

export const PendingWithCustomLabel: Story = {
  name: "pendingProps: configure the pending placeholder",
  render: () =>
    wrapper(() => (
      <AgentChatMessages
        pendingProps={() => ({ labels: { pending: "Thinking…" } })}
        viewModel={{
          ...buildViewModel(),
          messages: [buildViewModel().messages[0]],
          showPending: true,
          isIdle: false,
        }}
      />
    )),
};

export const Recovering: Story = {
  render: () =>
    wrapper(() => (
      <AgentChatMessages
        viewModel={{
          ...buildViewModel(),
          isRecovering: true,
          busy: true,
          phase: "recovering",
          messages: [
            {
              id: "a1",
              role: "assistant",
              text: "Partial response from an interrupted turn…",
              parts: [
                {
                  type: "text",
                  text: "Partial response from an interrupted turn…",
                },
              ],
              isStreaming: false,
              isAssistant: true,
              canRetry: false,
              canEdit: false,
              isLast: true,
            },
          ],
        }}
      />
    )),
};

export const WholeTranscriptOverride: Story = {
  name: "render: whole-transcript replacement",
  render: () =>
    wrapper(() => (
      <AgentChatMessages
        render={(view) => (
          <ol
            style={{
              fontFamily: "monospace",
              fontSize: 13,
              listStyle: "none",
              padding: 0,
            }}
          >
            {view.messages.map((msg) => (
              <li key={msg.id} style={{ padding: "8px 0" }}>
                <strong>{msg.role}:</strong> {msg.text}
              </li>
            ))}
          </ol>
        )}
      />
    )),
};

export const ContextualTextOverride: Story = {
  name: "renderText: branch per message",
  render: () =>
    wrapper(() => (
      <AgentChatMessages
        renderText={({ part, message: msg }) => (
          <span
            style={{
              color:
                msg.role === "user" ? "var(--text-color-kumo-link)" : undefined,
            }}
          >
            {msg.role === "user" ? "You said: " : ""}
            {part.text}
          </span>
        )}
      />
    )),
};

export const FilePropsStory: Story = {
  name: "fileProps: customize file rendering",
  render: () => {
    const vm = buildViewModel();
    const fileMessage: AgentChatMessageModel = {
      id: "m1",
      role: "assistant",
      text: "Here is the report.",
      parts: [
        { type: "text", text: "Here is the report." },
        {
          type: "file",
          file: {
            name: "README.md",
            mediaType: "text/markdown",
            size: 18432,
            url: "https://example.com/README.md",
          },
        },
      ],
      isStreaming: false,
      isAssistant: true,
      canRetry: false,
      canEdit: false,
      isLast: true,
    };
    return (
      <AgentChatRoot viewModel={{ ...vm, messages: [fileMessage] }}>
        <AgentChatMessages
          fileProps={() => ({ labels: { open: "View file" } })}
        />
      </AgentChatRoot>
    );
  },
};
