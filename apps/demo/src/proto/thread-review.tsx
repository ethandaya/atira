import '@fontsource-variable/geist/wght.css'
import '@fontsource-variable/geist-mono/wght.css'
import '../global.css'
import { ChatSession, useChatStore } from '@pretty-amped/blocks'
import { darkTheme, lightTheme } from '@pretty-amped/foundations/themes'
import { colors, space, type } from '@pretty-amped/foundations/tokens.stylex'
import { Button } from '@pretty-amped/primitives'
import * as stylex from '@stylexjs/stylex'
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import { NanocodexChatStore } from '../nanocodex-store'
import { captureThread, playbackStore, type Frame, type Note, type Target } from './thread-recording'

type Theme = 'light' | 'dark'
type ReplayMessage = { type: 'thread-review-frame'; frame: Frame; theme: Theme; reset: boolean }
const root = createRoot(document.getElementById('root')!)

if (new URLSearchParams(location.search).has('playback')) {
  let replay: ReturnType<typeof playbackStore> | undefined
  let generation = 0
  // A separate browsing context freezes timers without touching live runtime time.
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== parent || event.data?.type !== 'thread-review-frame') return
    const message = event.data as ReplayMessage
    Date.now = () => message.frame.at
    if (!replay || message.reset) {
      replay = playbackStore(message.frame.snapshot)
      generation++
    } else replay.update(message.frame.snapshot)
    root.render(<Replay key={generation} replay={replay} theme={message.theme} />)
  })
  parent.postMessage({ type: 'thread-review-ready' }, location.origin)
} else root.render(<Review />)

function Replay({ replay, theme }: { replay: ReturnType<typeof playbackStore>; theme: Theme }) {
  const snapshot = useChatStore(replay.store)
  useLayoutEffect(() => {
    // Evidence disclosures remain inspectable. Mutation controls are visibly
    // disabled and removed from the tab order, not fake functional controls.
    document.querySelectorAll<HTMLElement>('[data-slot="chat-session-dock"]').forEach(element => { element.inert = true })
    document.querySelectorAll<HTMLButtonElement>('button:not([aria-expanded])').forEach(button => { button.disabled = true })
    parent.postMessage({ type: 'thread-review-rendered' }, location.origin)
  }, [snapshot])
  return <div {...stylex.props(theme === 'dark' ? darkTheme : lightTheme, styles.replay)}>
    <ChatSession label="Recorded conversation" store={replay.store} />
  </div>
}

function Review() {
  const [store] = useState(() => new NanocodexChatStore())
  const snapshot = useChatStore(store)
  const runtime = useSyncExternalStore(store.subscribe, store.getRuntimeSnapshot)
  const conversations = useSyncExternalStore(store.subscribe, store.getConversations)
  const [frames, setFrames] = useState<Frame[]>([])
  const [cursor, setCursor] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [theme, setTheme] = useState<Theme>(() => matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  const [ready, setReady] = useState(false)
  const [picking, setPicking] = useState(false)
  const [target, setTarget] = useState<Target | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState('')
  const [saving, setSaving] = useState(false)
  const iframe = useRef<HTMLIFrameElement>(null)
  const preview = useRef<HTMLDivElement>(null)
  const live = useRef<HTMLDivElement>(null)
  const outline = useRef<HTMLDivElement>(null)
  const reset = useRef(true)
  const replayTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const index = cursor ?? frames.length - 1
  const frame = frames[index]
  const nextFrame = cursor === null ? undefined : frames[cursor + 1]

  useEffect(() => {
    const stop = captureThread(store, frame => setFrames(current => current.length >= 1000 ? current : [...current, frame]))
    void store.initialize()
    window.addEventListener('pagehide', store.persist)
    return () => { stop(); clearTimeout(replayTimer.current); window.removeEventListener('pagehide', store.persist); store.dispose() }
  }, [store])

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== iframe.current?.contentWindow || event.origin !== location.origin) return
      if (event.data?.type === 'thread-review-ready') setReady(true)
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [])

  useEffect(() => {
    if (!ready || cursor === null || !frame) return
    iframe.current?.contentWindow?.postMessage({ type: 'thread-review-frame', frame, theme, reset: reset.current } satisfies ReplayMessage, location.origin)
    reset.current = false
  }, [frame, cursor, ready, theme])

  useEffect(() => {
    if (!playing || cursor === null) return
    if (!nextFrame || !frame) { setPlaying(false); return }
    const timer = setTimeout(() => setCursor(cursor + 1), Math.max(16, (nextFrame.at - frame.at) / speed))
    return () => clearTimeout(timer)
  }, [playing, cursor, frame, nextFrame, speed])

  useEffect(() => {
    const pause = () => { if (document.hidden) setPlaying(false) }
    document.addEventListener('visibilitychange', pause)
    return () => document.removeEventListener('visibilitychange', pause)
  }, [])

  function seek(value: number | null) {
    clearTimeout(replayTimer.current)
    reset.current = true
    setPlaying(false)
    setCursor(value)
    setTarget(null)
    setPicking(false)
  }

  function replayTransition() {
    if (index < 1) return
    const destination = index
    seek(index - 1)
    setTarget(target)
    // Mount the before state without an entrance, then update the same component
    // tree so the actual library's presence/layout transitions run unchanged.
    replayTimer.current = setTimeout(() => setCursor(destination), 350)
  }

  useEffect(() => {
    const doc = cursor === null ? document : iframe.current?.contentDocument
    if (!doc || !preview.current) return
    const select = (event: MouseEvent) => {
      if (!picking || !(event.target instanceof (doc.defaultView!.Element))) return
      const element = (event.target as Element).closest<HTMLElement>('[data-slot]')
      if (!element || (cursor === null && !live.current?.contains(element))) return
      event.preventDefault()
      event.stopPropagation()
      const tool = element.closest<HTMLElement>('[data-tool-activity-id]')
      const turn = element.closest<HTMLElement>('[data-turn-id]')
      const scopeRoot = tool ?? turn ?? doc.body
      const scope = tool ? `[data-tool-activity-id="${CSS.escape(tool.dataset.toolActivityId!)}"]` : turn ? `[data-turn-id="${CSS.escape(turn.dataset.turnId!)}"]` : 'body'
      const path: string[] = []
      let current: Element = element
      while (current !== scopeRoot && current.parentElement) {
        path.unshift(`${current.tagName.toLowerCase()}:nth-child(${Array.from(current.parentElement.children).indexOf(current) + 1})`)
        current = current.parentElement
      }
      const slot = element.dataset.slot!
      setTarget({ slot, selector: [scope, ...path].join(' > '), text: element.textContent?.trim().slice(0, 160) ?? '' })
      setPicking(false)
    }
    doc.addEventListener('click', select, true)
    return () => doc.removeEventListener('click', select, true)
  }, [picking, cursor, ready])

  useEffect(() => {
    let animation = 0
    const update = () => {
      const scope = cursor === null ? live.current : iframe.current?.contentDocument
      const element = target && scope?.querySelector<HTMLElement>(target.selector)
      if (outline.current) {
        outline.current.hidden = !element
        if (element && preview.current) {
          const bounds = element.getBoundingClientRect()
          const container = preview.current.getBoundingClientRect()
          const offset = cursor === null ? { left: 0, top: 0 } : iframe.current!.getBoundingClientRect()
          Object.assign(outline.current.style, { left: `${bounds.left + offset.left - container.left}px`, top: `${bounds.top + offset.top - container.top}px`, width: `${bounds.width}px`, height: `${bounds.height}px` })
        }
      }
      if (target) animation = requestAnimationFrame(update)
    }
    update()
    return () => cancelAnimationFrame(animation)
  }, [target, cursor])

  async function save() {
    setSaving(true)
    setSaved('')
    const savedNotes = target && note.trim() ? [...notes, { frame: index, target, text: note.trim() }] : notes
    try {
      const response = await fetch('/__thread-review/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: 1, createdAt: new Date().toISOString(), frames, notes: savedNotes, cursor: index, theme, speed }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Could not save review')
      setSaved(result.path)
    } catch (error) { setSaved(error instanceof Error ? error.message : 'Could not save review') }
    finally { setSaving(false) }
  }

  return <main {...stylex.props(theme === 'dark' ? darkTheme : lightTheme, styles.app)}>
    <header {...stylex.props(styles.header)}>
      <h1 {...stylex.props(styles.title)}>Thread motion review</h1>
      <Button variant="quiet" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? 'Dark' : 'Light'} mode</Button>
    </header>
    <div {...stylex.props(styles.workspace)}>
      <div ref={preview} {...stylex.props(styles.preview)} data-review-mode={cursor === null ? 'live' : 'playback'}>
        <div ref={live} hidden={cursor !== null} {...stylex.props(styles.chat)}>
          <ChatSession label="Live conversation" store={store} empty={<p {...stylex.props(styles.hint)}>Send a message to capture working, subagents, tools, and the response.</p>} />
        </div>
        <iframe ref={iframe} onLoad={() => setReady(true)} title="Recorded conversation playback" src="/proto/thread-review/index.html?playback" hidden={cursor === null} {...stylex.props(styles.iframe)} />
        <div ref={outline} hidden aria-hidden="true" {...stylex.props(styles.outline)} />
      </div>
      <aside aria-label="Motion review controls" {...stylex.props(styles.panel)}>
        <div {...stylex.props(styles.row)}>
          <Button variant={cursor === null ? 'primary' : 'secondary'} onClick={() => seek(null)}>Live</Button>
          <span {...stylex.props(styles.hint)}>{cursor === null ? runtime.status === 'ready' ? 'Capturing' : runtime.status === 'loading' ? 'Connecting…' : 'Runtime unavailable' : 'Read-only playback'}</span>
        </div>
        <label {...stylex.props(styles.field)}>Conversation
          <select {...stylex.props(styles.input)} value={snapshot.sessionId} disabled={snapshot.activity.status !== 'idle' || cursor !== null} onChange={event => store.selectConversation(event.target.value)}>
            {!conversations.some(item => item.id === snapshot.sessionId) && <option value={snapshot.sessionId}>New conversation</option>}
            {conversations.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
        </label>
        <div {...stylex.props(styles.section)}>
          <label htmlFor="thread-state" {...stylex.props(styles.row)}>State {Math.max(0, index + 1)} of {frames.length}<span {...stylex.props(styles.hint, styles.time)}>{frame && frames[0] ? ((frame.at - frames[0].at) / 1000).toFixed(1) : '0.0'}s</span></label>
          <input id="thread-state" aria-label="Recorded state" type="range" min={0} max={Math.max(0, frames.length - 1)} value={Math.max(0, index)} disabled={frames.length < 2} onChange={event => seek(Number(event.target.value))} {...stylex.props(styles.slider)} />
          <select aria-label="Jump to captured state" value={Math.max(0, index)} onChange={event => seek(Number(event.target.value))} {...stylex.props(styles.input)}>
            {frames.map((frame, index) => <option key={index} value={index}>{index + 1}. {frame.label}</option>)}
          </select>
          <div {...stylex.props(styles.row)}>
            <Button disabled={index < 1} onClick={() => seek(index - 1)}>Previous</Button>
            <Button disabled={frames.length < 2} onClick={() => {
              clearTimeout(replayTimer.current)
              if (playing) { setPlaying(false); return }
              if (cursor === null || index === frames.length - 1) { reset.current = true; setCursor(0) }
              setTarget(null); setPicking(false); setPlaying(true)
            }}>{playing ? 'Pause' : 'Play'}</Button>
            <Button disabled={index >= frames.length - 1} onClick={() => seek(index + 1)}>Next</Button>
          </div>
          <Button disabled={index < 1 || !ready} onClick={replayTransition}>Replay transition</Button>
          <label {...stylex.props(styles.field)}>Playback speed
            <select value={speed} onChange={event => setSpeed(Number(event.target.value))} {...stylex.props(styles.input)}>
              {[0.25, 0.5, 1, 2].map(value => <option key={value} value={value}>{value}×</option>)}
            </select>
          </label>
          <p {...stylex.props(styles.hint)}>Captured from this tab. Earlier transitions cannot be recovered. Playback never reruns requests; speed changes event timing, not animation duration.</p>
          {frames.length >= 1000 && <p role="status" {...stylex.props(styles.hint)}>Capture stopped at 1,000 states. Save this recording before reloading. Your live chat is unaffected.</p>}
        </div>
        <form {...stylex.props(styles.section)} onSubmit={event => {
          event.preventDefault()
          if (!target || !note.trim()) return
          setNotes(current => [...current, { frame: index, target, text: note.trim() }])
          setNote(''); setSaved('')
        }}>
          <Button aria-pressed={picking} onClick={() => {
            if (cursor === null) seek(index)
            setPlaying(false); setPicking(!picking)
          }}>{picking ? 'Click a component…' : 'Select component'}</Button>
          <p {...stylex.props(styles.hint)}>{target ? `${target.slot} · state ${index + 1}` : 'Pause on a state, select the element, then describe what should animate.'}</p>
          <label {...stylex.props(styles.field)}>Animation note
            <textarea {...stylex.props(styles.input, styles.textarea)} value={note} onChange={event => setNote(event.target.value)} placeholder="What should enter, move, or stay in place?" />
          </label>
          <Button type="submit" disabled={!target || !note.trim()}>Add note</Button>
        </form>
        {notes.map((note, position) => <button key={position} {...stylex.props(styles.note)} onClick={() => { seek(note.frame); setTarget(note.target) }}>
          <span {...stylex.props(styles.hint)}>State {note.frame + 1} · {note.target.slot}</span>
          <span>{note.text}</span>
        </button>)}
        <Button disabled={saving || !frames.length} onClick={() => void save()}>{saving ? 'Saving…' : 'Save review'}</Button>
        {saved && <p role="status" {...stylex.props(styles.hint, styles.path)}>{saved}</p>}
      </aside>
    </div>
  </main>
}

const styles = stylex.create({
  app: { backgroundColor: colors.canvas, color: colors.text, minBlockSize: '100dvh', fontSize: type.sizeSmall, fontFamily: type.family, lineHeight: type.lineBody },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBlock: space.x3, paddingInline: space.x6 },
  title: { fontSize: type.sizeHeading, fontWeight: type.weightMedium, margin: 0 },
  workspace: { display: 'grid', gridTemplateColumns: { default: 'minmax(0, 1fr) 320px', '@media (max-width: 760px)': 'minmax(0, 1fr)' }, gap: space.x6, paddingInline: { default: space.x6, '@media (max-width: 760px)': space.x3 }, paddingBlockEnd: space.x4 },
  preview: { position: 'relative', overflow: 'hidden', minInlineSize: 0, blockSize: { default: 'calc(100dvh - 90px)', '@media (max-width: 760px)': '60dvh' } },
  chat: { blockSize: '100%', maxInlineSize: '54rem', marginInline: 'auto' },
  replay: { backgroundColor: colors.canvas, color: colors.text, blockSize: '100dvh', maxInlineSize: '54rem', marginInline: 'auto' },
  iframe: { borderWidth: 0, inlineSize: '100%', blockSize: '100%' },
  outline: { position: 'absolute', pointerEvents: 'none', borderRadius: '4px', outline: `2px solid ${colors.focus}`, outlineOffset: '3px' },
  panel: { display: 'grid', gridAutoRows: 'max-content', alignContent: 'start', gap: space.x5, padding: space.x4, backgroundColor: colors.surfaceInset, borderRadius: '12px', maxBlockSize: { default: 'calc(100dvh - 90px)', '@media (max-width: 760px)': 'none' }, overflowY: 'auto' },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: space.x2 },
  section: { display: 'flex', flexDirection: 'column', gap: space.x3 },
  field: { display: 'flex', flexDirection: 'column', gap: space.x2 },
  input: { inlineSize: '100%', minInlineSize: 0, minBlockSize: '44px', border: `1px solid ${colors.borderStrong}`, borderRadius: '8px', padding: space.x2, backgroundColor: colors.surface, color: colors.text, fontSize: '16px', ':focus-visible': { outline: `2px solid ${colors.textMuted}`, outlineOffset: '2px' } },
  slider: { inlineSize: '100%', minBlockSize: '44px', margin: 0, accentColor: colors.accent, touchAction: 'pan-y' },
  textarea: { minBlockSize: '96px', resize: 'vertical' },
  hint: { color: colors.textMuted, fontSize: type.sizeCaption, margin: 0, textWrap: 'pretty' },
  time: { fontVariantNumeric: 'tabular-nums' },
  path: { overflowWrap: 'anywhere' },
  note: { display: 'flex', flexDirection: 'column', gap: space.x1, textAlign: 'start', color: colors.text, backgroundColor: colors.surface, borderWidth: 0, borderRadius: '8px', padding: space.x3, minBlockSize: '44px', cursor: 'pointer', ':focus-visible': { outline: `2px solid ${colors.textMuted}`, outlineOffset: '2px' } },
})
