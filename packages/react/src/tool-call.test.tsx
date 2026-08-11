import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState, type ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { ToolCall } from "./tool-call";

/** Controlled harness: the consumer owns the details expansion state. */
function ControlledToolCall(props: ComponentProps<typeof ToolCall>) {
  const [open, setOpen] = useState(false);
  return <ToolCall expanded={open} onExpandedChange={setOpen} {...props} />;
}

describe("ToolCall", () => {
  it("renders its status and formatted input after expanding details", async () => {
    const user = userEvent.setup();
    render(
      <ControlledToolCall name="searchDocs" status="pending" input={{ query: "Agents" }} />
    );

    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View details" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "View details" }));
    expect(screen.getByText(/"query": "Agents"/)).toBeInTheDocument();
    expect(screen.getByText("Input")).toBeInTheDocument();
  });

  it("invokes approval actions", async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn();
    const onReject = vi.fn();
    render(
      <ToolCall
        name="sendEmail"
        status="awaiting-approval"
        onApprove={onApprove}
        onReject={onReject}
      />
    );

    await user.click(screen.getByRole("button", { name: "Approve" }));
    await user.click(screen.getByRole("button", { name: "Reject" }));
    expect(onApprove).toHaveBeenCalledOnce();
    expect(onReject).toHaveBeenCalledOnce();
  });

  it("does not render actions outside approval state", () => {
    render(<ToolCall name="searchDocs" status="completed" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("emits status, expanded, and actionable data attributes", () => {
    const { container } = render(
      <ToolCall
        name="searchDocs"
        status="awaiting-approval"
        input={{ q: 1 }}
        onApprove={() => {}}
      />
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute("data-status", "awaiting-approval");
    expect(root).toHaveAttribute("data-expanded", "false");
    expect(root).toHaveAttribute("data-actionable", "true");
  });

  it("starts details expanded when the tool failed and expanded is omitted", () => {
    const { container } = render(
      <ToolCall name="getData" status="failed" error="Boom" output={{ ok: false }} />
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute("data-expanded", "true");
    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByText("Boom")).toBeInTheDocument();
  });

  it("starts details closed for non-failed statuses when expanded is omitted", () => {
    render(<ToolCall name="getData" status="completed" output={{ ok: true }} />);
    expect(screen.getByRole("button", { name: "View details" })).not.toHaveAttribute(
      "data-panel-open"
    );
    expect(screen.queryByText(/"ok": true/)).not.toBeInTheDocument();
  });

  it("is fully controlled: reports toggle changes and never owns expansion state", async () => {
    const user = userEvent.setup();
    const onExpandedChange = vi.fn();
    const { container, rerender } = render(
      <ToolCall
        name="getData"
        status="completed"
        expanded={false}
        onExpandedChange={onExpandedChange}
        output={{ ok: true }}
      />
    );
    expect(container.firstElementChild).toHaveAttribute("data-expanded", "false");
    expect(screen.getByRole("button", { name: "View details" })).not.toHaveAttribute(
      "data-panel-open"
    );

    // Toggling only reports to the consumer; the component does not change on its own.
    await user.click(screen.getByRole("button", { name: "View details" }));
    expect(onExpandedChange).toHaveBeenCalledWith(true);
    expect(container.firstElementChild).toHaveAttribute("data-expanded", "false");
    expect(screen.queryByText(/"ok": true/)).not.toBeInTheDocument();

    // The consumer drives the open state via rerender.
    rerender(
      <ToolCall
        name="getData"
        status="completed"
        expanded={true}
        onExpandedChange={onExpandedChange}
        output={{ ok: true }}
      />
    );
    expect(container.firstElementChild).toHaveAttribute("data-expanded", "true");
    expect(screen.getByRole("button", { name: "View details" })).toHaveAttribute(
      "data-panel-open"
    );
    expect(screen.getByText(/"ok": true/)).toBeInTheDocument();
  });

  it("uses custom input and output renderers", async () => {
    const user = userEvent.setup();
    render(
      <ControlledToolCall
        name="getData"
        status="completed"
        input={{ q: 1 }}
        output={{ ok: true }}
        renderInput={(input) => <div>IN:{JSON.stringify(input)}</div>}
        renderOutput={(output) => <div>OUT:{JSON.stringify(output)}</div>}
      />
    );
    await user.click(screen.getByRole("button", { name: "View details" }));
    expect(screen.getByText("IN:{\"q\":1}")).toBeInTheDocument();
    expect(screen.getByText("OUT:{\"ok\":true}")).toBeInTheDocument();
  });

  it("forwards refs and standard DOM props to the root", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <ToolCall
        ref={ref}
        id="tool-1"
        data-testid="tool-root"
        aria-label="My tool"
        className="custom"
        name="getData"
        status="running"
      />
    );
    const root = screen.getByTestId("tool-root");
    expect(ref.current).toBe(root);
    expect(root).toHaveAttribute("id", "tool-1");
    expect(root).toHaveAttribute("aria-label", "My tool");
    expect(root.classList).toContain("agent-ui-tool-call");
    expect(root.classList).toContain("agent-ui-tool-call--running");
    expect(root.classList).toContain("custom");
  });

  it("applies variant and density classes", () => {
    const { container } = render(
      <ToolCall name="getData" status="completed" variant="subtle" density="compact" />
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.classList).toContain("agent-ui-tool-call--subtle");
    expect(root.classList).toContain("agent-ui-tool-call--compact");
  });

  it("wraps default approval actions in a labelled group", () => {
    render(
      <ToolCall
        name="sendEmail"
        status="awaiting-approval"
        onApprove={() => {}}
        onReject={() => {}}
      />
    );
    expect(screen.getByRole("group", { name: "Tool approval actions" })).toBeInTheDocument();
  });

  it("wraps a custom actions slot in a labelled group", () => {
    const onApprove = vi.fn();
    render(
      <ToolCall
        name="sendEmail"
        status="awaiting-approval"
        onApprove={onApprove}
        slots={{
          actions: <button onClick={onApprove}>Custom approve</button>
        }}
      />
    );
    const group = screen.getByRole("group", { name: "Tool approval actions" });
    expect(group).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Custom approve" })).toBeInTheDocument();
  });

  it("overrides labels via the labels object, including nested status labels", async () => {
    const user = userEvent.setup();
    render(
      <ControlledToolCall
        name="getData"
        status="awaiting-approval"
        onApprove={() => {}}
        onReject={() => {}}
        input={{ q: 1 }}
        labels={{
          details: "Détails",
          approve: "Valider",
          reject: "Refuser",
          input: "Entrée",
          status: { "awaiting-approval": "Approbation requise" }
        }}
      />
    );
    expect(screen.getByRole("button", { name: "Détails" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Valider" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refuser" })).toBeInTheDocument();
    expect(screen.getByText("Approbation requise")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Détails" }));
    expect(screen.getByText("Entrée")).toBeInTheDocument();
  });

  it("merges nested status labels while keeping other status labels intact", () => {
    render(
      <ToolCall
        name="getData"
        status="running"
        labels={{ status: { running: "En cours" } }}
      />
    );
    expect(screen.getByText("En cours")).toBeInTheDocument();
  });

  it("renders leading and footer slots", () => {
    render(
      <ToolCall
        name="getData"
        status="completed"
        slots={{
          leading: <span>Leading marker</span>,
          footer: <p>Footer note</p>
        }}
      />
    );
    expect(screen.getByText("Leading marker")).toBeInTheDocument();
    expect(screen.getByText("Footer note")).toBeInTheDocument();
  });
});