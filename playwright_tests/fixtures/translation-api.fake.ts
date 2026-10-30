import type { Page } from '@playwright/test';

/** Route fake for the translation API (`POST /cy`), shared by the smoke and accessibility specs. */
export const sourcePhrase = 'Translated Text';
export const welshPhrase = 'Testun wedi\'i gyfieithu [fake translation API]';
export const translationApiPath = '/cy';

export type TranslationApiFake = {
  requestBodies: unknown[];
  release: () => void;
};

export async function fakeTranslationApi(page: Page, options: { status?: number; hold?: boolean } = {}): Promise<TranslationApiFake> {
  const { status = 200, hold = false } = options;
  const requestBodies: unknown[] = [];
  let release: () => void = () => undefined;
  const released = hold ? new Promise<void>((resolve) => {
    release = resolve;
  }) : Promise.resolve();

  await page.route((url) => url.pathname === translationApiPath, async (route) => {
    if (route.request().method() !== 'POST') {
      return route.fallback();
    }
    requestBodies.push(route.request().postDataJSON());
    await released;
    if (status === 200) {
      return route.fulfill({ json: { translations: { [sourcePhrase]: welshPhrase } } });
    }
    return route.fulfill({ status, json: { message: 'fake translation API failure' } });
  });

  return { requestBodies, release };
}
