import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AgentFile } from "./agent-file";

describe("AgentFile", () => {
  it("renders a name, media type, and open link", () => {
    render(
      <AgentFile name="notes.txt" mediaType="text/plain" url="https://example.com/notes.txt" />
    );
    expect(screen.getByText("notes.txt")).toBeInTheDocument();
    expect(screen.getByText(/text\/plain/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Open" });
    expect(link).toHaveAttribute("href", "https://example.com/notes.txt");
  });

  it("renders a thumbnail for image media types with a url", () => {
    const { container } = render(
      <AgentFile name="pic.png" mediaType="image/png" url="data:image/png,x" />
    );
    const img = container.querySelector(".agent-ui-file__thumb");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("src", "data:image/png,x");
  });

  it("shows a human-friendly size suffix", () => {
    render(<AgentFile name="report.pdf" mediaType="application/pdf" size={2048} />);
    expect(screen.getByText(/2\.0 KB/)).toBeInTheDocument();
  });

  it("renders only the name when no type or size is present", () => {
    render(<AgentFile name="data.txt" />);
    expect(screen.getByText("data.txt")).toBeInTheDocument();
    expect(screen.queryByText(/data.txt/)).toHaveTextContent("data.txt");
    expect(screen.queryByRole("link", { name: "Open" })).not.toBeInTheDocument();
  });

  it("does not render a default Open link when no url is provided", () => {
    render(<AgentFile name="notes.txt" mediaType="text/plain" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("still renders a custom link slot when no url is provided", () => {
    render(
      <AgentFile
        name="notes.txt"
        slots={{ link: <a href="#internal">View inline</a> }}
      />
    );
    expect(screen.getByRole("link", { name: "View inline" })).toHaveAttribute("href", "#internal");
  });

  it("honors a custom open label", () => {
    render(<AgentFile name="a.txt" url="https://x/a.txt" labels={{ open: "View" }} />);
    expect(screen.getByRole("link", { name: "View" })).toBeInTheDocument();
  });

  it("renders custom slots instead of built-in content", () => {
    render(
      <AgentFile
        name="a.txt"
        slots={{ icon: <span data-testid="custom-icon" />, meta: <span data-testid="custom-meta" /> }}
      />
    );
    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
    expect(screen.getByTestId("custom-meta")).toBeInTheDocument();
    expect(screen.queryByText("a.txt")).not.toBeInTheDocument();
  });
});