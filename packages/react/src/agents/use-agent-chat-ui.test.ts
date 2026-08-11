import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ChatStatus, UIMessage } from "ai";
import { useAgentChatUI, type AgentChatInput } from "./use-agent-chat-ui";

function textPart(text: string) {
  return { type: "text", text } as const;
}

function chat(overrides: Partial<AgentChatInput> = {}): AgentChatInput {
  return {
    messages: [],
    status: "ready",
    ...overrides
  };
}

function assistantMessage(parts: UIMessage["parts"], id = "a1"): UIMessage {
  return { id, role: "assistant", parts };
}

function userMessage(parts: UIMessage["parts"], id = "u1"): UIMessage {
  return { id, role: "user", parts };
}

describe("useAgentChatUI", () => {
  it("normalizes messages into an SDK-free view model", () => {
    const { result } = renderHook(() =>
      useAgentChatUI(
        chat({
          messages: [
            userMessage([textPart("Hello?")], "u1"),
            assistantMessage([textPart("Hi there!")], "a1")
          ]
        })
      )
    );

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]).toMatchObject({
      id: "u1",
      role: "user",
      text: "Hello?",
      isAssistant: false,
      isLast: false
    });
    expect(result.current.messages[1]).toMatchObject({
      id: "a1",
      role: "assistant",
      text: "Hi there!",
      isAssistant: true,
      isLast: true,
      canRetry: false
    });
    expect(result.current.isIdle).toBe(false);
    expect(result.current.phase).toBe("ready");
    expect(result.current.busy).toBe(false);
  });

  it("derives busy and showPending from status", () => {
    const { result } = renderHook(() =>
      useAgentChatUI(
        chat({ messages: [userMessage([textPart("Hi")])], status: "submitted" })
      )
    );
    expect(result.current.phase).toBe("thinking");
    expect(result.current.busy).toBe(true);
    expect(result.current.showPending).toBe(true);
  });

  it("hides the pending placeholder during a tool continuation", () => {
    const { result } = renderHook(() =>
      useAgentChatUI(
        chat({
          messages: [userMessage([textPart("Hi")])],
          status: "submitted",
          isToolContinuation: true
        })
      )
    );
    expect(result.current.showPending).toBe(false);
  });

  it("maps status to phase", () => {
    const cases: Array<[ChatStatus, boolean, string]> = [
      ["ready", false, "ready"],
      ["submitted", false, "thinking"],
      ["streaming", false, "streaming"],
      ["error", false, "error"],
      ["ready", true, "recovering"]
    ];
    for (const [status, isRecovering, expected] of cases) {
      const { result } = renderHook(() =>
        useAgentChatUI(chat({ status, isRecovering }))
      );
      expect(result.current.phase).toBe(expected);
      expect(result.current.isRecovering).toBe(isRecovering);
    }
  });

  it("marks only the last assistant message as streaming", () => {
    const { result } = renderHook(() =>
      useAgentChatUI(
        chat({
          messages: [
            assistantMessage([textPart("First")], "a1"),
            assistantMessage([textPart("Second")], "a2")
          ],
          isStreaming: true
        })
      )
    );
    expect(result.current.messages[0].isStreaming).toBe(false);
    expect(result.current.messages[1].isStreaming).toBe(true);
  });

  it("enables canRetry for the last assistant message when regenerate is available and not busy", () => {
    const regenerate = vi.fn();
    const { result } = renderHook(() =>
      useAgentChatUI(
        chat({
          messages: [
            userMessage([textPart("Retry me")], "u1"),
            assistantMessage([textPart("partial")], "a1")
          ],
          regenerate
        })
      )
    );
    expect(result.current.messages[1].canRetry).toBe(true);
    expect(result.current.messages[0].canRetry).toBe(false);
    expect(result.current.actions.retry).toBeDefined();
    result.current.actions.retry?.(result.current.messages[1]);
    expect(regenerate).toHaveBeenCalledTimes(1);
  });

  it("wires effective retry to regenerate when no onRetry option is given", () => {
    const regenerate = vi.fn();
    const { result } = renderHook(() =>
      useAgentChatUI(
        chat({ messages: [assistantMessage([textPart("partial")], "a1")], regenerate })
      )
    );
    expect(result.current.messages[0].canRetry).toBe(true);
    result.current.actions.retry?.(result.current.messages[0]);
    expect(regenerate).toHaveBeenCalledTimes(1);
  });

  it("supports a custom onRetry without regenerate", () => {
    const onRetry = vi.fn();
    const { result } = renderHook(() =>
      useAgentChatUI(chat({ messages: [assistantMessage([textPart("partial")], "a1")] }), {
        onRetry
      })
    );
    expect(result.current.messages[0].canRetry).toBe(true);
    expect(result.current.actions.retry).toBe(onRetry);
    result.current.actions.retry?.(result.current.messages[0]);
    expect(onRetry).toHaveBeenCalledWith(result.current.messages[0]);
  });

  it("does not offer retry when neither regenerate nor onRetry is available", () => {
    const { result } = renderHook(() =>
      useAgentChatUI(chat({ messages: [assistantMessage([textPart("partial")], "a1")] }))
    );
    expect(result.current.messages[0].canRetry).toBe(false);
    expect(result.current.actions.retry).toBeUndefined();
  });

  it("disables retry while busy", () => {
    const { result } = renderHook(() =>
      useAgentChatUI(
        chat({
          messages: [assistantMessage([textPart("partial")], "a1")],
          regenerate: vi.fn(),
          isStreaming: true
        })
      )
    );
    expect(result.current.messages[0].canRetry).toBe(false);
  });

  it("wires an edit action and marks user messages as editable", () => {
    const onEdit = vi.fn();
    const { result } = renderHook(() =>
      useAgentChatUI(
        chat({ messages: [userMessage([textPart("Edit me")], "u1")] }),
        { onEdit }
      )
    );
    expect(result.current.messages[0].canEdit).toBe(true);
    expect(result.current.actions.edit).toBe(onEdit);
    result.current.actions.edit?.(result.current.messages[0]);
    expect(onEdit).toHaveBeenCalledWith(result.current.messages[0]);
  });

  it("does not mark assistant messages as editable", () => {
    const onEdit = vi.fn();
    const { result } = renderHook(() =>
      useAgentChatUI(chat({ messages: [assistantMessage([textPart("hi")], "a1")] }), {
        onEdit
      })
    );
    expect(result.current.messages[0].canEdit).toBe(false);
  });

  it("maps tool and file parts and wires approvals", () => {
    const addToolApprovalResponse = vi.fn();
    const { result } = renderHook(() =>
      useAgentChatUI(
        chat({
          messages: [
            assistantMessage(
              [
                {
                  type: "tool-sendReport",
                  toolCallId: "call_1",
                  state: "approval-requested",
                  input: { limit: 5 },
                  approval: { id: "approval-1" }
                },
                {
                  type: "file",
                  mediaType: "text/plain",
                  filename: "notes.txt",
                  url: "https://example.com/notes.txt"
                }
              ],
              "a1"
            )
          ],
          addToolApprovalResponse
        })
      )
    );

    const [tool, file] = result.current.messages[0].parts;
    expect(tool).toMatchObject({ type: "tool", toolCall: { status: "awaiting-approval" } });
    if (tool?.type === "tool") {
      tool.toolCall.onApprove?.();
      expect(addToolApprovalResponse).toHaveBeenCalledWith({ id: "approval-1", approved: true });
    }
    expect(file).toMatchObject({ type: "file", file: { name: "notes.txt" } });
  });

  it("preserves system messages with a system role", () => {
    const { result } = renderHook(() =>
      useAgentChatUI(
        chat({
          messages: [
            { id: "s1", role: "system", parts: [textPart("You are helpful.")] },
            assistantMessage([textPart("Ok.")], "a1")
          ]
        })
      )
    );
    expect(result.current.messages[0].role).toBe("system");
    expect(result.current.messages[0].isAssistant).toBe(false);
  });

  it("exposes resolved expansion and toggles a default-closed part", () => {
    const { result } = renderHook(() =>
      useAgentChatUI(
        chat({
          messages: [
            assistantMessage(
              [
                {
                  type: "reasoning",
                  text: "thinking…",
                  state: "done"
                },
                {
                  type: "tool-getSchedule",
                  toolCallId: "call_9",
                  state: "output-available",
                  input: {},
                  output: {}
                }
              ],
              "a1"
            )
          ]
        })
      )
    );

    const reasoningId = "a1:reasoning:0";
    // Default-closed parts resolve to false.
    expect(result.current.expanded[reasoningId]).toBe(false);
    expect(result.current.expanded["call_9"]).toBe(false);

    act(() => result.current.toggleExpanded("call_9"));
    expect(result.current.expanded["call_9"]).toBe(true);
    act(() => result.current.toggleExpanded("call_9"));
    expect(result.current.expanded["call_9"]).toBe(false);
  });

  it("resolves a failed tool as open by default and toggleExpanded closes it", () => {
    const { result } = renderHook(() =>
      useAgentChatUI(
        chat({
          messages: [
            assistantMessage([
              {
                type: "tool-sendReport",
                toolCallId: "call_failed",
                state: "output-error",
                input: {},
                errorText: "Timed out"
              }
            ])
          ]
        })
      )
    );
    expect(result.current.expanded["call_failed"]).toBe(true);
    act(() => result.current.toggleExpanded("call_failed"));
    expect(result.current.expanded["call_failed"]).toBe(false);
  });

  it("resolves streaming reasoning as open by default and toggleExpanded closes it", () => {
    const { result } = renderHook(() =>
      useAgentChatUI(
        chat({
          messages: [
            assistantMessage([{ type: "reasoning", text: "thinking…", state: "streaming" }])
          ]
        })
      )
    );
    const id = "a1:reasoning:0";
    expect(result.current.expanded[id]).toBe(true);
    act(() => result.current.toggleExpanded(id));
    expect(result.current.expanded[id]).toBe(false);
  });

  it("setExpanded sets the resolved open state", () => {
    const { result } = renderHook(() =>
      useAgentChatUI(
        chat({
          messages: [
            assistantMessage([
              { type: "tool-getSchedule", toolCallId: "call_1", state: "output-available", input: {}, output: {} }
            ])
          ]
        })
      )
    );
    expect(result.current.expanded["call_1"]).toBe(false);
    act(() => result.current.setExpanded("call_1", true));
    expect(result.current.expanded["call_1"]).toBe(true);
  });

  it("honors controlled expansion without owning state", () => {
    const onExpandedChange = vi.fn();
    const { result } = renderHook(() =>
      useAgentChatUI(
        chat({
          messages: [
            assistantMessage([
              { type: "tool-getSchedule", toolCallId: "call_1", state: "output-available", input: {}, output: {} }
            ])
          ]
        }),
        { expanded: { call_1: true }, onExpandedChange }
      )
    );
    expect(result.current.expanded).toEqual({ call_1: true });

    act(() => result.current.setExpanded("call_1", false));
    expect(onExpandedChange).toHaveBeenCalledWith("call_1", false);
    expect(result.current.expanded).toEqual({ call_1: true });
  });

  it("exposes copy/retry actions from options", () => {
    const onCopy = vi.fn();
    const onRetry = vi.fn();
    const { result } = renderHook(() =>
      useAgentChatUI(
        chat({ messages: [assistantMessage([textPart("hi")], "a1")], regenerate: vi.fn() }),
        { onCopy, onRetry }
      )
    );
    result.current.actions.copy?.(result.current.messages[0]);
    expect(onCopy).toHaveBeenCalledWith(result.current.messages[0]);
    result.current.actions.retry?.(result.current.messages[0]);
    expect(onRetry).toHaveBeenCalledWith(result.current.messages[0]);
  });

  it("attaches tool descriptions", () => {
    const { result } = renderHook(() =>
      useAgentChatUI(
        chat({
          messages: [
            assistantMessage([
              { type: "tool-check", toolCallId: "c", state: "input-available", input: {} }
            ])
          ]
        }),
        { toolDescriptions: { check: "Check things." } }
      )
    );
    const [tool] = result.current.messages[0].parts;
    expect(tool).toMatchObject({ type: "tool", toolCall: { description: "Check things." } });
  });
});