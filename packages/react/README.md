# Agent UI

Controlled React components for agent applications, built with
[Cloudflare Kumo](https://github.com/cloudflare/kumo).

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

## Core components

The core entry point is SDK-independent. Components receive state and callbacks through props.

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

## Cloudflare Agents adapter

Install `ai` and use the optional adapter when you already have chat state from Cloudflare Agents
or the AI SDK:

```sh
pnpm add ai
```

```tsx
import { AgentChat } from "@harshil1712/agent-ui/agents";

export function AgentPanel({ chat }) {
  return <AgentChat.Preset chat={chat} />;
}
```

See the [Storybook documentation](https://agent-ui.harshil.dev) for component
examples, lifecycle states, and API documentation.
