import "@harshil1712/agent-ui/styles";
import "./styles.css";

import { Button, Text } from "@cloudflare/kumo";
import { TrashIcon } from "@phosphor-icons/react";
import { AgentComposer } from "@harshil1712/agent-ui";
import {
  AgentChat,
  useAgentChatUI,
  useAgentComposer,
} from "@harshil1712/agent-ui/agents";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { useAgent } from "agents/react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const MODEL_LABEL = "GLM-4.7-Flash";

type Runtime = "agents-sdk" | "think";

const RUNTIMES: { id: Runtime; href: string; label: string }[] = [
  { id: "agents-sdk", href: "/agents-sdk", label: "Agents SDK" },
  { id: "think", href: "/think", label: "Think" },
];

const SUGGESTIONS = [
  "What is Workers AI?",
  "What model are you running on?",
  "How do streaming tool calls work in this playground?",
];

const TOOL_DESCRIPTIONS: Record<string, string> = {
  checkCloudflareDocs: "Read the official Workers AI documentation.",
};

const RUNTIME_META: Record<
  Runtime,
  {
    agent: string;
    title: string;
    subtitle: string;
    heading: string;
    copy: string;
    storageKey: string;
  }
> = {
  "agents-sdk": {
    agent: "ToolDemoAgent",
    title: "Agents SDK Chat",
    subtitle: `${MODEL_LABEL} · Workers AI · @cloudflare/ai-chat`,
    heading: "Chat with an agent on the Cloudflare Agents SDK",
    copy: "This agent is a classic AIChatAgent from @cloudflare/ai-chat. Ask about Workers AI — it reads the latest official documentation and streams a grounded answer in real time.",
    storageKey: "agent-ui-playground.chat-name",
  },
  think: {
    agent: "ThinkDemoAgent",
    title: "Think Chat",
    subtitle: `${MODEL_LABEL} · Workers AI · @cloudflare/think`,
    heading: "Chat with an agent on @cloudflare/think",
    copy: "This agent extends Think and uses the same documentation tool. Ask about Workers AI — it reads the latest official documentation and streams a grounded answer in real time.",
    storageKey: "agent-ui-playground.chat-name.think",
  },
};

/** Resolve the runtime from the URL path: /think -> think, everything else -> agents-sdk. */
function getRuntime(): Runtime {
  return window.location.pathname.startsWith("/think") ? "think" : "agents-sdk";
}

/** Read (or mint) a per-browser conversation id so each browser gets its own thread per runtime. */
function getBrowserChatName(storageKey: string): string {
  try {
    const existing = localStorage.getItem(storageKey);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(storageKey, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

function App() {
  const [runtime] = useState<Runtime>(() => getRuntime());
  const meta = RUNTIME_META[runtime];

  const [chatName] = useState<string>(() => getBrowserChatName(meta.storageKey));

  const agent = useAgent({
    agent: meta.agent,
    name: chatName,
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
    },
  });

  const composer = useAgentComposer({
    sendMessage: chat.sendMessage,
    busy: viewModel.busy,
    disabled: viewModel.isRecovering,
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
    const distance =
      transcript.scrollHeight - transcript.scrollTop - transcript.clientHeight;
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
    [viewModel.busy, chat.sendMessage],
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
          <h1>{meta.title}</h1>
          <Text as="span" variant="secondary" size="sm">
            {meta.subtitle}
          </Text>
        </div>
        <nav className="chat-nav" aria-label="Agent runtime">
          <ul>
            {RUNTIMES.map(({ id, href, label }) => (
              <li key={id}>
                <a
                  className="chat-nav__link"
                  data-active={id === runtime || undefined}
                  aria-current={id === runtime ? "page" : undefined}
                  href={href}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
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
                  {meta.heading}
                </Text>
                <Text as="p" variant="secondary">
                  {meta.copy}
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
            ),
          }}
        />
      </AgentChat.Root>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
