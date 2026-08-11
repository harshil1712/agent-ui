import { Button, Collapsible, Text } from "@cloudflare/kumo";
import { CaretDownIcon, CheckIcon, XIcon } from "@phosphor-icons/react";
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ReactNode
} from "react";

export type ToolCallStatus =
  | "pending"
  | "running"
  | "awaiting-approval"
  | "completed"
  | "failed";

/**
 * Visual treatment for a tool call.
 * - `"default"` — status marker on the execution rail with a readable status label.
 * - `"subtle"` — quieter rail and smaller status text, useful for background or
 *   nested tool calls that should not compete with the active turn.
 */
export type ToolCallVariant = "default" | "subtle";

/** Controls the geometric spacing around the rail and the detail panels. */
export type ToolCallDensity = "comfortable" | "compact";

export interface ToolCallStatusLabels {
  pending: string;
  running: string;
  "awaiting-approval": string;
  completed: string;
  failed: string;
}

/**
 * Localized labels for a `ToolCall`. Every field is optional; omitted
 * fields fall back to English. Pass a partial object and only override the
 * strings you need.
 */
export interface ToolCallLabels {
  /** Labels for each lifecycle status. */
  status: Partial<ToolCallStatusLabels>;
  /** Text shown on the details disclosure trigger. Defaults to `"View details"`. */
  details: string;
  /** Heading for the input section. Defaults to `"Input"`. */
  input: string;
  /** Heading for the output section. Defaults to `"Output"`. */
  output: string;
  /** Heading for the error section. Defaults to `"Error"`. */
  error: string;
  /** Label for the reject action. Defaults to `"Reject"`. */
  reject: string;
  /** Label for the approve action. Defaults to `"Approve"`. */
  approve: string;
  /** Accessible name for the approval action group. Defaults to `"Tool approval actions"`. */
  actions: string;
}

/**
 * Slots that let a consumer replace built-in content. Each slot, when
 * provided, is rendered instead of the default node while preserving the
 * accessible semantics of the surrounding structure.
 */
export interface ToolCallSlots {
  /** Replaces the content rendered before the summary (for example a custom icon). */
  leading?: ReactNode;
  /** Replaces the built-in approve/reject buttons. */
  actions?: ReactNode;
  /** Rendered below the details panel (visible whether or not details are open). */
  footer?: ReactNode;
}

export interface ToolCallProps
  extends Omit<ComponentPropsWithoutRef<"div">, "color"> {
  /** The tool's name, shown on the execution rail. */
  name: string;
  status: ToolCallStatus;
  /** Serialized input payload, rendered inside the expandable details. */
  input?: unknown;
  /** Serialized output payload, rendered inside the expandable details. */
  output?: unknown;
  /** Human-readable error text, shown prominently when the tool failed. */
  error?: ReactNode;
  /** Optional one-line description shown under the summary. */
  description?: ReactNode;
  /**
   * Controlled expansion of the details panel. Omitted fields fall back to a
   * deterministic default: open when `status === "failed"`, closed otherwise.
   * The component never owns mutable expansion state; consumers must pass
   * `expanded`/`onExpandedChange` to toggle details.
   */
  expanded?: boolean;
  /** Callback fired when the details panel is toggled. */
  onExpandedChange?: (expanded: boolean) => void;
  /** Custom renderer for the input payload. */
  renderInput?: (input: unknown) => ReactNode;
  /** Custom renderer for the output payload. */
  renderOutput?: (output: unknown) => ReactNode;
  /** Called when the user approves the tool. */
  onApprove?: () => void;
  /** Called when the user rejects the tool. */
  onReject?: () => void;
  variant?: ToolCallVariant;
  density?: ToolCallDensity;
  labels?: Partial<ToolCallLabels>;
  slots?: Partial<ToolCallSlots>;
  className?: string;
  style?: CSSProperties;
}

const defaultStatusLabels: ToolCallStatusLabels = {
  pending: "Pending",
  running: "Running",
  "awaiting-approval": "Approval required",
  completed: "Completed",
  failed: "Failed"
};

const defaultLabels: ToolCallLabels = {
  status: defaultStatusLabels,
  details: "View details",
  input: "Input",
  output: "Output",
  error: "Error",
  reject: "Reject",
  approve: "Approve",
  actions: "Tool approval actions"
};

function formatData(data: unknown): string {
  if (typeof data === "string") return data;

  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

function joinClass(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export const ToolCall = forwardRef<HTMLDivElement, ToolCallProps>(function ToolCall(
  {
    name,
    status,
    input,
    output,
    error,
    description,
    expanded,
    onExpandedChange,
    renderInput,
    renderOutput,
    onApprove,
    onReject,
    variant = "default",
    density = "comfortable",
    labels,
    slots,
    className,
    style,
    ...rest
  },
  ref
) {
  const label: ToolCallLabels = {
    ...defaultLabels,
    ...labels,
    status: { ...defaultStatusLabels, ...labels?.status }
  };
  const statusText = label.status[status];
  const hasDetails = input !== undefined || output !== undefined || error !== undefined;
  const hasApproval = status === "awaiting-approval" && (onApprove || onReject);

  // Controlled expansion: consumers own the state through `expanded`/
  // `onExpandedChange`. This component never stores mutable state; when
  // `expanded` is omitted it falls back to a deterministic default (failed
  // tools open by default, all other statuses closed).
  const resolvedOpen = expanded ?? status === "failed";
  const handleOpenChange = (open: boolean) => {
    onExpandedChange?.(open);
  };

  const renderSectionValue = (title: string, value: unknown, render?: (v: unknown) => ReactNode) =>
    render ? render(value) : <pre className="agent-ui-tool-call__pre">{formatData(value)}</pre>;

  return (
    <div
      ref={ref}
      className={joinClass(
        "agent-ui-tool-call",
        `agent-ui-tool-call--${status}`,
        `agent-ui-tool-call--${variant}`,
        `agent-ui-tool-call--${density}`,
        className
      )}
      data-status={status}
      data-expanded={resolvedOpen ? "true" : "false"}
      data-actionable={hasApproval ? "true" : "false"}
      style={style}
      {...rest}
    >
      {slots?.leading}
      <div className="agent-ui-tool-call__rail">
        <span className="agent-ui-tool-call__marker" aria-hidden="true" />
        <div className="agent-ui-tool-call__body">
          <div className="agent-ui-tool-call__summary">
            <span className="agent-ui-tool-call__name">{name}</span>
            <Text as="span" variant="secondary" size="xs" DANGEROUS_className="agent-ui-tool-call__status">
              {statusText}
            </Text>
          </div>

          {description && <div className="agent-ui-tool-call__description">{description}</div>}

          {hasDetails && (
            <Collapsible.Root open={resolvedOpen} onOpenChange={handleOpenChange}>
              <Collapsible.Trigger
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={CaretDownIcon}
                    className="agent-ui-tool-call__details-trigger"
                  >
                    {label.details}
                  </Button>
                }
              />
              <Collapsible.Panel className="agent-ui-tool-call__details-body">
                {input !== undefined &&
                  renderSection(
                    label.input,
                    renderSectionValue(label.input, input, renderInput)
                  )}
                {output !== undefined &&
                  renderSection(
                    label.output,
                    renderSectionValue(label.output, output, renderOutput)
                  )}
                {error !== undefined &&
                  renderSection(
                    label.error,
                    <div className="agent-ui-tool-call__error">{error}</div>,
                    "agent-ui-tool-call__error"
                  )}
              </Collapsible.Panel>
            </Collapsible.Root>
          )}

          {slots?.footer}

          {(hasApproval || slots?.actions) && (
            <div className="agent-ui-tool-call__actions" role="group" aria-label={label.actions}>
              {slots?.actions ?? (
                <>
                  {onReject && (
                    <Button variant="secondary" size="sm" icon={XIcon} onClick={onReject}>
                      {label.reject}
                    </Button>
                  )}
                  {onApprove && (
                    <Button variant="primary" size="sm" icon={CheckIcon} onClick={onApprove}>
                      {label.approve}
                    </Button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  function renderSection(title: string, body: ReactNode, sectionClass?: string) {
    return (
      <section aria-label={title} className={sectionClass}>
        <Text as="h4" variant="heading3" DANGEROUS_className="agent-ui-tool-call__section-title">
          {title}
        </Text>
        {body}
      </section>
    );
  }
});

ToolCall.displayName = "ToolCall";
