# ON: Match the Move — completion implementation plan

**Status:** Implemented in the Astro course. The inventory and decisions below record the pre-implementation proposal; `docs/completion-tracking.md` describes the current behavior. No SCORM package has been built.  
**Source:** [Final course QA](final-course-qa.md), the seven implemented lessons, `src/data/course-completion.ts`, `CourseProgress.astro`, `src/lib/scorm.ts`, and the storyboard.  
**Recommendation:** **51 required Astro milestones**, each equally weighted. The separate seven-question People Connect quiz is excluded from this inventory and must be configured in People Connect.

**Implementation resolution:** All 51 proposed milestones are required (Lessons 0–6: 7, 11, 7, 7, 7, 7, 5). Product cards earn exploration after 900 ms in the central viewport; flip cards, technology tabs, hotspots and RUN steps require learner selection/reveal. Optional product image angles remain optional. Reflection submission flags are saved, while reflection prose stays device-local in standalone mode and is never transmitted in LMS `suspend_data`. LMS launches use only versioned LMS suspend data for course progress and small interaction selections. Development progress is not migrated. The seven-question final quiz remains in People Connect.

## Decisions on the 56 QA candidates

All 56 candidate IDs are unique and point to real sections or activities. Five should **not** be required:

| QA candidate | Decision | Reason |
| --- | --- | --- |
| `lesson-0-learning-run` | Exclude | A route through the seven lessons; navigation and course map viewing should not gate completion. It is currently required and would be removed from the required set. |
| `lesson-3-collection` | Exclude | A short introduction immediately before the required product explorer; requiring both creates an extra scroll/dwell gate for the same collection. |
| `lesson-4-collection` | Exclude | Same reason. |
| `lesson-5-collection` | Exclude | Same reason. |
| `lesson-5-transition` | Exclude | A brief transition to RUN; navigation-like context, with the next lesson's substantive content already required. |

The Lesson 1 technology takeaway stays because it gives distinct guidance on explaining technology to a Customer. The Lesson 6 People Connect **handoff section** stays as a VIEW requirement so learners encounter the instruction to take the final quiz; viewing the handoff does **not** record the quiz as attempted or passed. Product explorer and feature cards use the same product IDs as *child IDs* in separate groups; these are distinct learning actions, not duplicate milestones. All product angles remain available but optional. Existing completed milestones are monotonic: changing an answer or closing a card never revokes credit.

## Trigger contract

| Kind | Required learner action | Completion rule and restoration |
| --- | --- | --- |
| `VIEW` | Read a required content section. | Keep the existing **900 ms continuous dwell in the central viewport zone** while the page is visible. No credit merely from navigation, page load, tab hiding or exit. Verify short takeaway/handoff sections can enter the zone at mobile and desktop widths. |
| `EXPLORE` profiles, technology, hotspots, feature cards, RUN | Open every required item. | Record an item once after an explicit reveal/tab selection. For an initially visible tab/step, record only after a qualifying visible dwell or explicit learner selection; initialization and restore must not emit progress. Persist the explored item set, not the currently open state alone. |
| `EXPLORE` product explorer | Inspect every product in the lesson. | Proposed: record each product when its detail card is selected and visibly present for the existing 900 ms VIEW dwell, including the default product. A category click that leaves the card offscreen must not grant credit. This hybrid trigger needs approval because current EXPLORE credits on selection alone. Switching among three-quarter, side and top image views is optional and must not create milestones. Persist the explored product set; restore the last product and optionally the last angle as UI state. |
| `SUBMIT` / `COMPLETE` assessments | Make a nonempty answer attempt. | Preserve the current attempt-based rule and immediate feedback. Lesson 0's form-backed knowledge check remains `SUBMIT`; its scenario and the Lesson 1–5 single questions use `COMPLETE` on an answered selection. Correctness is **not** a gate; a retry updates feedback without clearing earned completion. Never credit merely because a saved answer is painted during restore. |
| `COMPLETE` matching | Choose a product/discovery area for **every** prompt, then select Review/Check. | Fire one attempt event only after form validity succeeds. Keep feedback and retries; an incorrect but complete attempt earns the milestone under the approved attempt-based rule. Persist selected options and the attempted flag so resume does not show a completed activity as untouched. |
| `COMPLETE` reflection | Enter nonblank text and select Continue/Save response. | Preserve completion on explicit submission. Typing alone and restoring existing text do not complete it. The saved submission flag and the text-resume policy below are distinct. |

No `WATCH` requirement is needed because the course has no required video. No correctness score, People Connect quiz result, optional gallery angle, navigation link, footer or Back to top control enters the denominator.

## Final required milestone inventory

Each row has a unique `id` and same-named `targetId`; `path` is the lesson route shown. All rows are `required: true`. `EXPLORE` child IDs are listed after the inventory. “Configured” means already present in `course-completion.ts`; “Needs wiring” covers any missing configuration, target metadata or event behavior. The plan retains existing IDs to make a later migration possible.

| Route | Milestone ID | Kind | Required learner activity | Current state |
| --- | --- | --- | --- | --- |
| `/` | `lesson-0-guidance` | VIEW | Course guidance | Configured |
| `/` | `lesson-0-why` | VIEW | ON brand introduction | Configured |
| `/` | `lesson-0-customers` | VIEW | Customer needs and four collections | Configured |
| `/` | `lesson-0-scenario` | COMPLETE | Footwear-floor scenario attempt | Configured |
| `/` | `lesson-0-check` | SUBMIT | Separate knowledge-check attempt | Configured |
| `/` | `lesson-0-reflection` | COMPLETE | Nonblank starting-point reflection submission | Configured |
| `/` | `lesson-0-takeaway` | VIEW | Key takeaway | Configured |
| `/lesson-1/` | `lesson-1-introduction` | VIEW | Product-knowledge introduction | Configured |
| `/lesson-1/` | `lesson-1-profiles` | EXPLORE | Eight Customer profile backs | Configured |
| `/lesson-1/` | `lesson-1-check-clue` | COMPLETE | Profile clue question attempt | Configured |
| `/lesson-1/` | `lesson-1-technology` | EXPLORE | Seven technology explanations | Configured; initial-tab event needs correction |
| `/lesson-1/` | `lesson-1-challenge` | COMPLETE | Technology challenge attempt | Configured |
| `/lesson-1/` | `lesson-1-technology-takeaway` | VIEW | Technology-to-Customer takeaway | Configured |
| `/lesson-1/` | `lesson-1-measure` | EXPLORE | Four measurement hotspots | Configured |
| `/lesson-1/` | `lesson-1-discovery` | VIEW | Five discovery questions | Configured |
| `/lesson-1/` | `lesson-1-matching` | COMPLETE | Discovery-area matching review | Configured |
| `/lesson-1/` | `lesson-1-reflection` | COMPLETE | Nonblank discovery-question submission | Configured |
| `/lesson-1/` | `lesson-1-takeaway` | VIEW | Lesson takeaway | Configured |
| `/lesson-2/` | `lesson-2-introduction` | VIEW | Everyday running introduction | Needs wiring |
| `/lesson-2/` | `lesson-2-sipho-check` | COMPLETE | Sipho scenario attempt | Needs configuration |
| `/lesson-2/` | `lesson-2-products` | EXPLORE | Five everyday running products | Needs wiring |
| `/lesson-2/` | `lesson-2-feature-cards` | EXPLORE | Five feature-to-benefit backs | Needs wiring |
| `/lesson-2/` | `lesson-2-matching` | COMPLETE | Everyday running matching review | Needs wiring |
| `/lesson-2/` | `lesson-2-knowledge` | COMPLETE | Everyday running knowledge-check attempt | Needs configuration |
| `/lesson-2/` | `lesson-2-takeaway` | VIEW | Lesson takeaway | Needs wiring |
| `/lesson-3/` | `lesson-3-introduction` | VIEW | Performance running introduction | Needs wiring |
| `/lesson-3/` | `lesson-3-anele-check` | COMPLETE | Anele scenario attempt | Needs configuration |
| `/lesson-3/` | `lesson-3-products` | EXPLORE | Six performance products | Needs wiring |
| `/lesson-3/` | `lesson-3-feature-cards` | EXPLORE | Six feature-to-benefit backs | Needs wiring |
| `/lesson-3/` | `lesson-3-matching` | COMPLETE | Performance matching review | Needs wiring |
| `/lesson-3/` | `lesson-3-knowledge` | COMPLETE | Performance knowledge-check attempt | Needs configuration |
| `/lesson-3/` | `lesson-3-takeaway` | VIEW | Lesson takeaway | Needs wiring |
| `/lesson-4/` | `lesson-4-introduction` | VIEW | Outdoor introduction | Needs wiring |
| `/lesson-4/` | `lesson-4-lerato-check` | COMPLETE | Lerato scenario attempt | Needs configuration |
| `/lesson-4/` | `lesson-4-products` | EXPLORE | Three outdoor products | Needs wiring |
| `/lesson-4/` | `lesson-4-feature-cards` | EXPLORE | Three feature-to-benefit backs | Needs wiring |
| `/lesson-4/` | `lesson-4-matching` | COMPLETE | Outdoor matching review | Needs wiring |
| `/lesson-4/` | `lesson-4-knowledge` | COMPLETE | Outdoor knowledge-check attempt | Needs configuration |
| `/lesson-4/` | `lesson-4-takeaway` | VIEW | Lesson takeaway | Needs wiring |
| `/lesson-5/` | `lesson-5-introduction` | VIEW | Training and lifestyle introduction | Needs wiring |
| `/lesson-5/` | `lesson-5-thabo-check` | COMPLETE | Thabo scenario attempt | Needs configuration |
| `/lesson-5/` | `lesson-5-products` | EXPLORE | Five training/lifestyle products | Needs wiring |
| `/lesson-5/` | `lesson-5-feature-cards` | EXPLORE | Five feature-to-benefit backs | Needs wiring |
| `/lesson-5/` | `lesson-5-matching` | COMPLETE | Training/lifestyle matching review | Needs wiring |
| `/lesson-5/` | `lesson-5-knowledge` | COMPLETE | Training/lifestyle knowledge-check attempt | Needs configuration |
| `/lesson-5/` | `lesson-5-takeaway` | VIEW | Lesson takeaway | Needs wiring |
| `/lesson-6/` | `lesson-6-introduction` | VIEW | Final lesson introduction | Needs wiring |
| `/lesson-6/` | `lesson-6-run` | EXPLORE | R, U and N recommendation steps | Needs wiring |
| `/lesson-6/` | `lesson-6-dialogue` | VIEW | RUN dialogue and reflection prompt | Needs wiring |
| `/lesson-6/` | `lesson-6-conclusion` | VIEW | Closing recommendation guidance | Needs wiring |
| `/lesson-6/` | `lesson-6-challenge` | VIEW | People Connect quiz handoff instruction | Needs wiring |

**Required `EXPLORE` children:**

| Milestone group(s) | Child IDs to persist and restore |
| --- | --- |
| `lesson-1-profiles` | `profile-1`–`profile-8` |
| `lesson-1-technology` | `technology-1`–`technology-7` |
| `lesson-1-measure` | `hotspot-1`–`hotspot-4` |
| `lesson-2-products`, `lesson-2-feature-cards` | `cloudsurfer-2`, `cloudsurfer-max`, `cloudrunner-3`, `cloudrunner-3-max`, `cloudmonster-3` |
| `lesson-3-products`, `lesson-3-feature-cards` | `cloudflow-5`, `cloudmonster-3-hyper`, `lightspray-cloudmonster-3-hyper`, `cloudboom-volt`, `cloudboom-max`, `cloudboom-strike-2` |
| `lesson-4-products`, `lesson-4-feature-cards` | `cloudhorizon-2`, `cloudvista-3`, `cloudultra-3` |
| `lesson-5-products`, `lesson-5-feature-cards` | `cloud-x-5`, `cloud-x-tempo`, `cloudpulse-2`, `cloudpulse-next`, `cloud-6` |
| `lesson-6-run` | Proposed `run-r`, `run-u`, `run-n`; these need stable item IDs on the three step controls. |

## Resume and SCORM 1.2 strategy

### Current behavior and risks

- Tracker state is currently a completed-ID list plus watched ranges and explored child lists. Standalone reads/writes its versioned `localStorage` record; an LMS launch restores tracker state from `cmi.suspend_data`. The SCORM bridge enforces the **4,096-character** `suspend_data` ceiling. Completed/passed LMS status is protected from downgrade, and `cmi.core.exit` is set to `suspend` on exit.
- Visible UI selections live under several independent browser keys, including separate Lesson 0/1 reflection keys. They can survive into another LMS learner's browser session yet fail to follow a learner to another browser. The tracker can therefore show an activity complete while its UI looks untouched.
- The current Lesson 1 technology initialization calls the same selection function used for learner exploration; it can credit the first item during page load or restoration. Product and RUN default views also need explicit first-item rules.
- `ScormSession.save()` currently may write `completed` even when an oversized `suspend_data` payload was rejected. `CourseProgress` also passes an all-complete flag to saves on tab hiding and page exit. Completion should be written **only from the newly satisfied final milestone**, after successful bounded state persistence, never from launch, hiding or exit.

### Recommended state model

1. Use one validated, versioned course-state schema for both standalone and LMS. Include completed milestone bits, explored child bits, answered assessment indices, matching selections/attempt flags, active technology/product/RUN selection, and saved reflection state. Freeze the milestone/item ordering within that schema version; bump the version when IDs or encoding change. Keep **LMS `cmi.suspend_data` authoritative for LMS attempts**. Use `localStorage` only for standalone mode, or as a nonauthoritative UI cache keyed to an LMS learner/attempt if a specific need is approved; never merge an unscoped cache into LMS progress.
2. Initialize the LMS API once, read `cmi.core.lesson_status` and `cmi.suspend_data`, validate version/shape/IDs, then hydrate all components through one ready/restore path. Restoring selected answers, tabs or cards must not fire `COMPLETE`/`EXPLORE`. Components should render a completion/review indicator from restored tracker state even if their optional UI details are absent. Never derive completion from a restored radio or select alone.
3. Serialize completion and explored sets compactly (stable indexed bits or equivalent) and store small UI values as indices. Measure `JSON.stringify(payload).length` before every LMS write and target a **3,000-character maximum in tests**, leaving headroom under SCORM's 4,096-character hard limit. Test worst-case 51/51 milestones, every child explored, all selections and the longest permitted reflection inputs, including punctuation and non-ASCII text. Do not silently truncate, discard or overwrite an existing valid suspend record when a write exceeds the limit or the LMS rejects it.
4. **Recommended reflection policy:** save the two submitted reflections in the LMS only with an explicit, visible, bounded input limit that passes the worst-case payload test; keep their milestone flags even if a learner later edits the wording. A practical starting limit is **400 characters per reflection**, subject to measured serialized size and owner approval. If a text limit is not approved, keep the prose device-local, store only submission flags in LMS, and clearly tell learners that written text will not transfer between devices. Do not promise cross-device text restoration while it remains browser-only.
5. Persist changed progress on each qualifying action with a successful LMS commit. A failed `LMSSetValue`/`LMSCommit`, invalid version or oversized payload must be reported and must not promote a new attempt to `completed`. Retain the last known-good LMS record and provide a recoverable message/path. On tab hiding or `pagehide`, save only pending suspend data and set `cmi.core.exit = suspend`; never grant a milestone or newly set `completed` there. Keep `completed`/`passed` status untouched on later launches, refreshes and exits.
6. For a fresh or incompatible LMS attempt, do not import stale browser state. If suspend data is malformed/version-mismatched, do not overwrite it with an empty record on exit; report the problem and use an explicit migration/recovery rule. Assume current `v2` state is preproduction, but confirm this before using a new `v3` key. If any real learners already have `v2` progress, migrate known IDs and validated exploration rather than silently resetting them.

## Implementation and acceptance sequence after approval

1. Confirm the decisions below. Freeze the 51-item registry, child lists and course-state version. Add a build/runtime check for unique IDs, exact route targets, required child arrays, and achievable events.
2. Wire the missing Lessons 2–6 targets through the shared components; add RUN step IDs/events; separate component restoration from learner-action events. Keep approved styling and interaction behavior.
3. Add centralized state hydration and compact LMS serialization. Test same-browser refresh, previous/next navigation, fresh LMS attempt, cross-browser LMS resume, two learners sharing one browser, invalid/old suspend data, full payload size, API failures, completed/passed status preservation and no completion on launch/hide/exit. Confirm the final milestone is the only event that may newly set `completed`.
4. After implementation, run `npm run build` and `npm run verify`; then, when packaging is separately authorized, run `npm run package:scorm` and `npm run verify:scorm`. Simulated LMS tests are not live People Connect acceptance.

## Approval decisions

1. **Inventory:** Approve 51 requirements, excluding the five navigation/duplicate VIEW candidates above. Approve requiring **every** product card and its separate feature-to-benefit flip; reducing either set changes the learning requirement.
2. **Exploration trigger:** Approve use of the existing 900 ms central-viewport dwell for initially visible technology/RUN steps and for selected product detail cards; this prevents credit on initialization or for an offscreen card. The alternative is explicit reselection of the already displayed first item and immediate credit for every product click. No longer dwell is proposed.
3. **Attempt rule:** Confirm an answered question or fully submitted matching attempt counts regardless of correctness, with feedback and retry available. This matches the current course tracker rule. Lesson 0's storyboard requests only one retry, while the current UI allows more; decide that interaction policy separately without turning completion into a correctness gate.
4. **Reflection resume:** Approve bounded LMS storage of both reflection texts (recommended, initially 400 characters each subject to payload testing), or explicitly accept device-local text with LMS submission flags only.
5. **LMS migration:** Confirm that the existing `v2` state has no production learners before a version change; otherwise approve a migration path.
6. **People Connect boundary:** Confirm the Astro course is complete upon the 51st required milestone, including the *handoff view*, while the seven-question final quiz and any overall training pass rule remain wholly in People Connect. No quiz answers, scores or pass status should be invented in Astro.

The pre-implementation proposal kept `completionEnabled` false pending approval. The implemented 51-milestone configuration now enables Astro completion; the separate People Connect quiz remains outside this tracker.
