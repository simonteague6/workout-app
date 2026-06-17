# PRD: Workout Tracking App MVP

## Problem Statement

Existing workout tracking apps fall into two camps, both frustrating:

**Paid apps** (Strong, Hevy) charge $30+/year and lock features behind paywalls. They treat custom exercises as second-class — no images, no parity with built-in exercises. Users feel held back, unable to fully customize their experience.

**Free/open-source apps** feel unpolished. Navigation is poorly designed, data entry is high-friction, and they lack the thoughtful details that make workout logging feel effortless: inline history, auto-starting rest timers, set markers, sticky notes, and meaningful analytics.

The user currently tracks workouts in Obsidian with free-form text files — flexible but finicky, not purpose-built, and missing structured data tracking.

## Solution

A free, open-source (AGPLv3), Android-first (iOS later) workout tracker built with React Native (Expo) that prioritizes frictionless workout logging above all else. The workout session is the center of the app; every other feature supports it.

Core philosophy: **maximum freedom, zero second-class treatment.** Custom exercises live in the same table, same UI, same weight as built-in ones. No bundled images — user photos for all exercises, keeping everything equal. AI is a thin, optional parsing layer for routine import, never a dependency.

## User Stories

### Workout Session — Core Logging

1. As a lifter, I want to start a workout from a saved routine template, so that my exercises, target sets, and previous weights are pre-loaded and I can begin immediately.
2. As a lifter, I want to start a free-flow workout with no pre-loaded exercises, so that I can build my session ad-hoc when I'm not following a routine.
3. As a lifter, I want to see my previous session's weight and reps next to each set row during a workout, so that I know what I did last time without leaving the session screen.
4. As a lifter, I want the weight field pre-filled with my last session's weight for each set, so that I don't have to re-enter it every workout.
5. As a lifter, I want to tap the weight field and see increment chips (+2.5, +5, +10, -5) with my exercise's default highlighted, so that I can quickly bump weight without typing.
6. As a lifter, I want to mark each set as Warm-up, Drop-set, Failure, or Normal by tapping the set number, so that I can annotate my training intent.
7. As a lifter, I want warm-up sets visually distinct (orange "W") and excluded from volume/PR calculations, so that my analytics reflect working sets only.
8. As a lifter, I want drop-sets visually linked as a tree branching from the parent set, so that I can see the drop chain at a glance.
9. As a lifter, I want failure sets counted in volume but flagged in analytics, so that I can track when I'm hitting failure and how it correlates with progress.
10. As a lifter, I want a rest timer that auto-starts when I checkmark a set, so that I don't have to manually start it every time.
11. As a lifter, I want the rest timer visible inline on the current exercise and fading to the top bar when I scroll away, so that it's always accessible.
12. As a lifter, I want an "Add 30s" button on the rest timer, so that I can extend rest without resetting.
13. As a lifter, I want the rest timer to notify me with vibration (and sound if headphones are connected) when it hits zero, so that I know rest is over.
14. As a lifter, I want per-exercise configurable rest duration with a 2-minute app-wide default, so that bench press gets 2 minutes but lateral raises get 1 minute.
15. As a lifter, I want to add an exercise mid-workout via a modal that opens with the keyboard already focused and shows suggested exercises, so that I can find and add my next exercise in seconds.
16. As a lifter, I want suggested exercises sorted by how often I've paired them with my current exercises, so that the suggestions get smarter the more I use the app.
17. As a lifter, I want to substitute an exercise in my routine for today only via a three-dots menu, so that I can swap when equipment is taken without editing the template.
18. As a lifter, I want a substituted exercise to inherit the target sets/reps from the original but pre-fill weight from my history of the substitute exercise, so that I don't start from scratch.
19. As a lifter, I want to create supersets by pairing two exercises (via add modal toggle, drag, or long-press menu), so that alternating exercises display stacked vertically with a shared rest timer.
20. As a lifter, I want exercise default notes displayed as a highlighted sticky note above the set rows, editable inline, so that my form cues are always visible during the set.
21. As a lifter, I want to add per-session exercise notes via the three-dots menu, so that I can record "elbow felt weird today" without cluttering my permanent cues.
22. As a lifter, I want to tap an exercise name during a workout to see its full history card (analytics, all-time PR, past sessions), so that I can deep-dive without leaving the session.
23. As a lifter, I want the workout session to persist across tab switches, so that I can check my history or progress mid-workout and return without losing state.
24. As a lifter, I want to resume an interrupted workout from where I left off, so that an app crash or phone restart doesn't lose my session.

### Finish Flow

25. As a lifter, I want a finish screen that shows a git-diff style comparison of my routine template vs. what I actually did, with substitutions highlighted green and skipped exercises highlighted red, so that I can see exactly what changed.
26. As a lifter, I want the option to update the routine template to match today's workout, keep the original, or save today as a new template copy, so that I control whether changes persist.
27. As a lifter, I want the finish screen to show session stats (total volume, duration, exercises completed), so that I get immediate feedback on my session.
28. As a lifter, I want to add session-level notes on the finish screen, so that I can record "crowded gym, low energy" for the whole workout.
29. As a lifter, I want to be prompted to save a free-flow workout as a routine template after finishing, so that my ad-hoc sessions can become reusable routines.

### Routines

30. As a lifter, I want to organize routines into folders (e.g., "Push Pull Legs" with three templates inside), so that I can group related routines.
31. As a lifter, I want to see a routine preview (exercise list + last session's performance) before starting, so that I know what I'm committing to.
32. As a lifter, I want to create a routine manually via a builder screen where I add exercises, set target sets/reps/rest per exercise, and drag to reorder, so that I can build routines from scratch.
33. As a lifter, I want to edit an existing routine via a pencil icon on the routine card, so that I can adjust my templates over time.
34. As a lifter, I want to import a routine from a URL or pasted text using AI, so that I can adopt a Jeff Nippard program in seconds instead of an hour of manual entry.
35. As a lifter, I want the AI import to match exercise names against the database and flag unmatched ones for me to resolve, so that I can verify accuracy before saving.
36. As a lifter, I want the AI import to be optional and bring-your-own-key (OpenAI, OpenRouter, Claude, custom endpoint), so that I'm not forced into a subscription.

### Exercise Library

37. As a lifter, I want to browse and search 2,500+ built-in exercises by name, muscle group, or equipment, so that I can find any exercise quickly.
38. As a lifter, I want to create a custom exercise with name, muscle groups, equipment, default increment, rep range, rest timer, and notes, so that any exercise I invent feels complete.
39. As a lifter, I want custom exercises to appear identically to built-in ones in search results and workout logging, so that they never feel second-class.
40. As a lifter, I want to take a photo for any exercise (built-in or custom), so that every exercise can have visual reference without a two-tier image system.
41. As a lifter, I want to edit any exercise's metadata (increment, rep range, rest timer, notes), so that I can customize built-in exercises to my preferences.
42. As a lifter, I want AI to generate instructions for custom exercises based on the name, so that my custom exercises have guidance without me writing it.
43. As a lifter, I want the exercise library sorted by how frequently I use each exercise, so that my go-to exercises appear first.
44. As a lifter, I want to swipe-to-edit an exercise from the library to quickly access its metadata.

### History

45. As a lifter, I want a calendar view showing dots on days I worked out, so that I can see my consistency at a glance.
46. As a lifter, I want to tap a calendar day to see that session's exercises, sets, weights, reps, and duration, so that I can review any past workout.
47. As a lifter, I want per-exercise history showing every session for that exercise chronologically with weight×reps for each set, so that I can see my bench press progression over months (my Obsidian-style view).
48. As a lifter, I want to jump to any exercise's history from a search bar on the History tab, so that I can find it without browsing the full exercise library.

### Progress & Analytics

49. As a lifter, I want estimated 1RM charts per exercise over time, so that I can see my strength progression.
50. As a lifter, I want weekly volume trends (total weight moved) per muscle group, so that I can track training load.
51. As a lifter, I want a calendar heatmap (GitHub-contribution style) of my workout frequency, so that I can see consistency patterns.
52. As a lifter, I want muscle group frequency tracking that highlights neglected groups, so that I notice when I've been skipping legs for a month.
53. As a lifter, I want all-time and recent (30-day) personal records per exercise displayed as bold numbers, so that PRs feel significant.
54. As a lifter, I want native-drawn charts (react-native-skia or victory-native) that feel smooth and polished, so that the analytics tab doesn't feel like a webview afterthought.

### Settings & Data

55. As a lifter, I want to export all my data as JSON for backup and CSV for spreadsheet analysis, so that my data is portable and I'm never locked in.
56. As a lifter, I want to import data from JSON backups, so that I can restore my history on a new device.
57. As a lifter, I want to switch between lbs and kg, so that I can use my preferred unit system.
58. As a lifter, I want dark/light/system theme support, so that the app looks right in any environment.
59. As a lifter, I want to configure my AI provider and model in settings, so that I control which LLM powers routine import.

### Onboarding

60. As a new user, I want a 2-screen onboarding that introduces the app and offers pre-loaded demo routine URLs I can import with one tap, so that I see the AI import value immediately without configuring anything.
61. As a new user, I want one-time free AI access during onboarding so I can try routine import without entering an API key, so that I'm not blocked by setup before experiencing the feature.
62. As a new user, I want to skip AI setup entirely and start a free-flow workout immediately, so that AI-averse users aren't forced into it.

## Implementation Decisions

### Tech Stack

- **Framework**: React Native with Expo (managed workflow). Android-first, iOS supported from day one via the same codebase.
- **Language**: JavaScript initially, migrating to TypeScript after MVP stabilization.
- **Local database**: SQLite via op-sqlite. Offline-first, no server dependency. Schema migrations managed with a versioned migration runner.
- **State management**: Zustand. Four stores: `workoutStore` (live session state, timer), `exerciseStore` (library cache), `routineStore` (folders + templates), `settingsStore` (theme, units, API keys, defaults).
- **Navigation**: React Navigation. Bottom tabs (Workout | History | Progress | More) with stack navigators inside each tab.
- **Charts**: victory-native or react-native-skia for native-drawn charts in the Progress tab.
- **License**: AGPLv3.

### Data Model

The schema is fully normalized. Key entities and relationships:

- **Exercise**: id, name, primary_muscle_group_id, secondary_muscle_group_id, equipment_id, default_notes, default_increment, default_rep_range_min, default_rep_range_max, default_rest_seconds, exercise_type (strength/cardio/flexibility), is_custom, is_archived (soft-delete), created_at, updated_at. Photo stored as file path reference.
- **MuscleGroup** and **Equipment**: lookup tables (not free-text) to ensure reliable analytics grouping.
- **RoutineFolder**: id, name, sort_order.
- **Routine**: id, folder_id, name, created_at, updated_at.
- **RoutineExercise**: id, routine_id, exercise_id, sort_order, target_sets, target_reps_min, target_reps_max, target_rest_seconds. Normalized join table — NOT a JSON blob. Enables "which routines use exercise X?" queries and the routine-vs-actual comparison on finish.
- **WorkoutSession**: id, started_at, finished_at, routine_id (nullable — null = free-flow), notes, is_completed, body_weight (optional).
- **WorkoutExercise**: id, session_id, exercise_id, sort_order, notes (per-session), substituted_from_routine_exercise_id (nullable — tracks which routine exercise was substituted).
- **ExerciseSet**: id, workout_exercise_id, sort_order, weight, reps, set_type (normal | warmup | dropset | failure), is_completed, rest_timer_duration, rpe (optional, post-MVP).
- **SupersetGroup**: id, session_id. Links exercises paired as a superset within a session.
- **SupersetMember**: id, superset_group_id, workout_exercise_id, sort_order.
- **ExercisePairFrequency**: id, exercise_a_id, exercise_b_id, count. Incremented each time exercise B is added after exercise A in a session. Drives zero-AI exercise suggestions.
- **BodyMeasurement**: id, date, weight, body_fat_pct, notes. Post-MVP.

Foreign key constraints: ON DELETE RESTRICT for exercises referenced by history (prevents accidental data loss). ON DELETE CASCADE for session → exercise → set chains.

### Exercise Data Seed

Seed from `wrkout/exercises.json` (2,500+ exercises, Unlicense/public domain). A build script transforms the JSON into SQLite INSERT statements. Images are not bundled — the JSON's image references are ignored. Users can optionally download an image pack or take their own photos.

The seed maps wrkout fields to our schema: name → name, force → exercise_type mapping, mechanic → compound/isolation metadata, equipment → Equipment lookup, primaryMuscles/secondaryMuscles → MuscleGroup lookups, instructions → default_notes.

### AI Architecture

AI is a thin parsing layer. It never touches SQLite directly.

**Routine import flow**: User pastes URL or text → app fetches URL content (if URL) → text + structured prompt sent to LLM → LLM returns JSON with routine name and exercises (name, sets, reps, rest, notes) → app matches exercise names against the database → review screen shows matched/unmatched exercises → user resolves unmatched ones (create custom or pick existing) → saves to Routine + RoutineExercise rows.

The LLM prompt includes the exercise database as context so it can attempt accurate name matching, but the final match is done by the app (fuzzy string matching against the Exercise table), not the LLM.

**Instruction generation**: For custom exercises, an optional AI call generates default instructions from the exercise name. User can edit the result.

**Model flexibility**: Unified AI client supports OpenAI, OpenRouter, Anthropic, and custom OpenAI-compatible endpoints. Users bring their own API key. A model picker in settings. Post-MVP: optional $5/mo subscription for built-in AI access.

### Navigation Structure

Four bottom tabs:

- **Workout**: Start screen (routine folders, Free Flow button, continue interrupted session) → Routine Preview → Live Session (the core screen). Live Session persists across tab switches.
- **History**: Calendar view (default) → Session Detail. Per-exercise history accessible via search bar or exercise list button. Exercise list accessible from both History and More with correct back navigation.
- **Progress**: Scrollable screen with 1RM charts, volume trends, calendar heatmap, muscle group frequency, and PR displays.
- **More**: Scrollable settings screen with sections: Exercise Library, AI & API Keys, Data (export/import), Health Integrations (post-MVP), Appearance.

### In-Workout UX Details

- **Previous column**: Always visible next to each set row, showing last session's weight×reps. Zero taps required.
- **Set markers**: Tap set number → popup with Warm-up/Drop-set/Failure/Normal options. Color + letter labels (orange W, blue D, red F).
- **Weight quick-add**: Tap weight field → increment chips appear above keyboard (+2.5, +5, +10, -5). Exercise's default_increment highlighted.
- **Rest timer**: Auto-starts on set checkmark. Inline display on current exercise, fades to top bar when scrolling away. "Add 30s" button. Notification + vibration at zero (sound only if headphones connected). Hierarchy: routine override > exercise default > app default (2 min). Warm-up sets do not trigger the rest timer.
- **Add exercise modal**: Full-screen modal, keyboard auto-focused, suggestions at top (sorted by ExercisePairFrequency count DESC), full searchable list below. "Can't find it? Create new" at bottom.
- **Substitute exercise**: Three-dots menu → "Substitute for today" → same add-exercise modal. Inherits target sets/reps from original, pre-fills weight from substitute's history. One-session override; template unchanged unless user chooses "Update" on finish.
- **Supersets**: Created via add-modal toggle, drag-to-pair, or three-dots menu. Displayed stacked vertically (alternating rows). Shared rest timer starts after both exercises' current sets are completed.
- **Notes**: Three levels. Exercise default notes as highlighted sticky note above sets (editable inline). Per-session exercise notes via three-dots menu. Session notes on finish screen.
- **Three-dots menu**: Substitute, Add to superset, Edit today's notes, Reorder, Remove from workout. Session-level actions only.
- **Exercise name tap**: Navigates to exercise detail card (history, analytics, metadata, photo). Visual affordance (chevron) signals tappability.

### Finish Flow

Side-by-side git-diff comparison: routine template (left) vs. today (right). Substitutions highlighted green, skipped exercises highlighted red. Three options: Update template, Keep original, Save as new (with name + folder picker, folder pre-filled from original). Session stats displayed (volume, duration, exercises completed). Session notes field.

### Onboarding

Two screens: Welcome → "How do you want to begin?" with three options: Start Free Flow, Import from URL (with pre-loaded demo URLs from scientifically-researched programs), Browse Exercises. One-time free AI access for the demo import — no API key required. Users can skip AI setup entirely.

### Data Portability

JSON export/import for full backup/restore. CSV export for spreadsheet analysis. Import is JSON-only (rebuilding relational data from CSV is fragile). Post-MVP: AI-assisted import from other app formats.

## Testing Decisions

### What Makes a Good Test

Tests assert external behavior, not implementation details. They verify that given inputs produce correct outputs and state transitions. They do not test UI rendering, navigation, or component layout. They target conditional branches, edge values, invariants across fields, and error handling on bad input.

### Seams Under Test

1. **Zustand stores** — Pure JS, no React dependency. Test store actions and derived state:
   - `workoutStore`: add exercise, add set, complete set (triggers rest timer start, pair frequency increment), substitute exercise, mark set type, create superset, finish workout (produces correct comparison diff), resume interrupted session.
   - `routineStore`: create routine, edit routine, reorder exercises, save-as-new from finish diff.
   - `exerciseStore`: create custom exercise, edit metadata, archive exercise (preserves history), frequency-sorted listing.
   - `settingsStore`: unit conversion (lbs/kg display), rest timer resolution (routine > exercise > app default).

2. **SQLite query layer** — Test with in-memory SQLite:
   - Session history queries: calendar aggregation, session detail with exercises and sets.
   - Per-exercise history: chronological set list with weight×reps, all-time PR detection.
   - Analytics: volume over time (weekly aggregates), estimated 1RM (Brzycki formula), muscle group frequency, exercise pair frequency.
   - Routine vs. actual comparison: given a routine_id and session_id, produce the diff structure.
   - Seed pipeline: wrkout/exercises.json → correct row count, correct field mappings.

3. **AI routine import** — Test with mocked LLM responses:
   - Valid JSON → correct Routine + RoutineExercise rows created.
   - Partial matches → unmatched exercises flagged, matched ones linked.
   - Invalid JSON → graceful error, user sees the raw text to manually enter.
   - URL fetch failure → graceful error.

### Prior Art

No existing tests in the codebase (greenfield). Test patterns will follow standard Jest + React Native Testing Library conventions for store tests, and op-sqlite in-memory mode for query tests.

## Out of Scope

- **Health integrations** (Google Health Connect, Apple Health): Deferred to post-MVP. Reading body weight, steps, heart rate, run data; writing workouts back.
- **Run tracking / Strava-like features**: User will continue using Strava for run tracking. The app may read run data from Health integrations post-MVP for analytics context, but will not build a run logger.
- **Body measurements**: Deferred to post-MVP. Weight, body fat %, circumference tracking.
- **RPE/RIR fields on sets**: Post-MVP enhancement to set logging.
- **Cardio exercise tracking** (duration-based instead of rep-based): The schema supports it via exercise_type and optional duration fields on sets, but the MVP UI focuses on strength training.
- **$5/mo subscription for built-in AI**: Post-MVP. MVP uses bring-your-own-key only, with one-time free AI during onboarding.
- **"Generate routine from constraints" AI feature**: Post-MVP. MVP AI is routine import only.
- **Social features** (sharing workouts, following friends): Not planned.
- **Web/desktop version**: Mobile-only (Android + iOS).
- **Push notifications** (workout reminders): Post-MVP.

## Further Notes

- The app name is not yet decided. The codebase will use a working name until one is chosen.
- The exercise_pair_frequency table is the core of the "smart suggestions" system. It requires no AI, no network, and improves with every workout. This is a key differentiator from apps that use static muscle-group-based suggestions.
- The "no bundled images" decision is philosophical: it prevents the two-tier system where built-in exercises have polished media and custom ones don't. User photos for everything keeps the playing field level.
- The AGPLv3 license is intentional — the user wants this to be free and open-source forever, and AGPLv3 ensures any derivative works (including server-side modifications) remain open.
- JavaScript-first with a planned TypeScript migration. The initial codebase will use JSDoc annotations where practical to ease the transition.
