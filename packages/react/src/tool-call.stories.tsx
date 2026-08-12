import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { useState, type ComponentProps } from "react";
import { ToolCall } from "./tool-call";

const meta = {
  title: "Agent UI/ToolCall",
  component: ToolCall,
  tags: ["autodocs"],
  args: {
    name: "searchDocumentation",
    input: { query: "Durable Objects alarm best practices", limit: 5 }
  },
  render: (args) => <InteractiveToolCall {...args} />
} satisfies Meta<typeof ToolCall>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Storybook needs to own the expansion state because ToolCall is controlled.
 * Consumers drive `expanded`/`onExpandedChange`; this harness demonstrates the
 * pattern for stories whose `play` function opens the details.
 */
function InteractiveToolCall(props: ComponentProps<typeof ToolCall>) {
  const [open, setOpen] = useState(props.expanded ?? props.status === "failed");
  return <ToolCall {...props} expanded={open} onExpandedChange={setOpen} />;
}

export const Pending: Story = {
  args: { status: "pending" }
};

export const Running: Story = {
  args: {
    status: "running",
    description: "Searching the Cloudflare developer documentation."
  }
};

export const AwaitingApproval: Story = {
  args: {
    status: "awaiting-approval",
    description: "This tool will query an external documentation index.",
    onApprove: fn(),
    onReject: fn()
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Approve" }));
    await expect(args.onApprove).toHaveBeenCalledOnce();
  }
};

export const Completed: Story = {
  args: {
    status: "completed",
    output: {
      matches: 5,
      topResult: "Use alarms for durable, time-based callbacks."
    }
  }
};

export const Failed: Story = {
  args: {
    status: "failed",
    error: "The documentation service did not respond before the timeout."
  }
};

export const WithInputAndOutput: Story = {
  args: {
    status: "completed",
    output: { alarmId: "alr_9f2k", nextRun: "2026-08-10T09:00:00Z" }
  },
  render: (args) => <InteractiveToolCall {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "View details" }));
    await expect(canvas.getByText(/"query": "Durable Objects alarm best practices"/)).toBeInTheDocument();
  }
};

export const SubtleVariant: Story = {
  name: "Subtle variant (background/nested)",
  args: {
    status: "running",
    variant: "subtle",
    description: "Nested child run that should sit quietly below the main turn."
  }
};

export const CompactDensity: Story = {
  name: "Compact density",
  args: {
    status: "completed",
    density: "compact",
    output: { matches: 5 }
  },
  render: (args) => <InteractiveToolCall {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "View details" }));
    await expect(canvas.getByText(/"matches": 5/)).toBeInTheDocument();
  }
};

export const ControlledDetails: Story = {
  name: "Controlled expansion",
  args: { name: "getSchedule", status: "completed", output: { cron: "0 9 * * *" } },
  render: (args) => <InteractiveToolCall {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "View details" }));
    await expect(canvas.getByText(/"cron": "0 9 \* \* \*"/)).toBeInTheDocument();
  }
};

export const CustomInputOutputRenderers: Story = {
  name: "Custom input/output renderers",
  args: { name: "listAlarms", status: "completed" },
  render: (args) => (
    <InteractiveToolCall
      {...args}
      input={{ alarmId: "alr_9f2k" }}
      output={{ nextRun: "2026-08-10T09:00:00Z" }}
      renderInput={(input) => (
        <p style={{ fontFamily: "monospace", fontSize: 12 }}>
          payload: {JSON.stringify(input)}
        </p>
      )}
      renderOutput={(output) => <strong>next: {String((output as any).nextRun)}</strong>}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "View details" }));
    await expect(canvas.getByText(/payload:.*alr_9f2k/)).toBeInTheDocument();
    await expect(canvas.getByText(/next: 2026-08-10T09:00:00Z/)).toBeInTheDocument();
  }
};

export const LocalizedLabels: Story = {
  name: "Localized labels",
  args: {
    status: "awaiting-approval",
    onApprove: fn(),
    onReject: fn(),
    labels: {
      details: "Afficher les détails",
      approve: "Approuver",
      reject: "Rejeter",
      input: "Entrée",
      output: "Sortie",
      error: "Erreur",
      status: { "awaiting-approval": "Approbation requise" }
    }
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Approuver" }));
    await expect(args.onApprove).toHaveBeenCalledOnce();
  }
};

export const CustomSlots: Story = {
  name: "Slots (leading/actions/footer)",
  args: { name: "sendReport", status: "awaiting-approval" },
  render: () => (
    <ToolCall
      name="sendReport"
      status="awaiting-approval"
      onApprove={fn()}
      onReject={fn()}
      slots={{
        leading: <span style={{ color: "var(--color-kumo-warning)", fontSize: 14 }}>⚠</span>,
        actions: (
          <button onClick={fn()} style={{ fontSize: 12 }}>
            Review and allow
          </button>
        ),
        footer: <p style={{ fontSize: 12, color: "var(--text-color-kumo-subtle)" }}>Runs in production.</p>
      }}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Review and allow" }));
    await expect(canvas.getByText("Runs in production.")).toBeInTheDocument();
  }
};

export const TruncatedLargeValue: Story = {
  name: "Bounded detail: large payload truncated",
  args: {
    name: "listFiles",
    status: "completed",
    detailChars: 400,
    output: {
      files: Array.from({ length: 60 }, (_, i) => ({
        name: `report-${String(i).padStart(2, "0")}.csv`,
        size: 1024 * (i + 1),
        contentType: "text/csv",
        checksum: "sha256:".concat("a".repeat(64)),
      })),
    },
  },
  render: (args) => <InteractiveToolCall {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "View details" }));
    await expect(canvas.getByRole("button", { name: "Show more" })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Show more" }));
    await expect(canvas.getByRole("button", { name: "Show less" })).toBeInTheDocument();
    await expect(canvas.getByText(/report-59\.csv/)).toBeInTheDocument();
  },
};

export const LocalizedShowMore: Story = {
  name: "Localized show-more labels",
  args: {
    name: "queryLogs",
    status: "completed",
    detailChars: 50,
    output: { lines: Array.from({ length: 20 }, (_, i) => `line ${i}`) },
    labels: { showMore: "Afficher plus", showLess: "Afficher moins" },
  },
  render: (args) => <InteractiveToolCall {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "View details" }));
    const output = canvas.getByRole("region", { name: "Output" });
    await expect(within(output).getByRole("button", { name: "Afficher plus" })).toBeInTheDocument();
  },
};
