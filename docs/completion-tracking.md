# Completion tracking

Completion is configured in `src/data/course-completion.ts` and rendered by `CourseProgress.astro`. Standalone launches use browser storage; LMS launches use the SCORM 1.2 API and `cmi.suspend_data`. The configured milestones are the single source of truth for the progress display and LMS completion.

## Mandatory course-build workflow

Configure completion tracking during every course build; no separate tracking request is required. Replace the starter milestones with course-specific requirements derived from the storyboard and the content actually implemented. Do not retain placeholder requirements or configure milestones for content that is absent.

Connect required content, videos and interactions to the appropriate existing behavior: VIEW for qualified section viewing, WATCH for merged unique playback ranges, attempt-based SUBMIT or COMPLETE for questions and submitted activities, and EXPLORE for configured child items. Preserve all approved rules, thresholds, weighting, events, persistence and restoration. Do not add correctness gates, longer dwell times, playback restrictions or other policy changes unless explicitly approved.

Optional resources, navigation links, the fixed footer message and Back to top are excluded from required completion. Before handover, validate unique milestone and target IDs, working targets and triggers, a course-specific versioned storage key, saved progress, and restoration in the browser and LMS. There is no learner-facing Reset Progress control.

## Configuration

Each milestone has a unique `id`, learner-facing `label`, supported `type`, unique `targetId`, and explicit `required` boolean. Required milestones are equally weighted; non-required milestones never enter the percentage denominator. A `watch` milestone may set `threshold` from greater than `0` through `1`; the default is `0.8`. Use a course-specific, versioned key such as `astro-course-progress:course-slug:v1`.

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

Standalone progress, merged video ranges, and explored child IDs are stored in `localStorage`. An LMS launch restores validated, versioned state only from `cmi.suspend_data`; browser storage cannot complete that LMS attempt. The LMS save includes completed milestones, video ranges and explored child IDs, with a hard 4,096-character limit and a console diagnostic if the payload is too large. An internal reset event is available only in development or verification builds for automated tests. Individual activity Retry/Clear controls remain learner-facing. Changing the key version intentionally starts a new progress record.

## Known inherited limitations

- VIEW depends on browser intersection timing; background tabs and very short sections can behave differently across browsers.
- WATCH relies on the browser's `played` ranges and media duration metadata. It does not restrict playback speed.
- SUBMIT is intentionally attempt-based, not correctness-based.
- EXPLORE is binary in the percentage even though partial child state is saved.
- The source type named `optional` does not itself make an item optional; `required` controls inclusion.
- Standalone local storage is device-and-browser specific and can be cleared or unavailable.

## Storyboard alignment to confirm

The current course implements the A-M-E-R steps as a static flow and the Customer needs exercise as submitted matching. The source storyboard also describes a four-step reveal and a branching scenario. Those interactions are not present as separate activities, so they are not required milestones. Confirm whether those media notes remain intended requirements before changing the course content or completion configuration.

The SCORM 1.2 bridge initializes from the LMS-provided API, marks a fresh attempt incomplete, and sends `completed` with an immediate commit only after every configured required milestone is complete. It never invents scores or passed/failed results and preserves existing completed or passed status. Progress changes and tab hiding save data; actual page exit uses one guarded `LMSFinish` and a suspend exit value. API errors include the failed operation and LMS error details in the console. The single-SCO manifest and ZIP are generated by `npm run package:scorm`.

## Handover readiness

Run and report `npm run build`, `npm run verify`, `npm run package:scorm` and `npm run verify:scorm`, explicitly including the typography, completion-tracking and extracted-ZIP checks. `verify:scorm` uses a simulated LMS API. Live People Connect import, launch, resume and reporting must be tested in that LMS separately.
