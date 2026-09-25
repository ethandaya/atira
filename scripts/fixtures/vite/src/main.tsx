import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import * as stylex from '@stylexjs/stylex'
import { darkTheme } from '@pretty-amped/foundations/themes'
import { Button } from '@pretty-amped/primitives/button'
import { SelectPicker } from '@pretty-amped/primitives/select-picker'
import { Message } from '@pretty-amped/components/message'
import { JumpToLatest } from '@pretty-amped/blocks/timeline'
import '@pretty-amped/foundations/styles.css'
import '@pretty-amped/primitives/styles.css'
import '@pretty-amped/components/styles.css'
import '@pretty-amped/blocks/styles.css'

const hostStyles = stylex.create({
  override: { backgroundColor: 'rgb(12, 34, 56)' },
  dynamic: (color: string) => ({ color }),
})

function App() {
  const [clicked, setClicked] = useState(false)
  const [choice, setChoice] = useState('')
  return (
    <main data-theme="dark" {...stylex.props(darkTheme)}>
      <Button
        xstyle={[hostStyles.override, hostStyles.dynamic('rgb(210, 220, 230)')]}
        className="consumer-class"
        style={{ outlineWidth: '3px' }}
        variant="primary"
        onClick={() => setClicked(true)}
      >
        {clicked ? 'Verified' : 'Check integration'}
      </Button>
      <Button variant="primary">Theme sample</Button>
      <SelectPicker
        label="Model"
        value={choice}
        onValueChange={setChoice}
        options={[
          { label: 'Fast', value: 'fast' },
          { label: 'Deep', value: 'deep' },
        ]}
      />
      <output>{choice}</output>
      <Message actor="assistant">Component leaf</Message>
      <JumpToLatest pendingCount={1} onJump={() => {}} />
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
