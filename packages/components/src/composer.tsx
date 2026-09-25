import {
  chatAppearance,
  colors,
  motion,
  radii,
  space,
} from '@atira/foundations/tokens.stylex'
import {
  IconButton,
  TextareaField,
  resolveStyleProps,
  type StyleProps,
} from '@atira/primitives'
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

type ComposerBaseProps = NativeFormProps &
  StyleProps & {
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
  className,
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
  style,
  textareaRef,
  value,
  xstyle,
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
      {...resolveStyleProps(styles.root, xstyle, className, style)}
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
        <IconButton
          aria-label={active ? 'Stop' : sendLabel}
          disabled={!active && !canSubmit}
          iconSize="small"
          onClick={active ? onStop : undefined}
          title={active ? 'Stop response' : sendLabel}
          type={active ? 'button' : 'submit'}
          variant="primary"
        >
          {active ? (
            <Square fill="currentColor" size={16} strokeWidth={1.75} />
          ) : (
            <SendHorizontal size={16} strokeWidth={1.75} />
          )}
        </IconButton>
      </div>
    </form>
  )
}

const styles = stylex.create({
  root: {
    backgroundColor: colors.surfaceRaised,
    borderColor: 'transparent',
    borderRadius: radii.panel,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxShadow: chatAppearance.composerShadow,
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
    outlineOffset: chatAppearance.composerFocusOffset,
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
    backgroundColor: chatAppearance.composerToolbarSurface,
    margin: '0 6px 6px',
    display: 'flex',
    flexShrink: 0,
    gap: space.x2,
    justifyContent: 'space-between',
    minBlockSize: '2.5rem',
    paddingBlock: space.x1,
    paddingInline: space.x2,
  },
  actions: {
    alignItems: 'center',
    display: 'flex',
    gap: space.x1,
    minInlineSize: 0,
  },
})
