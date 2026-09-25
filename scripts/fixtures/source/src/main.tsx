import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import * as stylex from '@stylexjs/stylex'
import { darkTheme } from '@pretty-amped/foundations/themes'
import { Button } from '@pretty-amped/primitives'
import './host.css'

const hostStyles = stylex.create({ button: { backgroundColor: 'rgb(23, 45, 67)', color: 'rgb(210, 220, 230)' } })

function App() {
  const [clicked, setClicked] = useState(false)
  return <main {...stylex.props(darkTheme)}><Button variant="primary" xstyle={hostStyles.button} onClick={() => setClicked(true)}>{clicked ? 'Source verified' : 'Source check'}</Button></main>
}

createRoot(document.getElementById('root')!).render(<App />)
