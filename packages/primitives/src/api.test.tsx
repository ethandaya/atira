// @vitest-environment jsdom

import { cleanup, fireEvent, render } from '@testing-library/react'
import type * as stylex from '@stylexjs/stylex'
import { createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@stylexjs/stylex', () => ({
  create: <Styles,>(styles: Styles) => styles,
  createTheme: () => ({}),
  defineVars: <Vars,>(variables: Vars) => variables,
  firstThatWorks: (...values: string[]) => values[0],
  keyframes: () => '',
  props: (...styles: unknown[]) => {
    const flattened = styles.flat(Infinity).filter(Boolean) as Array<
      Record<string, unknown>
    >
    return {
      className: flattened.map((_, index) => `sx-${index}`).join(' '),
      style: Object.assign({}, ...flattened),
    }
  },
}))

import { Button } from './button'
import { CheckboxField } from './choice'
import { Disclosure } from './disclosure'
import { Progress } from './progress'
import { Status } from './status'
import { resolveStyleProps } from './style-props'
import { TextField } from './text-field'

afterEach(cleanup)

describe('public primitive API contracts', () => {
  it('merges defaults, xstyle, ordinary classes, and inline styles predictably', () => {
    const result = resolveStyleProps(
      {
        color: 'red',
        '--dynamic': 'default',
      } as unknown as stylex.StyleXStyles,
      {
        color: 'blue',
        backgroundColor: 'black',
        '--dynamic': 'override',
      } as unknown as stylex.StyleXStyles,
      'consumer-class',
      {
        backgroundColor: 'white',
        '--dynamic': 'inline',
      } as React.CSSProperties,
    )

    expect(result.className).toContain('consumer-class')
    expect(result.style).toMatchObject({
      color: 'blue',
      backgroundColor: 'white',
      '--dynamic': 'inline',
    })
  })

  it('forwards native props and refs through leaf controls', () => {
    const buttonRef = createRef<HTMLButtonElement>()
    const inputRef = createRef<HTMLInputElement>()
    const onClick = vi.fn()
    const { getByRole } = render(
      <>
        <Button
          ref={buttonRef}
          className="consumer"
          data-test="button"
          onClick={onClick}
        >
          Run
        </Button>
        <TextField ref={inputRef} data-test="input" label="Name" />
      </>,
    )

    fireEvent.click(getByRole('button', { name: 'Run' }))
    expect(onClick).toHaveBeenCalledOnce()
    expect(buttonRef.current?.getAttribute('data-test')).toBe('button')
    expect(buttonRef.current?.className).toContain('consumer')
    expect(inputRef.current?.getAttribute('data-test')).toBe('input')
  })

  it('associates checkbox labels with the native checkbox input', () => {
    const onCheckedChange = vi.fn()
    const { container, getByRole } = render(
      <CheckboxField
        checked={false}
        label="Include archived"
        onCheckedChange={onCheckedChange}
      />,
    )

    const label = container.querySelector('label')
    const input = container.querySelector('input[type="checkbox"]')
    expect(label?.htmlFor).toBe(input?.id)

    fireEvent.click(getByRole('checkbox', { name: 'Include archived' }))
    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })

  it('forwards native props, refs, styles, and key callbacks through display leaves', () => {
    const disclosureRef = createRef<HTMLDivElement>()
    const progressRef = createRef<HTMLDivElement>()
    const statusRef = createRef<HTMLSpanElement>()
    const onKeyDown = vi.fn()
    const { getByTestId } = render(
      <>
        <Disclosure
          ref={disclosureRef}
          data-testid="disclosure"
          onKeyDown={onKeyDown}
          className="consumer"
          style={{ marginTop: 3 }}
          summary="Details"
        >
          Evidence
        </Disclosure>
        <Progress
          ref={progressRef}
          data-testid="progress"
          label="Upload"
          value={25}
        />
        <Status ref={statusRef} data-testid="status">
          Ready
        </Status>
      </>,
    )

    fireEvent.keyDown(getByTestId('disclosure'), { key: 'Enter' })
    expect(onKeyDown).toHaveBeenCalledOnce()
    expect(disclosureRef.current?.className).toContain('consumer')
    expect(disclosureRef.current?.style.marginTop).toBe('3px')
    expect(progressRef.current).toBe(getByTestId('progress'))
    expect(statusRef.current).toBe(getByTestId('status'))
  })
})
