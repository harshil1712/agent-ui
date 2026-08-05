import { Badge, Button, LayerCard, Loader } from "@cloudflare/kumo";
import { CheckIcon, XIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";

export type ToolCallStatus =
  | "pending"
  | "running"
  | "awaiting-approval"
  | "completed"
  | "failed";

export interface ToolCallProps {
  name: string;
  status: ToolCallStatus;
  input?: unknown;
  output?: unknown;
  error?: ReactNode;
  description?: ReactNode;
  className?: string;
  onApprove?: () => void;
  onReject?: () => void;
}

const statusConfig = {
  pending: { label: "Pending", variant: "neutral" },
  running: { label: "Running", variant: "info" },
  "awaiting-approval": { label: "Approval required", variant: "warning" },
  completed: { label: "Completed", variant: "success" },
  failed: { label: "Failed", variant: "error" }
} as const;

function formatData(data: unknown) {
  if (typeof data === "string") return data;

  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

export function ToolCall({
  name,
  status,
  input,
  output,
  error,
  description,
  className,
  onApprove,
  onReject
}: ToolCallProps) {
  const statusDetails = statusConfig[status];
  const hasDetails = input !== undefined || output !== undefined || error !== undefined;

  return (
    <LayerCard className={["agent-ui-tool-call", className].filter(Boolean).join(" ")}>
      <div className="agent-ui-tool-call__header">
        <div className="agent-ui-tool-call__identity">
          <span className="agent-ui-tool-call__eyebrow">Tool call</span>
          <h3 className="agent-ui-tool-call__name">{name}</h3>
        </div>
        <div className="agent-ui-tool-call__status" aria-live="polite">
          {status === "running" && <Loader size="sm" aria-label={`${name} is running`} />}
          <Badge variant={statusDetails.variant} appearance="dot">
            {statusDetails.label}
          </Badge>
        </div>
      </div>

      {description && <div className="agent-ui-tool-call__description">{description}</div>}

      {hasDetails && (
        <details className="agent-ui-tool-call__details" open={status === "failed"}>
          <summary>View details</summary>
          <div className="agent-ui-tool-call__details-body">
            {input !== undefined && (
              <section aria-label="Tool input">
                <h4>Input</h4>
                <pre>{formatData(input)}</pre>
              </section>
            )}
            {output !== undefined && (
              <section aria-label="Tool output">
                <h4>Output</h4>
                <pre>{formatData(output)}</pre>
              </section>
            )}
            {error !== undefined && (
              <section aria-label="Tool error" className="agent-ui-tool-call__error">
                <h4>Error</h4>
                <div>{error}</div>
              </section>
            )}
          </div>
        </details>
      )}

      {status === "awaiting-approval" && (onApprove || onReject) && (
        <div className="agent-ui-tool-call__actions" aria-label="Tool approval actions">
          {onReject && (
            <Button variant="secondary" size="sm" icon={XIcon} onClick={onReject}>
              Reject
            </Button>
          )}
          {onApprove && (
            <Button variant="primary" size="sm" icon={CheckIcon} onClick={onApprove}>
              Approve
            </Button>
          )}
        </div>
      )}
    </LayerCard>
  );
}

ToolCall.displayName = "ToolCall";
