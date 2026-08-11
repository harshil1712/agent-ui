import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { AgentPending } from "./agent-pending";

describe("AgentPending", () => {
  it("announces the pending state", () => {
    render(<AgentPending />);
    expect(screen.getByRole("status", { name: "Thinking" })).toBeInTheDocument();
  });

  it("supports descriptive, localized, and custom indicator states", () => {
    render(
      <AgentPending
        variant="descriptive"
        labels={{ pending: "Preparing an answer" }}
        slots={{ indicator: <span data-testid="spinner" /> }}
      />
    );
    expect(screen.getByText("Preparing an answer", { selector: ":not(.agent-ui-visually-hidden)" })).toBeInTheDocument();
    expect(screen.getByTestId("spinner")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute("data-variant", "descriptive");
  });

  it("forwards refs and DOM props", () => {
    const ref = createRef<HTMLDivElement>();
    render(<AgentPending ref={ref} data-testid="pending" className="custom" />);
    expect(ref.current).toBe(screen.getByTestId("pending"));
    expect(ref.current).toHaveClass("agent-ui-pending", "custom");
  });
});
