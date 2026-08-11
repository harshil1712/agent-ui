import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { useState } from "react";
import { AgentMessage, type AgentMessagePart } from "./agent-message";

const meta = {
  title: "Agent UI/AgentMessage",
  component: AgentMessage,
  tags: ["autodocs"],
  args: {
    role: "assistant",
    text: "Durable Objects alarms fire reliably and persist across restarts, so they are the right primitive for scheduled work in an Agent."
  }
} satisfies Meta<typeof AgentMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Assistant: Story = {};

export const User: Story = {
  args: {
    role: "user",
    text: "Can you schedule a daily report at 09:00 UTC?"
  }
};

export const System: Story = {
  args: {
    role: "system",
    text: "You are a helpful assistant. You prefer Durable Objects for any scheduled or background work."
  }
};

export const Tool: Story = {
  args: {
    role: "tool",
    text: "The report schedule was loaded from durable storage."
  }
};

export const Streaming: Story = {
  args: {
    isStreaming: true,
    text: "Of course. I will set up an alarm on the reporting Durable Object that fires each morning."
  }
};

export const StreamingMarkdown: Story = {
  args: {
    isStreaming: true,
    text: "## Current status\n\n- Workers are **operational**\n- Durable Objects are"
  }
};

export const WaitingForFirstToken: Story = {
  args: { parts: [], text: undefined, isStreaming: true }
};

export const StreamingReasoning: Story = {
  args: {
    text: undefined,
    isStreaming: true,
    parts: [
      {
        id: "r1",
        type: "reasoning",
        reasoning: {
          text: "The question asks for live status, so I need to call the status tool before composing the answer.",
          isStreaming: true
        }
      }
    ]
  }
};

export const StructuredParts: Story = {
  render: function StructuredPartsStory() {
    const [expanded, setExpanded] = useState(false);
    return (
      <AgentMessage
        role="assistant"
        parts={[
          { id: "p1", type: "text", text: "I found what you need. Here is the top result:" },
          {
            id: "p2",
            type: "tool",
            toolCall: {
              name: "searchDocumentation",
              status: "completed",
              input: { query: "Durable Objects alarm best practices", limit: 5 },
              output: { matches: 5, topResult: "Use alarms for durable, time-based callbacks." },
              expanded,
              onExpandedChange: setExpanded
            }
          }
        ]}
      />
    );
  }
};

export const ComposedTranscript: Story = {
  render: function ComposedTranscriptStory() {
    const [scheduleExpanded, setScheduleExpanded] = useState(false);
    const [updateExpanded, setUpdateExpanded] = useState(false);

    return <div style={{ display: "grid", gap: 16 }}>
      <AgentMessage
        role="user"
        text="Can you set up a daily report so my team sees overnight failures first thing?"
      />
      <AgentMessage
        role="assistant"
        parts={[
          { id: "t1", type: "text", text: "Sure — I'll wire up an alarm to the reporting Durable Object. Let me check the current schedule first." },
          {
            id: "t2",
            type: "tool",
            toolCall: {
              name: "getSchedule",
              status: "completed",
               input: { report: "daily_summary" },
               output: { cron: "0 9 * * *", enabled: true },
               expanded: scheduleExpanded,
               onExpandedChange: setScheduleExpanded
            }
          },
          {
            id: "t3",
            type: "tool",
            toolCall: {
              name: "updateSchedule",
              status: "awaiting-approval",
              description: "This changes the production reporting schedule.",
               input: { report: "daily_summary", cron: "0 9 * * *", onFailure: "alert" },
               expanded: updateExpanded,
               onExpandedChange: setUpdateExpanded,
               onApprove: fn(),
              onReject: fn()
            }
          },
          {
            id: "t4",
            type: "text",
            text: "Approve this change to schedule the report for 09:00 UTC and page the on-call on any failure."
          }
        ]}
      />
    </div>;
  }
};

export const FailedWithTool: Story = {
  render: function FailedWithToolStory() {
    const [expanded, setExpanded] = useState(true);
    return (
      <AgentMessage
        role="assistant"
        parts={[
          { id: "e1", type: "text", text: "I couldn't complete that." },
          {
            id: "e2",
            type: "tool",
            toolCall: {
              name: "sendReport",
              status: "failed",
              error: "The delivery service did not respond before the timeout.",
              expanded,
              onExpandedChange: setExpanded
            }
          }
        ]}
      />
    );
  }
};

export const WithActions: Story = {
  args: {
    onRetry: fn(),
    onEdit: fn(),
    onCopy: fn()
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Copy message" }));
    await expect(args.onCopy).toHaveBeenCalledOnce();
  }
};

export const UserEditable: Story = {
  args: {
    role: "user",
    text: "Summarize the latest release notes.",
    onEdit: fn()
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Edit" }));
    await expect(args.onEdit).toHaveBeenCalledOnce();
  }
};

export const CustomPartRenderer: Story = {
  args: {
    renderPart: (part) => (
      <span style={{ fontFamily: "monospace", fontSize: 12 }}>
        [custom part: {part.type === "custom" ? part.name : part.type}]
      </span>
    ),
    parts: [{ type: "custom", id: "a", name: "artifact", data: { file: "report.pdf" } }]
  }
};

export const CustomTextRenderer: Story = {
  args: {
    renderText: (text) => (
      <p style={{ color: "var(--text-color-kumo-danger, #b42318)" }}>{text}</p>
    )
  }
};

export const CustomToolRenderer: Story = {
  name: "Custom tool renderer",
  args: {
    renderTool: (part) => (
      <span style={{ fontFamily: "monospace", fontSize: 12 }}>
        ⚙ {part.toolCall.name} · {part.toolCall.status}
      </span>
    ),
    parts: [
      {
        id: "a",
        type: "tool",
        toolCall: { name: "getStatus", status: "completed", output: { ok: true } }
      }
    ]
  }
};

export const PlainVariant: Story = {
  name: "Variant: plain (flat reading column)",
  args: { role: "assistant", variant: "plain" }
};

export const BubbleVariant: Story = {
  name: "Variant: bubble (padded surface)",
  args: { role: "assistant", variant: "bubble" }
};

export const NoticeVariant: Story = {
  name: "Variant: notice (muted inline)",
  args: { role: "assistant", variant: "notice", text: "Model context window updated." }
};

export const CompactDensity: Story = {
  name: "Density: compact",
  args: { density: "compact" }
};

export const SharedPlainVariant: Story = {
  name: "User and assistant: plain",
  render: () => (
    <div style={{ display: "grid", gap: 16 }}>
      <AgentMessage role="user" variant="plain" text="Can both sides use the same treatment?" />
      <AgentMessage role="assistant" variant="plain" text="Yes. Pass the same variant to each message." />
    </div>
  )
};

export const LocalizedLabels: Story = {
  name: "Localized labels",
  args: {
    role: "user",
    text: "Résume les notes de version.",
    onEdit: fn(),
    onRetry: fn(),
    labels: {
      role: { user: "Vous" },
      actions: { edit: "Modifier", retry: "Réessayer" },
      streaming: "Génération en cours"
    }
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Modifier" }));
    await expect(args.onEdit).toHaveBeenCalledOnce();
  }
};

export const CustomSlots: Story = {
  name: "Slots (leading/actions/footer)",
  render: () => (
    <AgentMessage
      role="assistant"
      text="Here is the report you asked for."
      slots={{
        leading: <span style={{ fontSize: 13, color: "var(--text-color-kumo-subtle)" }}>🤖 assistant</span>,
        actions: <button style={{ fontSize: 12 }}>Star</button>,
        footer: <p style={{ fontSize: 12, color: "var(--text-color-kumo-subtle)" }}>Generated just now</p>
      }}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Star" }));
    await expect(canvas.getByText("Generated just now")).toBeInTheDocument();
  }
};

export const PartTypes: Story = {
  render: () => {
    const parts: AgentMessagePart[] = [
      { type: "text", text: "First a text part, then a custom part, then a completed tool." },
      { type: "custom", id: "c1", name: "artifact", data: { file: "report.pdf" } },
      {
        type: "tool",
        toolCall: {
          name: "getStatus",
          status: "completed",
          output: { ok: true }
        }
      }
    ];
    return <AgentMessage role="assistant" parts={parts} />;
  }
};
