import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  AgentChatMessages,
  AgentChatRoot,
  type AgentChatMessageModel,
  type AgentChatViewModel
} from "./agent-chat";

function textPart(text: string) {
  return { type: "text", text } as const;
}

function message(overrides: Partial<AgentChatMessageModel>): AgentChatMessageModel {
  return {
    id: "m1",
    role: "assistant",
    parts: [textPart("Hello")],
    text: "Hello",
    isStreaming: false,
    isAssistant: true,
    canRetry: false,
    canEdit: false,
    isLast: false,
    ...overrides
  };
}

function textMessage(
  text: string,
  overrides: Partial<AgentChatMessageModel> = {}
): AgentChatMessageModel {
  return message({ text, parts: [textPart(text)], ...overrides });
}

function viewModel(overrides: Partial<AgentChatViewModel> = {}): AgentChatViewModel {
  return {
    messages: [],
    phase: "ready",
    busy: false,
    isRecovering: false,
    showPending: false,
    isIdle: overrides.isIdle ?? (overrides.messages?.length ?? 0) === 0,
    expanded: {},
    setExpanded: vi.fn(),
    toggleExpanded: vi.fn(),
    actions: {},
    ...overrides
  };
}

describe("AgentChatMessages", () => {
  it("throws when no Root is present and no viewModel is given", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<AgentChatMessages />)).toThrow(
      /must be rendered inside <AgentChat.Root>/
    );
    spy.mockRestore();
  });

  it("consumes the view model from AgentChat.Root context", () => {
    render(
      <AgentChatRoot viewModel={viewModel({ messages: [textMessage("From context")] })}>
        <AgentChatMessages />
      </AgentChatRoot>
    );
    expect(screen.getByText("From context")).toBeInTheDocument();
  });

  it("accepts an explicit viewModel prop without a Root", () => {
    render(<AgentChatMessages viewModel={viewModel({ messages: [textMessage("Explicit")] })} />);
    expect(screen.getByText("Explicit")).toBeInTheDocument();
  });

  it("renders an accessible region by default", () => {
    const { container } = render(
      <AgentChatMessages viewModel={viewModel({ messages: [textMessage("Hi")], isIdle: false })} />
    );
    const region = container.querySelector(".agent-ui-chat-messages");
    expect(region).toHaveAttribute("role", "region");
    expect(region).toHaveAttribute("aria-label", "Conversation");
  });

  it("allows role and aria-label to be overridden", () => {
    const { container } = render(
      <AgentChatMessages
        viewModel={viewModel({ messages: [textMessage("Hi")], isIdle: false })}
        role="list"
        aria-label="Messages"
        data-testid="transcript"
      />
    );
    const containerEl = container.querySelector(".agent-ui-chat-messages");
    expect(containerEl).toHaveAttribute("role", "list");
    expect(containerEl).toHaveAttribute("aria-label", "Messages");
    expect(containerEl).toHaveAttribute("data-testid", "transcript");
  });

  it("renders a default empty state when there are no messages", () => {
    render(<AgentChatMessages viewModel={viewModel()} />);
    expect(screen.getByText("Start a conversation")).toBeInTheDocument();
  });

  it("renders custom empty-state content", () => {
    render(
      <AgentChatMessages
        viewModel={viewModel()}
        empty={<button>Ask a suggestion</button>}
      />
    );
    expect(screen.getByRole("button", { name: "Ask a suggestion" })).toBeInTheDocument();
  });

  it("renders a function-based empty state", () => {
    render(
      <AgentChatMessages viewModel={viewModel()} renderEmpty={() => <span>Custom empty</span>} />
    );
    expect(screen.getByText("Custom empty")).toBeInTheDocument();
  });

  it("renders a recovery notice while recovering, even when idle", () => {
    render(
      <AgentChatMessages
        viewModel={viewModel({ isRecovering: true })}
        recoveringLabel="Récupération…"
      />
    );
    expect(screen.getByRole("status")).toHaveTextContent("Récupération…");
  });

  it("renders a pending placeholder when showPending", () => {
    render(
      <AgentChatMessages
        viewModel={viewModel({
          messages: [message({ id: "u1", role: "user", isAssistant: false, text: "Hi" })],
          showPending: true,
          isIdle: false
        })}
      />
    );
    expect(screen.getByRole("status", { name: "Thinking" })).toBeInTheDocument();
  });

  it("does not render a pending placeholder when showPending is false", () => {
    render(
      <AgentChatMessages
        viewModel={viewModel({
          messages: [message({ id: "u1", role: "user", isAssistant: false, text: "Hi" })],
          showPending: false,
          isIdle: false
        })}
      />
    );
    expect(screen.queryByRole("status", { name: "Thinking" })).not.toBeInTheDocument();
  });

  it("marks only the last assistant message as streaming", () => {
    const { container } = render(
      <AgentChatMessages
        viewModel={viewModel({
          messages: [
            message({ id: "a1", text: "First", isStreaming: false, isLast: false }),
            message({ id: "a2", text: "Second", isStreaming: true, isLast: true })
          ],
          isIdle: false
        })}
      />
    );
    const articles = container.querySelectorAll("[data-role='assistant']");
    expect(articles).toHaveLength(2);
    expect(articles[0]).toHaveAttribute("data-streaming", "false");
    expect(articles[1]).toHaveAttribute("data-streaming", "true");
  });

  it("wires copy, retry, and edit actions onto the message", async () => {
    const user = userEvent.setup();
    const onCopy = vi.fn();
    const onRetry = vi.fn();
    const onEdit = vi.fn();
    const copyModel = message({ id: "a1", text: "Copy me", canRetry: true });
    const userModel = message({
      id: "u1",
      role: "user",
      isAssistant: false,
      text: "Edit me",
      canEdit: true
    });
    render(
      <AgentChatMessages
        viewModel={viewModel({
          messages: [userModel, copyModel],
          isIdle: false,
          actions: { copy: onCopy, retry: onRetry, edit: onEdit }
        })}
      />
    );
    await user.click(screen.getByRole("button", { name: "Copy message" }));
    expect(onCopy).toHaveBeenCalledWith(copyModel);
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledWith(copyModel);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(onEdit).toHaveBeenCalledWith(userModel);
  });

  it("hides retry when canRetry is false and edit when canEdit is false", () => {
    render(
      <AgentChatMessages
        viewModel={viewModel({
          messages: [
            message({ id: "a1", canRetry: false }),
            message({ id: "u1", role: "user", isAssistant: false, canEdit: false })
          ],
          isIdle: false,
          actions: { retry: vi.fn(), edit: vi.fn() }
        })}
      />
    );
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("preserves a system message role", () => {
    const { container } = render(
      <AgentChatMessages
        viewModel={viewModel({
          messages: [
            message({ id: "s1", role: "system", isAssistant: false, text: "You are helpful." }),
            message({ id: "a1", text: "Ok." })
          ],
          isIdle: false
        })}
      />
    );
    const articles = container.querySelectorAll("[data-role]");
    expect(articles[0]).toHaveAttribute("data-role", "system");
    expect(articles[1]).toHaveAttribute("data-role", "assistant");
  });

  it("renders approval actions that answer with the approval id", async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn();
    render(
      <AgentChatMessages
        viewModel={viewModel({
          messages: [
            message({
              parts: [
                {
                  type: "tool",
                  toolCall: {
                    name: "sendReport",
                    status: "awaiting-approval",
                    onApprove: () => onApprove("approval-1"),
                    onReject: () => onApprove("rejected")
                  }
                }
              ]
            })
          ],
          isIdle: false
        })}
      />
    );
    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(onApprove).toHaveBeenCalledWith("approval-1");
  });
});

describe("AgentChatMessages render overrides and resolvers", () => {
  it("whole-transcript render overrides all default content", () => {
    const vm = viewModel({
      messages: [textMessage("Ignored"), textMessage("Also ignored")],
      isIdle: false,
      isRecovering: true
    });
    render(
      <AgentChatMessages
        viewModel={vm}
        render={(view) => <div data-testid="transcript">{view.messages.length} messages</div>}
      />
    );
    expect(screen.getByTestId("transcript")).toHaveTextContent("2 messages");
    expect(screen.queryByText("Ignored")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("whole-transcript render overrides the empty state", () => {
    render(
      <AgentChatMessages
        viewModel={viewModel()}
        render={(view) => <div data-testid="custom-empty">{view.isIdle ? "Idle" : "Active"}</div>}
      />
    );
    expect(screen.getByTestId("custom-empty")).toHaveTextContent("Idle");
    expect(screen.queryByText("Start a conversation")).not.toBeInTheDocument();
  });

  it("renderMessage fully overrides a message", () => {
    const model = textMessage("Overridden");
    render(
      <AgentChatMessages
        viewModel={viewModel({ messages: [model], isIdle: false })}
        renderMessage={(msg, messageIndex) => (
          <div data-testid="override" data-id={msg.id} data-index={messageIndex}>
            Custom
          </div>
        )}
      />
    );
    expect(screen.getByTestId("override")).toHaveAttribute("data-id", "m1");
    expect(screen.getByTestId("override")).toHaveAttribute("data-index", "0");
    expect(screen.queryByText("Overridden")).not.toBeInTheDocument();
  });

  it("messageProps resolver merges after defaults for user vs assistant", () => {
    const { container } = render(
      <AgentChatMessages
        viewModel={viewModel({
          messages: [
            message({ id: "u1", role: "user", isAssistant: false, text: "User text" }),
            message({ id: "a1", text: "Assistant text" })
          ],
          isIdle: false
        })}
        messageProps={({ message: msg }) => ({
          variant: msg.role === "user" ? "plain" : "bubble"
        })}
      />
    );
    const articles = container.querySelectorAll("[data-role]");
    expect(articles[0]).toHaveClass("agent-ui-message--plain");
    expect(articles[1]).toHaveClass("agent-ui-message--bubble");
  });

  it("messageProps resolver can set labels without rewiring actions", async () => {
    const user = userEvent.setup();
    const onCopy = vi.fn();
    const copyModel = message({ id: "a1", text: "hi" });
    render(
      <AgentChatMessages
        viewModel={viewModel({
          messages: [copyModel],
          isIdle: false,
          actions: { copy: onCopy }
        })}
        messageProps={() => ({ labels: { actions: { copy: "Copier" } } })}
      />
    );
    await user.click(screen.getByRole("button", { name: "Copier" }));
    expect(onCopy).toHaveBeenCalledWith(copyModel);
  });

  it("messageProps can customize a render callback per message without rewiring actions", () => {
    const onCopy = vi.fn();
    const copyModel = message({ id: "a1", text: "hi", canRetry: true });
    render(
      <AgentChatMessages
        viewModel={viewModel({
          messages: [copyModel],
          isIdle: false,
          actions: { copy: onCopy, retry: vi.fn() }
        })}
        messageProps={({ message: msg }) => ({
          renderText: () => <span data-testid="per-message-text">{msg.id}</span>
        })}
      />
    );
    expect(screen.getByTestId("per-message-text")).toHaveTextContent("a1");
    expect(screen.getByRole("button", { name: "Copy message" })).toBeInTheDocument();
  });

  it("top-level renderText does not clobber a messageProps renderText when absent", () => {
    const onCopy = vi.fn();
    render(
      <AgentChatMessages
        viewModel={viewModel({
          messages: [message({ id: "a1", text: "hi" })],
          isIdle: false,
          actions: { copy: onCopy }
        })}
        messageProps={() => ({ renderText: () => <span data-testid="kept" /> })}
        renderTool={() => <span data-testid="tool-wins" />}
      />
    );
    expect(screen.getByTestId("kept")).toBeInTheDocument();
  });

  it("top-level AgentChat renderText wins over messageProps renderText when provided", () => {
    render(
      <AgentChatMessages
        viewModel={viewModel({ messages: [message({ id: "a1", text: "hi" })], isIdle: false })}
        messageProps={() => ({ renderText: () => <span data-testid="lost" /> })}
        renderText={() => <span data-testid="top-wins" />}
      />
    );
    expect(screen.getByTestId("top-wins")).toBeInTheDocument();
    expect(screen.queryByTestId("lost")).not.toBeInTheDocument();
  });

  it("toolProps resolver reaches the ToolCall primitive", () => {
    render(
      <AgentChatMessages
        viewModel={viewModel({
          messages: [
            message({
              parts: [
                {
                  type: "tool",
                  toolCall: { name: "getSchedule", status: "completed", input: {}, output: {} }
                }
              ]
            })
          ],
          isIdle: false
        })}
        toolProps={({ part }) => ({ labels: { details: `Details: ${part.toolCall.name}` } })}
      />
    );
    expect(screen.getByRole("button", { name: "Details: getSchedule" })).toBeInTheDocument();
  });

  it("reasoningProps resolver reaches the AgentReasoning primitive", () => {
    render(
      <AgentChatMessages
        viewModel={viewModel({
          messages: [
            message({
              parts: [
                {
                  type: "reasoning",
                  reasoning: { text: "thinking…", expanded: true, onExpandedChange: vi.fn() }
                }
              ]
            })
          ],
          isIdle: false
        })}
        reasoningProps={() => ({ labels: { show: "Montrer", hide: "Masquer" } })}
      />
    );
    expect(screen.getByRole("button", { name: "Masquer" })).toBeInTheDocument();
  });

  it("textProps resolver reaches the AgentMarkdown primitive", () => {
    render(
      <AgentChatMessages
        viewModel={viewModel({
          messages: [message({ id: "a1", text: "# Heading", parts: [textPart("# Heading")] })],
          isIdle: false
        })}
        textProps={({ message: msg }) => ({
          className: msg.id === "a1" ? "custom-markdown" : ""
        })}
      />
    );
    expect(screen.getByText("Heading").closest(".agent-ui-markdown")).toHaveClass(
      "custom-markdown"
    );
  });

  it("default text render resolves the messageProps-overridden part for textProps", () => {
    render(
      <AgentChatMessages
        viewModel={viewModel({
          messages: [message({ id: "a1", text: "Original", parts: [textPart("Original")] })],
          isIdle: false
        })}
        messageProps={() => ({ parts: [{ type: "text", text: "Replaced" }] })}
        textProps={({ part }) => ({
          className: part.text === "Replaced" ? "resolved-part" : "stale-part"
        })}
      />
    );
    expect(screen.getByText("Replaced")).toBeInTheDocument();
    expect(screen.getByText("Replaced").closest(".agent-ui-markdown")).toHaveClass(
      "resolved-part"
    );
  });

  it("fileProps resolver reaches the AgentFile primitive", () => {
    render(
      <AgentChatMessages
        viewModel={viewModel({
          messages: [
            message({
              parts: [
                {
                  type: "file",
                  file: { name: "notes.txt", mediaType: "text/plain", url: "https://x/notes.txt" }
                }
              ]
            })
          ],
          isIdle: false
        })}
        fileProps={() => ({ labels: { open: "View" } })}
      />
    );
    expect(screen.getByRole("link", { name: "View" })).toBeInTheDocument();
  });

  it("pendingProps resolver configures the AgentPending placeholder", () => {
    render(
      <AgentChatMessages
        viewModel={viewModel({
          messages: [message({ id: "u1", role: "user", isAssistant: false, text: "Hi" })],
          showPending: true,
          isIdle: false
        })}
        pendingProps={() => ({ labels: { pending: "Réflexion" } })}
      />
    );
    expect(screen.getByRole("status", { name: "Réflexion" })).toBeInTheDocument();
  });

  it("renderTool full override receives context and wins over toolProps", () => {
    render(
      <AgentChatMessages
        viewModel={viewModel({
          messages: [
            message({
              id: "a1",
              parts: [
                { type: "tool", toolCall: { name: "getSchedule", status: "completed", input: {}, output: {} } }
              ]
            })
          ],
          isIdle: false
        })}
        toolProps={() => ({ labels: { details: "No" } })}
        renderTool={({ part, message: msg }) => (
          <span data-testid="custom-tool">{part.toolCall.name}-{msg.id}</span>
        )}
      />
    );
    expect(screen.getByTestId("custom-tool")).toHaveTextContent("getSchedule-a1");
    expect(screen.queryByRole("button", { name: "No" })).not.toBeInTheDocument();
  });

  it("renderText full override receives context", () => {
    render(
      <AgentChatMessages
        viewModel={viewModel({
          messages: [message({ id: "a1", text: "Hello", parts: [textPart("Hello")] })],
          isIdle: false
        })}
        renderText={({ part, message: msg }) => (
          <span data-testid="custom-text">{part.text}-{msg.id}</span>
        )}
      />
    );
    expect(screen.getByTestId("custom-text")).toHaveTextContent("Hello-a1");
  });

  it("two messages can render the same primitive differently via context", () => {
    render(
      <AgentChatMessages
        viewModel={viewModel({
          messages: [
            message({ id: "a1", text: "One", parts: [textPart("One")] }),
            message({ id: "a2", text: "Two", parts: [textPart("Two")] })
          ],
          isIdle: false
        })}
        renderText={({ part, message: msg }) => (
          <span data-testid={`text-${msg.id}`}>{part.text}</span>
        )}
      />
    );
    expect(screen.getByTestId("text-a1")).toHaveTextContent("One");
    expect(screen.getByTestId("text-a2")).toHaveTextContent("Two");
  });

  it("renderPending full override replaces the pending placeholder", () => {
    render(
      <AgentChatMessages
        viewModel={viewModel({
          messages: [message({ id: "u1", role: "user", isAssistant: false, text: "Hi" })],
          showPending: true,
          isIdle: false
        })}
        renderPending={() => <div data-testid="custom-pending">Streaming…</div>}
      />
    );
    expect(screen.getByTestId("custom-pending")).toHaveTextContent("Streaming…");
    expect(screen.queryByRole("status", { name: "Thinking" })).not.toBeInTheDocument();
  });

  it("renderPart renders custom parts through the escape hatch", () => {
    render(
      <AgentChatMessages
        viewModel={viewModel({
          messages: [
            message({
              parts: [{ type: "custom", name: "data-latency", data: { p95Ms: 120 } }]
            })
          ],
          isIdle: false
        })}
        renderPart={({ part }) => <span data-testid="custom-part">{part.name}</span>}
      />
    );
    expect(screen.getByTestId("custom-part")).toHaveTextContent("data-latency");
  });

  it("part resolvers receive messageIndex and partIndex", () => {
    const seen: Array<{ msgIndex: number; partIndex: number }> = [];
    render(
      <AgentChatMessages
        viewModel={viewModel({
          messages: [
            message({
              id: "a1",
              parts: [
                { type: "tool", toolCall: { name: "t1", status: "completed", input: {}, output: {} } }
              ]
            })
          ],
          isIdle: false
        })}
        toolProps={({ messageIndex, partIndex }) => {
          seen.push({ msgIndex: messageIndex, partIndex });
          return {};
        }}
      />
    );
    expect(seen).toEqual([{ msgIndex: 0, partIndex: 0 }]);
  });
});

describe("AgentChatMessages transcript window", () => {
  it("does not resolve or render parts from windowed-out messages", () => {
    const toolProps = vi.fn(() => ({}));
    const renderTool = vi.fn(() => <span>rendered tool</span>);
    render(
      <AgentChatMessages
        viewModel={viewModel({
          messages: [
            message({
              id: "old",
              parts: [
                {
                  type: "tool",
                  toolCall: { name: "oldTool", status: "completed", output: { large: true } }
                }
              ]
            }),
            textMessage("Newest", { id: "new" })
          ],
          isIdle: false
        })}
        maxVisibleMessages={1}
        toolProps={toolProps}
        renderTool={renderTool}
      />
    );

    expect(toolProps).not.toHaveBeenCalled();
    expect(renderTool).not.toHaveBeenCalled();
    expect(screen.queryByText("rendered tool")).not.toBeInTheDocument();
  });

  it("renders the full transcript by default when maxVisibleMessages is omitted", () => {
    render(
      <AgentChatMessages
        viewModel={viewModel({
          messages: [
            textMessage("One", { id: "m1" }),
            textMessage("Two", { id: "m2" }),
            textMessage("Three", { id: "m3" })
          ],
          isIdle: false
        })}
      />
    );
    expect(screen.getByText("One")).toBeInTheDocument();
    expect(screen.getByText("Three")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show older messages" })).not.toBeInTheDocument();
  });

  it("renders only the most-recent messages and offers a show-older control", async () => {
    const user = userEvent.setup();
    render(
      <AgentChatMessages
        viewModel={viewModel({
          messages: [
            textMessage("One", { id: "m1" }),
            textMessage("Two", { id: "m2" }),
            textMessage("Three", { id: "m3" }),
            textMessage("Four", { id: "m4" })
          ],
          isIdle: false
        })}
        maxVisibleMessages={2}
      />
    );
    expect(screen.queryByText("One")).not.toBeInTheDocument();
    expect(screen.queryByText("Two")).not.toBeInTheDocument();
    expect(screen.getByText("Three")).toBeInTheDocument();
    expect(screen.getByText("Four")).toBeInTheDocument();

    const showOlder = screen.getByRole("button", { name: "Show older messages" });
    await user.click(showOlder);
    expect(screen.getByText("One")).toBeInTheDocument();
    expect(screen.getByText("Two")).toBeInTheDocument();
    expect(showOlder).not.toBeInTheDocument();
  });

  it("reveals older messages one page at a time", async () => {
    const user = userEvent.setup();
    render(
      <AgentChatMessages
        viewModel={viewModel({
          messages: [
            textMessage("One", { id: "m1" }),
            textMessage("Two", { id: "m2" }),
            textMessage("Three", { id: "m3" }),
            textMessage("Four", { id: "m4" }),
            textMessage("Five", { id: "m5" })
          ],
          isIdle: false
        })}
        maxVisibleMessages={2}
      />
    );
    expect(screen.getByText("Four")).toBeInTheDocument();
    expect(screen.getByText("Five")).toBeInTheDocument();
    expect(screen.queryByText("Two")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show older messages" }));
    expect(screen.getByText("Two")).toBeInTheDocument();
    expect(screen.queryByText("One")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show older messages" }));
    expect(screen.getByText("One")).toBeInTheDocument();
  });

  it("honors a custom show-older label", () => {
    render(
      <AgentChatMessages
        viewModel={viewModel({
          messages: [
            textMessage("One", { id: "m1" }),
            textMessage("Two", { id: "m2" })
          ],
          isIdle: false
        })}
        maxVisibleMessages={1}
        showOlderLabel="View earlier"
      />
    );
    expect(screen.getByRole("button", { name: "View earlier" })).toBeInTheDocument();
  });

  it("keeps the newest message visible as the transcript grows", () => {
    const vm = viewModel({
      messages: [textMessage("One", { id: "m1" }), textMessage("Two", { id: "m2" })],
      isIdle: false
    });
    const { rerender } = render(<AgentChatMessages viewModel={vm} maxVisibleMessages={2} />);
    expect(screen.getByText("One")).toBeInTheDocument();

    rerender(
      <AgentChatMessages
        viewModel={viewModel({
          messages: [textMessage("One", { id: "m1" }), textMessage("Two", { id: "m2" }), textMessage("Three", { id: "m3" })],
          isIdle: false
        })}
        maxVisibleMessages={2}
      />
    );
    expect(screen.queryByText("One")).not.toBeInTheDocument();
    expect(screen.getByText("Two")).toBeInTheDocument();
    expect(screen.getByText("Three")).toBeInTheDocument();
  });

  it("renders messages that arrive after an empty initial render", () => {
    const { rerender } = render(
      <AgentChatMessages viewModel={viewModel({})} maxVisibleMessages={2} />
    );
    expect(screen.queryByText("One")).not.toBeInTheDocument();

    rerender(
      <AgentChatMessages
        viewModel={viewModel({
          messages: [textMessage("One", { id: "m1" }), textMessage("Two", { id: "m2" })],
          isIdle: false
        })}
        maxVisibleMessages={2}
      />
    );
    expect(screen.getByText("One")).toBeInTheDocument();
    expect(screen.getByText("Two")).toBeInTheDocument();
  });

  it("adjusts the window when maxVisibleMessages changes", () => {
    const { rerender } = render(
      <AgentChatMessages
        viewModel={viewModel({
          messages: [textMessage("One", { id: "m1" }), textMessage("Two", { id: "m2" }), textMessage("Three", { id: "m3" })],
          isIdle: false
        })}
        maxVisibleMessages={1}
      />
    );
    expect(screen.getByText("Three")).toBeInTheDocument();
    expect(screen.queryByText("One")).not.toBeInTheDocument();

    rerender(
      <AgentChatMessages
        viewModel={viewModel({
          messages: [textMessage("One", { id: "m1" }), textMessage("Two", { id: "m2" }), textMessage("Three", { id: "m3" })],
          isIdle: false
        })}
        maxVisibleMessages={3}
      />
    );
    expect(screen.getByText("One")).toBeInTheDocument();
  });

  it("clamps the window when messages shrink and clears on empty", () => {
    const { rerender } = render(
      <AgentChatMessages
        viewModel={viewModel({
          messages: [textMessage("One", { id: "m1" }), textMessage("Two", { id: "m2" }), textMessage("Three", { id: "m3" })],
          isIdle: false
        })}
        maxVisibleMessages={2}
      />
    );
    rerender(
      <AgentChatMessages
        viewModel={viewModel({
          messages: [textMessage("Two", { id: "m2" }), textMessage("Three", { id: "m3" })],
          isIdle: false
        })}
        maxVisibleMessages={2}
      />
    );
    expect(screen.getByText("Two")).toBeInTheDocument();
    expect(screen.getByText("Three")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show older messages" })).not.toBeInTheDocument();
  });

  it("preserves a revealed larger window as the transcript grows", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <AgentChatMessages
        viewModel={viewModel({
          messages: [
            textMessage("One", { id: "m1" }),
            textMessage("Two", { id: "m2" }),
            textMessage("Three", { id: "m3" }),
            textMessage("Four", { id: "m4" })
          ],
          isIdle: false
        })}
        maxVisibleMessages={2}
      />
    );
    // Reveal all four.
    await user.click(screen.getByRole("button", { name: "Show older messages" }));
    expect(screen.getByText("One")).toBeInTheDocument();

    // Grow to six: the revealed window of 4 is preserved (not snapped to 2),
    // so m3..m6 are shown and m1/m2 remain behind the show-older control.
    rerender(
      <AgentChatMessages
        viewModel={viewModel({
          messages: [
            textMessage("One", { id: "m1" }),
            textMessage("Two", { id: "m2" }),
            textMessage("Three", { id: "m3" }),
            textMessage("Four", { id: "m4" }),
            textMessage("Five", { id: "m5" }),
            textMessage("Six", { id: "m6" })
          ],
          isIdle: false
        })}
        maxVisibleMessages={2}
      />
    );
    expect(screen.getByText("Three")).toBeInTheDocument();
    expect(screen.getByText("Six")).toBeInTheDocument();
    expect(screen.queryByText("One")).not.toBeInTheDocument();
    expect(screen.queryByText("Two")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show older messages" })).toBeInTheDocument();
  });

  it("passes the canonical messageIndex within viewModel.messages when windowed", () => {
    const seen: number[] = [];
    render(
      <AgentChatMessages
        viewModel={viewModel({
          messages: [
            textMessage("One", { id: "m1" }),
            textMessage("Two", { id: "m2" }),
            textMessage("Three", { id: "m3" }),
            textMessage("Four", { id: "m4" })
          ],
          isIdle: false
        })}
        maxVisibleMessages={2}
        renderMessage={(msg, index) => {
          seen.push(index);
          return <div key={msg.id}>{msg.text}</div>;
        }}
      />
    );
    expect(screen.getByText("Three")).toBeInTheDocument();
    expect(screen.getByText("Four")).toBeInTheDocument();
    expect(seen).toEqual([2, 3]);
  });

  it("passes the canonical messageIndex to the messageProps resolver when windowed", () => {
    const seen: number[] = [];
    render(
      <AgentChatMessages
        viewModel={viewModel({
          messages: [
            textMessage("One", { id: "m1" }),
            textMessage("Two", { id: "m2" }),
            textMessage("Three", { id: "m3" }),
            textMessage("Four", { id: "m4" })
          ],
          isIdle: false
        })}
        maxVisibleMessages={2}
        messageProps={({ messageIndex }) => {
          seen.push(messageIndex);
          return {};
        }}
      />
    );
    expect(seen).toEqual([2, 3]);
  });

  it("normalizes a zero maxVisibleMessages to a page size of one", () => {
    render(
      <AgentChatMessages
        viewModel={viewModel({
          messages: [textMessage("One", { id: "m1" }), textMessage("Two", { id: "m2" })],
          isIdle: false
        })}
        maxVisibleMessages={0}
      />
    );
    expect(screen.getByText("Two")).toBeInTheDocument();
    expect(screen.queryByText("One")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show older messages" })).toBeInTheDocument();
  });

  it("normalizes a negative maxVisibleMessages to a page size of one", () => {
    render(
      <AgentChatMessages
        viewModel={viewModel({
          messages: [textMessage("One", { id: "m1" }), textMessage("Two", { id: "m2" })],
          isIdle: false
        })}
        maxVisibleMessages={-5}
      />
    );
    expect(screen.getByText("Two")).toBeInTheDocument();
    expect(screen.queryByText("One")).not.toBeInTheDocument();
  });

  it("normalizes a non-finite maxVisibleMessages to a page size of one", () => {
    render(
      <AgentChatMessages
        viewModel={viewModel({
          messages: [textMessage("One", { id: "m1" }), textMessage("Two", { id: "m2" })],
          isIdle: false
        })}
        maxVisibleMessages={Number.NaN}
      />
    );
    expect(screen.getByText("Two")).toBeInTheDocument();
    expect(screen.queryByText("One")).not.toBeInTheDocument();
  });

  it("floors a fractional maxVisibleMessages", () => {
    render(
      <AgentChatMessages
        viewModel={viewModel({
          messages: [
            textMessage("One", { id: "m1" }),
            textMessage("Two", { id: "m2" }),
            textMessage("Three", { id: "m3" })
          ],
          isIdle: false
        })}
        maxVisibleMessages={2.9}
      />
    );
    // 2.9 floors to 2, so the oldest message is hidden behind the control.
    expect(screen.getByText("Two")).toBeInTheDocument();
    expect(screen.getByText("Three")).toBeInTheDocument();
    expect(screen.queryByText("One")).not.toBeInTheDocument();
  });
});
