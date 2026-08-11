import { describe, expect, it } from "vitest";
import type { ProviderMetadata, UIMessage } from "ai";
import {
  getMessageText,
  mapChatStatus,
  mapToolState,
  toAgentMessageParts,
  type AgentChatDisplayStatus
} from "./map";

function message(parts: UIMessage["parts"]): UIMessage {
  return { id: "m1", role: "assistant", parts };
}

function toolPart(state: string, toolCallId = "call_1") {
  return {
    type: "tool-checkCloudflareStatus",
    toolCallId,
    state,
    input: { query: "status" },
    output: { incidents: 1 },
    errorText: undefined
  } as UIMessage["parts"][number];
}

describe("mapToolState", () => {
  it("maps every AI SDK tool state onto a ToolCall status", () => {
    expect(mapToolState("input-streaming")).toBe("running");
    expect(mapToolState("input-available")).toBe("pending");
    expect(mapToolState("approval-requested")).toBe("awaiting-approval");
    expect(mapToolState("approval-responded")).toBe("running");
    expect(mapToolState("output-available")).toBe("completed");
    expect(mapToolState("output-error")).toBe("failed");
    expect(mapToolState("output-denied")).toBe("failed");
  });

  it("falls back to running for unknown states", () => {
    expect(mapToolState("something-else")).toBe("running");
  });
});

describe("mapChatStatus", () => {
  it.each<[string, boolean, AgentChatDisplayStatus]>([
    ["submitted", false, "thinking"],
    ["streaming", false, "streaming"],
    ["ready", false, "ready"],
    ["error", false, "error"]
  ])("maps status %s (recovering=%s) to %s", (status, isRecovering, expected) => {
    expect(mapChatStatus({ status: status as "submitted", isRecovering })).toBe(expected);
  });

  it("prefers recovering over thinking and ready", () => {
    expect(mapChatStatus({ status: "submitted", isRecovering: true })).toBe("recovering");
    expect(mapChatStatus({ status: "ready", isRecovering: true })).toBe("recovering");
  });

  it("lets error win over recovering", () => {
    expect(mapChatStatus({ status: "error", isRecovering: true })).toBe("error");
  });
});

describe("getMessageText", () => {
  it("joins text parts in order, ignoring non-text parts", () => {
    const text = getMessageText(
      message([
        { type: "text", text: "First" },
        { type: "reasoning", text: "hidden" },
        { type: "text", text: "Second" },
        { type: "step-start" }
      ])
    );
    expect(text).toBe("First\nSecond");
  });
});

describe("toAgentMessageParts", () => {
  it("maps text, reasoning, tool, and file parts in order", () => {
    const parts = toAgentMessageParts(
      message([
        { type: "text", text: "Let me check." },
        { type: "reasoning", text: "I should query status.", state: "done" },
        toolPart("output-available", "call_1"),
        { type: "file", mediaType: "text/plain", filename: "notes.txt", url: "data:text/plain,hi" }
      ])
    );
    expect(parts.map((part) => part.type)).toEqual(["text", "reasoning", "tool", "file"]);
  });

  it("maps a completed tool part with input and output", () => {
    const [tool] = toAgentMessageParts(
      message([toolPart("output-available", "call_1")])
    );
    expect(tool).toMatchObject({
      type: "tool",
      id: "call_1",
      toolCall: {
        name: "checkCloudflareStatus",
        status: "completed",
        input: { query: "status" },
        output: { incidents: 1 }
      }
    });
  });

  it("maps a failed tool part with its error text", () => {
    const [tool] = toAgentMessageParts(
      message([
        {
          type: "tool-checkCloudflareStatus",
          toolCallId: "call_2",
          state: "output-error",
          input: { query: "status" },
          errorText: "Timed out"
        }
      ])
    );
    expect(tool).toMatchObject({ type: "tool", toolCall: { status: "failed", error: "Timed out" } });
  });

  it("attaches a tool description when provided", () => {
    const [tool] = toAgentMessageParts(
      message([toolPart("input-available", "call_3")]),
      { toolDescriptions: { checkCloudflareStatus: "Check the status page." } }
    );
    expect(tool).toMatchObject({
      type: "tool",
      toolCall: { description: "Check the status page." }
    });
  });

  it("defaults tool expansion to open for failed tools, closed otherwise", () => {
    const [failed] = toAgentMessageParts(message([toolPart("output-error", "a")]));
    expect(failed).toMatchObject({ toolCall: { expanded: true } });

    const [running] = toAgentMessageParts(message([toolPart("input-streaming", "b")]));
    expect(running).toMatchObject({ toolCall: { expanded: false } });
  });

  it("defaults reasoning expansion to open while streaming", () => {
    const [streaming] = toAgentMessageParts(
      message([{ type: "reasoning", text: "thinking…", state: "streaming" }])
    );
    expect(streaming).toMatchObject({ reasoning: { expanded: true } });

    const [done] = toAgentMessageParts(
      message([{ type: "reasoning", text: "done", state: "done" }])
    );
    expect(done).toMatchObject({ reasoning: { expanded: false } });
  });

  it("uses expansion overrides and reports toggles by part id", () => {
    const changes: Array<[string, boolean]> = [];
    const parts = toAgentMessageParts(
      message([
        { type: "reasoning", text: "r", state: "done" },
        toolPart("output-available", "call_9")
      ]),
      {
        expanded: { "m1:reasoning:0": true, call_9: true },
        onExpandedChange: (id, open) => changes.push([id, open])
      }
    );

    const reasoning = parts[0];
    if (reasoning?.type === "reasoning") reasoning.reasoning.onExpandedChange?.(false);
    const tool = parts[1];
    if (tool?.type === "tool") tool.toolCall.onExpandedChange?.(true);

    expect(parts[0]).toMatchObject({ reasoning: { expanded: true } });
    expect(parts[1]).toMatchObject({ toolCall: { expanded: true } });
    expect(changes).toEqual([
      ["m1:reasoning:0", false],
      ["call_9", true]
    ]);
  });

  it("maps a file part to a file part with filename and url", () => {
    const [file] = toAgentMessageParts(
      message([{ type: "file", mediaType: "text/markdown", filename: "README.md", url: "https://x/README.md" }])
    );
    expect(file).toMatchObject({
      type: "file",
      file: { name: "README.md", mediaType: "text/markdown", url: "https://x/README.md" }
    });
  });

  it("derives a filename from a file url when none is provided", () => {
    const [file] = toAgentMessageParts(
      message([{ type: "file", mediaType: "text/plain", url: "https://x/data.txt" }])
    );
    expect(file).toMatchObject({ type: "file", file: { name: "data.txt" } });
  });

  it("skips only the step-start structural marker", () => {
    const parts = toAgentMessageParts(
      message([{ type: "step-start" }, { type: "text", text: "hi" }])
    );
    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({ type: "text", text: "hi" });
  });

  it("maps a data part to a custom part so renderPart is an escape hatch", () => {
    const [latency, flags] = toAgentMessageParts(
      message([
        { type: "data-latency", data: { p95Ms: 120 } },
        { type: "data-flags", id: "flags-1", data: { darkMode: true } }
      ])
    );
    expect(latency).toMatchObject({
      type: "custom",
      name: "data-latency",
      data: { p95Ms: 120 }
    });
    expect(flags).toMatchObject({ type: "custom", name: "data-flags", id: "flags-1" });
  });

  it("maps custom, source, and reasoning-file parts to custom parts", () => {
    const providerMetadata = { v: { n: "1" } } as ProviderMetadata;
    const parts = toAgentMessageParts(
      message([
        { type: "custom", kind: "acme.widget", providerMetadata },
        { type: "source-url", sourceId: "s1", url: "https://example.com/source" },
        { type: "source-document", sourceId: "s2", mediaType: "text/plain", title: "Doc" },
        { type: "reasoning-file", mediaType: "text/plain", url: "https://example.com/rf" }
      ])
    );
    expect(parts.map((p) => p.type)).toEqual(["custom", "custom", "custom", "custom"]);
    expect(parts[0]).toMatchObject({ name: "acme.widget", data: { v: { n: "1" } } });
    expect(parts[1]).toMatchObject({ name: "source-url", data: { url: "https://example.com/source" } });
    expect(parts[2]).toMatchObject({ name: "source-document", data: { title: "Doc" } });
    expect(parts[3]).toMatchObject({ name: "reasoning-file", data: { mediaType: "text/plain" } });
  });

  it("wires approval handlers only for approval-requested parts with a callback", () => {
    const responded: Array<{ id: string; approved: boolean }> = [];
    const addToolApprovalResponse = (input: { id: string; approved: boolean }) => {
      responded.push(input);
    };

    const parts = toAgentMessageParts(
      message([
        {
          type: "tool-sendReport",
          toolCallId: "call_appr",
          state: "approval-requested",
          input: { limit: 5 },
          approval: { id: "approval-1" }
        }
      ]),
      { addToolApprovalResponse }
    );

    const [tool] = parts;
    expect(tool).toMatchObject({ type: "tool", toolCall: { status: "awaiting-approval" } });
    if (tool?.type === "tool") {
      tool.toolCall.onApprove?.();
      expect(responded).toEqual([{ id: "approval-1", approved: true }]);
      tool.toolCall.onReject?.();
      expect(responded).toEqual([
        { id: "approval-1", approved: true },
        { id: "approval-1", approved: false }
      ]);
    }
  });

  it("does not wire approval handlers when the callback is absent", () => {
    const [tool] = toAgentMessageParts(
      message([
        {
          type: "tool-sendReport",
          toolCallId: "call_appr",
          state: "approval-requested",
          input: { limit: 5 },
          approval: { id: "approval-1" }
        }
      ])
    );
    expect(tool).toMatchObject({ type: "tool", toolCall: { status: "awaiting-approval" } });
    if (tool?.type === "tool") {
      expect(tool.toolCall.onApprove).toBeUndefined();
      expect(tool.toolCall.onReject).toBeUndefined();
    }
  });
});