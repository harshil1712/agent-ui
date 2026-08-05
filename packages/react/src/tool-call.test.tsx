import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToolCall } from "./tool-call";

describe("ToolCall", () => {
  it("renders its status and formatted input", async () => {
    const user = userEvent.setup();
    render(<ToolCall name="searchDocs" status="pending" input={{ query: "Agents" }} />);

    expect(screen.getByText("Pending")).toBeInTheDocument();
    await user.click(screen.getByText("View details"));
    expect(screen.getByText(/"query": "Agents"/)).toBeInTheDocument();
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
});
