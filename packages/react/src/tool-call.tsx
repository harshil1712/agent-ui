import { Button, Collapsible, Text } from "@cloudflare/kumo";
import { CaretDownIcon, CheckIcon, XIcon } from "@phosphor-icons/react";
import {
  forwardRef,
  useId,
  useMemo,
  useState,
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
  /** Label to reveal a truncated detail value. Defaults to `"Show more"`. */
  showMore: string;
  /** Label to collapse an expanded detail value. Defaults to `"Show less"`. */
  showLess: string;
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
  /**
   * Character budget for the bounded detail preview before a "Show more"
   * control offers a larger bounded preview. Defaults to `5000`. Non-finite
   * values fall back to the default; negatives are clamped to `0`; fractional
   * values are floored. Only affects the default JSON rendering, never a
   * custom `renderInput`/`renderOutput`.
   */
  detailChars?: number;
  /**
   * Hard ceiling for expanded default detail rendering. Defaults to `20000`
   * and is always capped at `100000`. "Show more" remains bounded and never
   * fully serializes an arbitrary payload. Custom renderers are unaffected.
   */
  maxDetailChars?: number;
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
  actions: "Tool approval actions",
  showMore: "Show more",
  showLess: "Show less"
};

const DEFAULT_DETAIL_CHARS = 5000;
const DEFAULT_MAX_DETAIL_CHARS = 20000;
const ABSOLUTE_MAX_DETAIL_CHARS = 100000;

/** Max nesting depth for the bounded preview serializer. */
const MAX_PREVIEW_DEPTH = 6;

/**
 * Normalize the `detailChars` prop to a safe, non-negative, finite integer.
 * Non-finite values (NaN / ±Infinity) fall back to the default; negatives are
 * clamped to `0`; fractional values are floored.
 */
function normalizeDetailChars(value: number | undefined): number {
  if (value === undefined) return DEFAULT_DETAIL_CHARS;
  if (!Number.isFinite(value)) return DEFAULT_DETAIL_CHARS;
  return Math.min(ABSOLUTE_MAX_DETAIL_CHARS, Math.max(0, Math.floor(value)));
}

function normalizeMaxDetailChars(value: number | undefined): number {
  const normalized = value === undefined || !Number.isFinite(value)
    ? DEFAULT_MAX_DETAIL_CHARS
    : Math.max(0, Math.floor(value));
  return Math.min(ABSOLUTE_MAX_DETAIL_CHARS, normalized);
}

/**
 * Minimal JSON string encoding that deliberately avoids `JSON.stringify`
 * (which the bounded preview must not invoke on a large payload).
 */
function encodeJsonString(value: string): string {
  return '"' + value.replace(/[\\"]/g, (m) => (m === '"' ? '\\"' : "\\\\")) + '"';
}

/**
 * A bounded, non-serializing preview of an arbitrary value. It walks the
 * value only until `limit` characters are produced (and no deeper than
 * `MAX_PREVIEW_DEPTH`), so it never fully stringifies or traverses a huge
 * object. Strings are sliced cheaply. Circular references are detected and
 * rendered as `…(circular)`. Returns the preview text plus whether it was
 * truncated. Expanded previews use the same bounded walk with a larger limit;
 * arbitrary payloads are never fully serialized by the default renderer.
 *
 * Bounds: every appended chunk is capped to the remaining budget (a huge key
 * or primitive cannot push the output past `limit`), and object properties
 * are visited incrementally via `for…in` + `hasOwnProperty`, so a large
 * object is not enumerated/allocated up front and its values are only read as
 * the budget allows. Note: for Proxy/exotic objects the engine invokes the
 * `ownKeys` trap eagerly, so *key* enumeration may still touch every key;
 * values are still read lazily and the output remains bounded.
 */
function formatBounded(data: unknown, limit: number): { text: string; truncated: boolean } {
  const parts: string[] = [];
  let length = 0;
  let truncated = false;

  const encode = (slice: string): string =>
    slice.replace(/[\\"]/g, (m) => (m === '"' ? '\\"' : "\\\\"));

  // Append a chunk but never exceed `limit`: oversized chunks are sliced to
  // the remaining budget, so a huge key/primitive cannot blow past the limit.
  const push = (chunk: string) => {
    if (length >= limit) {
      truncated = true;
      return;
    }
    const room = limit - length;
    if (chunk.length <= room) {
      parts.push(chunk);
      length += chunk.length;
    } else {
      parts.push(chunk.slice(0, room));
      length = limit;
      truncated = true;
    }
  };

  // Push the budget ellipsis and always mark the preview as truncated.
  const ellipsis = () => {
    push("…");
    truncated = true;
  };

  const walk = (value: unknown, depth: number, seen: unknown[]) => {
    if (length >= limit) {
      truncated = true;
      return;
    }
    if (depth > MAX_PREVIEW_DEPTH) {
      ellipsis();
      return;
    }

    if (typeof value === "string") {
      // Need room for two quotes and at least one content character.
      if (limit - length < 3) {
        ellipsis();
        return;
      }
      push('"');
      const innerRoom = limit - length - 1; // reserve the closing quote
      const fits = value.length <= innerRoom;
      // Slice before encoding so a huge string never builds a full transform.
      const content = fits ? value : value.slice(0, innerRoom);
      push(encode(content));
      if (!fits) ellipsis();
      push('"');
      return;
    }
    if (value === null) {
      push("null");
      return;
    }
    if (value === undefined) {
      push("undefined");
      return;
    }
    const type = typeof value;
    if (type === "number" || type === "boolean") {
      push(String(value));
      return;
    }
    if (type === "bigint") {
      push(String(value) + "n");
      return;
    }

    if (seen.indexOf(value) !== -1) {
      push("…(circular)");
      return;
    }
    const nextSeen = [...seen, value];

    if (Array.isArray(value)) {
      push("[");
      const arr = value as unknown[];
      for (let i = 0; i < arr.length; i++) {
        if (length >= limit) {
          ellipsis();
          break;
        }
        if (i > 0) push(", ");
        walk(arr[i], depth + 1, nextSeen);
      }
      if (length >= limit) {
        if (!parts[parts.length - 1].startsWith("…")) ellipsis();
      } else {
        push("]");
      }
      return;
    }

    // Objects: iterate own enumerable string keys incrementally (for…in +
    // hasOwnProperty) instead of `Object.keys`, so a large object is not
    // enumerated/allocated up front. Huge keys are sliced to the remaining
    // budget before encoding.
    push("{");
    let first = true;
    for (const key in value) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
      if (length >= limit) {
        ellipsis();
        break;
      }
      if (!first) push(", ");
      first = false;
      const room = limit - length;
      const keyPreview = key.length > room ? key.slice(0, room) : key;
      push(encodeJsonString(keyPreview));
      if (keyPreview.length !== key.length) truncated = true;
      push(": ");
      walk((value as Record<string, unknown>)[key], depth + 1, nextSeen);
    }
    if (length >= limit) {
      if (!parts[parts.length - 1].startsWith("…")) ellipsis();
    } else {
      push("}");
    }
  };

  walk(data, 0, []);
  if (length > limit) truncated = true;
  return { text: parts.join(""), truncated };
}

function joinClass(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

interface ToolCallValueProps {
  value: unknown;
  render?: (value: unknown) => ReactNode;
  limit: number;
  maxLimit: number;
  showMore: string;
  showLess: string;
}

/**
 * Lazily renders a tool detail value inside the open Collapsible.Panel.
 * Because Kumo's panel only mounts its children when open, this component's
 * render — and therefore any serialization of `value` — only runs while the
 * details are visible. Both the initial and expanded renders use a bounded,
 * non-serializing preview (`formatBounded`), so a huge object is never fully
 * stringified. Custom `render` escape hatches bypass the built-in bounds.
 */
function BoundedToolCallValue({
  value,
  limit,
  maxLimit,
  showMore,
  showLess
}: Omit<ToolCallValueProps, "render">) {
  const [expandedValue, setExpandedValue] = useState(false);
  const previewId = useId();
  const activeLimit = expandedValue ? maxLimit : limit;
  const preview = useMemo(() => formatBounded(value, activeLimit), [value, activeLimit]);
  const canExpand = preview.truncated && activeLimit < maxLimit;

  return (
    <div className="agent-ui-tool-call__value">
      <pre id={previewId} className="agent-ui-tool-call__pre">{preview.text}</pre>
      {(canExpand || expandedValue) && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="agent-ui-tool-call__toggle-more"
          aria-expanded={expandedValue}
          aria-controls={previewId}
          onClick={() => setExpandedValue((current) => !current)}
        >
          {expandedValue ? showLess : showMore}
        </Button>
      )}
    </div>
  );
}

function ToolCallValue(props: ToolCallValueProps) {
  if (props.render) return <>{props.render(props.value)}</>;
  return <BoundedToolCallValue {...props} />;
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
    detailChars,
    maxDetailChars,
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

  // Normalize the optional `detailChars` to a safe non-negative integer.
  const maxDetailLimit = normalizeMaxDetailChars(maxDetailChars);
  const detailLimit = Math.min(normalizeDetailChars(detailChars), maxDetailLimit);

  const renderSectionValue = (title: string, value: unknown, render?: (v: unknown) => ReactNode) => (
    <ToolCallValue
      value={value}
      render={render}
      limit={detailLimit}
      maxLimit={maxDetailLimit}
      showMore={label.showMore}
      showLess={label.showLess}
    />
  );

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
