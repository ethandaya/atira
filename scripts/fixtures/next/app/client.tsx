'use client'

import { useState } from 'react'
import { Button } from '@pretty-amped/primitives/button'

export function Client() {
  const [on, setOn] = useState(false)
  return <Button variant="primary" onClick={() => setOn(true)}>{on ? 'Hydrated' : 'Theme sample'}</Button>
}
