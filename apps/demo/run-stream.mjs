import { EventEmitter } from 'node:events'

// A provider writes once; browser connections may come and go independently.
export class RunStream extends EventEmitter {
  chunks = []
  clients = new Set()
  writableEnded = false
  destroyed = false

  attach(response) {
    response.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' })
    response.flushHeaders()
    for (const chunk of this.chunks) response.write(chunk)
    if (this.writableEnded) { response.end(); return }
    this.clients.add(response)
    const heartbeat = setInterval(() => response.write('\n'), 15000)
    response.once('close', () => { clearInterval(heartbeat); this.clients.delete(response) })
  }

  writeHead() {}
  flushHeaders() {}
  write(chunk) {
    this.chunks.push(chunk)
    for (const client of this.clients) client.write(chunk)
  }
  end() {
    this.writableEnded = true
    for (const client of this.clients) client.end()
    this.clients.clear()
  }
}
