import '@fontsource-variable/geist/wght.css'
import '@fontsource-variable/geist-mono/wght.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './global.css'

const root = document.getElementById('root')

if (!root) {
  throw new Error('Missing root element')
}

const parameters = new URLSearchParams(window.location.search)
const gateway = parameters.get('view') === 'playground' || parameters.has('fixture')
const App = gateway
  ? (await import('./app')).App
  : (await import('./catalog-app')).CatalogApp

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
