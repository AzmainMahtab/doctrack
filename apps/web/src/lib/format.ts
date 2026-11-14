const date = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

const dateTime = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
});

export const formatDate = (iso: string): string => date.format(new Date(iso));

export const formatDateTime = (iso: string): string =>
  dateTime.format(new Date(iso)).replace(',', ',');

export const formatDay = (isoDay: string): string => {
  const [y, m, d] = isoDay.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)));
};

export const plural = (count: number, one: string, many = `${one}s`): string =>
  `${count.toLocaleString('en-GB')} ${count === 1 ? one : many}`;

export const share = (part: number, total: number): string =>
  total === 0 ? '0.0%' : `${((part / total) * 100).toFixed(1)}%`;
