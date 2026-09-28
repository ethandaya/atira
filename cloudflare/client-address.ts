export function clientRateLimitKey(address: string) {
  const normalized = address.toLowerCase()
  if (!normalized.includes(':')) return normalized

  const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mappedIpv4?.[1] && validIpv4(mappedIpv4[1])) return mappedIpv4[1]

  const halves = normalized.split('::')
  if (halves.length > 2) return normalized
  const left = parseHextets(halves[0] ?? '')
  const right = parseHextets(halves[1] ?? '')
  if (!left || !right) return normalized

  const omitted = 8 - left.length - right.length
  if (
    (halves.length === 1 && omitted !== 0) ||
    (halves.length === 2 && omitted < 1)
  ) {
    return normalized
  }

  const hextets = [...left, ...Array<string>(omitted).fill('0'), ...right]
  return `${hextets.slice(0, 4).join(':')}::/64`
}

function parseHextets(value: string) {
  if (!value) return []
  const parts = value.split(':')
  const ipv4 = parts.at(-1)
  if (ipv4?.includes('.')) {
    if (!validIpv4(ipv4)) return undefined
    const octets = ipv4.split('.').map(Number)
    parts.splice(
      -1,
      1,
      ((octets[0] ?? 0) * 256 + (octets[1] ?? 0)).toString(16),
      ((octets[2] ?? 0) * 256 + (octets[3] ?? 0)).toString(16),
    )
  }
  if (parts.some((part) => !/^[0-9a-f]{1,4}$/.test(part))) return undefined
  return parts.map((part) => Number.parseInt(part, 16).toString(16))
}

function validIpv4(value: string) {
  const parts = value.split('.')
  return (
    parts.length === 4 &&
    parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
  )
}
