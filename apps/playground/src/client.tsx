import "@agent-ui/react/styles";
import "./styles.css";

import { Button } from "@cloudflare/kumo";
import { ArrowClockwiseIcon } from "@phosphor-icons/react";
import { ToolCall } from "@agent-ui/react";
import { useAgent } from "agents/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type { DemoState, ToolDemoAgent } from "./server";

const initialState: DemoState = { status: "awaiting-approval" };

function App() {
  const agent = useAgent<ToolDemoAgent, DemoState>({
    agent: "ToolDemoAgent",
    name: "component-workshop"
  });
  const state = agent.state ?? initialState;

  return (
    <main className="workshop-shell">
      <header className="workshop-header">
        <div>
          <p className="workshop-kicker">Component 001 / Tool lifecycle</p>
          <h1>Agent UI Workshop</h1>
        </div>
        <span className="workshop-connection">Durable Object state</span>
      </header>

      <section className="workshop-grid" aria-labelledby="demo-title">
        <div className="workshop-notes">
          <span className="workshop-index">01</span>
          <h2 id="demo-title">Approval is a UI state, not a modal.</h2>
          <p>
            This example connects the controlled component to a real Cloudflare Agent. Approve or reject
            the operation and the Durable Object broadcasts the new state back to this client.
          </p>
          <dl>
            <div><dt>Primitive</dt><dd>Kumo LayerCard</dd></div>
            <div><dt>Transport</dt><dd>Agents WebSocket</dd></div>
            <div><dt>Ownership</dt><dd>Server state</dd></div>
          </dl>
        </div>

        <div className="workshop-stage">
          <div className="workshop-stage__label">Live component</div>
          <ToolCall
            name="searchDocumentation"
            status={state.status}
            description="Search the Cloudflare developer documentation before answering the user."
            input={{ query: "Durable Objects alarm best practices", limit: 5 }}
            output={state.output}
            error={state.error}
            onApprove={() => void agent.stub.approve()}
            onReject={() => void agent.stub.reject()}
          />
          <Button
            variant="ghost"
            size="sm"
            icon={ArrowClockwiseIcon}
            onClick={() => void agent.stub.reset()}
          >
            Reset demo
          </Button>
        </div>
      </section>

      <footer className="workshop-footer">
        <span>@agent-ui/react</span>
        <span>Cloudflare Kumo + Agents SDK</span>
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
