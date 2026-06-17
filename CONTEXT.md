# Workout Tracking App

A free, open-source (AGPLv3) workout tracker for Android and iOS built with React Native. The workout session is the center of the app; every other feature supports it.

## Language

### Core Entities

**Exercise**:
A movement performed during a workout. Has a name, primary and secondary muscle groups, equipment, and configurable defaults (increment, rep range, rest timer, notes). Can be built-in (seeded from wrkout/exercises.json) or custom (user-created). Built-in and custom exercises are structurally identical — no second-class treatment.
_Avoid_: Movement, lift, activity

**Routine**:
A saved template of exercises with target sets, reps, and rest durations. Used to pre-load a workout session. Lives inside a RoutineFolder.
_Avoid_: Program, plan, workout plan, template (use "routine" consistently; "template" is only used in the "save as template" prompt context)

**RoutineFolder**:
A grouping of related routines (e.g., "Push Pull Legs" containing Push Day A, Push Day B, Pull Day A).
_Avoid_: Category, group, collection

**WorkoutSession**:
A single workout instance — the recording of what happened. Has a start time, optional finish time, optional link to a Routine (null = free-flow), session-level notes, and a list of WorkoutExercises.
_Avoid_: Workout, session, training session (use "WorkoutSession" for the data entity, "workout" in user-facing prose)

**WorkoutExercise**:
One exercise performed within a WorkoutSession. Links to an Exercise, has per-session notes, and contains ExerciseSets. Tracks whether it was substituted from a RoutineExercise.
_Avoid_: Session exercise, logged exercise

**ExerciseSet**:
One set within a WorkoutExercise. Has weight, reps, set type (normal, warm-up, dropset, failure), completion status, and rest timer duration.
_Avoid_: Set, rep group

### Workout Modes

**Free Flow**:
A workout started without a routine template. Exercises are added ad-hoc during the session. At finish, the user is prompted to save as a routine.
_Avoid_: Empty workout, ad-hoc workout, blank workout

**Routine-Driven**:
A workout started from a saved routine. Exercises are pre-loaded in order with target sets/reps and previous weights pre-filled.

### Set Types

**Warm-up Set**:
A preparatory set, not counted in volume or PR calculations. Does not trigger the rest timer. Marked with orange "W".
_Avoid_: Warmup

**Drop-set**:
A set performed immediately after a working set with reduced weight, grouped visually as a tree branching from the parent set. Consecutive drop-sets form one logical group; rest timer only starts after the last drop.
_Avoid_: Drop set, strip set

**Failure Set**:
A set taken to muscular failure. Counted in volume but flagged in analytics. Marked with red "F".

**Normal Set**:
A standard working set. No special marker. Counted in all calculations.

### Superset

**Superset**:
Two exercises paired to be performed in alternating fashion (A, B, rest, A, B, rest). Displayed stacked vertically with alternating rows. Share one rest timer that starts after both exercises' current sets are completed.
_Avoid_: Circuit, paired exercises

### Notes System

**Exercise Default Notes**:
Permanent form cues or setup instructions stored on the Exercise entity. Displayed as a highlighted sticky note above set rows during every workout. Example: "In between pinky and ring finger on the inner rings of the bar."
_Avoid_: Sticky note, permanent note, cue (acceptable in user-facing prose but not as the canonical term)

**Per-Session Exercise Notes**:
Notes specific to today's performance of an exercise, stored on WorkoutExercise. Example: "Felt weak today, elbow was bothering me."
_Avoid_: Daily note, exercise note

**Session Notes**:
Overall workout notes stored on WorkoutSession. Added on the finish screen. Example: "Crowded gym, had to wait for squat rack."
_Avoid_: Workout note, summary note

### Analytics

**Personal Record (PR)**:
The best performance for an exercise, calculated as the highest estimated 1RM across all sessions. Displayed as bold numbers in the Progress tab.
_Avoid_: PB, best lift, max

**Estimated 1RM**:
A calculated one-rep max using the Brzycki formula from weight and reps. Used for PR detection and strength progression charts.

**Volume**:
Total weight moved in a session or period (weight × reps summed across working sets). Warm-up sets excluded.

**Exercise Pair Frequency**:
A counter tracking how often exercise B is added after exercise A in a session. Drives zero-AI exercise suggestions during free-flow workouts.

### AI

**Routine Import**:
AI-powered feature that parses a URL or pasted text into a structured routine. The AI returns JSON; the app matches exercise names against the database and presents a review screen before saving.
_Avoid_: AI routine generation, program import

**AI Provider**:
An external LLM service (OpenAI, OpenRouter, Anthropic, custom endpoint) that the user configures with their own API key. Optional — the app functions fully without AI.

### Data

**Exercise Library**:
The browsable, searchable collection of all exercises (built-in + custom). Accessible from the More tab and History tab. Sorted by usage frequency.
_Avoid_: Exercise database, exercise catalog

**Seed Data**:
The initial set of ~2,500 exercises from wrkout/exercises.json (public domain) bundled into the app at build time. No images included.
