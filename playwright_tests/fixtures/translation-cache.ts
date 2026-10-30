import type { Page } from '@playwright/test';
import { sourcePhrase } from './translation-api.fake';

export type CachedTranslation = {
  phrase: string;
  lang: string;
  validity: string;
  translation: { translation: string };
};

export async function readTranslationCache(page: Page): Promise<CachedTranslation[]> {
  return page.evaluate(() => new Promise<CachedTranslation[]>((resolve, reject) => {
    const request = indexedDB.open('RpxTranslations');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains('translations')) {
        database.close();
        resolve([]);
        return;
      }
      const rows = database.transaction('translations', 'readonly').objectStore('translations').getAll();
      rows.onerror = () => {
        database.close();
        reject(rows.error);
      };
      rows.onsuccess = () => {
        database.close();
        resolve(rows.result);
      };
    };
  }));
}

export async function expireWelshTranslation(page: Page, translation: string): Promise<void> {
  // Stop the old app's live cache observer before changing the next page load's fixture.
  const fixtureUrl = new URL('/translation-cache-fixture', page.url()).href;
  await page.route(fixtureUrl, (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Translation cache setup</title>' }), { times: 1 });
  await page.goto(fixtureUrl);
  await page.evaluate(({ phrase, text }) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('RpxTranslations');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction('translations', 'readwrite');
      const store = transaction.objectStore('translations');
      const rows = store.getAll();
      rows.onsuccess = () => {
        const row = rows.result.find((entry: CachedTranslation) => entry.phrase === phrase && entry.lang === 'cy');
        if (!row) {
          transaction.abort();
          return;
        }
        store.put({ ...row, validity: '2000-01-01T00:00:00.000Z', translation: { translation: text } });
      };
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onabort = () => {
        database.close();
        reject(transaction.error ?? new Error('Welsh cache fixture missing'));
      };
    };
  }), { phrase: sourcePhrase, text: translation });
}
