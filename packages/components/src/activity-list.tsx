import { colors, radii, space, type } from '@atiraui/foundations/tokens.stylex'
import { Disclosure } from '@atiraui/primitives'
import * as stylex from '@stylexjs/stylex'
import {
  Children,
  type ComponentPropsWithRef,
  type ReactElement,
  type ReactNode,
} from 'react'
import type { ActivityProps } from './activity'
import type { ToolActivityProps } from './tool-activity'

export type ActivityListItem = ReactElement<ActivityProps | ToolActivityProps>

export type ActivityListDisplay =
  | { mode?: 'expanded' }
  | {
      mode: 'disclosed'
      onOpenChange: (open: boolean) => void
      open: boolean
    }

type NativeSectionProps = Omit<
  ComponentPropsWithRef<'section'>,
  'aria-label' | 'children' | 'className' | 'id' | 'style'
>

export type ActivityListProps = NativeSectionProps &
  ActivityListDisplay & {
    children?: ActivityListItem | readonly ActivityListItem[]
    empty?: ReactNode
    headingLevel?: 2 | 3 | 4 | 5 | 6
    id: string
    label: string
  }

export function ActivityList({
  children,
  empty = 'No activity yet.',
  headingLevel = 2,
  id,
  label,
  ...props
}: ActivityListProps) {
  const items = Children.toArray(children)
  const isEmpty = items.length === 0
  const isDisclosed = props.mode === 'disclosed'
  const Heading = `h${headingLevel}` as const
  const state = isEmpty
    ? 'empty'
    : isDisclosed && !props.open
      ? 'collapsed'
      : 'expanded'
  const sectionProps: NativeSectionProps = isDisclosed
    ? (({ mode: _mode, onOpenChange: _onOpenChange, open: _open, ...native }) =>
        native)(props)
    : (({ mode: _mode, ...native }) => native)(props)
  const list = isEmpty ? (
    <p data-slot="activity-list-empty" {...stylex.props(styles.empty)}>
      {empty}
    </p>
  ) : (
    <ol data-slot="activity-list-items" {...stylex.props(styles.list)}>
      {Children.map(items, (item) => (
        <li data-slot="activity-list-item">{item}</li>
      ))}
    </ol>
  )

  return (
    <section
      {...sectionProps}
      id={id}
      aria-label={label}
      data-activity-list-id={id}
      data-slot="activity-list"
      data-state={state}
      {...stylex.props(styles.root)}
    >
      {isDisclosed ? (
        <Disclosure
          open={props.open}
          onOpenChange={props.onOpenChange}
          summary={label}
        >
          {list}
        </Disclosure>
      ) : (
        <>
          <Heading
            data-slot="activity-list-title"
            {...stylex.props(styles.title)}
          >
            {label}
          </Heading>
          {list}
        </>
      )}
    </section>
  )
}

const styles = stylex.create({
  root: {
    borderRadius: radii.surface,
    boxSizing: 'border-box',
    inlineSize: '100%',
    minInlineSize: 0,
    overflow: 'hidden',
  },
  title: {
    color: colors.text,
    fontFamily: type.family,
    fontSize: type.sizeSmall,
    fontWeight: type.weightMedium,
    lineHeight: type.lineCompact,
    margin: 0,
    padding: space.x3,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x2,
    listStyle: 'none',
    margin: 0,
    minInlineSize: 0,
    padding: 0,
  },
  empty: {
    color: colors.textMuted,
    fontFamily: type.family,
    fontSize: type.sizeSmall,
    lineHeight: type.lineBody,
    margin: 0,
    padding: space.x4,
    textAlign: 'center',
  },
})
