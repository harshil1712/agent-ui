import type { Meta, StoryObj } from "@storybook/react-vite";
import { AgentMarkdown } from "./agent-markdown";

const meta = {
  title: "Agent UI/AgentMarkdown",
  component: AgentMarkdown,
  tags: ["autodocs"],
  args: {
    children: "## Current status\n\nAll systems are **operational**.\n\n- API: healthy\n- Workers: healthy\n\n```ts\nconst status = await checkStatus()\n```"
  }
} satisfies Meta<typeof AgentMarkdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Complete: Story = {};
export const Streaming: Story = {
  args: {
    isStreaming: true,
    children: "## Working on it\n\nI found the following:\n\n- Workers are operational\n- Durable Objects are"
  }
};
