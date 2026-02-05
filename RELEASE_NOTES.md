# Package Review Notes - rpx-xui-translation

Date: 2026-02-05

Summary:
- Reviewed package usage across `projects/`, `src/`, and build tooling.
- Kept Angular/build tool dependencies that are required by `ng build`, lint, and test workflows even if not directly imported in source files.

Changes:
- Added peer dependency providers:
  - `@typescript-eslint/types`
  - `@typescript-eslint/utils`
  - `tslint`
- Updated versions to reduce peer warnings:
  - `@angular/compiler` pinned to `20.3.14`
  - `@angular/compiler-cli` pinned to `20.3.14`
  - `jasmine-core` -> `~5.1.0`
- No dependency removals in this pass.

Notes:
- Packages like `@angular/compiler`, `@angular/animations`, `@angular/cdk`, `@angular/localize`, `@angular/compiler-cli`, `typescript`, and lint/test tooling are required by Angular build/lint/test and are intentionally retained.
