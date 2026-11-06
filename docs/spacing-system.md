# Course spacing system

Use the shared layout tokens in `src/styles/global.css` for new lesson sections and components. They use 4px-based endpoints while scaling smoothly between mobile and desktop widths.

| Token | Use | Range |
| --- | --- | --- |
| `--course-space-section` | Standard section block padding | 48–96px |
| `--course-space-card` | Panel and card padding | 16–32px |
| `--course-space-component-gap` | Card grids and split panels | 16–32px |
| `--course-space-heading-copy` | Heading to following copy | 16px |
| `--course-space-intro-interaction` | Introduction to tabs, cards or activity | 32–48px |

For prose, reuse `--course-type-prose-gap` (20px), `--course-type-layout-gap-compact` (12px) and `--course-type-layout-gap-spacious` (32px) from the established typography system. Use 4, 8, 12, 16, 24, 32, 48, 64, 80 or 96px values for remaining local gaps where a shared token would add no meaning.

Keep the editorial exceptions: hero bottom padding and image position, overlapping lesson-purpose panels, Lesson 0's decorative motif, the shorter collection-to-explorer transition, Lesson 5's zero-top transition, and compact previous-only navigation. These offsets support the approved compositions.

After spacing changes, run `npm run build` and `npm run verify`, then inspect mobile, tablet and desktop layouts for heading clearance, text clipping, horizontal overflow and preserved hero overlaps.
