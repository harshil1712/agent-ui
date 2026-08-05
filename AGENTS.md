# Agent UI

React components for agentic applications, built with Cloudflare Kumo and demonstrated with the Cloudflare Agents SDK.

## Repository Structure

```text
apps/playground/   Cloudflare Worker, Durable Object Agent, and React demo
packages/react/    Publishable @agent-ui/react component library
```

## Commands

Run commands from the repository root.

```sh
pnpm install       Install workspace dependencies
pnpm dev           Start the Cloudflare Agents playground
pnpm storybook     Start component development on port 6006
pnpm check         Type-check every package
pnpm test          Run component tests
pnpm build         Build the library and playground
```

Run `pnpm --filter @agent-ui/react build-storybook` to verify the static Storybook build. Run `pnpm --filter @agent-ui/playground types` after changing bindings in `wrangler.jsonc`.

## Component Architecture

- Components are controlled. They receive state and callbacks through props.
- Components must not connect to an Agent, open a WebSocket, or call an SDK directly.
- Keep Cloudflare-specific state translation in the playground or a future adapter entry point.
- Export public components and types from `packages/react/src/index.ts`.
- Preserve semantic HTML, keyboard behavior, focus visibility, and accessible names.
- Add a story for every meaningful visual or lifecycle state.
- Add interaction tests for callbacks and conditional behavior.

## Kumo

- Build from Kumo components before introducing custom primitives.
- Import Kumo from `@cloudflare/kumo` or its granular component exports.
- Use semantic Kumo tokens rather than raw theme colors inside library components.
- Do not use `dark:` variants; Kumo tokens adapt to the active color mode.
- Consumers using Tailwind must include Kumo's Tailwind stylesheet and source files:

```css
@import "tailwindcss";
@import "@cloudflare/kumo/styles/tailwind";
@source "../node_modules/@cloudflare/kumo/dist/**/*.{js,jsx,ts,tsx}";
```

- Keep library-specific CSS prefixed with `agent-ui-` to avoid consumer collisions.

## Cloudflare Agents

- Retrieve current Cloudflare documentation before changing Agents SDK, Workers, Durable Objects, Wrangler, or Vite configuration.
- Extend `agents/tsconfig` in Agent applications.
- Keep `agents()` before React and Cloudflare in the Vite plugin list so TC39 decorators are transformed correctly.
- Use `@callable()` for client RPC methods. Do not enable `experimentalDecorators`.
- Durable Object binding names, exported class names, and migration class names must match exactly.
- Regenerate Worker types after changing bindings.
- Never place secrets in source code or `wrangler.jsonc`; use Wrangler secrets.

## Dependencies And Publishing

- Use pnpm workspaces and the existing lockfile.
- React, React DOM, Kumo, and Phosphor remain peer dependencies of the component package.
- Do not bundle peer dependencies into the library output.
- The package name and scope are placeholders until publishing is planned.
- Use Changesets for versioning once the first public release is prepared.

## Definition Of Done

Before considering a change complete, run:

```sh
pnpm check
pnpm test
pnpm build
pnpm --filter @agent-ui/react build-storybook
```

For visual or interactive changes, also test the playground on desktop and mobile and exercise the affected state transitions in a browser.
