import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FileUIPart } from "ai";
import { useAgentComposer } from "./use-agent-composer";

function fileList(files: File[]): FileList {
  const dt = new DataTransfer();
  for (const file of files) dt.items.add(file);
  return dt.files;
}

describe("useAgentComposer", () => {
  it("tracks input and exposes submit that clears after sending", async () => {
    const sendMessage = vi.fn();
    const { result } = renderHook(() => useAgentComposer({ sendMessage }));

    act(() => result.current.setInput("hello"));
    expect(result.current.input).toBe("hello");
    expect(result.current.canSubmit).toBe(true);

    await act(async () => {
      await result.current.submit();
    });
    expect(sendMessage).toHaveBeenCalledWith({ text: "hello" });
    expect(result.current.input).toBe("");
  });

  it("does not submit empty input", async () => {
    const sendMessage = vi.fn();
    const { result } = renderHook(() => useAgentComposer({ sendMessage }));

    await act(async () => {
      await result.current.submit();
    });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("sends attached files via the native FileList transport", async () => {
    const sendMessage = vi.fn();
    const { result } = renderHook(() => useAgentComposer({ sendMessage }));

    const files = fileList([new File(["a"], "a.txt", { type: "text/plain" })]);
    act(() => result.current.handleAddAttachments(files));

    expect(result.current.attachments).toHaveLength(1);
    expect(result.current.attachments[0]).toMatchObject({ name: "a.txt", mediaType: "text/plain" });
    expect(result.current.canSubmit).toBe(true);

    await act(async () => {
      await result.current.submit("look at this");
    });
    expect(sendMessage).toHaveBeenCalledTimes(1);
    const arg = sendMessage.mock.calls[0][0] as { text: string; files?: FileList };
    expect(arg.text).toBe("look at this");
    expect(arg.files).toBeDefined();
    expect(Array.from(arg.files ?? [])).toHaveLength(1);
    expect(Array.from(arg.files ?? [])[0].name).toBe("a.txt");
    expect(result.current.attachments).toHaveLength(0);
  });

  it("can submit attachments without any text", async () => {
    const sendMessage = vi.fn();
    const { result } = renderHook(() => useAgentComposer({ sendMessage }));

    act(() =>
      result.current.handleAddAttachments(fileList([new File(["x"], "x.txt", { type: "text/plain" })]))
    );
    await act(async () => {
      await result.current.submit("");
    });
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage.mock.calls[0][0].text).toBe("");
  });

  it("dedupes repeated additions of the same file", () => {
    const sendMessage = vi.fn();
    const { result } = renderHook(() => useAgentComposer({ sendMessage }));

    const file = new File(["x"], "x.txt", { type: "text/plain" });
    act(() => result.current.handleAddAttachments(fileList([file])));
    act(() => result.current.handleAddAttachments(fileList([file])));
    expect(result.current.attachments).toHaveLength(1);
  });

  it("removes an attachment by id", async () => {
    const sendMessage = vi.fn();
    const { result } = renderHook(() => useAgentComposer({ sendMessage }));

    act(() =>
      result.current.handleAddAttachments(
        fileList([
          new File(["a"], "a.txt", { type: "text/plain" }),
          new File(["b"], "b.txt", { type: "text/plain" })
        ])
      )
    );
    expect(result.current.attachments).toHaveLength(2);

    act(() => result.current.handleRemoveAttachment(result.current.attachments[0].id));
    expect(result.current.attachments).toHaveLength(1);
    expect(result.current.attachments[0].name).toBe("b.txt");

    await act(async () => {
      await result.current.submit("go");
    });
    const sent = sendMessage.mock.calls[0][0] as { files?: FileList };
    expect(Array.from(sent.files ?? [])).toHaveLength(1);
    expect(Array.from(sent.files ?? [])[0].name).toBe("b.txt");
  });

  it("does not submit while busy", async () => {
    const sendMessage = vi.fn();
    const { result } = renderHook(() => useAgentComposer({ sendMessage, busy: true }));

    act(() => result.current.setInput("hi"));
    expect(result.current.canSubmit).toBe(false);
    await act(async () => {
      await result.current.submit();
    });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("does not submit while disabled", async () => {
    const sendMessage = vi.fn();
    const { result } = renderHook(() => useAgentComposer({ sendMessage, disabled: true }));

    act(() => result.current.setInput("hi"));
    expect(result.current.canSubmit).toBe(false);
    await act(async () => {
      await result.current.submit();
    });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("clears input and attachments without sending", () => {
    const sendMessage = vi.fn();
    const { result } = renderHook(() => useAgentComposer({ sendMessage }));

    act(() => result.current.setInput("draft"));
    act(() =>
      result.current.handleAddAttachments(fileList([new File(["x"], "x.txt", { type: "text/plain" })]))
    );
    act(() => result.current.clear());

    expect(result.current.input).toBe("");
    expect(result.current.attachments).toHaveLength(0);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("accepts an explicit value on submit (suggestion click)", async () => {
    const sendMessage = vi.fn();
    const { result } = renderHook(() => useAgentComposer({ sendMessage }));

    await act(async () => {
      await result.current.submit("Suggest me");
    });
    expect(sendMessage).toHaveBeenCalledWith({ text: "Suggest me" });
  });

  it("preserves the draft and sets error when sending rejects", async () => {
    const sendMessage = vi.fn().mockRejectedValue(new Error("network down"));
    const onError = vi.fn();
    const { result } = renderHook(() => useAgentComposer({ sendMessage, onError }));

    act(() => result.current.setInput("draft text"));
    act(() =>
      result.current.handleAddAttachments(
        fileList([new File(["x"], "x.txt", { type: "text/plain" })])
      )
    );

    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toBe("network down");
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    // Draft preserved so the user can retry or edit.
    expect(result.current.input).toBe("draft text");
    expect(result.current.attachments).toHaveLength(1);
  });

  it("submit does not reject when sending fails (void-safe)", async () => {
    const sendMessage = vi.fn().mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useAgentComposer({ sendMessage }));

    act(() => result.current.setInput("hi"));
    await expect(result.current.submit()).resolves.toBeUndefined();
  });

  it("clears the error after a successful send and on clear", async () => {
    const boom = new Error("boom");
    const sendMessage = vi
      .fn()
      .mockRejectedValueOnce(boom)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(boom);
    const { result } = renderHook(() => useAgentComposer({ sendMessage }));

    act(() => result.current.setInput("hi"));
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.error).toBe(boom);

    act(() => result.current.setInput("again"));
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.error).toBeNull();

    // Re-trigger an error, then confirm clear() resets it.
    act(() => result.current.setInput("again2"));
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.error).toBe(boom);
    act(() => result.current.clear());
    expect(result.current.error).toBeNull();
  });
});