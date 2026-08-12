# Agent UI

React components for agent applications, built with [Cloudflare Kumo](https://github.com/cloudflare/kumo).

Agent UI provides controlled, SDK-independent primitives for messages, tool calls, reasoning,
attachments, composers, and chat transcripts. An optional adapter connects those primitives to
Cloudflare Agents and AI SDK chat state.

Agent UI owns presentation and interaction only. Cloudflare Agents or Think continue to own the
agent loop, message persistence, context management, tool execution, and durable recovery.

## Install

```sh
pnpm add @harshil1712/agent-ui @cloudflare/kumo @phosphor-icons/react
```

Import the component styles once in your application:

```ts
import "@harshil1712/agent-ui/styles";
```

Tailwind consumers must also include Kumo's stylesheet and source files:

```css
@import "tailwindcss";
@import "@cloudflare/kumo/styles/tailwind";
@source "../node_modules/@cloudflare/kumo/dist/**/*.{js,jsx,ts,tsx}";
```

## Quick start

Use the core package when you want to own the state and callbacks:

```tsx
import { AgentMessage } from "@harshil1712/agent-ui";

export function Greeting() {
  return (
    <AgentMessage
      role="assistant"
      parts={[{ type: "text", text: "How can I help?" }]}
    />
  );
}
```

Use the adapter when you already have a chat object from Cloudflare Agents or the AI SDK:

```tsx
import { AgentChat } from "@harshil1712/agent-ui/agents";

export function AgentPanel({ chat }) {
  return <AgentChat.Preset chat={chat} />;
}
```

The `ai` package is an optional peer dependency required only by the adapter entry point.

## Components

| Export | Purpose |
| --- | --- |
| `AgentChat` | Controlled chat transcript composition |
| `AgentComposer` | Prompt input and attachment previews |
| `AgentMessage` | User, assistant, system, and tool messages |
| `AgentMarkdown` | Streaming-safe Markdown rendering |
| `AgentFile` | Message attachment display |
| `AgentPending` | First-token waiting state |
| `AgentReasoning` | Collapsible reasoning display |
| `ToolCall` | Tool execution status and approval actions |

Run `pnpm storybook` for interactive examples, component states, and API documentation. The
complete Cloudflare Think integration is in [`apps/playground`](./apps/playground).

## Development

```sh
pnpm install
pnpm storybook
pnpm dev
pnpm check
pnpm test
pnpm test:memory
```

`pnpm test:memory` builds Storybook, runs repeated streaming/message-eviction/tool-detail cycles in
headless Chrome, forces garbage collection through the Chrome DevTools Protocol, and fails if
evicted message or payload instances—or mounted transcript nodes—remain retained. Set
`CHROME_PATH` if Chrome or Chromium is not installed in a standard system location.

The component package is in `packages/react`. The Cloudflare Think integration playground is in
`apps/playground`.

See [`ROADMAP.md`](./ROADMAP.md) for planned components, Cloudflare adapter work, and release requirements.

## Deployment

Pushes to `main` deploy the static Storybook documentation to the `agent-ui-docs` Worker through
GitHub Actions. Create a GitHub environment named `production` and add
`CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN_DOCS`; keep the token scoped to Workers Scripts
Edit.

The Agents SDK playground is intentionally local-only because its Workers AI binding incurs usage
costs. Run it with `pnpm dev`; do not expose it as a public Worker.
