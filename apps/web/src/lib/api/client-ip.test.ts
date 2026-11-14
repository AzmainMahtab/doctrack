import { describe, expect, it } from 'vitest';
import { clientIp } from './client-ip';

const headers = (values: Record<string, string>) => ({
  get: (name: string) => values[name.toLowerCase()] ?? null,
});

describe('clientIp', () => {
  it('takes the last forwarded entry, which the edge proxy appended', () => {
    expect(clientIp(headers({ 'x-forwarded-for': '203.0.113.9' }))).toBe('203.0.113.9');
    expect(clientIp(headers({ 'x-forwarded-for': '1.1.1.1, 203.0.113.9' }))).toBe('203.0.113.9');
  });

  it('ignores leading entries a client forged', () => {
    expect(clientIp(headers({ 'x-forwarded-for': '9.9.9.9, 8.8.8.8, 198.51.100.7' }))).toBe(
      '198.51.100.7',
    );
  });

  it('accepts IPv6', () => {
    expect(clientIp(headers({ 'x-forwarded-for': '2001:db8::1' }))).toBe('2001:db8::1');
  });

  it('falls back to x-real-ip, then to loopback', () => {
    expect(clientIp(headers({ 'x-real-ip': '192.0.2.5' }))).toBe('192.0.2.5');
    expect(clientIp(headers({}))).toBe('127.0.0.1');
  });

  it('never forwards garbage', () => {
    expect(clientIp(headers({ 'x-forwarded-for': 'not an ip' }))).toBe('127.0.0.1');
    expect(clientIp(headers({ 'x-forwarded-for': '1.1.1.1, <script>' }))).toBe('127.0.0.1');
    expect(clientIp(headers({ 'x-forwarded-for': 'x'.repeat(100) }))).toBe('127.0.0.1');
  });
});
