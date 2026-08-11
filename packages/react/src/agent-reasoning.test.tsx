import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AgentReasoning } from "./agent-reasoning";

describe("AgentReasoning", () => {
  it("opens by default while streaming", () => {
    const { container } = render(<AgentReasoning text="Checking constraints" isStreaming />);
    expect(screen.getByText("Checking constraints")).toBeVisible();
    expect(container.firstElementChild).toHaveAttribute("data-expanded", "true");
  });

  it("is collapsed by default when complete", () => {
    const { container } = render(
      <AgentReasoning text="Checked constraints" onExpandedChange={() => {}} />
    );
    expect(container.firstElementChild).toHaveAttribute("data-expanded", "false");
  });

  it("shows completed reasoning without a dead disclosure when no controller is provided", () => {
    render(<AgentReasoning text="Checked constraints" />);
    expect(screen.getByText("Checked constraints")).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("reports controlled expansion changes", async () => {
    const onExpandedChange = vi.fn();
    render(<AgentReasoning text="Details" expanded={false} onExpandedChange={onExpandedChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Show reasoning" }));
    expect(onExpandedChange).toHaveBeenCalledWith(true);
  });

  it("supports labels and slots", () => {
    render(
      <AgentReasoning
        text="Détails"
        expanded
        onExpandedChange={() => {}}
        labels={{ hide: "Masquer", reasoning: "Raisonnement" }}
        slots={{ summary: <span>Trace</span> }}
      />
    );
    expect(screen.getByRole("button", { name: "Masquer" })).toHaveTextContent("Trace");
    expect(screen.getByText("Détails")).toBeInTheDocument();
  });
});
