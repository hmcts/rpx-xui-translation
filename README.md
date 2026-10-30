# RPX XUI Translation

Angular translation library for Reform applications, with a small browser demo and automated checks. The library provides the `rpxTranslate` pipe, `RpxTranslationService`, language selection, batched translation requests and a browser cache. The demo exercises the library source directly; it is not a translation backend or a complete XUI application.

This guide covers a clean checkout, the demo, builds, unit tests, Playwright coverage and generated evidence. Run commands from the repository root unless stated otherwise. Examples use Bash or Zsh; `open` is a macOS convenience.

## Integrate the library

Import the module in a consuming application's root module with `forRoot`:

~~~typescript
import { RpxTranslationModule } from '@hmcts/rpx-xui-translation';

@NgModule({
  imports: [
    RpxTranslationModule.forRoot({
      baseUrl: '/api/translation',
      validity: { hours: 24 }
    })
  ]
})
~~~

Use `RpxTranslationModule.forChild()` in lazy-loaded modules. The configuration
sets the translation backend (`baseUrl`), cache lifetime (`validity`), request
coalescing delay (`debounceTimeMs`) and demo fallback (`testMode`). Use the
`rpxTranslate` pipe in templates:

~~~html
{{ 'case details' | rpxTranslate }}
~~~

The service supports English (`en`) and Welsh (`cy`), placeholder replacements
and translated Yes and No values. It persists the selected language in the
`exui-preferred-language` cookie and caches translations in the `RpxTranslations`
IndexedDB database. Unavailable translations display a
`[Translation in progress]` placeholder until a value is returned. Keep source
phrases stable so the backend and browser cache can identify them reliably.

## What lives where

| Path | Purpose |
| --- | --- |
| `projects/rpx-xui-translation/src/` | Library implementation, Jasmine specs and public exports in `public-api.ts` |
| `projects/rpx-xui-translation/package.json` | Published library dependency and peer-dependency contract |
| `projects/rpx-xui-translation-demo/` | Angular demo that imports the library source |
| `angular.json` | Explicit library build/test and demo build/serve targets |
| `playwright.config.ts` | Functional browser projects, demo server and reporters |
| `playwright.accessibility.config.ts` | Separate Chromium accessibility advisory |
| `playwright_tests/` | Browser specs, translation API fake, reporter checks and publication support |
| `.github/workflows/` | Build, release, advisory and report-publication workflows |

## 1. Select the checkout and toolchain

You need Git, network access to the source/package/browser registries, and an installed Node version manager or a managed Node installation. The commands below select the project toolchain; they do not install Git or a Node manager on an empty machine.

Clone the repository, or use your existing checkout:

~~~bash
git clone https://github.com/hmcts/rpx-xui-translation.git
cd rpx-xui-translation
git status --short
git branch --show-current
~~~

Playwright and reporting were introduced in [PR #91](https://github.com/hmcts/rpx-xui-translation/pull/91) and are available on `master`. For an older branch, check its `package.json` before using the commands below; an absent `test:e2e` script means that revision predates the browser checks.

Use the pinned toolchain:

| Tool | Version / source |
| --- | --- |
| Node.js | `24.22.1` in `.nvmrc` and CI; root engine requirement `>=24.22.1` |
| Yarn | `4.5.3` through the root `packageManager` field |
| Angular / CLI | Angular `20.3.31`, CLI `20.3.32`, installed locally |
| Playwright | `1.64.1`, installed locally |

Select Node **before** running Corepack or Yarn. With an existing nvm installation:

~~~bash
nvm install
nvm use
node --version
corepack enable
yarn --version
~~~

Expected: `v24.22.1` and `4.5.3`. With another Node manager, select the same version there. Corepack must be available in that Node installation; follow your managed environment's setup if it is absent or cannot write its shims. Use `yarn ng` rather than a global Angular CLI.

## 2. Install both dependency trees

The root Angular workspace and the library folder have separate tracked lockfiles. Install both:

~~~bash
yarn install --immutable
(cd projects/rpx-xui-translation && yarn install --immutable)
~~~

Immutable installs reject changes to the committed dependency graph. The child folder is a separate Yarn project. Its own dependencies include Luxon 2 and matching types, while the root uses Luxon 3; skipping its install can affect library compilation. Keep both lockfiles and use Yarn for both.

Check that installation preserved them:

~~~bash
git diff --exit-code -- yarn.lock projects/rpx-xui-translation/yarn.lock
~~~

The CI workflow and `yarn install-all` use ordinary installs for both folders. The explicit local commands above add lockfile enforcement. Investigate an immutable-lock failure against the selected revision and toolchain before changing dependencies. Existing peer-dependency warnings are separate from an install command failing.

Install Chromium for the smoke tests, reporter checks and rendered-report checker:

~~~bash
yarn playwright install chromium
~~~

For the advisory Firefox/WebKit pack:

~~~bash
yarn playwright install firefox webkit
~~~

On Linux runners needing browser system packages, use `yarn playwright install --with-deps chromium` (or include `firefox webkit`). This can require administrator access. Playwright browser downloads and system Google Chrome are separate installations.

## 3. Start and inspect the demo

Start the explicit application target in one terminal:

~~~bash
yarn ng serve rpx-xui-translation-demo --host 127.0.0.1 --port 4300
~~~

Open [http://127.0.0.1:4300/](http://127.0.0.1:4300/) after compilation finishes. A fresh browser context should show:

- **Translation Demo App** and **Current language: en**.
- **Untranslated text** and **Translated Text**.
- **Newid i'r Gymraeg**; **Change to English** appears after switching.

The server rebuilds on source changes. Stop it with `Ctrl+C`. A library build is not required first because the demo imports the library source. Prefer the explicit project command to unqualified `ng serve` or `yarn start`.

### What a manual Welsh switch proves

The demo uses `baseUrl: ''`, a 300 ms debounce, one-day cache validity and `testMode: true`. Switching to Welsh sends `POST /cy` to the demo origin with a body such as `{"phrases":["Translated Text"]}`. This repository supplies neither that translation service nor a demo proxy for it.

On the standalone server, the request fails and the library displays **[Test translation for Translated Text]** after its in-progress text. The language can still become `cy`, and **Change to English** restores the source phrase. This is the configured fallback, not a live Welsh translation.

Playwright supplies its own `POST /cy` route fake. Its success scenario returns **Testun wedi'i gyfieithu [fake translation API]**; a separate scenario deliberately returns HTTP 500 to check the fallback. No backend, login, environment file or application secret is needed for these browser tests.

Language is persisted in the `exui-preferred-language` cookie and translations in IndexedDB database `RpxTranslations`. A reused browser may start in Welsh or show cached fallback text. Use a fresh profile, or clear this demo origin's cookie and IndexedDB for a clean manual check. Playwright uses isolated contexts. Stay on one hostname: `localhost` and `127.0.0.1` have different browser storage.

## 4. Build and check the library

~~~bash
yarn build:library
yarn ng build rpx-xui-translation-demo --configuration production
~~~

- `yarn build` aliases `yarn build:library`; library output is `dist/rpx-xui-translation/`.
- The library production build then runs `scripts/sync-library-package.mjs` to copy dependency/peer-dependency declarations from the library manifest into its generated package.
- The separate demo production output is `dist/rpx-xui-translation-demo/`.
- `yarn build:library:watch` omits that manifest-sync step. Run the full library build before inspecting a final distributable.

Use `--configuration production`; do not copy the obsolete `--prod` flag from older Angular instructions. The legacy `yarn package` script expects application-style bundles and is not the library build or release-validation command.

Run lint and library unit tests:

~~~bash
yarn lint
yarn test --watch=false --browsers=ChromeHeadless
~~~

`yarn lint` checks Angular project TypeScript and runs `yarn lint:playwright`. The latter also compiles Playwright sources using `playwright_tests/tsconfig.json`. Jasmine/Karma covers library services, the pipe and helpers without starting the demo. Karma listens on port 9876 and needs Chrome.

If system Google Chrome is unavailable, use installed Playwright Chromium for this invocation:

~~~bash
export CHROME_BIN="$(yarn node -p 'require("@playwright/test").chromium.executablePath()')"
yarn test --watch=false
~~~

A missing-browser launcher error is a setup failure, not a failed assertion. Install Chromium before resolving its executable path.

## 5. Run browser checks

The functional config starts the demo automatically at `http://127.0.0.1:4300/` with a three-minute startup budget. Locally it may reuse a server already at that URL; confirm that it is this checkout's demo. CI does not reuse it, so stop a manually started server before a `CI=1` run. Tests have zero retries.

| Command | Scope | Expected executions |
| --- | --- | --- |
| `yarn test:e2e` | Five functional smoke scenarios on Chromium; default local/CI lane | 5 |
| `yarn playwright test` | Same scenarios on all three functional projects | 15 |
| `yarn test:e2e:crossbrowser` | Advisory smoke on `smoke-firefox` and `smoke-webkit` | 10 |
| `yarn test:a11y` | Separate EN/CY axe advisory on `chromium-a11y` | 2 |
| `yarn test:reporters` | Node checks for reporters, publisher, workflow contracts, selection and accessibility evidence | See runner summary |

Fifteen functional executions are five scenarios across three browsers, not fifteen distinct scenarios. Accessibility is excluded from the functional config.

The smoke covers English defaults; the Welsh request/in-progress/fake-success states; cookie/cache restoration after reload without another translation request, followed by returning to English; fallback after a faked API failure; and refresh of an expired Welsh IndexedDB entry. Unexpected page/console errors also fail the specs. This is demo/library integration evidence, not deployed-service validation.

`yarn test:reporters` also launches Chromium. Some checks deliberately run a failing inner test to prove error handling; judge the outer Node test summary and command exit status, not that controlled inner failure in isolation.

To use a demo you started yourself:

~~~bash
PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:4300 yarn test:e2e
~~~

When set, this variable disables Playwright server management. It must identify a running compatible demo; translation route fakes still apply. Unset it to restore automatic startup. Browser-free discovery is available with `yarn test:e2e --list`.

## 6. Generate, verify and read reports

Default local reporters are `list,html,junit,odhin`; CI uses `dot,html,junit,odhin`. Generate the functional report and verify its rendered dashboard:

~~~bash
yarn test:e2e
yarn test:e2e:odhin-check
~~~

| Evidence | Default path |
| --- | --- |
| Odhín dashboard and companion assets | `test-results/odhin/translation-playwright.html` |
| Playwright HTML report | `playwright-report/index.html` |
| JUnit XML | `test-results/junit.xml` |
| Failure traces/screenshots | Per-test folders under `test-results/` |
| Reporter failure logs | Beside Odhín, including its `logs/` folder |

The Odhín checker launches Chromium even for a Firefox/WebKit report. It checks dashboard metrics, panels, feature drill-down, native result details/steps and browser console/page errors. A written HTML file alone is not equivalent evidence.

Open reports on macOS:

~~~bash
open test-results/odhin/translation-playwright.html
yarn playwright show-report playwright-report
~~~

Keep the whole Odhín folder together because assets/attachments are external. To inspect a failure trace, replace this example assignment with an actual retained file:

~~~bash
TRACE_FILE=test-results/example-failed-test/trace.zip
yarn playwright show-trace "$TRACE_FILE"
~~~

Traces and screenshots are retained on failure; a green run need not contain them. Inspect available evidence before changing assertions, routes or waits.

### Reporter selection and separate runs

`PLAYWRIGHT_REPORTERS` overrides the whole reporter set. If unset/empty, `PLAYWRIGHT_DEFAULT_REPORTER` is used; if both are unset/empty, the built-in set applies. Supported comma-separated names are `dot,list,html,junit,odhin`. Unknown names or a nonempty value containing no names fail configuration.

~~~bash
PLAYWRIGHT_REPORTERS=list,html,junit,odhin yarn test:e2e
~~~

A `list`-only run produces no new HTML, JUnit or Odhín report. Do not validate a stale dashboard as evidence for it. Odhín fails the command when generation, enhancement or a reporter hook fails/times out, or the report is missing/empty. Passing scenarios with broken reporting still give a nonzero run.

Successive browser runs reuse output locations. A distinct Odhín folder alone does not preserve HTML/JUnit/browser output, and a later run can clear subfolders of `test-results/`. Archive complete evidence **before** starting the next lane:

~~~bash
EVIDENCE_ARCHIVE="${TMPDIR:-/tmp}/translation-functional-$(date +%Y%m%d-%H%M%S).tar.gz"
tar -czf "$EVIDENCE_ARCHIVE" playwright-report test-results
printf '%s\n' "$EVIDENCE_ARCHIVE"
~~~

Use another archive label for other lanes. Keep generated artifacts out of commits and share sanitized evidence.

`PW_ODHIN_OUTPUT` and `PW_ODHIN_INDEX` override the Odhín folder/filename. After archiving the functional evidence, run cross-browser generation and its browser check with identical values:

~~~bash
PW_ODHIN_OUTPUT=test-results/odhin/cross-browser PW_ODHIN_INDEX=index.html \
  yarn test:e2e:crossbrowser
PW_ODHIN_OUTPUT=test-results/odhin/cross-browser PW_ODHIN_INDEX=index.html \
  yarn test:e2e:odhin-check
~~~

Archive these outputs with a cross-browser label before running accessibility.

### Accessibility advisory

~~~bash
yarn test:a11y
PW_ODHIN_OUTPUT=test-results/odhin/accessibility PW_ODHIN_INDEX=index.html \
  yarn test:e2e:odhin-check
yarn node playwright_tests/accessibility/verify-evidence.cjs test-results/odhin/accessibility
open test-results/odhin/accessibility/index.html
~~~

The config writes HTML to `playwright-report/accessibility/`, JUnit to `test-results/accessibility/junit.xml`, browser artifacts to `test-results/accessibility/browser/` and Odhín to `test-results/odhin/accessibility/index.html`. Axe JSON/HTML/manifests are in its `accessibility-evidence/` folder and linked from its Accessibility tab.

Violations and incomplete checks are advisory evidence to review; they do not fail the pack. Execution, fake and reporting errors still fail it. The Welsh check also records the current document-language limitation: `<html lang>` stays `en`, reported as `translation-html-lang`. Two passed executions do not certify accessibility compliance.

The verifier requires exactly one EN and one CY axe record, nonempty linked JSON/HTML and an Accessibility tab. It accepts a positional folder and always checks `index.html`. Keep that filename if overriding the advisory folder; its folder is not selected through `PW_ODHIN_OUTPUT` automatically.

## 7. Complete local validation pass

After setup, stop any manually started demo with `Ctrl+C` so this pass starts the server from the intended checkout. Run these in order. The first two lines remove ambient reporter/server/output overrides from this shell. Stop on a failed command and inspect the evidence before proceeding.

~~~bash
unset PLAYWRIGHT_REPORTERS PLAYWRIGHT_DEFAULT_REPORTER PW_ODHIN_OUTPUT PW_ODHIN_INDEX PLAYWRIGHT_TEST_BASE_URL
unset PLAYWRIGHT_HTML_OUTPUT_DIR PLAYWRIGHT_HTML_REPORT PLAYWRIGHT_JUNIT_OUTPUT_FILE
yarn lint
export CHROME_BIN="$(yarn node -p 'require("@playwright/test").chromium.executablePath()')"
yarn test --watch=false
yarn build:library
yarn ng build rpx-xui-translation-demo --configuration production
yarn test:reporters
yarn test:e2e
yarn test:e2e:odhin-check
~~~

Expect successful lint/typecheck, unit/build and Node checks, five passing Chromium scenarios, then a passing dashboard check. Archive functional evidence using the command above. Run the optional cross-browser commands with their matched dashboard check, archive those outputs, then run the accessibility commands. The 15-execution all-project command is an alternative to separate functional/cross-browser runs for a combined functional report.

Record `git rev-parse HEAD`, tool versions, commands, exit statuses and archive paths with review evidence. A browser pack alone does not prove packaging, unit coverage, report rendering or live-service compatibility.

## Troubleshooting

| Symptom | Check / action |
| --- | --- |
| Engine or Angular tooling error | Select Node `24.22.1` and Yarn `4.5.3`, then install against this revision's locks. |
| Missing Luxon types/build resolution errors | Confirm root and child installs; inspect their separate manifests/locks before changing versions. |
| Startup fails on port 4300 | Identify the process; stop your stale demo or explicitly target the correct server. Do not let reuse hide another application. |
| Browser starts in Welsh/shows old text | Use a fresh profile or clear only this demo origin's cookie/IndexedDB. |
| Manual Welsh request fails | No standalone `/cy` backend is supplied; fallback is expected. Use fake-backed tests for deterministic success coverage. |
| Karma cannot find Chrome | Install Chromium and use `CHROME_BIN` above, or supply managed Google Chrome. |
| Playwright executable/system library missing | Install the relevant browsers; Linux may need system dependencies and appropriate access. |
| macOS Chromium exits with `mach_port_rendezvous ... Permission denied (1100)` | Use an unrestricted local terminal; sandbox launch failure is not product behavior. |
| Tests pass but command exits nonzero | Inspect reporter finalization errors/Odhín logs; reporting intentionally fails closed. |
| Dashboard missing, stale or from another lane | Check selection, matched Odhín variables, current outputs and prior archives. |
| Accessibility executions pass with findings | Advisory policy permits findings; review JSON, incomplete checks and the Accessibility tab. |

Do not start with force installs, dependency upgrades, broad retries or weaker assertions. Retain the failure and identify whether setup, the demo, tests or reporting failed.

## CI and optional publication

Local validation ends before publication. Remote dispatch, release and Pages setup require repository access and workflows on the default branch; they are not local prerequisites.

The `Node.js Package` workflow's build job has read-only repository permissions. It installs both trees, runs lint, Karma, the library build, Node reporter checks and Chromium smoke, then checks the rendered dashboard. It attempts `translation-playwright-evidence` upload even on failure. `translation-functional-report` is uploaded only after the dashboard check passes; a valid report of failed tests can still be downloaded. Separate release-only jobs publish the package/attach a tarball after build success.

In the source run summary, follow **Download browser-verified Odhín report**, or download the artifact. Replace this example ID with the exact numeric `Node.js Package` source run:

~~~bash
SOURCE_RUN_ID=123456789
gh run download "$SOURCE_RUN_ID" -R hmcts/rpx-xui-translation \
  -n translation-functional-report --dir translation-functional-report
open translation-functional-report/translation-playwright.html
~~~

Extract the whole artifact. Source artifacts are independent of Pages. Source build success does not prove Pages configuration or publication.

### Activate and use Pages after merge

`Publish Translation Odhín evidence` (`.github/workflows/publish-odhin.yml`) activates after its workflow is merged to `master`. A repository administrator must enable Pages with source **GitHub Actions** and allow `master` in the `github-pages` environment. Both `workflow_run` and manual dispatch depend on default-branch workflow availability.

Once active, the publisher handles `Node.js Package` success/failure for same-repository PRs and pushes to `master`/`Release`, plus the advisory workflows. Cancelled runs, fork PRs and missing artifacts are excluded. It archives reports on `odhin-reports` at `reports/<branch-slug>/runs/<run-id>-attempt-<attempt>/`; advisory history uses `cross-browser/runs/` or `accessibility/runs/` beneath the branch slug. A successful Pages deployment serves the current run only. Follow the deployed link in the publisher summary.

To dispatch advisory workflows after merge, use `master` below or replace it with an existing remote branch, tag or commit SHA. `--ref master` chooses the trusted workflow definition; `-f ref` chooses the code:

~~~bash
TARGET_REF=master
gh workflow run cross-browser-odhin.yml -R hmcts/rpx-xui-translation --ref master -f ref="$TARGET_REF"
gh workflow run accessibility-odhin.yml -R hmcts/rpx-xui-translation --ref master -f ref="$TARGET_REF"
~~~

Neither advisory pack runs in the default build. Cross-browser reports can publish after successful/failed tests; accessibility publication requires a successful advisory run and verified evidence.

Republish an exact source run after merge:

~~~bash
gh workflow run publish-odhin.yml -R hmcts/rpx-xui-translation \
  --ref master -f source_run_id="$SOURCE_RUN_ID"
~~~

The Actions UI provides the same operation: select **Publish Translation Odhín evidence**, keep **Use workflow from** on `master` and enter the numeric source ID. Byte-identical republication skips an empty archive commit and redeploys Pages; different content under an existing run key is rejected. Reports record the tested commit in `odhin-source.json`. For PRs this is the merge checkout, with PR head/base SHAs recorded separately.

### Vendored reporter sources

`playwright_tests/reporters/` is vendored and excluded from ESLint. The hybrid `presentation/enhance.cjs` restores CommonLib b27d3cd2 per-result retained-output download links; preserve this `ADAPTED` block when re-syncing WebApp presentation code. Each file starts with a `Vendored from` header that names its source, and every local change is marked `ADAPTED`.

| Files | Source |
| --- | --- |
| `odhin-report-enhancer.cjs`, `failure-context.cjs`, `presentation/enhance.cjs`, `presentation/accessibility.cjs`, `presentation/accessibility.js`, `presentation/report.css`, `presentation/report.js` | `hmcts/rpx-xui-webapp@2caeccf903473116a3e74bd703fc1233e84be89f` `playwright_tests_new/common/reporters/` |
| `odhin-adaptive.reporter.cjs`, `odhin-site-publisher.cjs`, `odhin-report.browser-check.cjs`, `presentation/report-navigation.css`. These intentionally diverge from upstream, and the fixes should be offered to common-lib. **F4:** the reporter keeps its deadline timer referenced, where upstream `unref`s it and lets a hung hook exit 0. **F6:** the publisher accepts a byte-identical re-publish of an archived run, where upstream always throws. | `hmcts/rpx-xui-common-lib@b27d3cd20a9ed08cf2ba7fdf50926c59d4250393` `e2e/reporters/` |
| `.github/workflows/publish-odhin.yml`, `cross-browser-odhin.yml`, `accessibility-odhin.yml`. Local changes: translation names and paths, and `timeout-minutes: 20` on every job. The two advisory workflows also install the library's own dependencies (`cd projects/rpx-xui-translation && yarn install`), and run `yarn lint:playwright` where upstream runs `test:e2e:typecheck` and `yarn test:reporters` where upstream runs `yarn node --test …`. The accessibility workflow runs the lean axe pack (`yarn test:a11y` plus `test:e2e:odhin-check`) and, before packaging, runs `playwright_tests/accessibility/verify-evidence.cjs`. That script checks for exactly one EN and one CY axe record, that every linked JSON and HTML file exists and is non-empty, and that the Accessibility tab is present. Intentional divergences: **F5**, `npmpublish.yml` writes `odhin-source.json` for the functional report and `publish-odhin.yml` reads it for every report type, where upstream reads it only for advisory reports. **F6**, `publish-odhin.yml` skips the empty archive commit when a re-publish is identical. All three report manifests bind `runId`/`runAttempt` to the source workflow. The publisher rejects mismatched or legacy manifests before archive access, and rejects automatic events whose attempt has changed. Manual recovery freezes the current completed attempt and requires matching evidence. | `hmcts/rpx-xui-common-lib@b27d3cd20a9ed08cf2ba7fdf50926c59d4250393` `.github/workflows/` |
| `odhin-reporter.node-check.cjs` (from `odhin-report-enhancer.node-check.cjs`), `odhin-site-publisher.node-check.cjs`, `report-publication.node-check.cjs`. The publication checks also execute the functional artifact summary, all three manifest scripts and the attempt validation. Reporter checks cover failed/timed-out output downloads, suppression and lane-specific screenshot/trace links. | `hmcts/rpx-xui-common-lib@b27d3cd20a9ed08cf2ba7fdf50926c59d4250393` `e2e/reporters/` |
| `.yarn/patches/odhin-reports-playwright-npm-1.1.8-a445ed88b7.patch` | `hmcts/rpx-xui-webapp@2caeccf903473116a3e74bd703fc1233e84be89f` (identical in common-lib) |

To re-sync, check out the new upstream SHA. For each file, compare the upstream file with the vendored file minus its header line, for example:

```bash
UPSTREAM_SHA=2caeccf903473116a3e74bd703fc1233e84be89f
diff <(git -C ../rpx-xui-webapp show "$UPSTREAM_SHA":playwright_tests_new/common/reporters/presentation/report.css) \
     <(tail -n +2 playwright_tests/reporters/presentation/report.css)
```

For runtime files, only `ADAPTED` lines may differ. Node-checks also differ by whole upstream cases that were removed or adapted; each node-check lists these in the `ADAPTED` lines under its header. Copy the upstream file, re-apply the `ADAPTED` edits, update the SHA in the header and in this table, then run `yarn test:reporters`, `yarn test:e2e` and `yarn test:e2e:odhin-check`.

## UK English and technical terminology

Use UK English in documentation, examples, translation source phrases and
support responses: organisation, authorise, behaviour, centre, colour,
customise, licence (noun), license (verb), and prioritise. Keep language codes,
cookie names, API fields, package names and exported identifiers unchanged.

## Licence

This project is licensed under the MIT Licence. See [LICENCE](LICENCE).
