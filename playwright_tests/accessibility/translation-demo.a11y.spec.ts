import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { fakeTranslationApi, welshPhrase } from '../fixtures/translation-api.fake';
import { axeFindings, recordAdvisoryEvidence, type AdvisoryFinding } from './axe-evidence';

const feature = 'Translation demo';

test.describe('Translation demo accessibility (advisory)', () => {
  test('A1 English default state', async ({ page }, testInfo) => {
    await page.goto('/');
    await expect(page.getByText('Current language: en', { exact: true })).toBeVisible();

    const axe = await new AxeBuilder({ page }).analyze();

    await recordAdvisoryEvidence(testInfo, { feature, pageState: 'English default', language: 'en', findings: axeFindings(axe), axe });
  });

  test('A2 Welsh state via the faked translation API', async ({ page }, testInfo) => {
    const api = await fakeTranslationApi(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Newid i\'r Gymraeg' }).click();
    await expect(page.getByText('Current language: cy', { exact: true })).toBeVisible();
    await expect(page.getByText(welshPhrase, { exact: true })).toBeVisible();
    expect(api.requestBodies).toHaveLength(1);

    const htmlLang = await page.evaluate(() => document.documentElement.lang);
    expect(['en', 'cy'], 'html lang is a known language code').toContain(htmlLang);
    const langFindings: AdvisoryFinding[] = htmlLang === 'cy' ? [] : [{
      rule: 'translation-html-lang',
      impact: 'serious',
      // Plain text only: Odhín renders annotation text as raw HTML.
      summary: `document lang stays "${htmlLang}" instead of "cy" after switching to Welsh (WCAG 3.1.1 Language of Page)`,
      targets: ['html']
    }];
    if (langFindings.length) {
      testInfo.annotations.push({ type: 'advisory', description: langFindings[0].summary });
    }

    const axe = await new AxeBuilder({ page }).analyze();

    await recordAdvisoryEvidence(testInfo, {
      feature,
      pageState: 'Welsh via translation API',
      language: 'cy',
      findings: [...langFindings, ...axeFindings(axe)],
      axe
    });
  });
});
