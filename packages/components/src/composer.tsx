import {
  colors,
  motion,
  radii,
  space,
} from '@pretty-amped/foundations/tokens.stylex'
import { Button, TextareaField } from '@pretty-amped/primitives'
import * as stylex from '@stylexjs/stylex'
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
        disabled={disabled || active}
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
          <Button onClick={onStop} variant="secondary">
            Stop
          </Button>
        ) : (
          <Button disabled={!canSubmit} type="submit" variant="primary">
            {sendLabel}
          </Button>
        )}
      </div>
    </form>
  )
}

const styles = stylex.create({
  root: {
    backgroundColor: colors.surface,
    borderColor: {
      default: colors.border,
      ':hover': {
        default: null,
        '@media (hover: hover) and (pointer: fine)': colors.borderStrong,
      },
    },
    borderRadius: radii.surface,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: space.x1,
    inlineSize: '100%',
    outlineColor: {
      default: 'transparent',
      ':focus-within': colors.focus,
    },
    outlineOffset: '2px',
    outlineStyle: 'solid',
    outlineWidth: '2px',
    padding: space.x2,
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
    gap: space.x2,
    justifyContent: 'space-between',
  },
  actions: {
    alignItems: 'center',
    display: 'flex',
    gap: space.x1,
    minBlockSize: '2.75rem',
    minInlineSize: 0,
  },
})
