# ON: Match the Move — final course QA audit

**Audit date:** 5 November 2026  
**Scope:** Seven Astro routes (`/`, `/lesson-1/`–`/lesson-6/`). Audit only; no lesson, completion, SCORM or package changes were made.  
**Verdict:** Course build and existing browser verification pass. **Do not package yet:** resolve the Critical completion readiness item and obtain the two product/asset decisions below.

## Evidence and limits

- Compared the seven lesson components and `src/data/course.ts` with `references/storyboard/Totalsports ON Footwear Specialist Match the Move 1 (002).docx`, including the final People Connect quiz boundary. Checked implemented product copy, measurements, answers and feedback against the source. The storyboard is the approved content authority for this audit; external product specifications were not substituted.
- Reviewed `AGENTS.md`, `references/moodboard/Moodboard.pdf`, `docs/spacing-system.md`, `docs/lesson-5-sme-review.md`, shared styles/components, tracker, SCORM bridge and browser verifier.
- `npm run build` **passed**: all seven static routes built. `npm run verify` **passed**: Playwright covers all routes at 320, 375, 768, 1280, 1440 and 1920 px, with focused interaction checks at mobile and desktop sizes. Reviewed generated full-page screenshots for Lessons 0, 1, 3 and 4, including the Lesson 0 tablet view. The automated checks cover the remaining routes at those widths; they are not a substitute for live device or LMS acceptance testing.
- No SCORM package was created and no live People Connect LMS session was tested. The `On tech sheets -TS.pdf` and any SKU approval sheet named in the storyboard are not present in `references/`; product-image provenance cannot be independently confirmed here.

## 1. Course content audit

| Lesson | Storyboard block coverage | Answer and feedback check |
| --- | --- | --- |
| 0 | Guidance, brand introduction, four collection visuals, scenario, separate knowledge check, seven-step learning run, reflection and takeaway are present in order. | Scenario **B**; knowledge check **B**. Immediate feedback and the separate question reveal are present. |
| 1 | Introduction, eight profile flips, clue check, seven technology tabs, challenge, technology takeaway, four measurement hotspots, five discovery areas, matching, reflection and takeaway are present. | Clue **B**; challenge **B**. Copy and feedback match the storyboard. |
| 2 | Introduction, Sipho scenario, category/product explorer (five products), feature flips, matching, knowledge check and takeaway are present. Each product has three gallery views. | Scenario **C**; knowledge check **C**. |
| 3 | Introduction, Anele scenario, collection, explorer (six products), feature flips, matching, knowledge check and takeaway are present. Each product has three gallery views. | Scenario **B**; knowledge check **A**. |
| 4 | Introduction, Lerato scenario, collection, explorer (three products), feature flips, matching, knowledge check and takeaway are present. Each product has three gallery views. | Scenario **A**; knowledge check **C**. |
| 5 | Introduction, Thabo scenario, collection, explorer (five products), feature flips, matching, knowledge check, takeaway and transition are present. Each product has three gallery views. | Scenario **B**; knowledge check **B**. |
| 6 | Introduction, three-step RUN process, Customer/Athlete dialogue, conclusion and People Connect handoff are present. | The seven-question final quiz is **not** in Astro, as directed by the storyboard. Its creation and scoring in People Connect are outside this repository audit. |

The substantive learner-facing prose, product specifications carried into the course, assessment options and feedback inspected in `course.ts` match the storyboard. No developer note, SME query, answer-key label or final quiz question was found in the rendered learner interface. The unused `placeholder` data is not rendered by any of the seven valid routes. The Cloud 6 heel-stack omission is deliberate and documented below; it is not an approved new value.

### Content and implementation findings

| Severity | Finding | Evidence and disposition |
| --- | --- | --- |
| **Major** | Cloudhorizon 2 product imagery has an unresolved SKU/variant mismatch. | Lesson 4 names the product **Cloudhorizon 2**, while all three gallery filenames in `src/data/course.ts` contain **Cloudhorizon 2 Waterproof**. Images decode and render, but that does not establish whether the pictured shoe is the approved non-Waterproof variant. Obtain SKU/image approval before packaging; do not silently relabel or replace. |
| **Major** | Cloud 6 heel-stack value still needs SME confirmation. | The storyboard says **1 mm** and explicitly requests SME confirmation. `docs/lesson-5-sme-review.md` records the hold; the learner-facing technical copy correctly omits heel stack while retaining 8 mm offset, 267 g, speed lacing and US M7–M15. Confirm the approved value or approve continued omission. |
| **Minor** | Storyboard interaction treatments differ from the approved implementation. | Lesson 1's developer note calls for eight **image** flip cards; the current eight profile cards use styled text faces. Lessons 2–5 call for drag-and-drop matching; the shared `ProductMatch` uses keyboard-accessible select controls. Content, pairings and feedback remain intact. Record design/instructional sign-off on these variants; no redesign is proposed. |
| **Minor** | Lesson 0 scenario allows more attempts than its storyboard developer note. | The note asks for immediate feedback and **one retry**. `AssessmentPanel` allows the learner to change the radio answer repeatedly; the verifier explicitly checks third and fourth selections. Confirm whether unlimited practice attempts are approved. This does not expose the final People Connect assessment. |
| **Informational** | Lesson 3 product order is not stated consistently in the source itself. | The storyboard's race-day category lists **Volt / Max / Strike 2**, while its detailed product blocks place **Max before Volt**. The course follows the category list. No content is omitted; confirm only if detailed-block order was intended to be mandatory. |
| **Informational** | Product sheet cross-check is limited. | The referenced ON technical sheet PDF is absent from `references/`. The audit verifies alignment with the supplied storyboard, not independent manufacturer SKU/specification accuracy. |

## 2. Visual and responsive findings

The browser verifier passed its checks for heading clearance and shared typography, 48–96 px section spacing, hero/purpose overlap, responsive navigation, footer contrast, Back to top, reduced motion and document horizontal overflow at all six widths. Focused checks also passed for product gallery decoding and category layout, assessment rendering, flip/reveal controls, RUN tab text and navigation. Full-page screenshots reviewed show the approved dark assessment panels, gradient feedback, blue accent, overlapping purpose panels, section treatments and mobile stacking. The shared mobile purpose-panel rule gives the seven ON logo slots the same 2 rem width and 4 rem contained image height, preserving aspect ratio.

| Severity | Finding | Evidence and disposition |
| --- | --- | --- |
| **Minor** | Six routes have a generic browser title. | `CoursePage.astro` gives Lesson 1 its lesson title but uses `courseData.meta.title` (`Content`) for Lessons 0 and 2–6. The verifier currently expects this. Use route-specific document titles in a later targeted fix for browser tabs, history and assistive context; no change was made during this audit. |
| **Informational** | No tested viewport overflow or text clipping failure was found. | All seven routes passed 320–1920 px automated geometry checks. Focused screenshot review found no obvious broken hero composition, panel, gallery, assessment, navigation or footer layout. Live device visual acceptance remains a final QA step. |

## 3. Interaction and accessibility findings

- **Passed:** lesson disclosure, previous/next links and Back to top; product category and product selection; all three gallery angles in the tested explorers; Lesson 1 profile flips, technology tabs and hotspots; feature flips; matching selection and review; immediate correct/incorrect assessment feedback; Lesson 0 question navigation and reflection; Lesson 1 reflection; RUN step buttons and arrow/Home/End keyboard operation.
- **Retry behavior:** wrong-to-right reselection updates feedback in the tested scenarios and knowledge checks. Lesson 0's permitted number of retries needs the source-owner decision noted above.
- **Passed:** skip link, visible focus checks on assessment choices, named controls, progress disclosure, tab semantics, image decoding/alt text samples, reduced-motion behavior and no horizontal overflow in the existing verifier. The shared matching select controls remain keyboard operable on mobile and desktop.
- **Limit:** this was automated browser and source QA, not a full screen-reader or physical-device audit. The People Connect assessment's accessibility and scoring cannot be assessed from this Astro project.

## 4. Persistence and resume findings

| Severity | Finding | Evidence and disposition |
| --- | --- | --- |
| **Major** | Interaction UI state is browser-local even in an LMS launch. | Assessment answers, explorer selection, flip state, matching selections, RUN tab and reflections use `localStorage` in their components. `CourseProgress` correctly takes milestone state from `cmi.suspend_data` during an LMS launch, but these UI details are not stored there. A resumed attempt on another browser/device can show an empty interaction with completed LMS milestones; a different learner using the same browser can see old UI selections despite a fresh LMS tracker state. Define the required LMS resume behavior and test learner isolation before packaging. |
| **Minor** | Alternate gallery angle is not restored. | `ProductExplorer` saves category/product, while the angle button changes only the current image. Refresh returns to the three-quarter view. This is harmless if angle choice is considered transient; specify otherwise before adding it to resume requirements. |
| **Informational** | Same-browser restoration works for tested controls. | The verifier checks selected products, assessment choices/feedback, reflection, and configured tracker milestones after reload; Lesson 1 technology/matching and RUN tab state also use local storage. The tracker restores its configured progress across routes and ignores another course's storage key. |
| **Informational** | SCORM bridge has the expected safeguards but awaits live LMS proof. | The verifier simulates LMS launch and `cmi.suspend_data` restoration; source inspection shows the 4096-character guard, `suspend` exit and completed/passed status protection. Completion is disabled. Live People Connect suspend/resume and cross-device behavior were not tested. |

## 5. Outstanding SME and owner queries

1. **Cloudhorizon 2 imagery:** Are the three `Cloudhorizon 2 Waterproof` files approved for the non-Waterproof Cloudhorizon 2 card, or should the asset/SKU change? Obtain the approved source asset before changing it.
2. **Cloud 6 heel stack:** Confirm the actual value from an approved ON source, or approve the documented omission. Do not infer it from the 8 mm offset.
3. **Instructional/design variants:** Confirm acceptance of text-only Lesson 1 profile flips and select-based Lessons 2–5 matching against the storyboard developer notes.
4. **People Connect:** Confirm that the separate seven-question final assessment, feedback and completion rule are configured and tested in People Connect. No assessment package or configuration is in this Astro repo.
5. **Resume policy:** Decide whether LMS resume must restore visible activity selections and reflections across browsers/devices and isolate learners sharing a browser.

## 6. Proposed course-wide completion milestone inventory

This is a **proposal only**. `src/data/course-completion.ts` currently defines **19 required milestones** (Lessons 0–1) under `astro-course-progress:on-match-the-move:v2`; `completionEnabled` is **false**. Lessons 2–6 have no milestones in the tracker. The table proposes **56 total unique IDs**: 19 existing and 37 proposed. `VIEW` means the existing central-viewport dwell rule; `SUBMIT`/`COMPLETE` mean an attempt or saved response, not a correct answer; `EXPLORE` means every listed child item is opened. No `WATCH` milestone is proposed because there is no required video. Each proposed row needs its route, `targetId`, `data-completion-id`, and, for `EXPLORE`, `data-required-items` before activation.

**Connection key:** `Connected` = configured target and trigger; `Target only` = target/event exists but no configuration; `Event only` = component emits an event but lacks target metadata/configuration; `ID only` = section exists but has neither tracking metadata nor event.

| Lesson | Proposed milestone ID = target ID | Trigger / required scope | Current connection |
| --- | --- | --- | --- |
| 0 | `lesson-0-guidance` | VIEW course guidance | Connected |
| 0 | `lesson-0-why` | VIEW brand introduction | Connected |
| 0 | `lesson-0-customers` | VIEW four-collection statement | Connected |
| 0 | `lesson-0-scenario` | COMPLETE scenario attempt | Connected |
| 0 | `lesson-0-check` | SUBMIT knowledge-check attempt | Connected |
| 0 | `lesson-0-learning-run` | VIEW seven-lesson route | Connected |
| 0 | `lesson-0-reflection` | COMPLETE nonblank reflection | Connected |
| 0 | `lesson-0-takeaway` | VIEW takeaway | Connected |
| 1 | `lesson-1-introduction` | VIEW introduction | Connected |
| 1 | `lesson-1-profiles` | EXPLORE `profile-1`–`profile-8` | Connected |
| 1 | `lesson-1-check-clue` | COMPLETE clue-check attempt | Connected |
| 1 | `lesson-1-technology` | EXPLORE `technology-1`–`technology-7` | Connected |
| 1 | `lesson-1-challenge` | COMPLETE Customer-challenge attempt | Connected |
| 1 | `lesson-1-technology-takeaway` | VIEW technology takeaway | Connected |
| 1 | `lesson-1-measure` | EXPLORE `hotspot-1`–`hotspot-4` | Connected |
| 1 | `lesson-1-discovery` | VIEW discovery process | Connected |
| 1 | `lesson-1-matching` | COMPLETE matching review attempt | Connected |
| 1 | `lesson-1-reflection` | COMPLETE nonblank saved question | Connected |
| 1 | `lesson-1-takeaway` | VIEW takeaway | Connected |
| 2 | `lesson-2-introduction` | VIEW hero introduction | ID only |
| 2 | `lesson-2-sipho-check` | COMPLETE scenario attempt | Target only |
| 2 | `lesson-2-products` | EXPLORE `cloudsurfer-2`, `cloudsurfer-max`, `cloudrunner-3`, `cloudrunner-3-max`, `cloudmonster-3` | Event only |
| 2 | `lesson-2-feature-cards` | EXPLORE the same five product IDs | Event only |
| 2 | `lesson-2-matching` | COMPLETE matching review attempt | Event only |
| 2 | `lesson-2-knowledge` | COMPLETE knowledge-check attempt | Target only |
| 2 | `lesson-2-takeaway` | VIEW takeaway | ID only |
| 3 | `lesson-3-introduction` | VIEW hero introduction | ID only |
| 3 | `lesson-3-anele-check` | COMPLETE scenario attempt | Target only |
| 3 | `lesson-3-collection` | VIEW collection introduction | ID only |
| 3 | `lesson-3-products` | EXPLORE `cloudflow-5`, `cloudmonster-3-hyper`, `lightspray-cloudmonster-3-hyper`, `cloudboom-volt`, `cloudboom-max`, `cloudboom-strike-2` | Event only |
| 3 | `lesson-3-feature-cards` | EXPLORE the same six product IDs | Event only |
| 3 | `lesson-3-matching` | COMPLETE matching review attempt | Event only |
| 3 | `lesson-3-knowledge` | COMPLETE knowledge-check attempt | Target only |
| 3 | `lesson-3-takeaway` | VIEW takeaway | ID only |
| 4 | `lesson-4-introduction` | VIEW hero introduction | ID only |
| 4 | `lesson-4-lerato-check` | COMPLETE scenario attempt | Target only |
| 4 | `lesson-4-collection` | VIEW collection introduction | ID only |
| 4 | `lesson-4-products` | EXPLORE `cloudhorizon-2`, `cloudvista-3`, `cloudultra-3` | Event only |
| 4 | `lesson-4-feature-cards` | EXPLORE the same three product IDs | Event only |
| 4 | `lesson-4-matching` | COMPLETE matching review attempt | Event only |
| 4 | `lesson-4-knowledge` | COMPLETE knowledge-check attempt | Target only |
| 4 | `lesson-4-takeaway` | VIEW takeaway | ID only |
| 5 | `lesson-5-introduction` | VIEW hero introduction | ID only |
| 5 | `lesson-5-thabo-check` | COMPLETE scenario attempt | Target only |
| 5 | `lesson-5-collection` | VIEW collection introduction | ID only |
| 5 | `lesson-5-products` | EXPLORE `cloud-x-5`, `cloud-x-tempo`, `cloudpulse-2`, `cloudpulse-next`, `cloud-6` | Event only |
| 5 | `lesson-5-feature-cards` | EXPLORE the same five product IDs | Event only |
| 5 | `lesson-5-matching` | COMPLETE matching review attempt | Event only |
| 5 | `lesson-5-knowledge` | COMPLETE knowledge-check attempt | Target only |
| 5 | `lesson-5-takeaway` | VIEW takeaway | ID only |
| 5 | `lesson-5-transition` | VIEW transition to RUN | ID only |
| 6 | `lesson-6-introduction` | VIEW hero introduction | ID only |
| 6 | `lesson-6-run` | EXPLORE proposed `run-r`, `run-u`, `run-n` | ID only; RUN needs explore events |
| 6 | `lesson-6-dialogue` | VIEW dialogue and reflection prompt | ID only |
| 6 | `lesson-6-conclusion` | VIEW conclusion | ID only |
| 6 | `lesson-6-challenge` | VIEW People Connect handoff | ID only |

**Requirements to confirm before implementation:** whether every product *and* its feature card is required, whether the Lesson 5 transition and Lesson 6 handoff should count as VIEW milestones, and whether an attempt is sufficient for matching/knowledge checks as the current tracker rules intend. Do not add the People Connect quiz, optional imagery angles, navigation, footer or Back to top as Astro requirements. After approval, validate unique target/item IDs, route targets, state restoration, LMS suspend size, and the final completion boundary before enabling completion.

## 7. Blockers before SCORM packaging

| Severity | Blocker | Release condition |
| --- | --- | --- |
| **Critical** | Only Lessons 0–1 are in the required tracker and `completionEnabled` is false. A full-course LMS completion cannot yet be earned. | Approve and implement the final course-wide milestone list and triggers, then run build, verifier, simulated LMS/SCORM package verification and live People Connect acceptance. This audit did **not** change completion. |
| **Major** | Cloudhorizon 2 versus Waterproof imagery is unresolved. | Approved SKU/image decision and source asset confirmation. |
| **Major** | Cloud 6 heel-stack source value lacks SME approval. | Approve a verified value or explicitly approve continued omission. |
| **Major** | LMS interaction-state resume and shared-browser isolation policy is undefined. | Decide required behavior and verify in a representative LMS launch, including a fresh learner attempt and resume on another browser/device if required. |
| **Minor** | `docs/completion-tracking.md` still says Lessons 1–6 are placeholders. | Update documentation after completion requirements are approved; do not use that sentence as the implementation status. |

**Verification:** `npm run build` — **PASS**. `npm run verify` — **PASS**. `npm run package:scorm` and `npm run verify:scorm` — **not run by instruction**. Simulated LMS checks are part of `npm run verify`; live People Connect testing remains outstanding.
