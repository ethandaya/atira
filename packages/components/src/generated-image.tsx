import type { GeneratedImageDescriptor } from '@pretty-amped/foundations/chat'
import {
  colors,
  motion,
  radii,
  space,
  type,
} from '@pretty-amped/foundations/tokens.stylex'
import {
  Button,
  Spinner,
  resolveStyleProps,
  type StyleProps,
} from '@pretty-amped/primitives'
import * as stylex from '@stylexjs/stylex'
import { Download, ArrowUpRight } from 'lucide-react'
import { useState, type ComponentPropsWithRef } from 'react'

type NativeFigureProps = Omit<
  ComponentPropsWithRef<'figure'>,
  'children' | 'className' | 'style'
>

export type GeneratedImageProps = NativeFigureProps &
  StyleProps & {
    label?: string
    state:
      | { status: 'generating' }
      | { status: 'failed'; error: string }
      | { status: 'ready'; image: GeneratedImageDescriptor }
  }

function useImageLoadState(image: GeneratedImageDescriptor | undefined) {
  const [loaded, setLoaded] = useState<string>()
  const [failed, setFailed] = useState<string>()
  const [attempt, setAttempt] = useState(0)
  const imageFailed = image !== undefined && failed === image.url

  return {
    attempt,
    imageFailed,
    loaded: image !== undefined && loaded === image.url,
    onError: () => image && setFailed(image.url),
    onLoad: () => image && setLoaded(image.url),
    retry: () => {
      setFailed(undefined)
      setAttempt((value) => value + 1)
    },
  }
}

export function GeneratedImage({
  className,
  label = 'Generated image',
  state,
  style,
  xstyle,
  ...props
}: GeneratedImageProps) {
  const image = state.status === 'ready' ? state.image : undefined
  const loadState = useImageLoadState(image)
  const loading =
    state.status === 'generating' ||
    (image !== undefined && !loadState.loaded && !loadState.imageFailed)
  return (
    <figure
      {...props}
      data-slot="generated-image"
      data-state={state.status}
      aria-label={label}
      aria-busy={loading || undefined}
      {...resolveStyleProps(styles.root, xstyle, className, style)}
    >
      <ImagePreview
        image={image}
        loading={loading}
        state={state}
        {...loadState}
      />
      <ImageActions
        image={image}
        visible={loadState.loaded && !loadState.imageFailed}
      />
    </figure>
  )
}

type ImageLoadState = ReturnType<typeof useImageLoadState>

function ImagePreview({
  image,
  loading,
  state,
  ...loadState
}: {
  image: GeneratedImageDescriptor | undefined
  loading: boolean
  state: GeneratedImageProps['state']
} & ImageLoadState) {
  return (
    <div {...stylex.props(styles.preview)}>
      {image && !loadState.imageFailed && (
        <img
          key={`${image.id}:${loadState.attempt}`}
          src={image.url}
          alt={image.alt}
          width={image.width}
          height={image.height}
          onLoad={loadState.onLoad}
          onError={loadState.onError}
          {...stylex.props(styles.image, !loadState.loaded && styles.hidden)}
        />
      )}
      {loading && (
        <div role="status" {...stylex.props(styles.status)}>
          <Spinner size="small" />
          <span>
            {state.status === 'generating'
              ? 'Generating image…'
              : 'Loading image…'}
          </span>
        </div>
      )}
      {(state.status === 'failed' || loadState.imageFailed) && (
        <div role="alert" {...stylex.props(styles.status)}>
          <span>
            {state.status === 'failed'
              ? state.error
              : 'This image could not be loaded.'}
          </span>
          {loadState.imageFailed && (
            <Button size="compact" variant="quiet" onClick={loadState.retry}>
              Retry loading
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function ImageActions({
  image,
  visible,
}: {
  image: GeneratedImageDescriptor | undefined
  visible: boolean
}) {
  return (
    <figcaption {...stylex.props(styles.actions)}>
      {image && visible && (
        <>
          <a
            href={image.url}
            target="_blank"
            rel="noopener noreferrer"
            {...stylex.props(styles.link)}
          >
            Open image <ArrowUpRight aria-hidden="true" size={14} />
          </a>
          <a
            href={image.downloadUrl ?? image.url}
            download="generated-image.png"
            {...stylex.props(styles.link)}
          >
            <Download aria-hidden="true" size={14} /> Download
          </a>
        </>
      )}
    </figcaption>
  )
}

const styles = stylex.create({
  root: {
    margin: 0,
    inlineSize: '100%',
    maxInlineSize: '24rem',
    minInlineSize: 0,
    fontFamily: type.family,
  },
  preview: {
    aspectRatio: '1',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.surface,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    display: 'block',
    inlineSize: '100%',
    blockSize: '100%',
    objectFit: 'contain',
    transitionProperty: 'opacity',
    transitionDuration: {
      default: motion.durationFast,
      '@media (prefers-reduced-motion: reduce)': '0ms',
    },
  },
  hidden: { opacity: 0 },
  status: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.x3,
    padding: space.x4,
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: type.sizeSmall,
    lineHeight: type.lineBody,
  },
  actions: {
    display: 'flex',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: space.x2,
    minBlockSize: '2.75rem',
  },
  link: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: space.x1,
    minBlockSize: '2.75rem',
    color: colors.textMuted,
    fontSize: type.sizeSmall,
    textDecoration: 'none',
    touchAction: 'manipulation',
    outline: { default: 'none', ':focus-visible': `2px solid ${colors.focus}` },
    outlineOffset: '2px',
  },
})
