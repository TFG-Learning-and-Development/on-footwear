# astro-course-shell

ON: Match the Move contains an implemented Lesson 0 and six linked placeholder lessons. Lessons 1–6 await their build instructions.

The dependency baseline is Astro `7.3.8` with Tailwind CSS `4.2.2` through `@tailwindcss/vite`. Astro 7 uses Vite 8; the installed Tailwind adapter supports that Vite major directly, so no styling migration or compatibility shim is required.

The two `@emnapi` development dependencies satisfy optional WASM compiler runtime peers in Astro 7's dependency graph. Keeping them explicit makes the tested installation reproducible; they are build-tool dependencies and are not shipped as browser code.

## Requirements

- Node.js `>=22.12.0` (tested with Node.js `24.11.1`)
- npm `>=9.6.5`
- npm package-lock v3 (`package-lock.json` must remain committed)

## Setup and commands

```sh
npm ci
npx playwright install chromium
npm run dev
npm run build
npm run verify
npm run preview
```

Use `npm ci` for a clean, lockfile-exact install. On a fresh Linux CI image, Playwright may also require `npx playwright install --with-deps chromium`. Do not replace the lockfile with a lockfile from another package manager.

The course runs standalone without credentials or environment variables. When an LMS launches the SCORM package, the course uses the LMS-provided SCORM 1.2 API. Its only external build dependencies are the packages recorded in `package-lock.json`; no external runtime services, fonts, images or analytics are used.

## File map

- `src/data/course.ts` — primary editing location for metadata, navigation labels and learner-facing copy.
- `src/pages/index.astro` and `src/pages/lesson-1.astro` through `lesson-6.astro` — separate lesson routes.
- `src/components/CoursePage.astro` — shared navigation, page structure and static footer.
- `src/components/AssessmentPanel.astro`, `LearningJourney.astro` and `LessonNavigation.astro` — reusable activity, roadmap and lesson navigation UI.
- `src/layouts/CourseLayout.astro` — shared document shell and metadata.
- `src/components/` — reusable presentation components; see [`docs/components.md`](docs/components.md) for properties and examples.
- `src/styles/global.css` — neutral theme, responsive layout, focus states and reusable component styles.
- `src/styles/typography.css` — shared Quick Course typography implementation.
- `src/styles/course-typography.css` — course-wide typography settings; see [`docs/typography.md`](docs/typography.md).
- `public/assets/` — course-specific images, downloads and static media; see [`docs/course-assets.md`](docs/course-assets.md).
- `scripts/verify-course.mjs` — production-output, responsive, interaction and verification-fixture checks.
- `scripts/fixtures/ComponentFixture.astro` — verification-only component page; it is injected only into the temporary verification build.

## Editing guidance

Start with `src/data/course.ts`. Welcome is `/`; lessons 1–6 are `/lesson-1/` through `/lesson-6/`. Keep each navigation `id` in sync with its page section. Use `CoursePage.astro` for the shared shell and add new assets under `public/assets/` after the storyboard arrives.

Do not add eyebrow content or small contextual labels above headings. Begin each section with its semantic heading, followed by an optional introduction when useful; the starter intentionally provides no eyebrow data field, component property, typography role or styling.

The default header is logo-only: keep the home link's accessible name, but do not add a visible course-name label beside the logo. The logo slot accepts wide or square image/SVG artwork without stretching. Keep all lesson links inside the Lessons dropdown at every viewport width, with the Lessons and Progress controls at the padded right edge. Both controls use white text and white borders against the blue header.

The footer sentence is fixed for every course as `Return to People Connect to continue`. Keep it as plain static text: do not turn it into a link or button, attach completion tracking, or add an LMS action. Keep Back to top in its default compact capsule treatment with the upward arrow, keyboard focus, anchor behaviour and reduced-motion support. The footer background is course-specific and should follow the supplied mood board or design board through the theme colour settings, with readable text contrast.

At mobile widths, the footer uses the standard centred vertical layout: a naturally wrapping centred message above the natural-width capsule, separated by `16px`, with `24px` top/bottom padding, `20px` side padding, a `144px` minimum height, and a `44px` minimum capsule touch height. The footer remains in normal page flow and may grow for longer wrapping; tablet and desktop retain the horizontal row.

See [`docs/components.md`](docs/components.md) and [`docs/typography.md`](docs/typography.md) before composing new sections, and [`docs/course-assets.md`](docs/course-assets.md) before adding media.

### Typography

The local default is `"Arial Nova", Arial, Helvetica, sans-serif`; no webfont is loaded. Body copy defaults to `1.125rem` with a `1.55` line height, and shared narrow, standard and wide measures are `42rem`, `54rem` and `72rem`.

Every new course must inherit this shared system through `CourseLayout.astro`. Preserve its heading hierarchy, font families, sizes, weights, line heights and responsive scaling, and use the existing typography components, classes and tokens for content and interactions. Do not replace or modify shared typography to match a mood board or design board. A heading-specific override is permitted only when explicitly requested and must remain scoped to that heading. Eyebrow content is not permitted. Full role guidance and examples are in [`docs/typography.md`](docs/typography.md).

### Theme colours

Configure course colours in the `:root` block at the top of `src/styles/global.css`:

- `--course-accent` and `--course-accent-strong`
- `--nav-hover-background` and `--nav-hover-indicator`
- `--nav-active-background` and `--nav-active-indicator`
- `--focus-on-light` and `--focus-on-dark`

Hover, active and focus states have separate tokens so they remain distinguishable. Do not assume one accent works on every surface: contrast-check the light- and dark-surface focus colours independently after changing the theme.

The Overview/hero gradient must inherit `--course-accent-strong` and `--course-accent` for every course. Replace those shared tokens from the supplied mood board or design board; do not add hard-coded starter accent colours or alter the approved hero layout and typography as part of theming.

The footer uses `--course-accent-strong` for readable contrast with its fixed white text. Lesson 0 applies the approved `#2995CC`, black and light-grey palette. The Activity progress bar and related accent states use `--course-accent`; do not add a separate progress colour. Keep the unfilled track neutral and contrast-check the filled state against it.

After editing content, run `npm run build` and `npm run verify`. The verifier creates and removes temporary component and completion fixtures, exercises desktop, tablet and mobile sizes, and checks routing, tracking, storage isolation, failed resources, console errors and horizontal overflow.

## Mandatory completion workflow

Completion tracking is part of every course build; it does not require a separate request. The ON milestone list in `src/data/course-completion.ts` contains 51 required activities across Lessons 0–6. LMS completion is enabled only after all 51 are complete. Each lesson unlocks when the preceding lesson reaches 100%. For requirements on separate pages, set `path` to the lesson route; exploration requirements also need `requiredItems` for cross-page restoration. Connect required sections, videos and interactions to the existing VIEW, WATCH, attempt-based SUBMIT or COMPLETE, and EXPLORE triggers. Preserve the approved defaults and event contracts.

Optional resources, navigation, the fixed footer message and Back to top must not contribute to required completion. Before handover, validate unique milestone and target IDs, working targets and triggers, the course-specific versioned storage key, browser persistence and LMS suspend/resume. The learner-facing Reset Progress control is absent. See [`docs/completion-tracking.md`](docs/completion-tracking.md) for the exact contracts.

## Build handover requirements

At the final course-build handover, report `npm run build`, `npm run verify`, `npm run package:scorm` and `npm run verify:scorm`, including typography, completion-tracking and extracted-ZIP checks. The package reports requirements-based completion through the LMS-provided SCORM 1.2 API; standalone use saves browser progress only. Simulated LMS verification does not replace live People Connect import and launch testing.

## Hosting assumptions

The default build is a static site in `dist/` intended to be served at a domain root. Astro's generated CSS URL and course-asset URLs are root-relative. A static host must serve `dist/index.html` for `/`, each lesson's `index.html` for its route, and generated files beneath `dist/_astro/` and `dist/assets/`.

`npm run package:scorm` rewrites asset references relative to the package root and lesson navigation to explicit `index.html` files. This lets an LMS serve the course from a deeply nested path without directory-index routing. The ordinary `dist/` build retains its root-hosting behavior.

## SCORM status

This course uses a single-SCO SCORM 1.2 runtime and manifest with browser and manifest title `Content`. Run `npm run build`, `npm run verify`, `npm run package:scorm` and `npm run verify:scorm`; the ZIP is `scorm-output/ON-Match-the-Move-SCORM-1.2.zip`. `verify:scorm` extracts the ZIP, launches its manifest resource from a nested path and simulates the SCORM API; it does not test live People Connect. The LMS attempt and `cmi.suspend_data` are authoritative during an LMS launch; standalone use retains course-specific `localStorage` progress. There are no scores, pass/fail rules, LMS credentials or external services.

## Optional WASM packages

With the tested npm release, `npm ls` can label `@img/sharp-wasm32`, `@napi-rs/wasm-runtime` and `@tybys/wasm-util` as extraneous even though the lockfile records them in optional WASM fallback paths. An isolated `npm ci`, production build and browser verification succeed with the current manifests. Treat the labels as dependency-tree diagnostics, not as a reason to remove or upgrade packages without a reproduced build problem.

## Dependency security

Run `npm audit` before team handover and review dependency paths before applying fixes. Compatible security updates are expected; framework-major upgrades require an explicit migration decision and full verification. Do not use `npm audit fix --force` without reviewing the proposed breaking changes.
