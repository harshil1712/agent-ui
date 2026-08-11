import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { useState } from "react";
import { AgentComposer, type AgentAttachment } from "./agent-composer";

const sampleAttachments: AgentAttachment[] = [
  { id: "a1", name: "report.pdf", size: 245760, mediaType: "application/pdf" },
  {
    id: "a2",
    name: "hero.png",
    size: 5242880,
    mediaType: "image/png",
    previewUrl: "https://imagedelivery.net/placeholder/hero"
  }
];

function ControlledComposer(props: Partial<Parameters<typeof AgentComposer>[0]>) {
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<AgentAttachment[]>([]);
  const [busy, setBusy] = useState(false);

  const handleAddAttachments = (files: FileList) => {
    const next: AgentAttachment[] = Array.from(files).map((file, index) => ({
      id: `${Date.now()}-${index}`,
      name: file.name,
      size: file.size,
      mediaType: file.type
    }));
    setAttachments((prev) => [...prev, ...next]);
  };

  const handleSubmit = (text: string, items: AgentAttachment[]) => {
    if (!text.trim() && items.length === 0) return;
    setBusy(true);
    window.setTimeout(() => {
      setBusy(false);
      setValue("");
      setAttachments([]);
    }, 1600);
  };

  return (
    <AgentComposer
      {...props}
      value={value}
      onValueChange={setValue}
      onSubmit={props.onSubmit ? props.onSubmit : handleSubmit}
      attachments={attachments}
      onAddAttachments={handleAddAttachments}
      onRemoveAttachment={(id) => setAttachments((prev) => prev.filter((a) => a.id !== id))}
      busy={busy}
      onStop={() => setBusy(false)}
    />
  );
}

const meta = {
  title: "Agent UI/AgentComposer",
  component: AgentComposer,
  tags: ["autodocs"],
  args: {
    value: "",
    onValueChange: fn(),
    onSubmit: fn(),
    placeholder: "Message the agent…"
  }
} satisfies Meta<typeof AgentComposer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  render: function BasicStory() {
    return <ControlledComposer />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole("textbox"), "Hi there");
    await expect(canvas.getByRole("textbox")).toHaveValue("Hi there");
  }
};

export const WithSubmitOnEnter: Story = {
  render: function WithSubmitOnEnterStory() {
    return <ControlledComposer submitOnEnter />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textbox = canvas.getByRole("textbox");
    await userEvent.type(textbox, "Enter sends{Enter}");
    await expect(canvas.getByRole("textbox")).toHaveValue("");
  }
};

export const WithAttachments: Story = {
  render: function WithAttachmentsStory() {
    return (
      <AgentComposer
        value=""
        onValueChange={() => {}}
        onSubmit={() => {}}
        attachments={sampleAttachments}
        onRemoveAttachment={() => {}}
      />
    );
  }
};

export const WithCallbacks: Story = {
  args: {
    onSubmit: fn()
  },
  render: function WithCallbacksStory(args) {
    return <ControlledComposer {...args} />;
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole("textbox"), "Callback text");
    await userEvent.click(canvas.getByRole("button", { name: "Send message" }));
    await expect(args.onSubmit).toHaveBeenCalled();
  }
};

export const Busy: Story = {
  render: function BusyStory() {
    return <ControlledComposer />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole("textbox"), "Run");
    await userEvent.click(canvas.getByRole("button", { name: "Send message" }));
    await expect(canvas.getByRole("button", { name: "Stop" })).toBeInTheDocument();
  }
};

export const Disabled: Story = {
  render: function DisabledStory() {
    return <ControlledComposer disabled />;
  }
};

export const CustomSlots: Story = {
  render: function CustomSlotsStory() {
    return (
      <ControlledComposer
        slots={{
          leading: <span style={{ fontSize: 13, color: "var(--text-color-kumo-subtle)" }}>🤖</span>,
          footer: (
            <p style={{ fontSize: 12, color: "var(--text-color-kumo-subtle)" }}>
              Press Enter to send · Shift+Enter for a new line
            </p>
          )
        }}
      />
    );
  }
};

export const CustomActionsSlot: Story = {
  render: function CustomActionsSlotStory() {
    return (
      <ControlledComposer
        slots={{
          actions: (
            <button style={{ padding: "6px 12px", borderRadius: 6 }}>
              ▶ Custom send
            </button>
          )
        }}
      />
    );
  }
};

export const LocalizedLabels: Story = {
  render: function LocalizedLabelsStory() {
    return (
      <ControlledComposer
        labels={{
          composer: "Composeur de message",
          send: "Envoyer",
          stop: "Arrêter",
          addAttachments: "Joindre un fichier",
          removeAttachment: "Retirer {name}"
        }}
      />
    );
  }
};