RPX XUI TRANSLATION LIBRARY
===========================

Overview
--------

@hmcts/rpx-xui-translation is an Angular library that provides translation
services for Reform programme applications. It exposes an Angular module,
translation service and rpxTranslate pipe.

The library supports English and Welsh language values through the RpxLanguage
type:

    en
    cy

Translations are cached in the browser using IndexedDB through Dexie. The
service can retrieve translations from a configured backend and can apply
placeholder and yes-or-no replacements.


Prerequisites
-------------

- Node.js 24.18.0 or a later version accepted by package.json.
- Yarn 4.5.3.
- Git Bash or WSL on Windows for shell commands that use Unix-style syntax.

Install dependencies from the repository root:

    corepack enable
    yarn install --immutable

To install both the workspace and the project package dependencies, use:

    yarn install-all


Run the demo application
------------------------

Start the Angular demo without opening a browser:

    yarn start:no-open

Start the demo and open a browser automatically:

    yarn start

The demo is normally available at:

    http://localhost:4200/

The demo is a development host and does not replace a consuming application's
translation configuration.


Build and package the library
-----------------------------

Build the library and merge the generated package metadata:

    yarn build

The explicit library command is:

    yarn build:library

Build continuously while editing the library:

    yarn build:library:watch

The generated package is written below:

    dist/rpx-xui-translation/

Create the compressed elements bundle when required:

    yarn package

The library package version and Angular peer dependency ranges are defined in
package.json and projects/rpx-xui-translation/package.json.


Integrate the library
---------------------

Import the module with forRoot in the consuming application's root module:

    import { RpxTranslationModule } from '@hmcts/rpx-xui-translation';

    @NgModule({
      imports: [
        RpxTranslationModule.forRoot({
          baseUrl: '/api/translation',
          validity: { hours: 24 }
        })
      ]
    })

Use forChild in lazy-loaded modules:

    RpxTranslationModule.forChild()

The configuration includes:

- baseUrl: backend endpoint used to retrieve translations.
- validity: duration for which cached translations remain valid.
- debounceTimeMs: delay used when translation requests are coalesced.
- testMode: test configuration switch.

Use the pipe in a template:

    {{ 'case details' | rpxTranslate }}

The pipe also supports replacements and yes-or-no values through the service
API. Keep phrases stable and consistent so that the backend and browser cache
can identify them reliably.


Translation behaviour
---------------------

The service:

- Tracks the current language and persists the preference in the
  exui-preferred-language cookie.
- Caches translated data in the RpxTranslations IndexedDB database.
- Supports English and Welsh values.
- Supports replacement values within translated phrases.
- Supports translated Yes and No values.
- Marks unavailable translations as Translation in progress until a value is
  returned by the backend.

When changing language, existing phrases are refreshed through the service.
Applications should provide accessible language-selection controls and ensure
that translated content remains meaningful when a phrase is not yet available.


Unit tests and quality checks
-----------------------------

Run the library unit tests:

    yarn test

Run linting:

    yarn lint

Run the end-to-end command when the configured Angular e2e environment is
available:

    yarn e2e

Review generated dist/ output and test results before publishing.


Development workflow
--------------------

1. Create a focused branch.
2. Install dependencies with yarn install --immutable.
3. Start the demo with yarn start:no-open.
4. Build the library with yarn build:library:watch when testing a consuming
   application.
5. Add or update unit tests for translation, caching and replacement behaviour.
6. Run yarn lint and yarn test.
7. Review Angular peer dependency compatibility.
8. Build the package and inspect dist/ before release.


Troubleshooting
---------------

The demo does not start

- Check the Node.js and Yarn versions.
- Run corepack enable and yarn install --immutable.
- Check that port 4200 is free.

Translations do not load

- Check the configured baseUrl and backend response.
- Confirm the requested phrase is stable and not surrounded by unintended
  whitespace.
- Check the selected language is either en or cy.
- Clear the RpxTranslations IndexedDB database when testing cache changes.
- Confirm that the validity configuration has not expired unexpectedly.

The language preference is not retained

- Check the exui-preferred-language cookie.
- Confirm that the browser allows the application to set cookies.
- Check that the stored value is en or cy.

The package is incompatible with a consumer

- Check Angular, RxJS and zone.js peer dependency versions.
- Rebuild the library and confirm that the consumer resolves the intended
  dist/ package.
- Run the unit tests before investigating the consuming application.


UK English and technical terminology
-------------------------------------

Use UK English in documentation, examples, translation source phrases and
support responses:

    organisation / organisations
    authorise / authorisation
    behaviour
    centre
    colour
    customise / customisation
    licence (noun) / license (verb)
    prioritise

Keep language codes, cookie names, API fields, package names and exported
identifiers unchanged.


Licence
-------

This project is licensed under the MIT Licence.
