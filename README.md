# Agent UI

React components for agent applications, built with [Cloudflare Kumo](https://github.com/cloudflare/kumo).

Agent UI provides controlled, SDK-independent primitives for messages, tool calls, reasoning,
attachments, composers, and chat transcripts. An optional adapter connects those primitives to
Cloudflare Agents and AI SDK chat state.

## Install

```sh
pnpm add @agent-ui/react @cloudflare/kumo @phosphor-icons/react
```

Import the component styles once in your application:

```ts
import "@agent-ui/react/styles";
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
import { AgentMessage } from "@agent-ui/react";

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
import { AgentChat } from "@agent-ui/react/agents";

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
complete Cloudflare Agents integration is in [`apps/playground`](./apps/playground).

## Development

```sh
pnpm install
pnpm storybook
pnpm dev
pnpm check
pnpm test
```

The component package is in `packages/react`. The Cloudflare Agents integration playground is in
`apps/playground`.

See [`ROADMAP.md`](./ROADMAP.md) for planned components, Cloudflare adapter work, and release requirements.
