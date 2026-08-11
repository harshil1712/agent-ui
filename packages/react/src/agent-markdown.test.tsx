import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { AgentMarkdown } from "./agent-markdown";

describe("AgentMarkdown", () => {
  it("renders semantic Markdown", () => {
    const { container } = render(
      <AgentMarkdown>{"## Result\n\nUse **Durable Objects**.\n\n- Durable\n- Stateful"}</AgentMarkdown>
    );
    expect(screen.getByRole("heading", { level: 2, name: "Result" })).toBeInTheDocument();
    expect(screen.getByText("Durable Objects").tagName).toBe("STRONG");
    expect(container.querySelectorAll("li")).toHaveLength(2);
  });

  it("uses safe defaults for raw HTML", () => {
    const { container } = render(<AgentMarkdown>{"<script>alert('no')</script>"}</AgentMarkdown>);
    expect(container.querySelector("script")).not.toBeInTheDocument();
  });

  it("marks streaming output and forwards DOM props", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <AgentMarkdown ref={ref} isStreaming data-testid="markdown" className="custom">
        {"```ts\nconst answer = 42"}
      </AgentMarkdown>
    );
    expect(ref.current).toBe(screen.getByTestId("markdown"));
    expect(ref.current).toHaveAttribute("data-streaming", "true");
    expect(ref.current).toHaveClass("agent-ui-markdown", "custom");
    expect(ref.current?.querySelector("code")).toHaveTextContent("const answer = 42");
  });
});
