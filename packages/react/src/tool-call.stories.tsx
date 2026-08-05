import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { ToolCall } from "./tool-call";

const meta = {
  title: "Agent UI/ToolCall",
  component: ToolCall,
  tags: ["autodocs"],
  args: {
    name: "searchDocumentation",
    input: { query: "Durable Objects alarm best practices", limit: 5 }
  }
} satisfies Meta<typeof ToolCall>;

export default meta;
type Story = StoryObj<typeof meta>;

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
