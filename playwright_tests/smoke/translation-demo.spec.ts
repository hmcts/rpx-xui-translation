import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';
import { fakeTranslationApi, sourcePhrase, translationApiPath, welshPhrase } from '../fixtures/translation-api.fake';

const inProgressPhrase = `${sourcePhrase} [Translation in progress]`;
const testModeFallbackPhrase = `[Test translation for ${sourcePhrase}]`;
const languageCookie = 'exui-preferred-language';
// The demo debounces translation requests by debounceTimeMs = 300 (projects/rpx-xui-translation-demo/src/app/app.module.ts).
const demoTranslationDebounceMs = 300;
// No-POST observation window after the cached Welsh render: the full debounce plus a scheduling allowance.
const noTranslationRequestWindowMs = demoTranslationDebounceMs + 400;

async function languageCookieValue(page: Page): Promise<string | undefined> {
  const cookies = await page.context().cookies();
  return cookies.find((cookie) => cookie.name === languageCookie)?.value;
}

async function cachedWelshTranslations(page: Page): Promise<string[]> {
  return page.evaluate(() => new Promise<string[]>((resolve, reject) => {
    const request = indexedDB.open('RpxTranslations');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains('translations')) {
        database.close();
        resolve([]);
        return;
      }
      const getAll = database.transaction('translations', 'readonly').objectStore('translations').getAll();
      getAll.onerror = () => reject(getAll.error);
      getAll.onsuccess = () => {
        database.close();
        resolve(getAll.result
          .filter((row: { lang: string }) => row.lang === 'cy')
          .map((row: { translation: { translation: string } }) => row.translation.translation));
      };
    };
  }));
}

test.describe('Translation demo smoke', () => {
  let pageErrors: string[];
  let consoleErrors: string[];
  let allowFakedApiFailureLog: boolean;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];
    allowFakedApiFailureLog = false;
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message: ConsoleMessage) => {
      const isFakedApiFailure = new URL(message.location().url || 'about:blank').pathname === translationApiPath;
      if (message.type() === 'error' && !(allowFakedApiFailureLog && isFakedApiFailure)) {
        consoleErrors.push(message.text());
      }
    });
  });

  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    expect(pageErrors, 'uncaught page errors').toEqual([]);
    expect(consoleErrors, 'console errors').toEqual([]);
  });

  test('S1 renders English by default', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Translation Demo App' })).toBeVisible();
    await expect(page.getByText('Current language: en', { exact: true })).toBeVisible();
    await expect(page.getByText(sourcePhrase, { exact: true })).toBeVisible();
    await expect(page.getByText('Untranslated text', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Newid i\'r Gymraeg' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Change to English' })).toHaveCount(0);
    await expect.poll(() => languageCookieValue(page)).toBe('en');
  });

  test('S2 switches to Welsh via the translation API', async ({ page }) => {
    const api = await fakeTranslationApi(page, { hold: true });
    await page.goto('/');

    await page.getByRole('button', { name: 'Newid i\'r Gymraeg' }).click();

    await expect(page.getByText('Current language: cy', { exact: true })).toBeVisible();
    await expect(page.getByText(inProgressPhrase, { exact: true })).toBeVisible();
    await expect.poll(() => api.requestBodies).toEqual([{ phrases: [sourcePhrase] }]);

    api.release();

    await expect(page.getByText(welshPhrase, { exact: true })).toBeVisible();
    expect(api.requestBodies).toHaveLength(1);
    await expect(page.getByText(inProgressPhrase, { exact: true })).toHaveCount(0);
    await expect(page.getByText('Untranslated text', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Change to English' })).toBeVisible();
    await expect.poll(() => languageCookieValue(page)).toBe('cy');
  });

  test('S3 restores Welsh from cookie and cache after reload, then returns to English', async ({ page }) => {
    const api = await fakeTranslationApi(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Newid i\'r Gymraeg' }).click();
    await expect(page.getByText(welshPhrase, { exact: true })).toBeVisible();
    await expect.poll(() => cachedWelshTranslations(page)).toEqual([welshPhrase]);

    await test.step('reload restores Welsh without a second API call', async () => {
      await page.reload();
      await expect(page.getByText('Current language: cy', { exact: true })).toBeVisible();
      await expect(page.getByText(welshPhrase, { exact: true })).toBeVisible();

      // Event-bound negative window: any translation POST within the debounce window after the cached render fails.
      const translationPost = await page.waitForRequest(
        (request) => request.method() === 'POST' && new URL(request.url()).pathname === translationApiPath,
        { timeout: noTranslationRequestWindowMs }
      ).then(
        (request) => `unexpected ${request.method()} ${new URL(request.url()).pathname} after reload`,
        (error: Error) => (error.name === 'TimeoutError' ? 'none' : `request observer failed: ${error.message}`)
      );
      expect(translationPost, 'translation POSTs within the debounce window after reload').toBe('none');
      expect(api.requestBodies).toHaveLength(1);
    });

    await test.step('switch back to English', async () => {
      await page.getByRole('button', { name: 'Change to English' }).click();
      await expect(page.getByText('Current language: en', { exact: true })).toBeVisible();
      await expect(page.getByText(sourcePhrase, { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Newid i\'r Gymraeg' })).toBeVisible();
      await expect.poll(() => languageCookieValue(page)).toBe('en');
    });
  });

  test('S4 falls back to test-mode text when the translation API fails', async ({ page }) => {
    allowFakedApiFailureLog = true;
    const api = await fakeTranslationApi(page, { status: 500 });
    await page.goto('/');

    await page.getByRole('button', { name: 'Newid i\'r Gymraeg' }).click();

    await expect(page.getByText(testModeFallbackPhrase, { exact: true })).toBeVisible();
    expect(api.requestBodies).toEqual([{ phrases: [sourcePhrase] }]);
    await expect.poll(() => languageCookieValue(page)).toBe('cy');
  });
});
