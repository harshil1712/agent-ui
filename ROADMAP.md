# Agent UI Roadmap

This roadmap tracks the features needed for a useful first release. Items are ordered by priority, not implementation difficulty.

## Current Baseline

- [x] Kumo-based React component package
- [x] Controlled component architecture
- [x] `ToolCall` lifecycle states
- [x] Tool approval and rejection actions
- [x] Storybook documentation and accessibility checks
- [x] Component interaction tests
- [x] Cloudflare Agent and Durable Object playground

## MVP Components

### Agent Message

- [ ] Render user, assistant, system, and tool messages
- [ ] Support partial content while streaming
- [ ] Render structured message parts rather than one text blob
- [ ] Provide slots for custom content renderers
- [ ] Expose retry, edit, and copy actions

### Agent Thread

- [ ] Compose messages and tool calls into a conversation timeline
- [ ] Follow streaming output without stealing the user's scroll position
- [ ] Show empty, loading, disconnected, and failed states
- [ ] Support pagination or loading older messages
- [ ] Announce new content appropriately to assistive technology

### Prompt Composer

- [ ] Multiline prompt input with submit and cancel actions
- [ ] Disabled, submitting, and interrupted states
- [ ] Keyboard shortcuts with accessible alternatives
- [ ] Attachment preview and removal
- [ ] Custom action slots for voice, model, or tool controls

### Agent Status

- [ ] Represent connecting, ready, thinking, acting, waiting, and failed states
- [ ] Distinguish transient activity from connection state
- [ ] Provide compact and descriptive variants
- [ ] Handle reconnecting and resumable stream messaging

### Approval Request

- [ ] Extract approval UI from `ToolCall` for standalone use
- [ ] Support confirmation, rejection, and optional user input
- [ ] Support destructive-action emphasis
- [ ] Prevent duplicate decisions while a response is pending

### Artifact

- [ ] Render generated text, code, files, images, and links
- [ ] Support preview, download, copy, and open actions
- [ ] Represent generating, ready, expired, and failed states
- [ ] Allow consumers to register custom artifact renderers

### Citations And Attachments

- [ ] Inline and grouped citations
- [ ] Source preview metadata
- [ ] File upload progress and errors
- [ ] Image and document attachment treatments

## Tool Call Enhancements

- [ ] Controlled expansion state
- [ ] Custom input and output renderers
- [ ] Long-running progress and progress messages
- [ ] Cancellation and retry actions
- [ ] Start and completion timestamps
- [ ] Nested or child tool calls
- [ ] Redaction for sensitive input and output
- [ ] Large-output truncation with an explicit expansion action

## Cloudflare Adapter

The core components must remain independent of networking. Cloudflare integration should live in a separate export such as `@agent-ui/react/cloudflare`.

- [ ] Translate `useAgentChat()` messages into component models
- [ ] Map AI SDK message parts to message, tool, artifact, and citation components
- [ ] Connect tool approval actions to `addToolResult()`
- [ ] Represent resumable streams and reconnection state
- [ ] Integrate retained child runs from `useAgentToolEvents()`
- [ ] Provide typed helpers without wrapping or hiding the underlying SDK hooks
- [ ] Add adapter fixtures covering protocol changes and legacy message migration

## Advanced Agent Patterns

- [ ] Multi-agent handoff and ownership indicators
- [ ] Parent and child agent execution timelines
- [ ] Background task and scheduled-work status
- [ ] Interrupt, resume, and checkpoint controls
- [ ] Clarification and structured user-input requests
- [ ] Voice input, transcription, and speaking states
- [ ] Optimistic state with server reconciliation
- [ ] Offline and degraded-connection behavior

## Quality And Developer Experience

- [ ] Public API documentation for every component and prop
- [ ] Theming and visual customization guide
- [ ] Accessibility test coverage for every interactive component
- [ ] Reduced-motion behavior
- [ ] Right-to-left layout testing
- [ ] Localization-ready labels and status text
- [ ] Visual regression testing across light and dark modes
- [ ] Bundle-size and package-export validation
- [ ] Example recipes for common agent interfaces

## Release Readiness

- [ ] Choose the final package name and npm scope
- [ ] Add Changesets and a release workflow
- [ ] Add CI for checks, tests, builds, and Storybook
- [ ] Add package provenance and publishing configuration
- [ ] Define browser and React version support
- [ ] Write migration and versioning policies
- [ ] Build one complete reference agent using only public package APIs

## First Release Scope

The first release should include:

1. `AgentMessage`
2. `AgentThread`
3. `PromptComposer`
4. `AgentStatus`
5. `ToolCall`
6. `ApprovalRequest`
7. A minimal Cloudflare adapter
8. One production-quality reference agent

Artifacts, citations, multi-agent timelines, voice, and background tasks can follow after the core conversation and tool flows are stable.
