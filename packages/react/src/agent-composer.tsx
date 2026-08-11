import { Button, Text, Textarea } from "@cloudflare/kumo";
import { PaperclipIcon, PaperPlaneTiltIcon, StopIcon, XIcon } from "@phosphor-icons/react";
import {
  forwardRef,
  useRef,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode
} from "react";

/**
 * A file the user intends to send. The composer renders attachments as
 * removable chips; actual file bytes are uploaded/encoded by the consumer,
 * which owns the attachment list.
 */
export interface AgentAttachment {
  id: string;
  name: string;
  /** Size in bytes, rendered as a human-friendly suffix when present. */
  size?: number;
  /** MIME type, used to pick a chip icon and to hint at the file kind. */
  mediaType?: string;
  /** Optional thumbnail URL (for example an image preview). */
  previewUrl?: string;
}

/**
 * Localized labels for an `AgentComposer`. Every field is optional;
 * omitted fields fall back to English.
 */
export interface AgentComposerLabels {
  /** Accessible name for the composer form. Defaults to `"Message composer"`. */
  composer: string;
  /** Accessible name for the action button group. Defaults to `"Composer actions"`. */
  actions: string;
  /** Accessible name for the textarea. Defaults to `"Message"`. */
  input: string;
  /** Accessible name for the attach button. Defaults to `"Add attachments"`. */
  addAttachments: string;
  /** Accessible name for the send button. Defaults to `"Send message"`. */
  send: string;
  /** Accessible name for the stop button shown while busy. Defaults to `"Stop"`. */
  stop: string;
  /** Accessible name for the attachments group. Defaults to `"Attachments"`. */
  attachments: string;
  /**
   * Accessible name for an individual attachment chip, where `{name}` is the
   * file name. Defaults to `"Attachment {name}"`.
   */
  attachment: string;
  /** Accessible name for an attachment's remove button, where `{name}` is the file name. Defaults to `"Remove {name}"`. */
  removeAttachment: string;
}

/**
 * Slots that let a consumer replace built-in content while preserving
 * accessible semantics.
 */
export interface AgentComposerSlots {
  /** Rendered above the textarea and attachments. */
  leading?: ReactNode;
  /** Replaces the contents of each attachment chip. */
  attachment?: (attachment: AgentAttachment, index: number) => ReactNode;
  /** Replaces the built-in attach/send action buttons. */
  actions?: ReactNode;
  /** Rendered below the textarea. */
  footer?: ReactNode;
}

export interface AgentComposerProps
  extends Omit<ComponentPropsWithoutRef<"form">, "onSubmit" | "onChange"> {
  /** Controlled textarea value. */
  value: string;
  /** Called whenever the user edits the textarea. */
  onValueChange: (value: string) => void;
  /** Controlled list of attachments rendered as removable chips. */
  attachments?: AgentAttachment[];
  /**
   * Enables the built-in hidden file input and attach button. Receives the raw
   * `FileList`; consumers are expected to read the files and update the
   * controlled `attachments` list themselves.
   */
  onAddAttachments?: (files: FileList) => void;
  /** Restricts the kinds of files the hidden input accepts (forwarded to the input's `accept`). */
  accept?: string;
  /** Allows selecting multiple files at once in the hidden input. */
  multiple?: boolean;
  /** Called with the attachment `id` when its remove control is activated. */
  onRemoveAttachment?: (id: string) => void;
  /** Called with the current value and attachments when the user submits. */
  onSubmit: (value: string, attachments: AgentAttachment[]) => void;
  /**
   * When `true`, the send button becomes a stop button. Clicking it calls
   * `onStop` instead of `onSubmit`.
   */
  busy?: boolean;
  /** Called when the busy stop button is activated. */
  onStop?: () => void;
  /** Disables the textarea and all controls. */
  disabled?: boolean;
  placeholder?: string;
  /** Auto-grow the textarea with content. Forwarded to the Kumo `Textarea`. */
  autoResize?: boolean;
  /** Minimum rows when `autoResize` is enabled. */
  minRows?: number;
  /** Maximum rows when `autoResize` is enabled. */
  maxRows?: number;
  /** When `true`, pressing Enter submits instead of inserting a newline. Shift+Enter always inserts a newline. */
  submitOnEnter?: boolean;
  labels?: Partial<AgentComposerLabels>;
  slots?: Partial<AgentComposerSlots>;
  className?: string;
  style?: CSSProperties;
}

const defaultLabels: AgentComposerLabels = {
  composer: "Message composer",
  actions: "Composer actions",
  input: "Message",
  addAttachments: "Add attachments",
  send: "Send message",
  stop: "Stop",
  attachments: "Attachments",
  attachment: "Attachment {name}",
  removeAttachment: "Remove {name}"
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

export const AgentComposer = forwardRef<HTMLFormElement, AgentComposerProps>(
  function AgentComposer(
    {
      value,
      onValueChange,
      attachments = [],
      onAddAttachments,
      accept,
      multiple,
      onRemoveAttachment,
      onSubmit,
      busy,
      onStop,
      disabled,
      placeholder,
      autoResize,
      minRows,
      maxRows,
      submitOnEnter,
      labels,
      slots,
      className,
      style,
      "aria-label": ariaLabel,
      ...rest
    },
    ref
  ) {
    const label: AgentComposerLabels = { ...defaultLabels, ...labels };
    const fileInputRef = useRef<HTMLInputElement>(null);

    const hasAttachments = attachments.length > 0;
    const canSubmit = Boolean(
      !disabled && !busy && (value.trim().length > 0 || hasAttachments)
    );

    const handleSubmit = () => {
      if (!canSubmit) return;
      onSubmit(value, attachments);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (submitOnEnter && event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
        event.preventDefault();
        handleSubmit();
      }
    };

    const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      handleSubmit();
    };

    const handleFileChange = () => {
      const input = fileInputRef.current;
      if (!input?.files) return;
      onAddAttachments?.(input.files);
      input.value = "";
    };

    return (
      <form
        ref={ref}
        className={joinClass("agent-ui-composer", className)}
        data-agent-ui-composer=""
        data-busy={busy ? "true" : "false"}
        data-disabled={disabled ? "true" : "false"}
        data-has-attachments={hasAttachments ? "true" : "false"}
        aria-label={ariaLabel ?? label.composer}
        style={style}
        onSubmit={handleFormSubmit}
        {...rest}
      >
        {slots?.leading}

        {hasAttachments && (
          <ul
            className="agent-ui-composer__attachments"
            role="list"
            aria-label={label.attachments}
            data-agent-ui-attachments=""
          >
            {attachments.map((attachment, index) => (
              <li
                key={attachment.id}
                className="agent-ui-composer__chip"
                data-agent-ui-attachment=""
                data-attachment-id={attachment.id}
                data-attachment-name={attachment.name}
                aria-label={label.attachment.replace("{name}", attachment.name)}
              >
                {slots?.attachment ? slots.attachment(attachment, index) : (
                  <>
                    {isImage(attachment.mediaType) && attachment.previewUrl ? (
                      <img
                        className="agent-ui-composer__chip-preview"
                        src={attachment.previewUrl}
                        alt=""
                        aria-hidden="true"
                      />
                    ) : null}
                    <span className="agent-ui-composer__chip-name">{attachment.name}</span>
                    {attachment.size !== undefined && (
                      <Text as="span" variant="secondary" size="xs" DANGEROUS_className="agent-ui-composer__chip-size">
                        {formatSize(attachment.size)}
                      </Text>
                    )}
                  </>
                )}
                {onRemoveAttachment && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    shape="square"
                    icon={XIcon}
                    disabled={disabled || busy}
                    aria-label={label.removeAttachment.replace("{name}", attachment.name)}
                    className="agent-ui-composer__chip-remove"
                    data-agent-ui-remove-attachment=""
                    onClick={() => onRemoveAttachment(attachment.id)}
                  />
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="agent-ui-composer__input-row">
          <Textarea
            aria-label={label.input}
            value={value}
            onValueChange={onValueChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            autoResize={autoResize}
            minRows={minRows}
            maxRows={maxRows}
            data-agent-ui-textarea=""
            className="agent-ui-composer__textarea"
          />

          {slots?.actions ?? (
            <div className="agent-ui-composer__actions" role="group" aria-label={label.actions}>
              {onAddAttachments && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  shape="square"
                  icon={PaperclipIcon}
                  disabled={disabled || busy}
                  aria-label={label.addAttachments}
                  className="agent-ui-composer__attach"
                  data-agent-ui-attach=""
                  onClick={() => fileInputRef.current?.click()}
                />
              )}
              <Button
                type={busy ? "button" : "submit"}
                variant="primary"
                size="sm"
                shape="square"
                icon={busy ? StopIcon : PaperPlaneTiltIcon}
                disabled={disabled || (!busy && !canSubmit)}
                aria-label={busy ? label.stop : label.send}
                className="agent-ui-composer__submit"
                data-agent-ui-submit=""
                data-submit-state={busy ? "stop" : "send"}
                onClick={busy ? onStop : undefined}
              />
            </div>
          )}
        </div>

        {onAddAttachments && (
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            multiple={multiple}
            disabled={disabled || busy}
            tabIndex={-1}
            aria-hidden="true"
            className="agent-ui-composer__file-input"
            data-agent-ui-file-input=""
            onChange={handleFileChange}
          />
        )}

        {slots?.footer}
      </form>
    );
  }
);

AgentComposer.displayName = "AgentComposer";
