import { Agent, callable, routeAgentRequest } from "agents";

export type DemoStatus =
  | "pending"
  | "running"
  | "awaiting-approval"
  | "completed"
  | "failed";

export interface DemoState {
  status: DemoStatus;
  output?: { matches: number; topResult: string };
  error?: string;
}

export class ToolDemoAgent extends Agent<Env, DemoState> {
  initialState: DemoState = { status: "awaiting-approval" };

  @callable()
  async approve() {
    this.setState({ status: "running" });
    await new Promise((resolve) => setTimeout(resolve, 900));
    this.setState({
      status: "completed",
      output: {
        matches: 5,
        topResult: "Use alarms for durable, time-based callbacks."
      }
    });
  }

  @callable()
  reject() {
    this.setState({
      status: "failed",
      error: "The user rejected this tool call."
    });
  }

  @callable()
  reset() {
    this.setState({ status: "awaiting-approval" });
  }
}

export default {
  async fetch(request: Request, env: Env) {
    return (await routeAgentRequest(request, env)) ?? new Response("Not found", { status: 404 });
  }
} satisfies ExportedHandler<Env>;
