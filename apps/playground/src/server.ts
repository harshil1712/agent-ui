import { AIChatAgent } from "@cloudflare/ai-chat";
import { Think } from "@cloudflare/think";
import { routeAgentRequest } from "agents";
import {
  convertToModelMessages,
  pruneMessages,
  stepCountIs,
  streamText,
  tool,
} from "ai";
import { z } from "zod";
import { createWorkersAI } from "workers-ai-provider";

export const MODEL_ID = "@cf/zai-org/glm-4.7-flash";

const WORKERS_AI_DOCS_URL =
  "https://developers.cloudflare.com/workers-ai/index.md";
const DOCS_TIMEOUT_MS = 5_000;
const MAX_DOCS_BYTES = 64 * 1024;

/**
 * Fetch the current Workers AI overview from Cloudflare's Markdown docs with a
 * bounded timeout and response size.
 */
async function fetchWorkersAiDocs(): Promise<{
  source: string;
  markdown: string;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOCS_TIMEOUT_MS);
  try {
    const response = await fetch(WORKERS_AI_DOCS_URL, {
      headers: { Accept: "text/markdown" },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Cloudflare Docs responded with ${response.status}`);
    }
    return {
      source: WORKERS_AI_DOCS_URL,
      markdown: await readBoundedText(response, MAX_DOCS_BYTES),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function readBoundedText(
  response: Response,
  maxBytes: number,
): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error("Cloudflare Docs response was too large");
  }

  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel("Response exceeded size limit");
      throw new Error("Cloudflare Docs response was too large");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

const checkCloudflareDocs = tool({
  description:
    "Fetch the current official Cloudflare Workers AI overview. Use it to answer questions about what Workers AI is and what it provides.",
  inputSchema: z.object({}),
  execute: async () => {
    return fetchWorkersAiDocs();
  },
});

const tools = { checkCloudflareDocs };

/** Agents SDK reference integration: AIChatAgent with bounded persistence + tools. */
export class ToolDemoAgent extends AIChatAgent<Env> {
  maxPersistedMessages = 100;

  async onChatMessage(
    onFinish: Parameters<AIChatAgent<Env>["onChatMessage"]>[0],
    options?: Parameters<AIChatAgent<Env>["onChatMessage"]>[1],
  ) {
    const workersai = createWorkersAI({ binding: this.env.AI });
    const result = streamText({
      model: workersai(MODEL_ID),
      system: [
        "You are a helpful assistant embedded in a chat playground demo.",
        "You are running on Cloudflare Workers AI (GLM-4.7-Flash) via the Cloudflare Agents SDK (@cloudflare/ai-chat).",
        "When asked about Workers AI, use the checkCloudflareDocs tool and ground the answer in the returned documentation.",
        "Keep answers friendly and concise.",
      ].join("\n"),
      messages: pruneMessages({
        messages: await convertToModelMessages(this.messages),
        toolCalls: "before-last-2-messages",
        reasoning: "before-last-message",
      }),
      tools,
      stopWhen: stepCountIs(5),
      abortSignal: options?.abortSignal,
      onFinish,
    });
    return result.toUIMessageStreamResponse();
  }
}

/** Think runtime integration: Think with the same docs-grounded assistant behavior. */
export class ThinkDemoAgent extends Think<Env> {
  getModel() {
    return createWorkersAI({ binding: this.env.AI })(MODEL_ID);
  }

  getSystemPrompt() {
    return [
      "You are a helpful assistant embedded in a chat playground demo.",
      "You are running on Cloudflare Workers AI (GLM-4.7-Flash) via @cloudflare/think.",
      "When asked about Workers AI, use the checkCloudflareDocs tool and ground the answer in the returned documentation.",
      "Keep answers friendly and concise.",
    ].join("\n");
  }

  getTools() {
    return { checkCloudflareDocs };
  }
}

export default {
  async fetch(request: Request, env: Env) {
    return (
      (await routeAgentRequest(request, env)) ??
      new Response("Not found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
