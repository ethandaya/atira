import { expect, it } from 'vitest'
import { clientRateLimitKey } from './client-address.ts'

it('keeps IPv4 clients distinct', () => {
  expect(clientRateLimitKey('203.0.113.42')).toBe('203.0.113.42')
  expect(clientRateLimitKey('::ffff:203.0.113.42')).toBe('203.0.113.42')
})

it('groups IPv6 clients by their routed 64-bit prefix', () => {
  expect(clientRateLimitKey('2001:0DB8:abcd:12::1')).toBe(
    '2001:db8:abcd:12::/64',
  )
  expect(clientRateLimitKey('2001:db8:abcd:12:ffff::99')).toBe(
    '2001:db8:abcd:12::/64',
  )
  expect(clientRateLimitKey('2001:db8:abcd:12::192.0.2.1')).toBe(
    '2001:db8:abcd:12::/64',
  )
})

it('does not normalize malformed addresses into a shared key', () => {
  expect(clientRateLimitKey('2001:db8::bad::1')).toBe('2001:db8::bad::1')
})
