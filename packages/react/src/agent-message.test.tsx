import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { AgentMessage, type AgentMessagePart } from "./agent-message";

describe("AgentMessage", () => {
  it("renders a single text blob for a simple text message", () => {
    render(<AgentMessage role="assistant" text="Hello from the agent." />);
    expect(screen.getByRole("article", { name: "Assistant message" })).toBeInTheDocument();
    expect(screen.getByText("Hello from the agent.")).toBeInTheDocument();
  });

  it("renders Markdown text semantically", () => {
    render(<AgentMessage role="assistant" text={"## Result\n\nUse **Durable Objects**."} />);
    expect(screen.getByRole("heading", { level: 2, name: "Result" })).toBeInTheDocument();
    expect(screen.getByText("Durable Objects").tagName).toBe("STRONG");
  });

  it("renders structured parts instead of a single blob", () => {
    render(
      <AgentMessage
        role="assistant"
        parts={[
          { id: "a", type: "text", text: "Let me look that up." },
          {
            id: "b",
            type: "tool",
            toolCall: { name: "searchDocs", status: "completed", output: { matches: 2 } }
          }
        ]}
      />
    );
    expect(screen.getByText("Let me look that up.")).toBeInTheDocument();
    expect(screen.getByText("searchDocs")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("calls a custom part renderer for custom parts", () => {
    const renderPart = vi.fn((part: AgentMessagePart) =>
      part.type === "custom" ? `custom:${part.name}` : null
    );
    render(
      <AgentMessage
        role="assistant"
        parts={[{ type: "custom", id: "a", name: "artifact", data: { file: "code.txt" } }]}
        renderPart={renderPart}
      />
    );
    expect(renderPart).toHaveBeenCalled();
    expect(screen.getByText("custom:artifact")).toBeInTheDocument();
  });

  it("calls a custom text renderer slot", () => {
    const renderText = vi.fn((text: string) => <strong>{text}</strong>);
    render(<AgentMessage role="assistant" text="Bold content" renderText={renderText} />);
    expect(renderText).toHaveBeenCalledWith("Bold content", 0);
    expect(screen.getByText("Bold content").tagName).toBe("STRONG");
  });

  it("uses a custom tool renderer for tool parts", () => {
    const renderTool = vi.fn((part) => <div data-testid="custom-tool">{part.toolCall.name}</div>);
    render(
      <AgentMessage
        role="assistant"
        parts={[
          { id: "b", type: "tool", toolCall: { name: "searchDocs", status: "completed" } }
        ]}
        renderTool={renderTool}
      />
    );
    expect(renderTool).toHaveBeenCalled();
    expect(screen.getByTestId("custom-tool")).toHaveTextContent("searchDocs");
    expect(screen.queryByText("Completed")).not.toBeInTheDocument();
  });

  it("announces streaming state with a status indicator", () => {
    const { container } = render(<AgentMessage role="assistant" text="Partial" isStreaming />);
    expect(screen.getByRole("status")).toHaveTextContent("Streaming");
    expect(container.querySelector(".agent-ui-message__content")).toHaveAttribute("aria-busy", "true");
  });

  it("shows a visible pending state before the first streamed part", () => {
    render(<AgentMessage role="assistant" parts={[]} isStreaming />);
    expect(screen.getByRole("status", { name: "Thinking" })).toBeInTheDocument();
  });

  it("renders a streamed reasoning part", () => {
    const { container } = render(
      <AgentMessage
        role="assistant"
        parts={[
          {
            type: "reasoning",
            reasoning: { text: "I should check current status.", isStreaming: true }
          }
        ]}
      />
    );
    expect(screen.getByText("I should check current status.")).toBeInTheDocument();
    expect(container.querySelector(".agent-ui-reasoning")).toHaveAttribute("data-streaming", "true");
  });

  it("supports a custom reasoning renderer", () => {
    const renderReasoning = vi.fn((part) => <strong>{part.reasoning.text}</strong>);
    render(
      <AgentMessage
        role="assistant"
        parts={[{ type: "reasoning", reasoning: { text: "Private trace" } }]}
        renderReasoning={renderReasoning}
      />
    );
    expect(renderReasoning).toHaveBeenCalled();
    expect(screen.getByText("Private trace").tagName).toBe("STRONG");
  });

  it("does not render a streaming indicator when idle", () => {
    render(<AgentMessage role="assistant" text="Done" />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("supports a custom streaming indicator slot", () => {
    render(
      <AgentMessage role="assistant" text="Partial" isStreaming slots={{ streamingIndicator: "Génération" }} />
    );
    expect(screen.getByRole("status")).toHaveTextContent("Génération");
    expect(screen.getByRole("status")).not.toHaveTextContent("Streaming");
  });

  it("invokes retry, edit, and copy callbacks", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const onEdit = vi.fn();
    const onCopy = vi.fn();
    render(
      <AgentMessage role="assistant" text="Retry me" onRetry={onRetry} onEdit={onEdit} onCopy={onCopy} />
    );

    await user.click(screen.getByRole("button", { name: "Retry" }));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Copy message" }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onCopy).toHaveBeenCalledOnce();
  });

  it("renders no actions when no callbacks are provided", () => {
    render(<AgentMessage role="assistant" text="Plain" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("can hide actions even when callbacks or slots are provided", () => {
    render(
      <AgentMessage
        role="user"
        text="No actions"
        onCopy={() => {}}
        showActions={false}
        slots={{ actions: <button>Custom action</button> }}
      />
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders only the actions that are provided", () => {
    render(<AgentMessage role="user" text="Hi" onRetry={() => {}} />);
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy message" })).not.toBeInTheDocument();
  });

  it("wraps default actions in a labelled group", () => {
    render(<AgentMessage role="assistant" text="Hi" onRetry={() => {}} onEdit={() => {}} />);
    const group = screen.getByRole("group", { name: "Message actions" });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("wraps a custom actions slot in a labelled group", () => {
    const onCopy = vi.fn();
    render(
      <AgentMessage
        role="assistant"
        text="Hi"
        slots={{ actions: <button onClick={onCopy}>Custom copy</button> }}
      />
    );
    const group = screen.getByRole("group", { name: "Message actions" });
    expect(group).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy message" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Custom copy" })).toBeInTheDocument();
  });

  it("uses the correct accessible role labels for each role", () => {
    const { rerender } = render(<AgentMessage role="user" text="Hi" />);
    expect(screen.getByRole("article", { name: "You message" })).toBeInTheDocument();
    rerender(<AgentMessage role="system" text="Hi" />);
    expect(screen.getByRole("article", { name: "System message" })).toBeInTheDocument();
    rerender(<AgentMessage role="tool" text="Hi" />);
    expect(screen.getByRole("article", { name: "Tool result message" })).toBeInTheDocument();
  });

  it("overrides role and action labels via the labels object", () => {
    render(
      <AgentMessage
        role="user"
        text="Hi"
        onEdit={() => {}}
        labels={{ role: { user: "Vous" }, actions: { edit: "Modifier" } }}
      />
    );
    expect(screen.getByRole("article", { name: "Vous message" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Modifier" })).toBeInTheDocument();
  });

  it("keeps copyLabel/retryLabel/editLabel as backward-compatible aliases", () => {
    render(
      <AgentMessage
        role="assistant"
        text="Hi"
        onRetry={() => {}}
        onEdit={() => {}}
        onCopy={() => {}}
        retryLabel="Rejouer"
        editLabel="Éditer"
        copyLabel="Copier"
      />
    );
    expect(screen.getByRole("button", { name: "Rejouer" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Éditer" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copier" })).toBeInTheDocument();
  });

  it("emits role, streaming, and actionable data attributes", () => {
    const { container, rerender } = render(
      <AgentMessage role="assistant" text="Hi" isStreaming onRetry={() => {}} />
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute("data-role", "assistant");
    expect(root).toHaveAttribute("data-streaming", "true");
    expect(root).toHaveAttribute("data-actionable", "true");

    rerender(<AgentMessage role="user" text="Hi" />);
    expect(container.firstElementChild).toHaveAttribute("data-role", "user");
    expect(container.firstElementChild).toHaveAttribute("data-streaming", "false");
    expect(container.firstElementChild).toHaveAttribute("data-actionable", "false");
  });

  it("forwards refs and standard DOM props to the article root", () => {
    const ref = createRef<HTMLElement>();
    const { container } = render(
      <AgentMessage
        ref={ref}
        data-testid="msg-root"
        id="msg-1"
        className="custom"
        role="assistant"
        text="Hi"
      />
    );
    const root = screen.getByTestId("msg-root");
    expect(ref.current).toBe(root);
    expect(root).toHaveAttribute("id", "msg-1");
    expect(root.classList).toContain("agent-ui-message");
    expect(root.classList).toContain("agent-ui-message--assistant");
    expect(root.classList).toContain("custom");
    expect(container.firstElementChild).toBe(root);
  });

  it("applies variant and density classes", () => {
    const { container } = render(
      <AgentMessage role="assistant" text="Hi" variant="bubble" density="compact" />
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.classList).toContain("agent-ui-message--bubble");
    expect(root.classList).toContain("agent-ui-message--compact");
  });

  it("uses the bubble variant by default for user and assistant messages", () => {
    const { container, rerender } = render(<AgentMessage role="user" text="Hi" />);
    expect(container.firstElementChild).toHaveClass("agent-ui-message--bubble");
    rerender(<AgentMessage role="assistant" text="Hello" />);
    expect(container.firstElementChild).toHaveClass("agent-ui-message--bubble");
  });

  it("renders leading, actions, and footer slots", () => {
    const onCopy = vi.fn();
    render(
      <AgentMessage
        role="assistant"
        text="Hi"
        onCopy={onCopy}
        slots={{
          leading: <span>Avatar</span>,
          actions: <button onClick={onCopy}>Custom copy</button>,
          footer: <p>Footer note</p>
        }}
      />
    );
    expect(screen.getByText("Avatar")).toBeInTheDocument();
    expect(screen.getByText("Footer note")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy message" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Custom copy" })).toBeInTheDocument();
  });

  it("renders a composed transcript of text and tool parts in order", () => {
    render(
      <AgentMessage
        role="assistant"
        parts={[
          { id: "a", type: "text", text: "Let me check the schedule." },
          {
            id: "b",
            type: "tool",
            toolCall: { name: "getSchedule", status: "completed", output: { cron: "0 9 * * *" } }
          },
          {
            id: "c",
            type: "tool",
            toolCall: {
              name: "updateSchedule",
              status: "awaiting-approval",
              onApprove: () => {},
              onReject: () => {}
            }
          },
          { id: "d", type: "text", text: "Ready when you are." }
        ]}
      />
    );

    const textParts = screen.getAllByText(/Let me check|Ready when/);
    expect(textParts).toHaveLength(2);
    expect(screen.getByText("getSchedule")).toBeInTheDocument();
    expect(screen.getByText("updateSchedule")).toBeInTheDocument();
    expect(screen.getByText("Approval required")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
  });
});
