import type { Meta, StoryObj } from "@storybook/react-vite";
import { AgentPending } from "./agent-pending";

const meta = {
  title: "Agent UI/AgentPending",
  component: AgentPending,
  tags: ["autodocs"]
} satisfies Meta<typeof AgentPending>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Compact: Story = {};
export const Descriptive: Story = { args: { variant: "descriptive" } };
export const CustomIndicator: Story = {
  args: {
    variant: "descriptive",
    labels: { pending: "Searching documentation" },
    slots: { indicator: <span aria-hidden="true">⌕</span> }
  }
};
