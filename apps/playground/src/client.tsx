import "@agent-ui/react/styles";
import "./styles.css";

import { Button, Text } from "@cloudflare/kumo";
import { TrashIcon } from "@phosphor-icons/react";
import { AgentComposer } from "@agent-ui/react";
import { AgentChat, useAgentChatUI, useAgentComposer } from "@agent-ui/react/agents";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { useAgent } from "agents/react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const MODEL_LABEL = "GLM-4.7-Flash";

const STORAGE_KEY = "agent-ui-playground.chat-name";

const SUGGESTIONS = [
  "Is Cloudflare having any outages right now?",
  "What model are you running on?",
  "How do streaming tool calls work in this playground?"
];

const TOOL_DESCRIPTIONS: Record<string, string> = {
  checkCloudflareStatus: "Check Cloudflare's current status page for incidents."
};

/** Read (or mint) a per-browser conversation id so each browser gets its own thread. */
function getBrowserChatName(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

function App() {
  const [chatName] = useState<string>(() => getBrowserChatName());

  const agent = useAgent({
    agent: "ToolDemoAgent",
    name: chatName
  });

  const chat = useAgentChat({ agent });

  const shouldFollowRef = useRef(true);

  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard unavailable in some contexts; ignore */
    }
  }, []);

  // Headless adapter: raw Agents chat state -> SDK-free view model.
  const viewModel = useAgentChatUI(chat, {
    toolDescriptions: TOOL_DESCRIPTIONS,
    onCopy: (message) => {
      void handleCopy(message.text || JSON.stringify(message.parts));
    },
    onRetry: () => {
      shouldFollowRef.current = true;
      void chat.regenerate();
    }
  });

  const composer = useAgentComposer({
    sendMessage: chat.sendMessage,
    busy: viewModel.busy,
    disabled: viewModel.isRecovering
  });

  const transcriptRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const transcript = transcriptRef.current;
    if (!transcript || !shouldFollowRef.current) return;
    transcript.scrollTop = transcript.scrollHeight;
  }, [chat.messages, chat.isStreaming, chat.status]);

  const handleTranscriptScroll = useCallback(() => {
    const transcript = transcriptRef.current;
    if (!transcript) return;
    const distance = transcript.scrollHeight - transcript.scrollTop - transcript.clientHeight;
    shouldFollowRef.current = distance < 80;
  }, []);

  const handleClear = useCallback(() => {
    composer.clear();
    shouldFollowRef.current = true;
    void chat.clearHistory();
  }, [composer.clear, chat.clearHistory]);

  const handleSuggestion = useCallback(
    (text: string) => {
      if (viewModel.busy) return;
      shouldFollowRef.current = true;
      void chat.sendMessage({ text });
    },
    [viewModel.busy, chat.sendMessage]
  );

  const statusLabel =
    chat.status === "error"
      ? "Error"
      : viewModel.phase === "recovering"
        ? "Recovering"
        : viewModel.phase === "thinking"
          ? "Thinking"
          : viewModel.phase === "streaming"
            ? "Streaming"
            : "Connected";

  return (
    <main className="chat-shell">
      <header className="chat-header">
        <div className="chat-header__title">
          <h1>Agent Chat</h1>
          <Text as="span" variant="secondary" size="sm">
            {MODEL_LABEL} · Workers AI
          </Text>
        </div>
        <div className="chat-header__actions">
          <span
            className="chat-header__connection"
            data-status={chat.status}
            aria-live="polite"
            aria-atomic="true"
          >
            <span className="chat-header__dot" aria-hidden="true" />
            {statusLabel}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={TrashIcon}
            onClick={handleClear}
            disabled={viewModel.isIdle}
            aria-label="Clear conversation"
          >
            Clear
          </Button>
        </div>
      </header>

      <AgentChat.Root viewModel={viewModel}>
        <section
          className="chat-transcript"
          ref={transcriptRef}
          onScroll={handleTranscriptScroll}
        >
          <AgentChat.Messages
            empty={
              <div className="chat-empty">
                <Text as="h2" variant="heading2">
                  Chat with an agent on Cloudflare
                </Text>
                <Text as="p" variant="secondary">
                  Ask about Cloudflare&apos;s status — the agent can call a real tool
                  and stream the result back in real time.
                </Text>
                <div className="chat-suggestions">
                  {SUGGESTIONS.map((suggestion) => (
                    <Button
                      key={suggestion}
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => handleSuggestion(suggestion)}
                      disabled={viewModel.busy}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </div>
            }
          />
        </section>

        <AgentComposer
          className="chat-composer"
          value={composer.input}
          onValueChange={composer.setInput}
          attachments={composer.attachments}
          onAddAttachments={composer.handleAddAttachments}
          onRemoveAttachment={composer.handleRemoveAttachment}
          accept="text/plain,.md,.markdown,.json,.csv"
          multiple
          onSubmit={(value) => {
            shouldFollowRef.current = true;
            void composer.submit(value);
          }}
          busy={viewModel.busy}
          onStop={() => void chat.stop()}
          disabled={viewModel.isRecovering}
          placeholder="Ask the agent something…"
          autoResize
          minRows={1}
          maxRows={4}
          submitOnEnter
          labels={{ stop: "Stop streaming" }}
          slots={{
            footer: (
              <>
                {viewModel.error && !viewModel.busy && (
                  <Text
                    as="p"
                    variant="secondary"
                    size="sm"
                    DANGEROUS_className="chat-composer__error"
                  >
                    Something went wrong sending your message. Try again.
                  </Text>
                )}
                <Text
                  as="span"
                  variant="secondary"
                  size="xs"
                  DANGEROUS_className="chat-composer__hint"
                >
                  Attach text files · Enter to send · Shift+Enter for a new line
                </Text>
              </>
            )
          }}
        />
      </AgentChat.Root>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);