import { Button, Collapsible, Text } from "@cloudflare/kumo";
import { CaretDownIcon } from "@phosphor-icons/react";
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";

export interface AgentReasoningLabels {
  reasoning: string;
  streaming: string;
  show: string;
  hide: string;
}

export interface AgentReasoningSlots {
  summary?: ReactNode;
  indicator?: ReactNode;
}

export interface AgentReasoningProps extends Omit<ComponentPropsWithoutRef<"div">, "color"> {
  text: string;
  isStreaming?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  /** Set to false when a parent live region already announces streamed updates. */
  announceUpdates?: boolean;
  labels?: Partial<AgentReasoningLabels>;
  slots?: Partial<AgentReasoningSlots>;
}

const defaultLabels: AgentReasoningLabels = {
  reasoning: "Reasoning",
  streaming: "Reasoning…",
  show: "Show reasoning",
  hide: "Hide reasoning"
};

function joinClass(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export const AgentReasoning = forwardRef<HTMLDivElement, AgentReasoningProps>(
  function AgentReasoning(
    {
      text,
      isStreaming,
      expanded,
      onExpandedChange,
      announceUpdates = true,
      labels,
      slots,
      className,
      ...rest
    },
    ref
  ) {
    const label = { ...defaultLabels, ...labels };
    const canToggle = Boolean(onExpandedChange);
    const resolvedOpen = expanded ?? Boolean(isStreaming || !canToggle);

    const panelContent = (
      <>
        <Text
          as="p"
          variant="secondary"
          size="sm"
          DANGEROUS_className="agent-ui-reasoning__text"
          aria-live={isStreaming && announceUpdates ? "polite" : "off"}
        >
          {text}
        </Text>
        {isStreaming && (slots?.indicator ?? <span className="agent-ui-reasoning__cursor" aria-hidden="true" />)}
      </>
    );

    return (
      <div
        ref={ref}
        className={joinClass("agent-ui-reasoning", className)}
        data-streaming={isStreaming ? "true" : "false"}
        data-expanded={resolvedOpen ? "true" : "false"}
        {...rest}
      >
        {canToggle ? (
          <Collapsible.Root
            open={resolvedOpen}
            onOpenChange={(open) => onExpandedChange?.(open)}
          >
            <Collapsible.Trigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={CaretDownIcon}
                  className="agent-ui-reasoning__trigger"
                  aria-label={resolvedOpen ? label.hide : label.show}
                >
                  {slots?.summary ?? (isStreaming ? label.streaming : label.reasoning)}
                </Button>
              }
            />
            <Collapsible.Panel className="agent-ui-reasoning__panel">
              {panelContent}
            </Collapsible.Panel>
          </Collapsible.Root>
        ) : (
          <>
            <Text as="span" variant="secondary" size="sm" DANGEROUS_className="agent-ui-reasoning__summary">
              {slots?.summary ?? (isStreaming ? label.streaming : label.reasoning)}
            </Text>
            {resolvedOpen && <div className="agent-ui-reasoning__panel">{panelContent}</div>}
          </>
        )}
      </div>
    );
  }
);

AgentReasoning.displayName = "AgentReasoning";
