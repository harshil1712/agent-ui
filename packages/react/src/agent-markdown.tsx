import { streamingMarkdownExtension } from "@tanstack/markdown/extensions/streaming";
import { Markdown, type MarkdownComponents } from "@tanstack/markdown/react";
import { forwardRef, type ComponentPropsWithoutRef } from "react";

export interface AgentMarkdownProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  children: string;
  isStreaming?: boolean;
  components?: MarkdownComponents;
}

const streamingExtensions = [streamingMarkdownExtension()];

function joinClass(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/** Safe Markdown rendering tuned for text that may still be streaming. */
export const AgentMarkdown = forwardRef<HTMLDivElement, AgentMarkdownProps>(
  function AgentMarkdown({ children, isStreaming, components, className, ...rest }, ref) {
    return (
      <div
        ref={ref}
        className={joinClass("agent-ui-markdown", className)}
        data-streaming={isStreaming ? "true" : "false"}
        {...rest}
      >
        <Markdown
          extensions={streamingExtensions}
          frontmatter={false}
          headingIds={false}
          components={components}
        >
          {children}
        </Markdown>
      </div>
    );
  }
);

AgentMarkdown.displayName = "AgentMarkdown";
