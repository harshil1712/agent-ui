import { Text } from "@cloudflare/kumo";
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";

export type AgentPendingVariant = "compact" | "descriptive";

export interface AgentPendingLabels {
  pending: string;
}

export interface AgentPendingSlots {
  indicator?: ReactNode;
}

export interface AgentPendingProps extends Omit<ComponentPropsWithoutRef<"div">, "color"> {
  variant?: AgentPendingVariant;
  labels?: Partial<AgentPendingLabels>;
  slots?: Partial<AgentPendingSlots>;
}

function joinClass(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export const AgentPending = forwardRef<HTMLDivElement, AgentPendingProps>(function AgentPending(
  { variant = "compact", labels, slots, className, "aria-label": ariaLabel, ...rest },
  ref
) {
  const pending = labels?.pending ?? "Thinking";

  return (
    <div
      ref={ref}
      role="status"
      aria-label={ariaLabel ?? pending}
      className={joinClass("agent-ui-pending", `agent-ui-pending--${variant}`, className)}
      data-variant={variant}
      {...rest}
    >
      {slots?.indicator ?? (
        <span className="agent-ui-pending__dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      )}
      {variant === "descriptive" && (
        <Text as="span" variant="secondary" size="sm">
          {pending}
        </Text>
      )}
      <span className="agent-ui-visually-hidden">{pending}</span>
    </div>
  );
});

AgentPending.displayName = "AgentPending";
