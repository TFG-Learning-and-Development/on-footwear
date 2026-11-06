# Reusable components

The starter uses custom Astro components and shared rules in `src/styles/global.css`. Import only the components a course needs. The transferred typography primitives and their full property reference are documented in [`typography.md`](typography.md).

All course components and interactions must use the inherited typography system; do not introduce component-local type scales or font families. Completion tracking must be configured as part of every course build and connected to each required component using the contracts in [`completion-tracking.md`](completion-tracking.md).

For card grids built with semantic `ul` or `ol` elements, reset item margins in the component styles. The shared `main li + li` prose rule adds a top margin to later items and otherwise puts their icons and headings out of alignment. Check card alignment at desktop and responsive widths.

## `AssessmentPanel`

Pass `scenario` and `knowledge` objects containing their approved titles, prompts, answer options and feedback. Set unique `scenarioId` and `knowledgeId` values that match completion targets, the zero-based correct indexes, and `scenarioAttempts`. The component keeps the knowledge check collapsed, shows feedback in a reserved panel and dispatches the scenario's existing `course-progress:complete` event on a valid attempt. The knowledge form retains the shared attempt-based SUBMIT contract.

## `ProductExplorer`

Pass a unique `id`, title, introduction, instruction, category records and product records. Each category has an `id`, `label` and `productIds`; each product supplies its full approved content, a static Customer-profile image and ordered footwear image filenames. The first image is the hero view. Category tabs support arrow, Home and End keys; product and image buttons are ordinary keyboard controls. Pass a course-specific `storageKey` to restore the selected category and product. The component is data-driven for later product collections; Lesson 2 uses it without adding later lessons' content.

## `FeatureFlipCards` and `ProductMatch`

`FeatureFlipCards` accepts product names, approved features, benefits and recommendation cues. It follows the Lesson 1 flip-card treatment and saves revealed cards under its `storageKey`. `ProductMatch` accepts need/product pairs, keeps product choices separate from the needs, checks all five relationships on request and allows corrections. It saves the learner's selections under its `storageKey`. Both emit the existing interaction events; add course completion milestones only when the course build brief authorizes them.

## `LearningJourney`

Pass seven or more `{ href, title, description, icon }` items and the `currentPath`. Available icon names are `circle-play`, `search`, `activity`, `gauge`, `mountain`, `dumbbell` and `award`. The component requests validated progress through `course-progress:request-state`. A lesson displays Completed only when that route has configured requirements and all are satisfied; routes with no requirements stay Available.

The inline icon paths come from Lucide; the distribution notice is in `public/LUCIDE-LICENSE.txt`.

## `LessonNavigation`

Pass optional `previous` and `next` links as `{ href, label }`. The compact controls show the adjacent lesson title, use the approved blue and support keyboard focus. Navigation does not dispatch completion events.

## `SectionHeading`

Properties:

- `title` (required string): heading text.
- `intro` (optional string): introductory paragraph.
- `light` (optional boolean, default `false`): light text for dark surfaces.
- `align` (`"left" | "center"`, default `"center"`): text alignment.

```astro
<SectionHeading title="A descriptive heading" intro="A concise introduction." align="left" />
```

## `InfoCallout`

Properties:

- `title` (required string): callout heading.
- `tone` (`"pale" | "slate" | "navy"`, default `"pale"`): surface treatment.
- `icon` (optional boolean, default `true`): shows or hides the decorative icon.
- Default slot: callout body content.

```astro
<InfoCallout title="Remember" tone="slate" icon={false}>
  <p>Concise supporting content.</p>
</InfoCallout>
```

## `ResponsiveTable`

Properties:

- `label` (required string): accessible region label and visually hidden table caption.
- `columns` (required array): `{ key, label }` column definitions.
- `rows` (required array): string values keyed by the column definitions.
- `tone` (`"light" | "dark"`, default `"light"`): surface treatment.
- `id` (optional string): base for the scroll-hint ID. Supply a unique value when labels may repeat.

The table region is keyboard-focusable and scrolls horizontally when its contents are wider than its container.

```astro
<ResponsiveTable
  id="example-table"
  label="Example comparison"
  columns={[{ key: "item", label: "Item" }, { key: "detail", label: "Detail" }]}
  rows={[{ item: "Example", detail: "Description" }]}
/>
```

## `DialogueBlock`

Properties:

- `label` (optional string, default `"Example dialogue"`): accessible group label.
- `speakerA` (required object): `{ label, text }` for the first speaker.
- `speakerB` (required array): the first item is the reply; remaining items appear in the follow-up response area.

```astro
<DialogueBlock
  label="Service conversation"
  speakerA={{ label: "Speaker A", text: "Opening statement." }}
  speakerB={[
    { label: "Speaker B", text: "Initial reply." },
    { label: "Follow-up", text: "Supporting response." },
  ]}
/>
```

## `CourseProgress` and `ExploreGroup`

Completion configuration, activity attributes, events, persistence, internal test reset behavior, and examples for sections, videos, questions, matching, accordions, cards, and tabs are documented in [`completion-tracking.md`](completion-tracking.md).

## Shared theme

Do not hard-code course colours inside components. Configure the custom properties at the top of `src/styles/global.css`, and contrast-check every replacement against the surface where it appears. The light- and dark-surface focus tokens are intentionally separate.

The Overview/hero gradient must use `--course-accent-strong` and `--course-accent` so it follows the supplied visual-board palette without layout or typography changes. Do not add starter-specific hero accent values.

The Activity progress UI must inherit the supplied visual-board accent through `--course-accent`, including its filled bar and related accent states. Keep the unfilled track neutral, verify readable contrast, and do not introduce a component-specific progress colour.

## Typography primitives

`TypeText`, `TextLayout`, `QuoteBlock`, `StatisticBlock` and `DefinitionList` live in `src/components/typography/`. Use them for semantic type roles and controlled text composition rather than adding one-off font sizes to a course component. Configure the course scale in `src/styles/course-typography.css`; see [`typography.md`](typography.md) for the role table, variants, examples and override hierarchy.
