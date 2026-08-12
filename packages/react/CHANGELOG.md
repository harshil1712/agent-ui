# @harshil1712/agent-ui

## 0.2.0

### Minor Changes

- 0841bf2: Bound browser-side chat work by default: `useAgentChatUI` now adapts the latest 100 messages, while `AgentChat.Preset` initially mounts the latest 50. Consumers can configure these limits with `maxMessages` and `maxVisibleMessages`.

  Tool detail rendering is now lazy and hard-bounded. The default renderer shows up to 5,000 characters initially, up to 20,000 after expanding, and never exceeds 100,000 characters. It no longer fully serializes arbitrary tool payloads.

  Message text is joined lazily, and unchanged normalized message parts retain stable references across streaming and controlled-expansion updates.

  The composer now clears immediately after submitting instead of waiting for the assistant response to finish. Failed sends restore the submitted draft without overwriting new input.

### Patch Changes

- 47f5327: Include the package changelog in the published npm tarball.

## 0.1.0

### Minor Changes

- d21fd92: Initial public release of the Agent UI React component library and Cloudflare Agents adapter.
