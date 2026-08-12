import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { UIMessage } from "ai";
import { AgentChatPreset } from "./agent-chat-preset";
import type { AgentChatInput } from "./use-agent-chat-ui";

function userMessage(parts: UIMessage["parts"], id = "u1"): UIMessage {
  return { id, role: "user", parts };
}

function assistantMessage(parts: UIMessage["parts"], id = "a1"): UIMessage {
  return { id, role: "assistant", parts };
}

function chat(overrides: Partial<AgentChatInput> = {}): AgentChatInput {
  return {
    messages: [],
    status: "ready",
    sendMessage: vi.fn(),
    ...overrides
  };
}

describe("AgentChatPreset", () => {
  it("renders a default transcript and composer when sendMessage is supplied", async () => {
    const sendMessage = vi.fn();
    const user = userEvent.setup();
    render(
      <AgentChatPreset
        chat={chat({
          messages: [
            userMessage([{ type: "text", text: "Hello?" }], "u1"),
            assistantMessage([{ type: "text", text: "Hi there!" }], "a1")
          ],
          sendMessage
        })}
      />
    );
    expect(screen.getByText("Hello?")).toBeInTheDocument();
    expect(screen.getByText("Hi there!")).toBeInTheDocument();

    const textarea = screen.getByLabelText("Message");
    await user.type(textarea, "Another question");
    await user.click(screen.getByRole("button", { name: "Send message" }));
    expect(sendMessage).toHaveBeenCalledWith({ text: "Another question" });
  });

  it("renders no composer when sendMessage is omitted", () => {
    const { container } = render(
      <AgentChatPreset
        chat={chat({
          messages: [assistantMessage([{ type: "text", text: "Hello" }], "a1")],
          sendMessage: undefined
        })}
      />
    );
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(container.querySelector(".agent-ui-composer")).toBeNull();
  });

  it("mounts only the latest 50 messages by default", () => {
    const messages = Array.from({ length: 55 }, (_, index) =>
      userMessage([{ type: "text", text: `message ${index}` }], `u${index}`)
    );
    const { container } = render(<AgentChatPreset chat={chat({ messages })} />);

    expect(container.querySelectorAll("[data-role]")).toHaveLength(50);
    expect(screen.queryByText("message 4")).not.toBeInTheDocument();
    expect(screen.getByText("message 54")).toBeInTheDocument();
  });

  it("allows consumers to opt into mounting every adapted message", () => {
    const messages = Array.from({ length: 55 }, (_, index) =>
      userMessage([{ type: "text", text: `message ${index}` }], `u${index}`)
    );
    const { container } = render(
      <AgentChatPreset chat={chat({ messages })} maxVisibleMessages={false} />
    );

    expect(container.querySelectorAll("[data-role]")).toHaveLength(55);
  });

  it("forwards messageProps and composerProps resolvers", () => {
    render(
      <AgentChatPreset
        chat={chat({
          messages: [
            userMessage([{ type: "text", text: "Hi" }], "u1"),
            assistantMessage([{ type: "text", text: "Yo" }], "a1")
          ]
        })}
        messageProps={({ message: msg }) => ({
          variant: msg.role === "user" ? "plain" : "bubble"
        })}
        composerProps={({ chat: vm }) => ({
          placeholder: vm.busy ? "Working…" : "Ask me anything"
        })}
      />
    );
    expect(screen.getByPlaceholderText("Ask me anything")).toBeInTheDocument();
  });

  it("renderComposer fully replaces the default composer", () => {
    const { container } = render(
      <AgentChatPreset
        chat={chat({ messages: [userMessage([{ type: "text", text: "Hi" }])] })}
        renderComposer={() => <div data-testid="custom-composer" />}
      />
    );
    expect(screen.getByTestId("custom-composer")).toBeInTheDocument();
    expect(container.querySelector(".agent-ui-composer")).toBeNull();
  });

  it("applies messageProps by role for user vs assistant independently", () => {
    const { container } = render(
      <AgentChatPreset
        chat={chat({
          messages: [
            userMessage([{ type: "text", text: "Hi" }], "u1"),
            assistantMessage([{ type: "text", text: "Yo" }], "a1")
          ]
        })}
        messageProps={({ message: msg }) => ({
          density: msg.role === "user" ? "compact" : "comfortable"
        })}
      />
    );
    const articles = container.querySelectorAll("[data-role]");
    expect(articles[0]).toHaveClass("agent-ui-message--compact");
    expect(articles[1]).toHaveClass("agent-ui-message--comfortable");
  });

  it("renders the pending placeholder configured by pendingProps", () => {
    render(
      <AgentChatPreset
        chat={chat({
          messages: [userMessage([{ type: "text", text: "Hi" }], "u1")],
          status: "submitted"
        })}
        pendingProps={() => ({ labels: { pending: "Réflexion" } })}
      />
    );
    expect(screen.getByRole("status", { name: "Réflexion" })).toBeInTheDocument();
  });

  it("clicking Retry in the preset calls chat.regenerate (zero-config)", async () => {
    const user = userEvent.setup();
    const regenerate = vi.fn();
    render(
      <AgentChatPreset
        chat={chat({
          messages: [
            userMessage([{ type: "text", text: "Retry me" }], "u1"),
            assistantMessage([{ type: "text", text: "partial" }], "a1")
          ],
          regenerate
        })}
      />
    );
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(regenerate).toHaveBeenCalledTimes(1);
  });

  it("renderComposer can reuse the composer plumbing", async () => {
    const user = userEvent.setup();
    const sendMessage = vi.fn();
    render(
      <AgentChatPreset
        chat={chat({ messages: [userMessage([{ type: "text", text: "Hi" }])], sendMessage })}
        renderComposer={({ composerProps, composer }) => (
          <div>
            <button
              type="button"
              onClick={() => void composer.submit("Custom message")}
              data-testid="custom-send"
            >
              Send custom
            </button>
            <span data-testid="busy">{String(composerProps.busy)}</span>
          </div>
        )}
      />
    );
    await user.click(screen.getByTestId("custom-send"));
    expect(sendMessage).toHaveBeenCalledWith({ text: "Custom message" });
    expect(screen.getByTestId("busy")).toHaveTextContent("false");
  });
});
