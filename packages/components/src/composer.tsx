import {
  colors,
  motion,
  radii,
  space,
} from '@pretty-amped/foundations/tokens.stylex'
import { IconButton, TextareaField } from '@pretty-amped/primitives'
import * as stylex from '@stylexjs/stylex'
import { SendHorizontal, Square } from 'lucide-react'
import type {
  ComponentPropsWithRef,
  FormEvent,
  KeyboardEvent,
  ReactNode,
  Ref,
} from 'react'

type NativeFormProps = Omit<
  ComponentPropsWithRef<'form'>,
  'children' | 'className' | 'onSubmit' | 'style'
>

type ComposerBaseProps = NativeFormProps & {
  actions?: ReactNode
  composerLabel?: string
  inputLabel?: string
  maxLength?: number
  name?: string
  onSubmit: (value: string) => void
  onValueChange: (value: string) => void
  placeholder?: string
  sendLabel?: string
  textareaRef?: Ref<HTMLTextAreaElement>
  value: string
}

type PassiveComposerProps = ComposerBaseProps & {
  onStop?: never
  status?: 'idle' | 'disabled'
}

type ActiveComposerProps = ComposerBaseProps & {
  onStop: () => void
  status: 'submitting' | 'streaming'
}

export type ComposerProps = PassiveComposerProps | ActiveComposerProps

export function Composer({
  actions,
  composerLabel = 'Message composer',
  inputLabel = 'Message',
  maxLength,
  name,
  onStop,
  onSubmit,
  onValueChange,
  placeholder = 'Ask, describe, or paste…',
  ref,
  sendLabel = 'Send',
  status = 'idle',
  textareaRef,
  value,
  ...props
}: ComposerProps) {
  const disabled = status === 'disabled'
  const active = status === 'submitting' || status === 'streaming'
  const canSubmit = !disabled && !active && value.trim().length > 0

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (canSubmit) {
      onSubmit(value)
    }
  }

  function submitWithKeyboard(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === 'Enter' &&
      (event.metaKey || event.ctrlKey) &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
  }

  return (
    <form
      {...props}
      ref={ref}
      aria-busy={active || undefined}
      aria-label={composerLabel}
      onSubmit={submit}
      data-slot="composer"
      data-state={status}
      {...stylex.props(styles.root)}
    >
      <TextareaField
        autoComplete="off"
        disabled={disabled}
        label={inputLabel}
        labelHidden
        onKeyDown={submitWithKeyboard}
        onValueChange={onValueChange}
        placeholder={placeholder}
        ref={textareaRef}
        rows={1}
        value={value}
        variant="plain"
        {...(maxLength === undefined ? {} : { maxLength })}
        {...(name === undefined ? {} : { name })}
      />
      <div data-slot="composer-footer" {...stylex.props(styles.footer)}>
        <div
          role={actions ? 'group' : undefined}
          aria-label={actions ? 'Composer actions' : undefined}
          data-slot="composer-actions"
          {...stylex.props(styles.actions)}
        >
          {actions}
        </div>
        {active ? (
          <IconButton
            aria-label="Stop"
            iconSize="small"
            onClick={onStop}
            title="Stop response"
            variant="primary"
          >
            <Square fill="currentColor" size={16} strokeWidth={1.75} />
          </IconButton>
        ) : (
          <IconButton
            aria-label={sendLabel}
            disabled={!canSubmit}
            iconSize="small"
            title={sendLabel}
            type="submit"
            variant="primary"
          >
            <SendHorizontal size={16} strokeWidth={1.75} />
          </IconButton>
        )}
      </div>
    </form>
  )
}

const styles = stylex.create({
  root: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.surface,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'stretch',
    flexDirection: 'column',
    gap: 0,
    inlineSize: '100%',
    outlineColor: {
      default: 'transparent',
      ':focus-within': colors.focus,
    },
    outlineOffset: 0,
    outlineStyle: 'solid',
    outlineWidth: '3px',
    padding: 0,
    transitionDuration: {
      default: motion.durationFast,
      '@media (prefers-reduced-motion: reduce)': '0ms',
    },
    transitionProperty: 'background-color, border-color',
    transitionTimingFunction: motion.easingStandard,
  },
  footer: {
    alignItems: 'center',
    display: 'flex',
    flexShrink: 0,
    gap: space.x2,
    justifyContent: 'space-between',
    minBlockSize: '2.5rem',
    paddingBlockEnd: space.x2,
    paddingInline: space.x2,
  },
  actions: {
    alignItems: 'center',
    display: 'flex',
    gap: space.x1,
    minInlineSize: 0,
  },
})
