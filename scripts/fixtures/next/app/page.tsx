import * as stylex from '@stylexjs/stylex'
import { darkTheme } from '@pretty-amped/foundations/themes'
import { Client } from './client'

export default function Page() {
  return <main data-theme="dark" {...stylex.props(darkTheme)}><Client /></main>
}
