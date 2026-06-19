# Repository Guidelines

## Project Overview

A free, open-source (AGPLv3) workout tracker for Android and iOS built with React Native (Expo). The workout session is the center of the app; every other feature supports it. Custom exercises are first-class — same table, same UI, same weight as built-in ones. No bundled images; user photos for all exercises. AI is an optional thin parsing layer for routine import.

Repo: `https://github.com/simonteague6/workout-app`

## Architecture & Data Flow

```
React Native (Expo) → Zustand stores → SQLite (op-sqlite)
                           ↑
                    Custom AI client (OpenAI/OpenRouter/Claude/custom endpoint)
```

- **Local-first, offline-first**: SQLite on device. No server.
- **State**: Four Zustand stores — `workoutStore` (live session), `exerciseStore` (library cache), `routineStore` (folders + templates), `settingsStore` (theme, units, API keys).
- **Navigation**: React Navigation — 4 bottom tabs (Workout | History | Progress | More) with stack navigators inside each tab.
- **AI**: Thin parsing layer. LLM returns JSON; app matches exercise names against database. AI never touches SQLite directly.
- **Exercise suggestions**: `exercise_pair_frequency` counter table — zero AI, gets smarter with every workout.

```
src/
├── db/                  # SQLite schema, migrations, seed script, query functions
│   ├── schema.sql       # Full CREATE TABLE statements with FK constraints (authoritative reference)
│   ├── migrations/      # Versioned schema changes (0001_initial_schema.js + index.js)
│   ├── seed/            # Build-time: wrkout/exercises.json → SQLite INSERTs (seed.js + exercises.json)
│   └── queries/         # Reusable SQL: exerciseQueries, sessionQueries, routineQueries, analyticsQueries
├── stores/              # Zustand stores (workoutStore, exerciseStore, routineStore, settingsStore)
├── screens/             # Tab screens + stack screens
│   ├── WorkoutTab/      # StartScreen, RoutinePreview, LiveSession
│   ├── HistoryTab/      # CalendarScreen, SessionDetail, ExerciseHistory
│   ├── ProgressTab/     # ProgressScreen (charts, heatmap, PRs)
│   └── MoreTab/         # MoreScreen, ExerciseLibrary, ExerciseDetail, AISettings, DataScreen
├── components/          # Shared UI: ExerciseCard, SetRow, RestTimer, AddExerciseModal, FinishScreen, RoutineBuilder, CalendarHeatmap
├── navigation/          # AppNavigator.js — bottom-tab + stack navigator setup
├── ai/                  # (planned) aiClient, routineImport, instructionGenerate
├── utils/               # db.js (connection + migration runner), formatters.js, secureStorage.js, theme.js
├── theme.js             # Frozen color/spacing/radius design tokens
└── App.js               # Root component: DB bootstrap, migration runner, navigation container
```

## Development Commands

```bash
# Create Expo project (not yet initialized)
npx create-expo-app@latest . --template blank

# Run on Android
npx expo start --android

# Run tests (Jest)
npm test

# Lint
npm run lint
```

Package manager: **npm** (default with Expo). Runtime: **Node.js** (Expo managed workflow).

## Code Conventions & Common Patterns

### Language
- **JavaScript** initially, migrating to TypeScript after MVP stabilization.
- Use JSDoc annotations where practical to ease the transition.

### Domain vocabulary
Use terms as defined in `CONTEXT.md`. Key terms:
- **Exercise** (not "movement" or "lift")
- **Routine** (not "program" or "plan"; "template" only in "save as template" context)
- **WorkoutSession** (data entity; "workout" in user-facing prose)
- **Free Flow** (not "empty workout" or "ad-hoc workout")
- **ExerciseSet** (not "set" or "rep group")
- **Exercise Default Notes** (not "sticky note" or "permanent note")

### Naming
- Stores: `camelCase` files, PascalCase exports (`workoutStore.js` exports `useWorkoutStore`)
- Components: PascalCase files matching component name (`ExerciseCard.js`)
- Queries: `camelCase` files, functions named for what they return (`getSessionHistory`, `calculate1RM`)
- SQL tables: `snake_case` (`workout_session`, `exercise_set`, `routine_exercise`)

### State management pattern
Stores expose actions that read/write SQLite and update in-memory state:
```js
// Pattern: action → SQLite write → state update
const useWorkoutStore = create((set, get) => ({
  sessions: [],
  startFreeFlow: async () => {
    const session = await db.insertSession({ routine_id: null });
    set(state => ({ sessions: [...state.sessions, session] }));
  },
}));
```

### Testing seams
Test through public interfaces only — Zustand store actions and SQLite query functions. Never test UI rendering, navigation, or component layout at the unit level. See `docs/prd-workout-app-mvp.md` §Testing Decisions for seam details.

## Important Files

| File | Purpose |
|------|---------|
| `CONTEXT.md` | Domain glossary — canonical terms, avoid-list |
| `docs/prd-workout-app-mvp.md` | Full PRD: 62 user stories, data model, implementation decisions |
| `docs/agents/domain.md` | How agents consume domain docs |
| `docs/agents/issue-tracker.md` | GitHub CLI conventions for issue operations |
| `docs/agents/triage-labels.md` | Label mapping (`ready-for-agent`, `needs-triage`, etc.) |
| `src/db/schema.sql` | Authoritative full schema (13 tables, FK constraints, indexes) |
| `src/db/seed/seed.js` | Transforms wrkout `exercises.json` → SQLite INSERTs (idempotent) |
| `src/db/seed/exercises.json` | Bundled wrkout exercise dataset (public domain, Unlicense) |
| `src/utils/db.js` | DB adapter (op-sqlite on device / node:sqlite in tests) + migration runner |
| `skills-lock.json` | Installed Matt Pocock skills manifest |

## Runtime/Tooling Preferences

- **Framework**: React Native with Expo managed workflow
- **Database**: SQLite via `op-sqlite`
- **State**: Zustand
- **Navigation**: React Navigation
- **Charts**: victory-native or react-native-skia
- **Testing**: Jest (stores + queries); React Native Testing Library (if component tests needed later)
- **AI client**: Custom unified client supporting OpenAI, OpenRouter, Anthropic, and custom OpenAI-compatible endpoints
- **CI**: GitHub Actions (to be set up)

## Testing & QA

Jest with `jest-expo` preset, `testEnvironment: "node"` for DB unit tests. In-memory SQLite via `node:sqlite` — no React dependency.

### Test infrastructure helpers
Located in `src/utils/db.js`:
- `createInMemoryDb()` — fresh in-memory SQLite database per test
- `initDatabase(db)` — runs schema + migrations on a database instance
- `resetDatabaseForTesting(db)` — clears all rows between tests
- `resetSecureStorageForTesting()` — clears in-memory secure storage map

### Test files
| File | What it covers |
|------|---------------|
| `src/stores/__tests__/workoutStore.test.js` | Free flow, add/complete sets, set type cycle, exercise CRUD, supersets, resume, finish, start-from-routine, substitute |
| `src/stores/__tests__/settingsStore.test.js` | Settings persistence, AI config, load on restart |
| `src/stores/__tests__/exerciseStore.test.js` | Library load/search, filtering, sort by frequency, create/edit/archive, photos, history |
| `src/stores/__tests__/routineStore.test.js` | Folder/routine CRUD, edit + reorder, preview, save-as-new from finish diff |
| `src/db/__tests__/routineQueries.test.js` | Folder/routine CRUD, routine preview, routine-vs-session diff, save-as-new + update-template-from-session |
| `src/db/__tests__/sessionQueries.test.js` | Session CRUD, exercise suggestions via pair frequency, set pre-fill, supersets, volume calc |
| `src/db/__tests__/exerciseQueries.test.js` | Exercise lookup/search/sort, custom exercises, archive/unarchive, photo paths, history |
| `src/db/__tests__/settingsQueries.test.js` | Read/write app_settings table |
| `src/db/__tests__/portabilityQueries.test.js` | Export/import workout data |
| `src/db/__tests__/migrationRunner.test.js` | Apply schemas in order, idempotency |
| `src/db/__tests__/seed.test.js` | wrkout dataset seeding, field mappings, idempotency |
| `src/utils/__tests__/formatters.test.js` | Weight conversion, rounding, display formatting |

### Coverage gaps
- `src/utils/db.js` — statement splitting, adapter logic not unit-tested (indirectly exercised via store/query tests)
- `src/utils/theme.js` — theme resolution hook not unit-tested
- `src/ai/` — no tests yet (module not implemented)

### TDD workflow
Issues #3, #4, #5, #6 require TDD. Agents read `skill://tdd` before starting. Red-green-refactor per acceptance criterion. Never write all tests upfront.

### What to test
- **Store actions**: given inputs → correct state + correct SQLite rows
- **Query functions**: given database state → correct return values
- **AI pipeline**: given mocked LLM response → correct parsing + matching
- **Seed script**: given JSON → correct row count + field mappings
- **Formatters**: given raw values → correct display output

### What NOT to test
- UI rendering, navigation transitions, component layout
- Chart rendering (test the data queries, not the pixels)
- React Navigation configuration

### Running tests
```bash
npm test                 # all tests
npm test -- --watch      # watch mode
npm test -- -t "workout"  # filter by name
```

## Issue Workflow

Issues are tracer-bullet vertical slices — each cuts through all layers end-to-end. Dependency order:

```
#1 (scaffold+db) → #2 (exercise library) → #3 (free-flow) → #6 (history+progress)
                 ↘                    ↘      ↘
                   #7 (settings)        #4 (routines) → #5 (AI import)
```

All issues labeled `ready-for-agent`. Agents pick up any unblocked issue, read `skill://tdd` if required, and implement against acceptance criteria.
