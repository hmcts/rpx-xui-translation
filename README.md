# RpxTranslation

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 17.3.6.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The app will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory. Use the `--prod` flag for a production build.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

The demo app (`projects/rpx-xui-translation-demo`) is the end-to-end harness. Playwright smoke tests live in `playwright_tests/` and fake the translation API with route handlers, so no backend is needed.

```bash
yarn playwright install chromium   # first run only
yarn test:e2e                      # starts the demo on http://127.0.0.1:4300 and runs the Chromium smoke
yarn lint:playwright               # eslint + typecheck of the Playwright sources
```

Set `PLAYWRIGHT_TEST_BASE_URL` to run against an already running demo instead of starting one. Reports are written to `playwright-report/` and `test-results/`.

## Playwright reporting

Reporting follows the `rpx-xui-common-lib` standard (fail-closed Odhín reporter, browser-verified dashboard, GitHub Pages publication) with the current `rpx-xui-webapp` Odhín styling.

```bash
yarn test:e2e                      # Chromium smoke only (--project=chromium); list,html,junit,odhin locally
yarn test:e2e:crossbrowser         # advisory: the same smoke on smoke-firefox and smoke-webkit
yarn test:a11y                     # advisory: axe scans of the EN and CY demo states (playwright.accessibility.config.ts)
PLAYWRIGHT_REPORTERS=list yarn test:e2e
yarn test:e2e:odhin-check          # opens the generated Odhín report in Chromium and checks the dashboard
yarn test:reporters                # node --test checks for the reporter, publisher and workflow contract
```

- `PLAYWRIGHT_REPORTERS`: a comma-separated subset of `dot,list,html,junit,odhin`. An unknown name fails the run. The default is `list,html,junit,odhin` locally and `dot,html,junit,odhin` in CI.
- `PW_ODHIN_OUTPUT` (default `test-results/odhin`) and `PW_ODHIN_INDEX` (default `translation-playwright.html`) set the Odhín output folder and index file. `yarn test:e2e:odhin-check` reads the same variables.
- Outputs: Odhín `test-results/odhin/translation-playwright.html` (its assets and failure logs sit beside it), HTML `playwright-report/`, JUnit `test-results/junit.xml`, traces and screenshots of failures under `test-results/`.
- The Odhín reporter fails the run if the report is missing or empty, if enhancement throws, or if a reporter hook fails or times out. A green test run with a broken report exits nonzero.

### Advisory packs

Neither pack runs in the default `yarn test:e2e` or in the `Node.js Package` workflow.

- **Cross-browser:** the smoke spec runs on the `smoke-firefox` and `smoke-webkit` projects. Install those browsers first with `yarn playwright install firefox webkit`. The Odhín report goes to `test-results/odhin/translation-playwright.html`.
- **Accessibility:** `playwright_tests/accessibility/translation-demo.a11y.spec.ts` runs axe on the English default state and on the Welsh state. The Welsh state uses the same `/cy` route fake as the smoke (`playwright_tests/fixtures/translation-api.fake.ts`).
  - Findings are advisory. Each test attaches its axe JSON, and the findings appear in the Odhín Accessibility tab at `test-results/odhin/accessibility/index.html`, with the raw files under `accessibility-evidence/`.
  - Findings never fail the run. Execution, fake or report errors still do.
  - The spec also records whether `<html lang>` follows the switch to Welsh. At present it stays `en`, which is reported as the advisory finding `translation-html-lang`.
  - To check that report, run `PW_ODHIN_OUTPUT=test-results/odhin/accessibility PW_ODHIN_INDEX=index.html yarn test:e2e:odhin-check`.

Both packs have a manual GitHub workflow. The `ref` input selects the code under test, and `--ref master` selects the trusted workflow definition:

```bash
gh workflow run cross-browser-odhin.yml -R hmcts/rpx-xui-translation --ref master -f ref=<branch-or-sha>
gh workflow run accessibility-odhin.yml -R hmcts/rpx-xui-translation --ref master -f ref=<branch-or-sha>
```

GitHub only lets you dispatch a workflow that exists on the default branch, so both workflows become runnable after merge.
- Cross-browser reports from successful or failed test runs publish to `reports/<branch-slug>/cross-browser/runs/...`.
- Successful accessibility runs publish to `reports/<branch-slug>/accessibility/runs/...`.

### Publication

The `Node.js Package` workflow is read-only. It runs the Chromium suite, verifies the rendered dashboard and uploads two artifacts: `translation-playwright-evidence` (always) and `translation-functional-report` (only when the dashboard check passed). It still runs the dashboard check when tests fail, so a valid report of a failed run is published.

`Publish Translation Odhín evidence` (`.github/workflows/publish-odhin.yml`) runs on `workflow_run` after `Node.js Package` finishes with success or failure, for same-repository pull requests and for pushes to `master` or `Release`. It also runs after the two advisory workflows, as described above. It appends the exact report to the immutable history on the `odhin-reports` branch at `reports/<branch-slug>/runs/<run-id>-attempt-<attempt>/`. GitHub Pages serves the current run only. Cancelled runs, missing artifacts and fork pull requests are not published.

- Prerequisite: a repository admin enables GitHub Pages with source **GitHub Actions** and allows `master` in the `github-pages` environment.
- GitHub loads `workflow_run` and `workflow_dispatch` workflows from the default branch. Publication therefore starts only after this workflow is merged to `master`.
- To re-publish an exact run, open **Actions** → **Publish Translation Odhín evidence**, keep **Use workflow from** on `master`, enter the numeric source run ID and choose **Run workflow**.

### Vendored reporter sources

`playwright_tests/reporters/` is vendored and excluded from ESLint. Each file starts with a `Vendored from` header that names its source, and every local change is marked `ADAPTED`.

| Files | Source |
| --- | --- |
| `odhin-report-enhancer.cjs`, `failure-context.cjs`, `presentation/enhance.cjs`, `presentation/accessibility.cjs`, `presentation/accessibility.js`, `presentation/report.css`, `presentation/report.js` | `hmcts/rpx-xui-webapp@2caeccf903473116a3e74bd703fc1233e84be89f` `playwright_tests_new/common/reporters/` |
| `odhin-adaptive.reporter.cjs`, `odhin-site-publisher.cjs`, `odhin-report.browser-check.cjs`, `presentation/report-navigation.css` | `hmcts/rpx-xui-common-lib@b27d3cd20a9ed08cf2ba7fdf50926c59d4250393` `e2e/reporters/` |
| `.github/workflows/publish-odhin.yml`, `cross-browser-odhin.yml`, `accessibility-odhin.yml`. Local changes: translation names and paths, and `timeout-minutes: 20` on every job. The two advisory workflows also install the library's own dependencies (`cd projects/rpx-xui-translation && yarn install`), and run `yarn lint:playwright` where upstream runs `test:e2e:typecheck` and `yarn test:reporters` where upstream runs `yarn node --test …`. The accessibility workflow runs the lean axe pack (`yarn test:a11y` plus `test:e2e:odhin-check`) and checks the evidence (two manifests and the Accessibility tab) before packaging. | `hmcts/rpx-xui-common-lib@b27d3cd20a9ed08cf2ba7fdf50926c59d4250393` `.github/workflows/` |
| `odhin-reporter.node-check.cjs` (from `odhin-report-enhancer.node-check.cjs`), `odhin-site-publisher.node-check.cjs`, `report-publication.node-check.cjs` | `hmcts/rpx-xui-common-lib@b27d3cd20a9ed08cf2ba7fdf50926c59d4250393` `e2e/reporters/` |
| `.yarn/patches/odhin-reports-playwright-npm-1.1.8-a445ed88b7.patch` | `hmcts/rpx-xui-webapp@2caeccf903473116a3e74bd703fc1233e84be89f` (identical in common-lib) |

To re-sync, check out the new upstream SHA. For each file, compare the upstream file with the vendored file minus its header line, for example:

```bash
diff <(git -C ../rpx-xui-webapp show <sha>:playwright_tests_new/common/reporters/presentation/report.css) \
     <(tail -n +2 playwright_tests/reporters/presentation/report.css)
```

For runtime files, only `ADAPTED` lines may differ. Node-checks also differ by whole upstream cases that were removed or adapted; each node-check lists these in the `ADAPTED` lines under its header. Copy the upstream file, re-apply the `ADAPTED` edits, update the SHA in the header and in this table, then run `yarn test:reporters`, `yarn test:e2e` and `yarn test:e2e:odhin-check`.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI README](https://github.com/angular/angular-cli/blob/master/README.md).
