# Completion tracking

Completion is configured in `src/data/course-completion.ts` and rendered by `CourseProgress.astro`. Standalone launches use browser storage; LMS launches use the SCORM 1.2 API and `cmi.suspend_data`. The configured milestones are the single source of truth for overall and per-lesson progress and LMS completion. The ON course has 51 required milestones across all seven lessons (7, 11, 7, 7, 7, 7, 5), uses the versioned `on-match-the-move:v3` storage key, and enables LMS completion only after all requirements are met. The seven-question People Connect quiz is outside this Astro course.

Lessons unlock in order: Lesson 0 is available immediately, and each later lesson becomes available when every required milestone in the preceding lessons is complete. The header, Progress dropdown, learning journey and next-lesson card use the same derived unlock state. A locked direct route redirects to the highest unlocked lesson after persisted state is restored, with an explanation. A People Connect launch at the course entry resumes at the saved lesson when it is unlocked. This is client-side access control for the static Astro course; the LMS launch and browser JavaScript remain necessary for normal operation. Previous lessons stay available for revision.

The Progress dropdown also lists the current lesson's required activities directly from the milestone registry. Its checklist shows completed and outstanding items, the completed count and the number left before the next lesson unlocks. Outstanding items link to their on-page target where available; selecting one closes Progress, focuses the activity and briefly outlines it. The checklist is display-only: it creates no new milestones or LMS state.

## Mandatory course-build workflow

Configure completion tracking during every course build; no separate tracking request is required. Add course-specific requirements derived from the new storyboard and content actually implemented. Do not configure milestones for content that is absent.

Connect required content, videos and interactions to the appropriate existing behavior: VIEW for qualified section viewing, WATCH for merged unique playback ranges, attempt-based SUBMIT or COMPLETE for questions and submitted activities, and EXPLORE for configured child items. Preserve all approved rules, thresholds, weighting, events, persistence and restoration. Do not add correctness gates, longer dwell times, playback restrictions or other policy changes unless explicitly approved.

Optional resources, navigation links, the fixed footer message and Back to top are excluded from required completion. Before handover, validate unique milestone and target IDs, working targets and triggers, a course-specific versioned storage key, saved progress, and restoration in the browser and LMS. There is no learner-facing Reset Progress control.

## Configuration

Each milestone has a unique `id`, learner-facing `label`, supported `type`, unique `targetId`, and explicit `required` boolean. For requirements on separate pages, set `path` to the lesson route (for example `/lesson-2/`). An `explore` requirement on another page also needs `requiredItems` for cross-page restoration. Required milestones are equally weighted; non-required milestones never enter the percentage denominator. A `watch` milestone may set `threshold` from greater than `0` through `1`; the default is `0.8`. Use a course-specific, versioned key such as `astro-course-progress:course-slug:v1`.

Supported types:

- `view`: place `data-completion-id="milestone-id"` on the target. It completes after 900 ms continuously in the central viewport zone (`rootMargin: -38% 0 -38%`).
- `watch`: put both the target `id` and `data-completion-id` on a `<video>`. Merged unique `video.played` ranges must reach the threshold; seeking gaps and replayed ranges do not add credit.
- `submit`: put `data-completion-id` on the activity and `data-completion-option` on form answer controls. Completion occurs on a submitted, nonempty selection, regardless of correctness.
- `explore`: put `data-completion-id` and a JSON `data-required-items` array on the group. Dispatch `course-progress:explore` with `{ activityId, itemId }` for each child. The included `ExploreGroup.astro` demonstrates accordion, card and tab variants. Its initially visible first tab is recorded immediately.
- `complete`: put the matching `id` and `data-completion-id` on the target, then dispatch `course-progress:complete` with `{ activityId }` at the approved completion moment.
- `optional`: retained for compatibility with the pilot. Give its target the matching `id` and `data-completion-id`; it has no automatic behaviour and normally uses the same `course-progress:complete` event. Despite the type name, only `required: false` excludes a milestone from progress.

For a standard question, use `submit`, mark its radio or select answer with `data-completion-option`, and submit the enclosing form. For matching, require at least one real selection in the activity code, then dispatch `course-progress:complete` only when the learner submits. A section uses `view`; a video uses `watch`; accordion, reveal-card, and tab groups use `explore`. Configuration errors for duplicate IDs, duplicate targets, malformed thresholds, or an unversioned storage key fail the build. Unresolved DOM targets report a clear browser console error and never become satisfied.

## Events and restoration

- Send `course-progress:explore` with `{ activityId, itemId }`.
- Send `course-progress:complete` with `{ activityId }`.
- An explore component may send `course-progress:request-restore` with `{ activityId, apply(itemIds) }`.
- The manager emits `course-progress:explore-state` with `{ activityId, itemIds }`, `course-progress:restore-complete` with `{ activityId, complete }`, and `course-progress:reset`.
- A display component may send `course-progress:request-state`. The manager emits `course-progress:state` with `{ completedIds, milestones: [{ id, path, required }] }` on request and after progress renders. `LearningJourney.astro` derives lesson states from this validated tracker state; navigation alone never marks a lesson complete.

Standalone progress, merged video ranges, explored child IDs and small interaction selections are stored in `localStorage`. An LMS launch restores validated, versioned state only from `cmi.suspend_data`; browser storage cannot complete that LMS attempt. The LMS save includes completed milestones, video ranges, explored child IDs and small non-text selections, with a hard 4,096-character limit and a console diagnostic if the payload is too large. Free-text reflections are never sent to the LMS. Lesson 0 and Lesson 1 written responses are saved separately in browser `localStorage` as learners type and again when they select Continue or Save response. Standalone responses retain their existing keys (`<storageKey>:lesson-0-reflection-text` and `:lesson-1-reflection-text`). LMS responses use `<storageKey>:learner:<encoded cmi.core.student_id>:<activityId>-text`; they restore only for the same learner in the same browser. If the LMS provides no reliable student ID, the course does not save or restore LMS reflection prose in shared browser storage. On another browser or device, SCORM restores the completion milestone, but the text field remains empty. Browser storage can be inspected or cleared by someone with device access, so it is not a confidential record. `cmi.core.lesson_location` records the current lesson route. An internal reset event is available only in development or verification builds for automated tests. Individual activity Retry/Clear controls remain learner-facing. Changing the key version intentionally starts a new progress record.

## Known inherited limitations

- VIEW depends on browser intersection timing; background tabs and very short sections can behave differently across browsers.
- WATCH relies on the browser's `played` ranges and media duration metadata. It does not restrict playback speed.
- SUBMIT is intentionally attempt-based, not correctness-based.
- EXPLORE is binary in the percentage even though partial child state is saved.
- The source type named `optional` does not itself make an item optional; `required` controls inclusion.
- Standalone local storage is device-and-browser specific and can be cleared or unavailable.

## Storyboard alignment to confirm

Lessons 0–6 are implemented and tracked. The 51 requirements are documented in `docs/completion-implementation-plan.md`. Navigation and the separate People Connect final quiz are excluded from Astro requirements.

The SCORM 1.2 bridge initializes from the LMS-provided API, marks a fresh attempt incomplete, and sends `completed` with an immediate commit only when the final required milestone is earned and the bounded suspend data is saved. It never invents scores or passed/failed results and preserves existing completed or passed status. Progress changes and tab hiding save data without granting completion; actual page exit uses one guarded `LMSFinish` and a suspend exit value. API errors include the failed operation and LMS error details in the console. The single-SCO manifest and ZIP are generated by `npm run package:scorm` when packaging is authorized.

## Handover readiness

Run and report `npm run build`, `npm run verify`, `npm run package:scorm` and `npm run verify:scorm`, explicitly including the typography, completion-tracking and extracted-ZIP checks. `verify:scorm` uses a simulated LMS API. Live People Connect import, launch, resume and reporting must be tested in that LMS separately.
