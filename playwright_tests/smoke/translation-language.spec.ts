import { expect, test } from '@playwright/test';
import { fakeTranslationApi, sourcePhrase, translationApiPath, welshPhrase } from '../fixtures/translation-api.fake';
import { readTranslationCache } from '../fixtures/translation-cache';

// Demo requests debounce for 300 ms; observe a full debounce plus scheduling allowance.
const noTranslationRequestWindowMs = 300 + 400;

for (const status of [200, 500]) {
  test(`keeps English selected after a delayed Welsh response (${status})`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      const expectedFailure = status === 500 && new URL(message.location().url || 'about:blank').pathname === translationApiPath;
      if (message.type() === 'error' && !expectedFailure) {
        errors.push(message.text());
      }
    });
    const api = await fakeTranslationApi(page, { hold: true, status });
    try {
      await page.goto('/');
      await page.getByRole('button', { name: 'Newid i\'r Gymraeg' }).click();
      await expect.poll(() => api.requestBodies).toEqual([{ phrases: [sourcePhrase] }]);
      await expect(page.getByText(`${sourcePhrase} [Translation in progress]`, { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Change to English' }).click();
      await expect(page.getByText('Current language: en', { exact: true })).toBeVisible();
      await expect(page.getByText(sourcePhrase, { exact: true })).toBeVisible();

      const response = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === translationApiPath);
      api.release();
      const delivered = await response;
      expect(delivered.status()).toBe(status);
      await delivered.finished();
      const cachedText = status === 200 ? welshPhrase : `[Test translation for ${sourcePhrase}]`;
      await expect.poll(() => readTranslationCache(page)).toEqual([
        expect.objectContaining({ phrase: sourcePhrase, lang: 'cy', translation: { translation: cachedText } })
      ]);
      await expect(page.getByText('Current language: en', { exact: true })).toBeVisible();
      await expect(page.getByText(sourcePhrase, { exact: true })).toBeVisible();
      await expect(page.getByText(cachedText, { exact: true })).toHaveCount(0);

      await page.getByRole('button', { name: 'Newid i\'r Gymraeg' }).click();
      await expect(page.getByText('Current language: cy', { exact: true })).toBeVisible();
      await expect(page.getByText(cachedText, { exact: true })).toBeVisible();
      const extraRequest = page.waitForRequest(
        (request) => request.method() === 'POST' && new URL(request.url()).pathname === translationApiPath,
        { timeout: noTranslationRequestWindowMs }
      ).then(() => 'unexpected request', (error: Error) => {
        if (error.name === 'TimeoutError') {
          return 'none';
        }
        throw error;
      });
      expect(await extraRequest, 'cached Welsh reuse does not issue a second request').toBe('none');
      expect(api.requestBodies).toEqual([{ phrases: [sourcePhrase] }]);
      expect(errors, 'unexpected page or console errors').toEqual([]);
    } finally {
      api.release();
      await page.unrouteAll({ behavior: 'wait' });
    }
  });
}
