import { FileTextIcon } from "@phosphor-icons/react";
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";

/**
 * The data describing a file the agent produced (or the user attached) in a
 * message. The `AgentFile` component renders this as a compact
 * attachment chip with an optional thumbnail, name, media type, size, and an
 * open link when a URL is present.
 */
export interface AgentFileData {
  /** Display name of the file. */
  name: string;
  /** IANA media type (for example `image/png` or `text/plain`). */
  mediaType?: string;
  /** Optional URL to a hosted file or a data URL. */
  url?: string;
  /** Size in bytes, rendered as a human-friendly suffix when present. */
  size?: number;
}

/**
 * Localized labels for an `AgentFile`. Every field is optional; omitted
 * fields fall back to English.
 */
export interface AgentFileLabels {
  /** Text shown on the open link. Defaults to `"Open"`. */
  open: string;
}

/**
 * Slots that let a consumer replace built-in content while preserving
 * accessible semantics.
 */
export interface AgentFileSlots {
  /** Replaces the leading icon (or thumbnail). */
  icon?: ReactNode;
  /** Replaces the name/type meta block. */
  meta?: ReactNode;
  /** Replaces the trailing open link. */
  link?: ReactNode;
}

export interface AgentFileProps
  extends AgentFileData,
    Omit<ComponentPropsWithoutRef<"div">, "color"> {
  labels?: Partial<AgentFileLabels>;
  slots?: Partial<AgentFileSlots>;
}

const defaultLabels: AgentFileLabels = {
  open: "Open"
};

function joinClass(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function formatSize(bytes?: number): string | undefined {
  if (bytes === undefined || bytes === null) return undefined;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(mediaType?: string): boolean {
  return Boolean(mediaType && mediaType.startsWith("image/"));
}

/** Default, SDK-agnostic rendering for a file part. */
export const AgentFile = forwardRef<HTMLDivElement, AgentFileProps>(function AgentFile(
  { name, mediaType, url, size, labels, slots, className, style, ...rest },
  ref
) {
  const label: AgentFileLabels = { ...defaultLabels, ...labels };
  const showThumb = isImage(mediaType) && Boolean(url);

  return (
    <div
      ref={ref}
      className={joinClass("agent-ui-file", className)}
      data-agent-ui-file=""
      data-media-type={mediaType ?? ""}
      data-has-url={url ? "true" : "false"}
      style={style}
      {...rest}
    >
      {slots?.icon ??
        (showThumb ? (
          <img className="agent-ui-file__thumb" src={url} alt="" aria-hidden="true" />
        ) : (
          <span className="agent-ui-file__icon" aria-hidden="true">
            <FileTextIcon size={18} weight="duotone" />
          </span>
        ))}
      {slots?.meta ?? (
        <span className="agent-ui-file__meta">
          <span className="agent-ui-file__name">{name}</span>
          {(mediaType || size !== undefined) && (
            <span className="agent-ui-file__type">
              {[mediaType, formatSize(size)].filter(Boolean).join(" · ")}
            </span>
          )}
        </span>
      )}
      {slots?.link ?? (url ? (
        <a
          className="agent-ui-file__link"
          href={url}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => event.stopPropagation()}
        >
          {label.open}
        </a>
      ) : null)}
    </div>
  );
});

AgentFile.displayName = "AgentFile";
