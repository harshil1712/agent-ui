import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { AgentReasoning } from "./agent-reasoning";

const meta = {
  title: "Agent UI/AgentReasoning",
  component: AgentReasoning,
  tags: ["autodocs"],
  args: { text: "The request needs current service status, so I should use the status tool before answering." }
} satisfies Meta<typeof AgentReasoning>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Complete: Story = {};
export const Streaming: Story = { args: { isStreaming: true } };
export const Controlled: Story = {
  render: function ControlledStory(args) {
    const [expanded, setExpanded] = useState(false);
    return <AgentReasoning {...args} expanded={expanded} onExpandedChange={setExpanded} />;
  }
};
