import { AIChatAgent } from "@cloudflare/ai-chat";
import { routeAgentRequest } from "agents";
import { convertToModelMessages, pruneMessages, stepCountIs, streamText, tool } from "ai";
import { z } from "zod";
import { createWorkersAI } from "workers-ai-provider";

export const MODEL_ID = "@cf/zai-org/glm-4.7-flash";

const STATUS_API = "https://www.cloudflarestatus.com/api/v2/summary.json";
const STATUS_TIMEOUT_MS = 5_000;
const MAX_DETAIL = 5;
const MAX_STATUS_BYTES = 512 * 1024;

interface StatusIncident {
  name: string;
  status: string;
  impact: string;
  updated: string;
}

interface StatusSummary {
  page: {
    name: string;
    updated: string;
  };
  incidents: StatusIncident[];
  degradedComponents: number;
}

/**
 * Fetch Cloudflare's public status API with a bounded timeout and return a
 * small, bounded JSON summary. This is a genuinely useful, deterministic tool
 * the model can call to answer "is Cloudflare having issues?" style questions.
 */
async function fetchStatusSummary(): Promise<StatusSummary> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STATUS_TIMEOUT_MS);
  try {
    const response = await fetch(STATUS_API, {
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`Status API responded with ${response.status}`);
    }
    const body = (await readBoundedJson(response, MAX_STATUS_BYTES)) as {
      page?: { name?: string; updated?: string };
      incidents?: Array<{ name?: string; status?: string; impact?: string; updated_at?: string }>;
      components?: Array<{ name?: string; status?: string }>;
    };
    const incidents = (body.incidents ?? [])
      .filter((i) => i.status !== "resolved")
      .slice(0, MAX_DETAIL)
      .map((i) => ({
        name: i.name ?? "Untitled",
        status: i.status ?? "unknown",
        impact: i.impact ?? "unknown",
        updated: i.updated_at ?? ""
      }));
    const degradedComponents = (body.components ?? []).filter(
      (c) => c.status && c.status !== "operational"
    ).length;
    return {
      page: { name: body.page?.name ?? "Cloudflare", updated: body.page?.updated ?? "" },
      incidents,
      degradedComponents
    };
  } finally {
    clearTimeout(timer);
  }
}

async function readBoundedJson(response: Response, maxBytes: number): Promise<unknown> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error("Status API response was too large");
  }

  if (!response.body) return null;

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel("Response exceeded size limit");
      throw new Error("Status API response was too large");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

const checkCloudflareStatus = tool({
  description:
    "Check the current Cloudflare status page for active incidents and degraded components. Useful for answering questions about Cloudflare availability or outages.",
  inputSchema: z.object({}),
  execute: async () => {
    return fetchStatusSummary();
  }
});

const tools = { checkCloudflareStatus };

export class ToolDemoAgent extends AIChatAgent<Env> {
  maxPersistedMessages = 100;

  async onChatMessage(
    onFinish: Parameters<AIChatAgent<Env>["onChatMessage"]>[0],
    options?: Parameters<AIChatAgent<Env>["onChatMessage"]>[1]
  ) {
    const workersai = createWorkersAI({ binding: this.env.AI });
    const result = streamText({
      model: workersai(MODEL_ID),
      system: [
        "You are a helpful assistant embedded in a chat playground demo.",
        "You are running on Cloudflare Workers AI (GLM-4.7-Flash).",
        "When asked about Cloudflare's status, use the checkCloudflareStatus tool and then summarize the result concisely.",
        "Keep answers friendly and concise."
      ].join("\n"),
      messages: pruneMessages({
        messages: await convertToModelMessages(this.messages),
        toolCalls: "before-last-2-messages",
        reasoning: "before-last-message"
      }),
      tools,
      stopWhen: stepCountIs(5),
      abortSignal: options?.abortSignal,
      onFinish
    });
    return result.toUIMessageStreamResponse();
  }
}

export default {
  async fetch(request: Request, env: Env) {
    return (await routeAgentRequest(request, env)) ?? new Response("Not found", { status: 404 });
  }
} satisfies ExportedHandler<Env>;
