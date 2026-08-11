import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { AgentComposer, type AgentAttachment } from "./agent-composer";

const attachments: AgentAttachment[] = [
  { id: "a1", name: "report.pdf", size: 2048, mediaType: "application/pdf" },
  { id: "a2", name: "hero.png", size: 5242880, mediaType: "image/png", previewUrl: "https://example.com/hero.png" }
];

describe("AgentComposer", () => {
  it("renders a labelled form with a controlled textarea", () => {
    render(<AgentComposer value="Hello" onValueChange={() => {}} onSubmit={() => {}} />);
    expect(screen.getByRole("form", { name: "Message composer" })).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("Hello");
  });

  it("calls onValueChange when the textarea changes", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<AgentComposer value="" onValueChange={onValueChange} onSubmit={() => {}} />);
    await user.type(screen.getByRole("textbox"), "Hi");
    expect(onValueChange).toHaveBeenCalled();
  });

  it("calls onSubmit with the value and attachments", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <AgentComposer
        value="send this"
        onValueChange={() => {}}
        onSubmit={onSubmit}
        attachments={attachments}
      />
    );
    await user.click(screen.getByRole("button", { name: "Send message" }));
    expect(onSubmit).toHaveBeenCalledWith("send this", attachments);
  });

  it("submits empty text when attachments exist", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <AgentComposer value="" onValueChange={() => {}} onSubmit={onSubmit} attachments={attachments} />
    );
    const send = screen.getByRole("button", { name: "Send message" });
    expect(send).not.toBeDisabled();
    await user.click(send);
    expect(onSubmit).toHaveBeenCalledWith("", attachments);
  });

  it("disables submit when text is empty and there are no attachments", () => {
    render(<AgentComposer value="  " onValueChange={() => {}} onSubmit={() => {}} />);
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
  });

  it("does not submit while busy; the send button becomes a stop button", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onStop = vi.fn();
    render(
      <AgentComposer
        value="running"
        onValueChange={() => {}}
        onSubmit={onSubmit}
        busy
        onStop={onStop}
      />
    );
    const stop = screen.getByRole("button", { name: "Stop" });
    expect(stop).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send message" })).not.toBeInTheDocument();
    await user.click(stop);
    expect(onStop).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("disables controls when disabled is set", () => {
    render(
      <AgentComposer
        value="x"
        onValueChange={() => {}}
        onSubmit={() => {}}
        disabled
        onAddAttachments={() => {}}
        onRemoveAttachment={() => {}}
        attachments={attachments}
      />
    );
    expect(screen.getByRole("textbox")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add attachments" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove report.pdf" })).toBeDisabled();
  });

  it("renders attachment chips with names, sizes, and remove controls", () => {
    const onRemoveAttachment = vi.fn();
    render(
      <AgentComposer
        value=""
        onValueChange={() => {}}
        onSubmit={() => {}}
        attachments={attachments}
        onRemoveAttachment={onRemoveAttachment}
      />
    );
    const list = screen.getByRole("list", { name: "Attachments" });
    expect(list).toBeInTheDocument();
    expect(screen.getByText("report.pdf")).toBeInTheDocument();
    expect(screen.getByText("2.0 KB")).toBeInTheDocument();
    expect(screen.getByText("hero.png")).toBeInTheDocument();
    expect(screen.getByText("5.0 MB")).toBeInTheDocument();
  });

  it("calls onRemoveAttachment with the attachment id", async () => {
    const user = userEvent.setup();
    const onRemoveAttachment = vi.fn();
    render(
      <AgentComposer
        value=""
        onValueChange={() => {}}
        onSubmit={() => {}}
        attachments={attachments}
        onRemoveAttachment={onRemoveAttachment}
      />
    );
    await user.click(screen.getByRole("button", { name: "Remove report.pdf" }));
    expect(onRemoveAttachment).toHaveBeenCalledWith("a1");
  });

  it("renders an image preview for image attachments", () => {
    render(
      <AgentComposer
        value=""
        onValueChange={() => {}}
        onSubmit={() => {}}
        attachments={attachments}
      />
    );
    const img = screen.getByAltText("");
    expect(img).toHaveAttribute("src", "https://example.com/hero.png");
  });

  it("renders a hidden file input and attach button when onAddAttachments is provided", () => {
    render(
      <AgentComposer
        value=""
        onValueChange={() => {}}
        onSubmit={() => {}}
        onAddAttachments={() => {}}
        accept="image/*"
        multiple
      />
    );
    const input = document.querySelector('[data-agent-ui-file-input]') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input).toHaveAttribute("type", "file");
    expect(input).toHaveAttribute("accept", "image/*");
    expect(input).toHaveAttribute("multiple");
    expect(screen.getByRole("button", { name: "Add attachments" })).toBeInTheDocument();
  });

  it("does not render attach controls when onAddAttachments is omitted", () => {
    render(<AgentComposer value="" onValueChange={() => {}} onSubmit={() => {}} />);
    expect(screen.queryByRole("button", { name: "Add attachments" })).not.toBeInTheDocument();
    expect(document.querySelector('[data-agent-ui-file-input]')).toBeNull();
  });

  it("forwards selected files to onAddAttachments", async () => {
    const user = userEvent.setup();
    const onAddAttachments = vi.fn();
    render(
      <AgentComposer
        value=""
        onValueChange={() => {}}
        onSubmit={() => {}}
        onAddAttachments={onAddAttachments}
      />
    );
    const input = document.querySelector('[data-agent-ui-file-input]') as HTMLInputElement;
    const file = new File(["content"], "notes.txt", { type: "text/plain" });
    await user.upload(input, file);
    expect(onAddAttachments).toHaveBeenCalled();
  });

  it("submits on Enter when submitOnEnter is enabled", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <AgentComposer
        value="enter me"
        onValueChange={() => {}}
        onSubmit={onSubmit}
        submitOnEnter
      />
    );
    await user.type(screen.getByRole("textbox"), "{Enter}");
    expect(onSubmit).toHaveBeenCalled();
  });

  it("inserts a newline instead of submitting on Shift+Enter", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <AgentComposer
        value="multi"
        onValueChange={() => {}}
        onSubmit={onSubmit}
        submitOnEnter
      />
    );
    await user.keyboard("{Shift>}{Enter}{/Shift}");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("supports a custom placeholder", () => {
    render(
      <AgentComposer value="" onValueChange={() => {}} onSubmit={() => {}} placeholder="Type here…" />
    );
    expect(screen.getByRole("textbox")).toHaveAttribute("placeholder", "Type here…");
  });

  it("forwards autoResize, minRows, and maxRows to the textarea", () => {
    render(
      <AgentComposer
        value=""
        onValueChange={() => {}}
        onSubmit={() => {}}
        autoResize
        minRows={2}
        maxRows={6}
      />
    );
    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveAttribute("data-agent-ui-textarea");
  });

  it("renders leading, actions, and footer slots", () => {
    const onStop = vi.fn();
    render(
      <AgentComposer
        value=""
        onValueChange={() => {}}
        onSubmit={() => {}}
        busy
        onStop={onStop}
        slots={{
          leading: <span>Avatar</span>,
          actions: <button onClick={onStop}>Custom stop</button>,
          footer: <p>Footer hint</p>
        }}
      />
    );
    expect(screen.getByText("Avatar")).toBeInTheDocument();
    expect(screen.getByText("Footer hint")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Stop" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Custom stop" })).toBeInTheDocument();
  });

  it("supports a custom attachment renderer", () => {
    render(
      <AgentComposer
        value=""
        onValueChange={() => {}}
        onSubmit={() => {}}
        attachments={attachments}
        slots={{ attachment: (attachment) => <strong>Custom {attachment.name}</strong> }}
      />
    );
    expect(screen.getByText("Custom report.pdf")).toBeInTheDocument();
    expect(screen.queryByText("2.0 KB")).not.toBeInTheDocument();
  });

  it("uses a custom actions slot that replaces send/stop entirely", () => {
    render(
      <AgentComposer
        value="x"
        onValueChange={() => {}}
        onSubmit={() => {}}
        slots={{ actions: <button>My send</button> }}
      />
    );
    expect(screen.getByRole("button", { name: "My send" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send message" })).not.toBeInTheDocument();
  });

  it("overrides labels via the labels object", () => {
    render(
      <AgentComposer
        value="x"
        onValueChange={() => {}}
        onSubmit={() => {}}
        onRemoveAttachment={() => {}}
        attachments={attachments}
        labels={{
          composer: "Composeur",
          send: "Envoyer",
          stop: "Arrêter",
          addAttachments: "Joindre",
          removeAttachment: "Retirer {name}",
          attachment: "Pièce {name}"
        }}
      />
    );
    expect(screen.getByRole("form", { name: "Composeur" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Envoyer" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retirer report.pdf" })).toBeInTheDocument();
  });

  it("emits deterministic data attributes on the root", () => {
    const { container, rerender } = render(
      <AgentComposer value="x" onValueChange={() => {}} onSubmit={() => {}} attachments={attachments} />
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute("data-agent-ui-composer");
    expect(root).toHaveAttribute("data-has-attachments", "true");
    expect(root).toHaveAttribute("data-busy", "false");
    expect(root).toHaveAttribute("data-disabled", "false");

    rerender(
      <AgentComposer value="" onValueChange={() => {}} onSubmit={() => {}} busy disabled />
    );
    expect(root).toHaveAttribute("data-has-attachments", "false");
    expect(root).toHaveAttribute("data-busy", "true");
    expect(root).toHaveAttribute("data-disabled", "true");
  });

  it("emits data attributes on attachment chips and the submit button", () => {
    render(
      <AgentComposer
        value="x"
        onValueChange={() => {}}
        onSubmit={() => {}}
        attachments={attachments}
      />
    );
    const chip = document.querySelector('[data-agent-ui-attachment]') as HTMLElement;
    expect(chip).toHaveAttribute("data-attachment-id", "a1");
    expect(chip).toHaveAttribute("data-attachment-name", "report.pdf");

    const submit = screen.getByRole("button", { name: "Send message" });
    expect(submit).toHaveAttribute("data-submit-state", "send");
    expect(submit).toHaveAttribute("data-agent-ui-submit");
  });

  it("forwards a ref and native form props to the form root", () => {
    const ref = createRef<HTMLFormElement>();
    const { container } = render(
      <AgentComposer
        ref={ref}
        value=""
        onValueChange={() => {}}
        onSubmit={() => {}}
        id="composer-1"
        data-testid="composer-root"
        autoComplete="off"
      />
    );
    const root = screen.getByTestId("composer-root");
    expect(ref.current).toBe(root);
    expect(root).toHaveAttribute("id", "composer-1");
    expect(root).toHaveAttribute("autocomplete", "off");
    expect(root.tagName.toLowerCase()).toBe("form");
    expect(container.firstElementChild).toBe(root);
  });

  it("works as a fully controlled component without internal value state", async () => {
    function Controlled() {
      const [value, setValue] = useState("");
      const [items, setItems] = useState<AgentAttachment[]>(attachments);
      const onSubmit = vi.fn();
      return (
        <AgentComposer
          value={value}
          onValueChange={setValue}
          onSubmit={onSubmit}
          attachments={items}
          onRemoveAttachment={(id) => setItems((prev) => prev.filter((a) => a.id !== id))}
        />
      );
    }
    const user = userEvent.setup();
    render(<Controlled />);
    await user.click(screen.getByRole("button", { name: "Remove report.pdf" }));
    expect(screen.queryByText("report.pdf")).not.toBeInTheDocument();
    expect(screen.getByText("hero.png")).toBeInTheDocument();
  });
});
