import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import {
  ADMIN,
  VIEWER,
  addPatient,
  appAlert,
  apiStatus,
  cookieHeader,
  isMobile,
  newDoctor,
  openDoctor,
  signIn,
  unique,
  useOwnIp,
} from './helpers';

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  await useOwnIp(page);
});

test('J1 signing in lands on the dashboard and shows the register', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);

  await page.getByLabel('Email').fill(ADMIN.email);
  await page.getByLabel('Password').fill('wrong-password-here');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(appAlert(page)).toHaveText('Invalid email or password.');

  await page.getByLabel('Password').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Register totals' })).toContainText(
    'on record with',
  );
  await expect(page.getByRole('heading', { name: 'New registrations' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Patients per doctor' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Patients by condition' })).toBeVisible();
});

test('rate limited sign-in states the wait', async ({ page }) => {
  const email = `${unique('nobody')}@example.com`;
  await page.goto('/login');
  for (let i = 0; i < 6; i++) {
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('wrong-password-here');
    await Promise.all([
      page.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes('/login')),
      page.getByRole('button', { name: 'Sign in' }).click(),
    ]);
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  }
  await expect(appAlert(page)).toContainText(/Too many attempts\. Try again in \d+ seconds\./);
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeDisabled();
});

test('J2 register a doctor, add a patient, and the dashboard follows', async ({ page }) => {
  await signIn(page);
  const totals = async () => {
    const response = await page.request.get('/api/v1/dashboard/summary');
    const body = (await response.json()) as { data: { patients: number; doctors: number } };
    return body.data;
  };
  const before = await totals();

  const name = unique('Dr Test ');
  await newDoctor(page, { name, email: `${unique('doc')}@example.com` });
  await openDoctor(page, name);
  const patient = unique('Pat ');
  await addPatient(page, {
    name: patient,
    email: `${unique('pat')}@example.com`,
    condition: 'critical',
  });
  await expect(page.getByText(patient).filter({ visible: true }).first()).toBeVisible();

  await expect
    .poll(async () => (await totals()).patients, { timeout: 25_000, intervals: [1000] })
    .toBe(before.patients + 1);
  expect((await totals()).doctors).toBe(before.doctors + 1);

  await page.goto('/dashboard');
  const text = (await page.getByRole('region', { name: 'Register totals' }).innerText()).replace(
    /\s+/g,
    ' ',
  );
  expect(text).toContain(`${(before.patients + 1).toLocaleString('en-GB')} patient`);
  expect(text).toContain(`${(before.doctors + 1).toLocaleString('en-GB')} doctor`);
});

test('J3 find, edit and delete a patient', async ({ page }) => {
  await signIn(page);
  const doctorName = unique('Dr Edit ');
  await newDoctor(page, { name: doctorName, email: `${unique('doc')}@example.com` });
  await openDoctor(page, doctorName);
  const keep = unique('Keep ');
  const target = unique('Target ');
  await addPatient(page, { name: keep, email: `${unique('p')}@example.com` });
  await addPatient(page, {
    name: target,
    email: `${unique('p')}@example.com`,
    condition: 'stable',
  });

  await page.goto('/patients');
  await page.getByRole('search').getByRole('searchbox').fill(target);
  const row = isMobile(page)
    ? page.getByRole('button', { name: new RegExp(`${target}.*Open actions`) })
    : page.getByRole('row', { name: new RegExp(target) });
  await expect(row).toBeVisible();

  if (isMobile(page)) {
    await row.click();
    await page.getByRole('button', { name: 'Edit patient' }).click();
  } else {
    await page.getByRole('button', { name: `Edit ${target}` }).click();
  }
  const drawer = page.getByRole('dialog', { name: 'Edit patient' });
  await expect(drawer.getByLabel('Name')).toHaveValue(target);
  await drawer.getByLabel('Condition').selectOption('recovered');
  await drawer.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Changes saved.')).toBeVisible();
  await expect(page.getByText('Recovered').filter({ visible: true }).first()).toBeVisible();

  if (isMobile(page)) {
    await page.getByRole('button', { name: new RegExp(`${target}.*Open actions`) }).click();
    await page.getByRole('button', { name: 'Delete patient' }).click();
  } else {
    await page.getByRole('button', { name: `Delete ${target}` }).click();
  }
  await page
    .getByRole('dialog', { name: 'Delete this patient?' })
    .getByRole('button', { name: 'Delete patient' })
    .click();
  await expect(page.getByText('Patient deleted.')).toBeVisible();
  await expect(page.getByText('No patients match these filters')).toBeVisible();

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText(target).filter({ visible: true }).first()).toBeVisible({
    timeout: 15_000,
  });

  const cookie = await cookieHeader(page);
  expect(
    await apiStatus(page.request, 'get', '/patients?q=' + encodeURIComponent(target), cookie),
  ).toBe(200);
});

test('J4 signing out invalidates the session', async ({ page }) => {
  await signIn(page);
  const cookie = await cookieHeader(page);
  expect(await apiStatus(page.request, 'get', '/auth/me', cookie)).toBe(200);

  if (isMobile(page)) await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login/);

  const replay = await page.request.get('/api/v1/auth/me', { headers: { cookie } });
  expect(replay.status()).toBe(401);
  expect((await replay.json()).code).toBe('TOKEN_REVOKED');

  await page.goto('/doctors');
  await expect(page).toHaveURL(/\/login\?next=%2Fdoctors/);
});

test('J5 a viewer reads but cannot write', async ({ page }) => {
  await signIn(page, VIEWER, '/doctors');
  await expect(page.getByRole('heading', { level: 1, name: 'Doctors' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add doctor' })).toHaveCount(0);

  await page.goto('/patients');
  await expect(page.getByRole('heading', { level: 1, name: 'Patients' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^(Edit|Delete) / })).toHaveCount(0);

  const cookie = await cookieHeader(page);
  expect(
    await apiStatus(page.request, 'post', '/doctors', cookie, {
      name: 'Nope Nope',
      specialization: 'Nope',
      hospital: 'Nope',
      phone: '+14155550123',
      email: `${unique('v')}@example.com`,
    }),
  ).toBe(403);
});

test('layout holds at the viewport width on every page', async ({ page }) => {
  await signIn(page);
  for (const path of ['/dashboard', '/doctors', '/patients']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, `${path} overflows horizontally`).toBeLessThanOrEqual(0);
  }
});

test('accessibility: no serious or critical violations', async ({ page }) => {
  const check = async (label: string) => {
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(
      bad.map((v) => `${label}: ${v.id} (${v.nodes.length})`),
      label,
    ).toEqual([]);
  };
  await page.goto('/login');
  await check('login');
  await signIn(page);
  await page.waitForLoadState('networkidle');
  await check('dashboard');
  await page.goto('/doctors');
  await page.waitForLoadState('networkidle');
  await check('doctors');
  const first = page.locator('a[href^="/doctors/"]').filter({ visible: true }).first();
  await first.click();
  await page.waitForLoadState('networkidle');
  await check('doctor detail');
  await page.goto('/patients');
  await page.waitForLoadState('networkidle');
  await check('patients');
});
