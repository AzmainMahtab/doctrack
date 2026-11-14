import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const ADMIN = {
  email: process.env.E2E_ADMIN_EMAIL ?? 'admin@doctrack.dev',
  password: process.env.E2E_ADMIN_PASSWORD ?? 'admin-demo-password',
};
export const VIEWER = {
  email: process.env.E2E_VIEWER_EMAIL ?? 'viewer@doctrack.dev',
  password: process.env.E2E_VIEWER_PASSWORD ?? 'viewer-demo-password',
};

export const unique = (prefix: string): string =>
  `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const randomIp = (): string =>
  `10.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;

export async function useOwnIp(page: Page): Promise<string> {
  const ip = randomIp();
  await page.context().setExtraHTTPHeaders({ 'x-forwarded-for': ip });
  return ip;
}

export async function signIn(page: Page, account = ADMIN, next = '/dashboard'): Promise<void> {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

export const isMobile = (page: Page): boolean => (page.viewportSize()?.width ?? 1440) < 768;

export async function openDrawerAction(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name }).first().click();
}

export async function newDoctor(
  page: Page,
  doctor: { name: string; email: string },
): Promise<void> {
  await page.goto('/doctors');
  await page.getByRole('button', { name: 'Add doctor' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Add doctor' });
  await dialog.getByLabel('Name').fill(doctor.name);
  await dialog.getByLabel('Specialization').fill('Cardiology');
  await dialog.getByLabel('Hospital').fill('St. Mary Hospital');
  await dialog.getByLabel('Phone').fill('+14155550123');
  await dialog.getByLabel('Email').fill(doctor.email);
  await dialog.getByRole('button', { name: 'Save doctor' }).click();
  await expect(page.getByText('Doctor saved.')).toBeVisible();
}

export async function openDoctor(page: Page, name: string): Promise<void> {
  await page.goto('/doctors');
  await page.getByRole('search').getByRole('searchbox').fill(name);
  await page.waitForURL(/[?&]q=/);
  const link = page.getByRole('link', { name }).filter({ visible: true }).first();
  await expect(link).toBeVisible();
  await link.click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

export async function addPatient(
  page: Page,
  patient: { name: string; email: string; condition?: string },
): Promise<void> {
  await page.getByRole('button', { name: 'Add patient' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Add patient' });
  await dialog.getByLabel('Name').fill(patient.name);
  await dialog.getByLabel('Date of birth').fill('1985-03-21');
  await dialog.getByLabel('Phone').fill('+14155550199');
  await dialog.getByLabel('Email').fill(patient.email);
  if (patient.condition) await dialog.getByLabel('Condition').selectOption(patient.condition);
  await dialog.getByLabel('Diagnosis').fill('Routine checkup');
  await dialog.getByLabel('Admitted').fill('2026-11-01T09:30');
  await dialog.getByRole('button', { name: 'Save patient' }).click();
  await expect(page.getByText('Patient saved.')).toBeVisible();
}

export async function cookieHeader(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
}

export async function apiStatus(
  request: APIRequestContext,
  method: 'get' | 'post' | 'delete',
  path: string,
  cookie: string,
  data?: unknown,
): Promise<number> {
  const response = await request[method](`/api/v1${path}`, {
    headers: { cookie },
    ...(data ? { data } : {}),
  });
  return response.status();
}

export const appAlert = (page: Page) =>
  page.locator('[role="alert"]:not(#__next-route-announcer__)');
