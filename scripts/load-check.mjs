const base = process.env.API_URL ?? 'http://127.0.0.1:8080/api/v1';
const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@doctrack.dev';
const password = process.env.SEED_ADMIN_PASSWORD;
const samples = Number(process.env.SAMPLES ?? 20);
if (!password) throw new Error('SEED_ADMIN_PASSWORD is required');

const ip = `203.0.113.${1 + Math.floor(Math.random() * 250)}`;
const common = { 'x-forwarded-for': ip };

const login = await fetch(`${base}/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...common },
  body: JSON.stringify({ email, password }),
});
if (!login.ok) throw new Error(`login failed: ${login.status}`);
const cookie = login.headers
  .getSetCookie()
  .map((c) => c.split(';')[0])
  .join('; ');

const get = async (path) => {
  const start = performance.now();
  const response = await fetch(`${base}${path}`, { headers: { cookie, ...common } });
  await response.arrayBuffer();
  return { ms: performance.now() - start, status: response.status };
};

const doctors = await (
  await fetch(`${base}/doctors?limit=1`, { headers: { cookie, ...common } })
).json();
const doctorId = doctors.data[0].id;

const targets = [
  ['lookup', 'doctors list', '/doctors?page=1&limit=20'],
  ['lookup', 'doctors search + filter', `/doctors?q=amir&specialization=Cardiology&limit=20`],
  ['lookup', 'doctors deep page', '/doctors?page=300&limit=20'],
  ['lookup', 'patients list', '/patients?page=1&limit=20'],
  ['lookup', 'patients search + filter', '/patients?q=amir&condition=critical&limit=20'],
  ['lookup', 'patients deep page', '/patients?page=4000&limit=20'],
  ['lookup', 'doctor patients', `/doctors/${doctorId}/patients?limit=20`],
  ['report', 'dashboard summary', '/dashboard/summary'],
  ['report', 'patients per doctor', '/dashboard/patients-per-doctor'],
  ['report', 'timeseries 30 days', '/dashboard/timeseries?window=30'],
  ['report', 'timeseries 90 days weekly', '/dashboard/timeseries?window=90&interval=week'],
  ['report', 'conditions', '/dashboard/conditions'],
];
const limits = { lookup: 300, report: 200 };

const p95 = (values) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1];
let failed = false;
console.log(
  'target'.padEnd(30),
  'p50'.padStart(7),
  'p95'.padStart(7),
  'limit'.padStart(7),
  'result',
);
for (const [kind, name, path] of targets) {
  await get(path);
  const times = [];
  for (let i = 0; i < samples; i++) {
    const { ms, status } = await get(path);
    if (status !== 200) throw new Error(`${name}: HTTP ${status}`);
    times.push(ms);
  }
  const sorted = [...times].sort((a, b) => a - b);
  const ok = p95(times) < limits[kind];
  if (!ok) failed = true;
  console.log(
    name.padEnd(30),
    sorted[Math.floor(sorted.length / 2)].toFixed(1).padStart(7),
    p95(times).toFixed(1).padStart(7),
    String(limits[kind]).padStart(7),
    ok ? 'pass' : 'FAIL',
  );
}
process.exit(failed ? 1 : 0);
