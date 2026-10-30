# RPX XUI Translation library

Angular library providing the `rpxTranslate` pipe, translation service, English/Welsh language selection and browser translation cache.

Use the [repository guide](../../README.md) for integration examples, the current Node/Yarn toolchain, both dependency installations, the demo, Playwright coverage and reports, and the CI/release workflow.

## Build and unit tests

Run these commands from the **repository root**, after completing the setup in the repository guide:

```bash
yarn build:library
yarn test --watch=false --browsers=ChromeHeadless
```

The production build writes to `dist/rpx-xui-translation/`. Library unit tests use Jasmine/Karma and require Chrome; browser setup alternatives are covered in the repository guide.
