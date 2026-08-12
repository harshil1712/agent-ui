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

  it("clears the submitted draft before sendMessage finishes", async () => {
    let finishSend!: () => void;
    const sendMessage = vi.fn(
      () => new Promise<void>((resolve) => {
        finishSend = resolve;
      })
    );
    const { result } = renderHook(() => useAgentComposer({ sendMessage }));

    act(() => result.current.setInput("hello"));

    let submission!: Promise<void>;
    act(() => {
      submission = result.current.submit();
    });

    expect(sendMessage).toHaveBeenCalledWith({ text: "hello" });
    expect(result.current.input).toBe("");

    await act(async () => {
      finishSend();
      await submission;
    });
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

describe("useAgentComposer attachment validation", () => {
  function file(name: string, size = 10): File {
    return new File([new Uint8Array(size)], name, { type: "text/plain" });
  }

  it("is unrestricted by default (no maxFiles / maxSize)", () => {
    const sendMessage = vi.fn();
    const { result } = renderHook(() => useAgentComposer({ sendMessage }));

    act(() => result.current.handleAddAttachments(fileList([file("a"), file("b"), file("c")])));
    expect(result.current.attachments).toHaveLength(3);
    expect(result.current.rejectedFiles).toHaveLength(0);
  });

  it("rejects files beyond maxFiles with reason max-files and reports them", () => {
    const sendMessage = vi.fn();
    const onRejectedFiles = vi.fn();
    const { result } = renderHook(() =>
      useAgentComposer({ sendMessage, maxFiles: 2, onRejectedFiles })
    );

    act(() => result.current.handleAddAttachments(fileList([file("a"), file("b"), file("c")])));
    expect(result.current.attachments).toHaveLength(2);
    expect(result.current.attachments.map((a) => a.name)).toEqual(["a", "b"]);
    expect(result.current.rejectedFiles).toEqual([
      { file: expect.any(File), reason: "max-files" }
    ]);
    expect(result.current.rejectedFiles[0].file.name).toBe("c");
    expect(onRejectedFiles).toHaveBeenCalledTimes(1);
    expect(onRejectedFiles.mock.calls[0][0]).toEqual([
      { file: expect.any(File), reason: "max-files" }
    ]);
  });

  it("rejects a single file exceeding maxSize with reason max-size", () => {
    const sendMessage = vi.fn();
    const onRejectedFiles = vi.fn();
    const { result } = renderHook(() =>
      useAgentComposer({ sendMessage, maxSize: 50, onRejectedFiles })
    );

    act(() =>
      result.current.handleAddAttachments(fileList([file("small", 10), file("big", 100), file("ok", 40)]))
    );
    expect(result.current.attachments).toHaveLength(2);
    expect(result.current.attachments.map((a) => a.name)).toEqual(["small", "ok"]);
    expect(result.current.rejectedFiles).toEqual([
      { file: expect.any(File), reason: "max-size" }
    ]);
    expect(result.current.rejectedFiles[0].file.name).toBe("big");
    expect(onRejectedFiles).toHaveBeenCalledWith([
      { file: expect.any(File), reason: "max-size" }
    ]);
  });

  it("combines maxFiles and maxSize, rejecting the oversized file before the cap", () => {
    const sendMessage = vi.fn();
    const { result } = renderHook(() =>
      useAgentComposer({ sendMessage, maxFiles: 2, maxSize: 50 })
    );

    act(() =>
      result.current.handleAddAttachments(
        fileList([file("ok1", 10), file("big", 100), file("ok2", 20), file("extra", 5)])
      )
    );
    expect(result.current.attachments.map((a) => a.name)).toEqual(["ok1", "ok2"]);
    expect(result.current.rejectedFiles.map((r) => r.file.name)).toEqual(["big", "extra"]);
    expect(result.current.rejectedFiles.map((r) => r.reason)).toEqual(["max-size", "max-files"]);
  });

  it("does not count a max-size rejected file against the maxFiles cap", () => {
    const sendMessage = vi.fn();
    const { result } = renderHook(() =>
      useAgentComposer({ sendMessage, maxFiles: 2, maxSize: 50 })
    );

    act(() =>
      result.current.handleAddAttachments(
        fileList([file("big", 100), file("a", 10), file("b", 10), file("c", 10)])
      )
    );
    // "big" is rejected for size and does not consume a max-files slot.
    expect(result.current.attachments.map((a) => a.name)).toEqual(["a", "b"]);
    expect(result.current.rejectedFiles.map((r) => r.file.name)).toEqual(["big", "c"]);
  });

  it("does not pass rejected files to sendMessage", async () => {
    const sendMessage = vi.fn();
    const { result } = renderHook(() =>
      useAgentComposer({ sendMessage, maxFiles: 1 })
    );

    act(() => result.current.handleAddAttachments(fileList([file("a"), file("b")])));
    await act(async () => {
      await result.current.submit("go");
    });
    expect(sendMessage).toHaveBeenCalledTimes(1);
    const arg = sendMessage.mock.calls[0][0] as { files?: FileList };
    expect(Array.from(arg.files ?? [])).toHaveLength(1);
    expect(Array.from(arg.files ?? [])[0].name).toBe("a");
  });

  it("does not report a duplicate re-add as rejected", () => {
    const sendMessage = vi.fn();
    const onRejectedFiles = vi.fn();
    const { result } = renderHook(() =>
      useAgentComposer({ sendMessage, maxFiles: 2, onRejectedFiles })
    );

    const f = file("a");
    act(() => result.current.handleAddAttachments(fileList([f])));
    act(() => result.current.handleAddAttachments(fileList([f])));
    expect(result.current.attachments).toHaveLength(1);
    expect(onRejectedFiles).not.toHaveBeenCalled();
  });

  it("clears rejectedFiles on clear and on successful submit", async () => {
    const sendMessage = vi.fn();
    const { result } = renderHook(() =>
      useAgentComposer({ sendMessage, maxFiles: 1 })
    );

    act(() => result.current.handleAddAttachments(fileList([file("a"), file("b")])));
    expect(result.current.rejectedFiles).toHaveLength(1);

    act(() => result.current.clear());
    expect(result.current.rejectedFiles).toHaveLength(0);
    expect(result.current.attachments).toHaveLength(0);

    act(() => result.current.handleAddAttachments(fileList([file("a"), file("b")])));
    expect(result.current.rejectedFiles).toHaveLength(1);
    await act(async () => {
      await result.current.submit("go");
    });
    expect(result.current.rejectedFiles).toHaveLength(0);
  });

  it("keeps rejectedFiles when a send fails and onError fires", async () => {
    const sendMessage = vi.fn().mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() =>
      useAgentComposer({ sendMessage, maxFiles: 1 })
    );

    act(() => result.current.handleAddAttachments(fileList([file("a"), file("b")])));
    expect(result.current.rejectedFiles).toHaveLength(1);
    await act(async () => {
      await result.current.submit("go");
    });
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.rejectedFiles).toHaveLength(1);
  });

  it("clears stale rejectedFiles on a subsequent successful add", () => {
    const sendMessage = vi.fn();
    const onRejectedFiles = vi.fn();
    const { result } = renderHook(() =>
      useAgentComposer({ sendMessage, maxSize: 50, onRejectedFiles })
    );

    // First add rejects one oversized file.
    act(() => result.current.handleAddAttachments(fileList([file("big", 100), file("ok", 10)])));
    expect(result.current.rejectedFiles).toHaveLength(1);
    expect(onRejectedFiles).toHaveBeenCalledTimes(1);

    // A later successful add with no rejections must clear the stale result.
    act(() => result.current.handleAddAttachments(fileList([file("ok2", 10)])));
    expect(result.current.rejectedFiles).toHaveLength(0);
    expect(onRejectedFiles).toHaveBeenCalledTimes(1);
  });

  it("dedupes duplicate files within the same incoming FileList", () => {
    const sendMessage = vi.fn();
    const { result } = renderHook(() =>
      useAgentComposer({ sendMessage, maxFiles: 10 })
    );

    const dup = file("dup");
    act(() => result.current.handleAddAttachments(fileList([dup, dup, dup])));
    expect(result.current.attachments).toHaveLength(1);
    expect(result.current.attachments[0].name).toBe("dup");
  });

  it("dedupes within a batch and against current files together", () => {
    const sendMessage = vi.fn();
    const { result } = renderHook(() =>
      useAgentComposer({ sendMessage, maxFiles: 10 })
    );

    const a = file("a");
    act(() => result.current.handleAddAttachments(fileList([a, file("b")])));
    expect(result.current.attachments).toHaveLength(2);

    // Re-add a (against current) plus duplicate c within the batch.
    act(() =>
      result.current.handleAddAttachments(fileList([a, file("c"), file("c")]))
    );
    expect(result.current.attachments.map((x) => x.name)).toEqual(["a", "b", "c"]);
  });
});
