import type { Meta, StoryObj } from "@storybook/react-vite";
import { AgentFile } from "./agent-file";

const meta = {
  title: "Agent UI/AgentFile",
  component: AgentFile,
  tags: ["autodocs"]
} satisfies Meta<typeof AgentFile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TextFile: Story = {
  args: {
    name: "README.md",
    mediaType: "text/markdown",
    size: 18432,
    url: "https://example.com/README.md"
  }
};

export const ImageWithThumbnail: Story = {
  args: {
    name: "incident-graph.png",
    mediaType: "image/png",
    size: 512000,
    url: "data:image/png;base64,iVBORw0KGgo="
  }
};

export const NoUrl: Story = {
  args: {
    name: "notes.txt",
    mediaType: "text/plain",
    size: 512
  }
};

export const CustomOpenLabel: Story = {
  args: {
    name: "report.pdf",
    mediaType: "application/pdf",
    url: "https://example.com/report.pdf",
    labels: { open: "View report" }
  }
};