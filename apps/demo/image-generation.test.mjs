import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { createImageGenerationTool, GeneratedImageStore, hasImageGenerationPlan } from './image-generation.mjs'
import { createChatGptSession, runChatGptTurn } from './chatgpt-runtime.mjs'

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='
const credential = { accountId: 'test-account', accessToken: `header.${Buffer.from(JSON.stringify({ 'https://api.openai.com/auth': { chatgpt_plan_type: 'plus' } })).toString('base64url')}.signature` }
const directories = []
afterEach(async () => { await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true }))) })

it('executes subscription image generation, privately stores the PNG and returns image context without streaming base64 to the browser', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pretty-images-'))
  directories.push(directory)
  const images = new GeneratedImageStore(directory)
  const imageRequest = vi.fn().mockResolvedValueOnce(new Response('', { status: 401 })).mockResolvedValueOnce(Response.json({ data: [{ b64_json: png }] }))
  const getCredential = vi.fn(async () => credential)
  const tool = createImageGenerationTool({ getCredential, images, owner: 'owner-a', request: imageRequest })
  const completed = output => new Response(`data: ${JSON.stringify({ type: 'response.completed', response: { output, usage: { input_tokens: 1, output_tokens: 1 } } })}\n\n`, { headers: { 'Content-Type': 'text/event-stream' } })
  const request = vi.fn()
    .mockResolvedValueOnce(completed([{ type: 'function_call', call_id: 'image-call', name: 'generate_image', arguments: JSON.stringify({ prompt: 'A black gravel bicycle' }) }]))
    .mockResolvedValueOnce(completed([{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Here is your image.' }] }]))
  const events = []
  await runChatGptTurn({ getCredential, input: 'Render my bicycle', model: 'test', session: createChatGptSession(), sessionId: 'test', request, tools: { generate_image: tool }, onEvent: event => events.push(structuredClone(event)) })
  const result = events.find(event => event.type === 'tool-completed')
  expect(result).toMatchObject({ status: 'succeeded', kind: 'image', image: { width: 1, height: 1, alt: 'A black gravel bicycle' } })
  expect(JSON.stringify(events)).not.toContain(png)
  expect(JSON.parse(request.mock.calls[1][1].body).input.find(item => item.type === 'function_call_output').output)
    .toContainEqual({ type: 'input_image', image_url: `data:image/png;base64,${png}`, detail: 'auto' })
  expect(imageRequest.mock.calls[1][0]).toBe('https://chatgpt.com/backend-api/codex/images/generations')
  expect(JSON.parse(imageRequest.mock.calls[1][1].body)).toMatchObject({ model: 'gpt-image-2', prompt: 'A black gravel bicycle', output_format: 'png' })
  expect(getCredential).toHaveBeenCalledWith({ forceRefresh: true })
  expect(await images.read('owner-a', result.image.id)).toEqual(Buffer.from(png, 'base64'))
  expect(await images.read('owner-b', result.image.id)).toBeUndefined()
  expect(await images.read('owner-a', '../../secret')).toBeUndefined()
  expect(await new GeneratedImageStore(directory).read('owner-a', result.image.id)).toBeDefined()
})

it('fails closed for missing plan metadata and does not save failed or cancelled generation', async () => {
  expect(hasImageGenerationPlan(undefined)).toBe(false)
  expect(hasImageGenerationPlan({ accessToken: 'invalid' })).toBe(false)
  const images = { save: vi.fn() }
  const failed = createImageGenerationTool({ getCredential: async () => credential, owner: 'owner', images, request: async () => new Response('', { status: 403 }) })
  await expect(failed.handler({ prompt: 'An image' }, { invocation: {} })).rejects.toThrow()
  const controller = new AbortController()
  const cancelled = createImageGenerationTool({ getCredential: async () => credential, owner: 'owner', images, request: async () => { controller.abort(); return Response.json({ data: [{ b64_json: png }] }) } })
  await expect(cancelled.handler({ prompt: 'An image' }, { invocation: {}, signal: controller.signal })).rejects.toThrow('stopped')
  expect(images.save).not.toHaveBeenCalled()
})
