import { describe, expect, it } from 'vitest'

import { translateProviderEvent } from './provider-stream.ts'

describe('provider stream translation', () => {
  it('translates assistant and reasoning events', () => {
    expect(
      translateProviderEvent({
        payload: { text: 'Hello' },
        type: 'assistant.delta',
      }),
    ).toEqual({ text: 'Hello', type: 'assistant-delta' })
    expect(
      translateProviderEvent({
        payload: { text: 'Done' },
        type: 'assistant.message',
      }),
    ).toEqual({ text: 'Done', type: 'assistant-message' })
    expect(
      translateProviderEvent({
        payload: { text: 'Checking' },
        type: 'reasoning.summary.delta',
      }),
    ).toEqual({ text: 'Checking', type: 'reasoning-delta' })
  })

  it('preserves supported and provider-native tool presentation', () => {
    expect(
      translateProviderEvent({
        payload: {
          arguments: { query: 'button' },
          call_id: 'catalog',
          tool: 'inspect_component_catalog',
        },
        type: 'tool.call',
      }),
    ).toEqual({
      id: 'catalog',
      input: 'button',
      summary: 'Searching component catalog',
      tool: 'inspect_component_catalog',
      type: 'tool-started',
    })
    expect(
      translateProviderEvent({
        payload: {
          call_id: 'web',
          status: 'failed',
          tool: 'search_web',
        },
        type: 'tool.result',
      }),
    ).toEqual({
      error: 'The web search failed.',
      id: 'web',
      status: 'failed',
      summary: 'Searched the web',
      tool: 'search_web',
      type: 'tool-completed',
    })
    expect(
      translateProviderEvent({
        payload: {
          arguments: {},
          call_id: 'native',
          tool: 'list_agents',
        },
        type: 'tool.call',
      }),
    ).toEqual({
      id: 'native',
      input: '{}',
      summary: 'list_agents',
      tool: 'list_agents',
      type: 'tool-started',
    })
  })
})
