import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export function hasImageGenerationPlan(credential) {
  try {
    const claims = JSON.parse(Buffer.from(credential.accessToken.split('.')[1], 'base64url').toString())
    const plan = claims['https://api.openai.com/auth']?.chatgpt_plan_type
    return typeof plan === 'string' && plan !== 'free' && plan.length > 0
  } catch {
    return false
  }
}

export class GeneratedImageStore {
  constructor(directory) { this.directory = directory }

  async save(owner, base64, alt) {
    if (typeof base64 !== 'string' || base64.length > 28_000_000) throw new Error('Invalid generated image.')
    const bytes = Buffer.from(base64, 'base64')
    if (bytes.length < 24 || !bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) throw new Error('Expected a PNG image.')
    const width = bytes.readUInt32BE(16)
    const height = bytes.readUInt32BE(20)
    if (!width || !height || width > 16384 || height > 16384) throw new Error('Invalid image dimensions.')
    const id = randomUUID()
    const directory = join(this.directory, owner)
    await mkdir(directory, { recursive: true, mode: 0o700 })
    await writeFile(join(directory, `${id}.png`), bytes, { mode: 0o600, flag: 'wx' })
    return { id, url: `/api/images/${id}`, width, height, alt }
  }

  async read(owner, id) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined
    try { return await readFile(join(this.directory, owner, `${id}.png`)) }
    catch (error) { if (error.code === 'ENOENT') return undefined; throw error }
  }
}

export function createImageGenerationTool({ getCredential, owner, images, request = globalThis.fetch }) {
  return {
    description: 'Generate one new image when the user explicitly asks for an image, render, illustration, or visual mockup. Describe the desired image precisely in the prompt. The image is displayed directly in the conversation; do not duplicate it in Markdown. This tool does not edit existing images.',
    parameters: { type: 'object', properties: { prompt: { type: 'string', maxLength: 8000 } }, required: ['prompt'], additionalProperties: false },
    startedSummary: 'Generating image',
    completedSummary: 'Image generated',
    failedSummary: 'Image generation failed',
    formatInput: input => input.prompt,
    formatOutput: () => 'Image generated and displayed in the conversation.',
    formatError: () => 'Image generation failed. The provider may be unavailable or your subscription may not support it. Try again.',
    invocation: () => ({ kind: 'image' }),
    modelOutput: value => [
      { type: 'input_text', text: 'Generated image is displayed in the conversation. Do not embed it again.' },
      { type: 'input_image', image_url: value.dataUrl, detail: 'auto' },
    ],
    async handler(input, { invocation, signal }) {
      if (typeof input?.prompt !== 'string' || !input.prompt.trim() || input.prompt.length > 8000) throw new Error('An image prompt is required.')
      let credential = await getCredential()
      const send = () => {
        if (!hasImageGenerationPlan(credential)) throw new Error('A paid ChatGPT plan is required.')
        return request('https://chatgpt.com/backend-api/codex/images/generations', {
          method: 'POST',
          headers: { Authorization: `Bearer ${credential.accessToken}`, 'ChatGPT-Account-ID': credential.accountId,
            'Content-Type': 'application/json', 'User-Agent': 'pretty-amped/0.0.0',
            ...(credential.fedramp ? { 'X-OpenAI-Fedramp': 'true' } : {}) },
          body: JSON.stringify({ prompt: input.prompt, model: 'gpt-image-2', background: 'auto', quality: 'auto', size: 'auto', output_format: 'png' }),
          signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(180_000)]),
        })
      }
      let response = await send()
      if (response.status === 401) { credential = await getCredential({ forceRefresh: true }); response = await send() }
      if (!response.ok) throw new Error('Image provider request failed.')
      const body = await response.json()
      if (signal?.aborted) throw new Error('Image generation stopped.')
      const base64 = body?.data?.[0]?.b64_json
      invocation.image = await images.save(owner, base64, input.prompt)
      return { dataUrl: `data:image/png;base64,${base64}` }
    },
  }
}
