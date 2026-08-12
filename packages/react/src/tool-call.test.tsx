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

  it("does not serialize detail payloads while the details panel is closed", async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(JSON, "stringify");
    const input = { query: "Agents" };
    render(
      <ControlledToolCall
        name="getData"
        status="completed"
        input={input}
        output={{ matches: 5 }}
      />
    );

    // Closed: the default rendering must not JSON.stringify the payloads.
    expect(spy).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "View details" }));
    // Kumo's Collapsible may stringify internally on open, but the payload is
    // never passed to JSON.stringify while its value fits within the limit.
    expect(spy.mock.calls.some(([arg]) => arg === input)).toBe(false);
    spy.mockRestore();
  });

  it("does not traverse detail payloads while the details panel is closed", () => {
    let reads = 0;
    const output = new Proxy({ blob: "x".repeat(1000) }, {
      get(target, property, receiver) {
        reads += 1;
        return Reflect.get(target, property, receiver);
      }
    });

    render(<ControlledToolCall name="getData" status="completed" output={output} />);

    expect(reads).toBe(0);
  });

  it("never fully serializes a huge object, including after Show more", async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(JSON, "stringify");
    const big = "x".repeat(2000);
    const payload = { blob: big };
    render(
      <ControlledToolCall
        name="getData"
        status="completed"
        output={payload}
        detailChars={200}
        maxDetailChars={400}
      />
    );

    // Opening the panel must not fully serialize the large payload; the
    // bounded preview (which avoids JSON.stringify) is shown instead.
    await user.click(screen.getByRole("button", { name: "View details" }));
    expect(spy.mock.calls.some(([arg]) => arg === payload)).toBe(false);
    expect(screen.getByRole("button", { name: "Show more" })).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(big))).not.toBeInTheDocument();

    // Expanded details remain bounded instead of fully serializing the payload.
    await user.click(screen.getByRole("button", { name: "Show more" }));
    expect(spy.mock.calls.some(([arg]) => arg === payload)).toBe(false);
    expect(screen.queryByText(new RegExp(big))).not.toBeInTheDocument();
    const pre = document.querySelector<HTMLElement>(".agent-ui-tool-call__pre");
    expect(pre?.textContent?.length ?? 0).toBeLessThanOrEqual(405);
    spy.mockRestore();
  });

  it("slices top-level strings cheaply without JSON.stringify", async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(JSON, "stringify");
    const long = "x".repeat(5000);
    render(
      <ControlledToolCall
        name="getData"
        status="completed"
        input={long}
        detailChars={100}
      />
    );
    await user.click(screen.getByRole("button", { name: "View details" }));
    // Opening a large top-level string slices it cheaply; it is never JSON-serialized.
    expect(spy.mock.calls.some(([arg]) => arg === long)).toBe(false);
    expect(screen.getByRole("button", { name: "Show more" })).toBeInTheDocument();
    spy.mockRestore();
  });

  it("renders circular structures in the bounded preview without throwing", async () => {
    const user = userEvent.setup();
    const circular: Record<string, unknown> = { name: "root" };
    circular.self = circular;
    render(
      <ControlledToolCall name="getData" status="completed" output={circular} />
    );
    await user.click(screen.getByRole("button", { name: "View details" }));
    expect(screen.getByText(/\(circular\)/)).toBeInTheDocument();
  });

  it("keeps circular data bounded after Show more without throwing", async () => {
    const user = userEvent.setup();
    const circular: Record<string, unknown> = { name: "root" };
    circular.self = circular;
    circular.items = Array.from({ length: 40 }, (_, i) => `item ${i}`);
    render(
      <ControlledToolCall
        name="getData"
        status="completed"
        output={circular}
        detailChars={60}
        maxDetailChars={120}
      />
    );
    await user.click(screen.getByRole("button", { name: "View details" }));
    await user.click(screen.getByRole("button", { name: "Show more" }));
    expect(screen.getByText(/\(circular\)/)).toBeInTheDocument();
  });

  it("does not serialize when there is nothing to serialize while closed", () => {
    const spy = vi.spyOn(JSON, "stringify");
    render(<ToolCall name="getData" status="pending" input={{ q: 1 }} />);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("truncates large detail values behind an accessible show-more toggle", async () => {
    const user = userEvent.setup();
    const big = "x".repeat(1000);
    render(
      <ControlledToolCall
        name="getData"
        status="completed"
        output={{ blob: big }}
        detailChars={200}
        maxDetailChars={400}
      />
    );
    await user.click(screen.getByRole("button", { name: "View details" }));

    const showMore = screen.getByRole("button", { name: "Show more" });
    expect(showMore).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(new RegExp(big))).not.toBeInTheDocument();

    await user.click(showMore);
    expect(screen.queryByText(new RegExp(big))).not.toBeInTheDocument();
    const pre = document.querySelector<HTMLElement>(".agent-ui-tool-call__pre");
    expect(pre?.textContent?.length ?? 0).toBeLessThanOrEqual(405);
    const showLess = screen.getByRole("button", { name: "Show less" });
    expect(showLess).toHaveAttribute("aria-expanded", "true");

    await user.click(showLess);
    expect(screen.getByRole("button", { name: "Show more" })).toBeInTheDocument();
  });

  it("does not truncate values that fit within the limit", async () => {
    const user = userEvent.setup();
    render(
      <ControlledToolCall
        name="getData"
        status="completed"
        output={{ matches: 5 }}
        detailChars={200}
      />
    );
    await user.click(screen.getByRole("button", { name: "View details" }));
    expect(screen.getByText(/"matches": 5/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show more" })).not.toBeInTheDocument();
  });

  it("custom renderers bypass serialization and truncation", async () => {
    const user = userEvent.setup();
    render(
      <ControlledToolCall
        name="getData"
        status="completed"
        output={{ blob: "x".repeat(1000) }}
        detailChars={10}
        renderOutput={(output) => <div>OUT:{(output as any).blob.length}</div>}
      />
    );
    await user.click(screen.getByRole("button", { name: "View details" }));
    expect(screen.getByText("OUT:1000")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show more" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show less" })).not.toBeInTheDocument();
  });

  it("bounds output for an object with a huge key", async () => {
    const user = userEvent.setup();
    const hugeKey = "k".repeat(100000);
    render(
      <ControlledToolCall
        name="getData"
        status="completed"
        output={{ [hugeKey]: 1 }}
        detailChars={200}
      />
    );
    await user.click(screen.getByRole("button", { name: "View details" }));
    const pre = document.querySelector<HTMLElement>(".agent-ui-tool-call__pre");
    expect(pre?.textContent?.length ?? 0).toBeLessThanOrEqual(205);
    expect(pre?.textContent).not.toContain(hugeKey);
    expect(screen.getByRole("button", { name: "Show more" })).toBeInTheDocument();
  });

  it("bounds output for a huge string value", async () => {
    const user = userEvent.setup();
    const huge = "x".repeat(100000);
    render(
      <ControlledToolCall
        name="getData"
        status="completed"
        output={{ blob: huge }}
        detailChars={200}
      />
    );
    await user.click(screen.getByRole("button", { name: "View details" }));
    const pre = document.querySelector<HTMLElement>(".agent-ui-tool-call__pre");
    expect(pre?.textContent?.length ?? 0).toBeLessThanOrEqual(205);
    expect(pre?.textContent).not.toContain(huge);
    expect(screen.getByRole("button", { name: "Show more" })).toBeInTheDocument();
  });

  it("does not read every value of a large object during the bounded preview", async () => {
    const user = userEvent.setup();
    const target: Record<string, unknown> = {};
    for (let i = 0; i < 500; i++) target[`k${i}`] = `value ${i}`;
    let reads = 0;
    const proxy = new Proxy(target, {
      get(t, p, r) {
        reads += 1;
        return Reflect.get(t, p, r);
      }
    });
    render(
      <ControlledToolCall
        name="getData"
        status="completed"
        output={proxy}
        detailChars={100}
      />
    );
    await user.click(screen.getByRole("button", { name: "View details" }));
    expect(screen.getByRole("button", { name: "Show more" })).toBeInTheDocument();
    // The bounded preview must not have read every value (the engine may still
    // enumerate keys via the ownKeys trap, but values are read lazily).
    expect(reads).toBeLessThan(500);
  });

  it("normalizes non-finite detailChars to the default limit", async () => {
    const user = userEvent.setup();
    render(
      <ControlledToolCall
        name="getData"
        status="completed"
        output={{ matches: 5 }}
        detailChars={Number.NaN}
      />
    );
    await user.click(screen.getByRole("button", { name: "View details" }));
    // Default 5000 limit: a small value is not truncated.
    expect(screen.getByText(/"matches": 5/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show more" })).not.toBeInTheDocument();
  });

  it("treats maxDetailChars as a hard ceiling below the preview request", async () => {
    const user = userEvent.setup();
    render(
      <ControlledToolCall
        name="getData"
        status="completed"
        output={{ blob: "x".repeat(1000) }}
        detailChars={500}
        maxDetailChars={100}
      />
    );
    await user.click(screen.getByRole("button", { name: "View details" }));

    const pre = document.querySelector<HTMLElement>(".agent-ui-tool-call__pre");
    expect(pre?.textContent?.length ?? 0).toBeLessThanOrEqual(105);
    expect(screen.queryByRole("button", { name: "Show more" })).not.toBeInTheDocument();
  });

  it("uses a bounded 20000-character expanded preview by default", async () => {
    const user = userEvent.setup();
    const huge = "x".repeat(30000);
    render(
      <ControlledToolCall name="getData" status="completed" output={{ blob: huge }} />
    );
    await user.click(screen.getByRole("button", { name: "View details" }));
    await user.click(screen.getByRole("button", { name: "Show more" }));

    const pre = document.querySelector<HTMLElement>(".agent-ui-tool-call__pre");
    expect(pre?.textContent?.length ?? 0).toBeLessThanOrEqual(20005);
    expect(pre?.textContent).not.toContain(huge);
  });

  it("floors fractional detailChars to an integer limit", async () => {
    const user = userEvent.setup();
    render(
      <ControlledToolCall
        name="getData"
        status="completed"
        output={{ blob: "x".repeat(50) }}
        detailChars={10.9}
      />
    );
    await user.click(screen.getByRole("button", { name: "View details" }));
    // 10.9 floors to 10, so the 50-char value is truncated.
    expect(screen.getByRole("button", { name: "Show more" })).toBeInTheDocument();
  });

  it("clamps negative detailChars to zero (everything truncated)", async () => {
    const user = userEvent.setup();
    render(
      <ControlledToolCall
        name="getData"
        status="completed"
        output={{ matches: 5 }}
        detailChars={-3}
      />
    );
    await user.click(screen.getByRole("button", { name: "View details" }));
    expect(screen.getByRole("button", { name: "Show more" })).toBeInTheDocument();
  });
});
