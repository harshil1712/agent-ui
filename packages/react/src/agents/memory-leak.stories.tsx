import { useEffect, useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { UIMessage } from "ai";
import { AgentChatMessages } from "../agent-chat";
import { useAgentChatUI } from "./use-agent-chat-ui";

class AgentUiMemoryPayload {
  marker: string;
  files: Array<{ name: string; checksum: string; content: string }>;

  constructor(cycle: number, message: number) {
    this.marker = `agent-ui-memory-${cycle}-${message}`;
    this.files = Array.from({ length: 20 }, (_, index) => ({
      name: `${this.marker}-${index}.txt`,
      checksum: `${cycle}-${message}-${index}-${"a".repeat(64)}`,
      content: `${this.marker}:${index}:${"x".repeat(256)}`
    }));
  }
}

class AgentUiMemoryMessage implements UIMessage {
  id: string;
  role = "assistant" as const;
  parts: UIMessage["parts"];

  constructor(cycle: number, message: number, streamStep = 0) {
    const id = `memory-${cycle}-${message}`;
    this.id = id;
    this.parts = [
      { type: "text", text: `Cycle ${cycle}, message ${message}${".".repeat(streamStep)}` },
      {
        type: "tool-memoryProbe",
        toolCallId: `tool-${id}`,
        state: "output-available",
        input: { cycle, message },
        output: new AgentUiMemoryPayload(cycle, message)
      }
    ];
  }
}

interface MemoryHarnessApi {
  payloadPrototype: AgentUiMemoryPayload;
  messagePrototype: AgentUiMemoryMessage;
  populate: () => Promise<void>;
  run: (cycles?: number) => Promise<void>;
  clear: () => Promise<void>;
  stats: () => {
    cycles: number;
    domNodes: number;
    mountedMessages: number;
  };
}

declare global {
  interface Window {
    __agentUiMemoryHarness?: MemoryHarnessApi;
  }
}

const nextPaint = () => new Promise<void>((resolve) =>
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
);

function makeMessages(cycle: number, count = 120): UIMessage[] {
  return Array.from({ length: count }, (_, index) =>
    new AgentUiMemoryMessage(cycle, index)
  );
}

function MemoryLeakHarness() {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [cycles, setCycles] = useState(0);
  const cyclesRef = useRef(0);
  const viewModel = useAgentChatUI({ messages, status: "ready" });

  useEffect(() => {
    let cancelled = false;

    const clear = async () => {
      setMessages([]);
      await nextPaint();
    };

    const run = async (count = 20) => {
      for (let cycle = 0; cycle < count && !cancelled; cycle++) {
        setMessages(makeMessages(cycle));
        await nextPaint();

        // Replace the active message several times to reproduce streaming
        // object churn while the historical message identities remain stable.
        for (let streamStep = 1; streamStep <= 4 && !cancelled; streamStep++) {
          setMessages((current) => [
            ...current.slice(0, -1),
            new AgentUiMemoryMessage(cycle, 119, streamStep)
          ]);
          await nextPaint();
        }

        // Mount and unmount bounded tool details for a sample of visible tools.
        const details = Array.from(document.querySelectorAll<HTMLButtonElement>(
          ".agent-ui-chat-messages button[aria-expanded]"
        )).slice(0, 8);
        for (const button of details) button.click();
        await nextPaint();
        for (const button of details) button.click();
        await nextPaint();

        setMessages([]);
        cyclesRef.current += 1;
        setCycles(cyclesRef.current);
        await nextPaint();
      }
    };

    window.__agentUiMemoryHarness = {
      payloadPrototype: AgentUiMemoryPayload.prototype,
      messagePrototype: AgentUiMemoryMessage.prototype,
      populate: async () => {
        setMessages(makeMessages(999));
        await nextPaint();
      },
      run,
      clear,
      stats: () => ({
        cycles: cyclesRef.current,
        domNodes: document.querySelectorAll("*").length,
        mountedMessages: document.querySelectorAll(".agent-ui-chat-messages [data-role]").length
      })
    };

    return () => {
      cancelled = true;
      delete window.__agentUiMemoryHarness;
    };
  }, []);

  return (
    <div style={{ width: "min(100%, 760px)" }}>
      <p data-testid="memory-cycles">Completed cycles: {cycles}</p>
      <AgentChatMessages viewModel={viewModel} maxVisibleMessages={50} />
    </div>
  );
}

const meta = {
  title: "Agent UI/Stress/Memory Leak",
  component: MemoryLeakHarness,
  parameters: { layout: "padded" }
} satisfies Meta<typeof MemoryLeakHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Harness: Story = {};
