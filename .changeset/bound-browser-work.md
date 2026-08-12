---
"@harshil1712/agent-ui": minor
---

Bound browser-side chat work by default: `useAgentChatUI` now adapts the latest 100 messages, while `AgentChat.Preset` initially mounts the latest 50. Consumers can configure these limits with `maxMessages` and `maxVisibleMessages`.

Tool detail rendering is now lazy and hard-bounded. The default renderer shows up to 5,000 characters initially, up to 20,000 after expanding, and never exceeds 100,000 characters. It no longer fully serializes arbitrary tool payloads.

Message text is joined lazily, and unchanged normalized message parts retain stable references across streaming and controlled-expansion updates.
