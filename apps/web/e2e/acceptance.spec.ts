import { expect, test } from '@playwright/test';
import { signIn, useOwnIp } from './helpers';

test.beforeEach(async ({ page }) => {
  await useOwnIp(page);
});

test('keyboard: focus follows reading order and is visible', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByLabel('Email')).toBeFocused();
  const order: string[] = [];
  for (let i = 0; i < 2; i++) {
    await page.keyboard.press('Tab');
    const focus = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const style = getComputedStyle(el);
      return {
        name: el.getAttribute('type') === 'submit' ? 'submit' : el.getAttribute('name'),
        ring: style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2,
      };
    });
    expect(focus.ring, `focus ring on ${focus.name}`).toBe(true);
    order.push(focus.name ?? '');
  }
  expect(order).toEqual(['password', 'submit']);
});

test('a filter that matches nothing shows an empty state with Clear filters', async ({ page }) => {
  await signIn(page, undefined, '/doctors?q=zzzznomatch');
  await expect(
    page
      .getByRole('button', { name: 'Clear filters' })
      .or(page.getByRole('link', { name: 'Clear filters' }))
      .first(),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Clear filters' })
    .or(page.getByRole('link', { name: 'Clear filters' }))
    .first()
    .click();
  await expect(page).not.toHaveURL(/q=zzzz/);
});

test('an unknown doctor id shows the not-found state', async ({ page }) => {
  await signIn(page);
  const response = await page.goto('/doctors/01900000-0000-7000-8000-000000000000');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'This page is not on the register',
  );
});

test('a copied filtered URL reproduces the filters for another session', async ({
  page,
  browser,
}) => {
  await signIn(page, undefined, '/doctors?q=amir&specialization=Cardiology');
  const url = page.url();
  const other = await browser.newContext();
  const second = await other.newPage();
  await useOwnIp(second);
  await signIn(second, undefined, new URL(url).pathname + new URL(url).search);
  await expect(second.getByRole('searchbox')).toHaveValue('amir');
  await other.close();
});
