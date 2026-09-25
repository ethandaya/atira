// @ts-check
import { ServerResponse } from 'node:http'

// A provider writes once; browser connections may come and go independently.
export class RunStream {
  /** @type {(string | Uint8Array)[] | undefined} */
  #chunks = []
  #bytes = 0
  /** @type {Set<ServerResponse>} */
  #clients = new Set()
  writableEnded = false
  destroyed = false

  constructor(maxReplayBytes = 8 * 1024 * 1024) {
    this.maxReplayBytes = maxReplayBytes
  }

  /** @param {ServerResponse} response */
  attach(response) {
    if (!this.#chunks) {
      response.writeHead(409, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
      response.end(JSON.stringify({ error: 'This response exceeded the replay limit. Its live connection can continue, but it cannot be reconnected.' }))
      return
    }
    response.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' })
    response.flushHeaders()
    for (const chunk of this.#chunks) response.write(chunk)
    if (this.writableEnded) { response.end(); return }
    this.#clients.add(response)
    const heartbeat = setInterval(() => response.write('\n'), 15000)
    response.once('close', () => { clearInterval(heartbeat); this.#clients.delete(response) })
  }

  writeHead() {}
  flushHeaders() {}
  /** @param {string | Uint8Array} chunk */
  write(chunk) {
    if (this.writableEnded) return
    this.#bytes += Buffer.byteLength(chunk)
    if (this.#bytes > this.maxReplayBytes) this.#chunks = undefined
    else this.#chunks?.push(chunk)
    for (const client of this.#clients) client.write(chunk)
  }
  end() {
    this.writableEnded = true
    for (const client of this.#clients) client.end()
    this.#clients.clear()
  }
}
