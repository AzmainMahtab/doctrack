const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const IPV6 = /^[0-9a-fA-F:]+$/;
const FALLBACK = '127.0.0.1';

const looksLikeIp = (value: string): boolean =>
  value.length <= 45 && (IPV4.test(value) || (value.includes(':') && IPV6.test(value)));

export function clientIp(headers: { get(name: string): string | null }): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const last = forwarded.split(',').at(-1)?.trim() ?? '';
    if (looksLikeIp(last)) return last;
  }
  const real = headers.get('x-real-ip')?.trim() ?? '';
  return looksLikeIp(real) ? real : FALLBACK;
}
