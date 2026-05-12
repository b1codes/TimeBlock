# Chunk Editor — Editable Times & Bottom-Task Extension

**Date:** 2026-05-12
**Status:** Approved design — ready for implementation plan
**Scope:** `frontend/src/screens/ChunkEditorScreen.tsx`, `frontend/src/components/ChunkContainer.tsx`, `frontend/src/components/DraggableDivider.tsx`, `frontend/src/utils/dragMath.ts`, `frontend/src/api/client.ts`, `backend/src/models.py`, `backend/src/database.py`, plus a new `frontend/src/components/EditTimesModal.tsx`.

## Problem

Two related gaps in `ChunkEditorScreen`:

1. The chunk's `start_time` / `end_time` are displayed as static `HH:mm — HH:mm` text in the top eyebrow. There is no way to edit them from the editor screen.
2. The bottom-most task cannot be extended into the "Unassigned Time Chunk" slot. Today, dragging a divider rebalances two adjacent tasks (zero-sum), and the unassigned slot is purely a tap target for creating a new task. Concretely: a chunk with two tasks at 5m and 15m and 10m unassigned cannot become 5m and 25m without first creating a placeholder task and rebalancing.

## Goals

- Tap-to-edit start and end times on the editor screen, with persistence end-to-end.
- A direct, gestural way to grow (or shrink) the bottom task by consuming unassigned time.
- Preserve the existing zero-sum drag behavior between tasks unchanged.
- Reject envelope edits that would silently destroy task durations.

## Non-goals (explicit YAGNI)

- Editing the chunk's **date** (only the time-of-day).
- Native OS date/time pickers (no new dependency).
- Auto-shrinking tasks when the envelope shrinks — instead, block with an error.
- Buffer-toggle on the terminal divider.
- Overnight chunks (where end < start across midnight). Same-day only for now.

## Design

### 1. State ownership

`ChunkEditorScreen` becomes stateful for the envelope:

```
ChunkEditorScreen
  ├── state: { startTime: string, endTime: string }      ← ISO strings, mirrors route param at mount
  ├── derived: totalDurationMinutes
  └── ChunkContainer
        ├── prop: totalDurationMinutes                   ← reactive to envelope edits
        ├── state: tasks
        └── derived: currentTotal, unassigned
```

`ChunkContainer` keeps owning `tasks`. The screen passes a callback (`onTimesChange`) that the modal triggers; the screen owns the debounced sync of envelope changes.

### 2. Backend — partial PATCH

**`backend/src/models.py`** — `TimeChunkUpdate` becomes partial:

```python
class TimeChunkUpdate(BaseModel):
    tasks: list[Task] | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
```

**`backend/src/database.py`** — rename `update_chunk_tasks` → `update_chunk(user_id, chunk_id, update: TimeChunkUpdate)`. Build the `UpdateExpression` dynamically from whichever fields are non-`None`. Same `ConditionExpression="attribute_exists(chunk_id)"`. Same `ReturnValues="ALL_NEW"`. If no fields are provided, return early with a fresh `get_item` (or raise — see "Open implementation choices" below).

**`backend/src/routes.py`** — the route passes the whole `update_data` model through:

```python
return database.update_chunk(x_user_id, chunk_id, update_data)
```

### 3. Frontend API — partial PATCH

**`frontend/src/api/client.ts`** — generalize the patch:

```ts
type ChunkUpdate = {
  tasks?: Task[];
  start_time?: string;
  end_time?: string;
};

private async executePatch(chunkId: string, payload: ChunkUpdate): Promise<void>
public debouncedUpdateChunk: DebouncedFunc<(chunkId: string, payload: ChunkUpdate) => Promise<void>>;
```

Existing call sites in `ChunkContainer` migrate from `debouncedUpdateChunkTasks(id, tasks)` to `debouncedUpdateChunk(id, { tasks })`. The new screen state calls `debouncedUpdateChunk(id, { start_time, end_time })`.

### 4. EditTimesModal — new component

**`frontend/src/components/EditTimesModal.tsx`** — mirrors the existing `CreateTaskModal` and `CreateScheduleModal` patterns:

- `BlurView` backdrop (`intensity={30}`, `tint="dark"`) + dim overlay.
- `GlassSurface` sheet (radius `theme.layout.radius.xl`, `tone="raised"`, `borderTone="strong"`).
- Eyebrow `ADJUST ENVELOPE`, title `Re-time the schedule`.
- Two field rows side-by-side or stacked: `START` and `END` labels with `HH:mm` `TextInput`s (numeric keyboard, masked-ish — simple validation on submit, not on each keystroke).
- Inline error region below the fields, shown on validation failure.
- `ABORT` and `COMMIT` buttons matching the existing modal styling.

**Validation on COMMIT:**

1. Parse each `HH:mm` string. Reject if not parseable.
2. Compose new `start_time` and `end_time` ISO strings using the *date portion* of the existing chunk timestamps (only time-of-day changes).
3. Reject if `end <= start` (same-day requirement).
4. Compute `newTotalMinutes = end - start`. Reject if `newTotalMinutes < currentTotal` with error:
   `INSUFFICIENT ATMOSPHERE — ${currentTotal}M REQUIRED, ${newTotalMinutes}M REQUESTED`
5. On success: `onSubmit({ start_time, end_time })`, close modal.

`currentTotal` is passed in as a prop from the screen (the screen computes it from the current `tasks` snapshot read from `ChunkContainer` — see "Open implementation choices").

### 5. dragMath — last-task helper

**`frontend/src/utils/dragMath.ts`** — add:

```ts
/**
 * Calculates the new duration for the LAST task when its terminal divider is dragged
 * against the unassigned pool. Returns a new tasks array with only the last task mutated.
 * Returns the same reference if the clamp resolves to zero delta.
 */
export function calculateLastTaskWithUnassigned(
  tasks: Task[],
  deltaMinutes: number,
  unassigned: number,
): Task[]
```

Semantics:

- `deltaMinutes > 0` → terminal divider moved down → last task **grows**. Clamp delta to `unassigned` (so growth never exceeds available vacant atmosphere).
- `deltaMinutes < 0` → terminal divider moved up → last task **shrinks**. Clamp `|delta|` to `last.duration_minutes - last.min_duration`.
- If clamped delta is 0 → return `tasks` unchanged (same reference, consistent with `calculateZeroSumTasks`).
- Otherwise return a new array with `tasks[last]` replaced.

### 6. ChunkContainer — terminal divider rendering

Today (`ChunkContainer.tsx:135`):

```tsx
{index < tasks.length - 1 && (
  <DraggableDivider … />
)}
```

Becomes:

```tsx
{index < tasks.length - 1 ? (
  <DraggableDivider
    variant="between"
    onDrag={(delta) => handleDrag(index, delta)}
    onDragEnd={handleDragEnd}
    onPress={() => handleToggleBuffer(index)}
    bufferDuration={task.buffer_after_minutes}
  />
) : canExtendLast ? (
  <DraggableDivider
    variant="terminal"
    onDrag={handleLastDrag}
    onDragEnd={handleDragEnd}
    /* no onPress — terminal variant is drag-only */
  />
) : null}
```

Where `canExtendLast = unassigned > 0 || task.duration_minutes > task.min_duration`.

New handler:

```tsx
const handleLastDrag = (delta: number) => {
  const updated = calculateLastTaskWithUnassigned(tasks, delta, unassigned);
  if (updated === tasks) return;
  // limit feedback: if grow was clamped to 0 by hitting unassigned===0, flash limit ring on last task
  setTasks(updated);
  apiClient.debouncedUpdateChunk(initialChunk.chunk_id, { tasks: updated });
};
```

Note: `unassigned` in the body of `handleLastDrag` is the value at the time of the drag tick — it is recomputed each render from `tasks` + `totalDurationMinutes`, so consecutive snap ticks see fresh remaining capacity. This is a closure capture concern; we'll resolve via a `useRef` mirror or by recomputing inside the handler from `tasks` state (see "Open implementation choices").

### 7. DraggableDivider — terminal variant

Add prop:

```ts
interface Props {
  onDrag: (deltaMinutes: number) => void;
  onDragEnd: () => void;
  bufferDuration?: number;
  onPress?: () => void;
  variant?: 'between' | 'terminal';   // default 'between'
}
```

**Visual differences in `'terminal'` mode:**

- **Halo gradient** swaps the thermal palette (`rgba(255, 59, 48, …)` / `rgba(255, 149, 0, …)`) for the cool palette already defined in `theme.colors.cool` (`bleed: rgba(20, 90, 200, 0.10)`, `bleedStrong: rgba(30, 110, 220, 0.16)`). The same locations/easing — only the colors change.
- **Buffer rendering is skipped entirely** — terminal variant never receives `bufferDuration`, and even if it did, the `isBuffer` branch is gated off.
- **Handle gradient** stays as-is (glass highlight/specular) — it's already neutral.
- **Tap gesture** is conditionally composed: when `variant === 'terminal'`, the `Gesture.Exclusive(panGesture, tapGesture)` becomes just `panGesture` (no tap branch).

The wrapper height stays at the base `28` (no buffer expansion).

### 8. ChunkEditorScreen — wiring

Top-bar eyebrow becomes pressable:

```tsx
<Pressable onPress={() => setEditTimesVisible(true)} hitSlop={8}>
  <Text style={styles.eyebrow}>{start} — {end}</Text>
</Pressable>
```

(With a subtle pressed-state animation matching the rest of the app's spring/scale pattern.)

The screen owns:

```ts
const [startTime, setStartTime] = useState(chunk.start_time);
const [endTime, setEndTime] = useState(chunk.end_time);
const [editTimesVisible, setEditTimesVisible] = useState(false);
// reactive totalDurationMinutes derived from startTime/endTime
```

On modal commit:

```ts
const handleTimesCommit = (next: { start_time: string; end_time: string }) => {
  setStartTime(next.start_time);
  setEndTime(next.end_time);
  setEditTimesVisible(false);
  apiClient.debouncedUpdateChunk(chunk.chunk_id, next);
};
```

`currentTotal` for validation must come from `ChunkContainer`'s `tasks`. Two reasonable options — see "Open implementation choices."

## Data flow summary

```
[User taps top-bar time]
   → EditTimesModal opens, receives currentTotal prop
   → User types HH:mm × 2 → COMMIT
   → modal validates locally (currentTotal vs new envelope)
   → onSubmit → screen updates {startTime, endTime}
   → ChunkContainer re-renders with new totalDurationMinutes
   → debouncedUpdateChunk(id, { start_time, end_time })
   → PATCH /chunks/{id}/  →  update_chunk(user_id, chunk_id, update_data)
   → Dynamo SET start_time, end_time

[User drags terminal divider down]
   → DraggableDivider (terminal variant) snaps in 5m steps
   → onDrag(delta) → handleLastDrag
   → calculateLastTaskWithUnassigned(tasks, delta, unassigned)
   → setTasks(updated)
   → debouncedUpdateChunk(id, { tasks: updated })
   → PATCH /chunks/{id}/  →  update_chunk(user_id, chunk_id, update_data)
   → Dynamo SET tasks
```

## Error handling

- **Modal validation:** all rejections show an inline message in the modal. No `Alert.alert` — keep failure local to the modal context.
- **Terminal-divider clamps:** when growth is clamped to zero (i.e., `unassigned === 0`), flash the last task's `limitRing` (the existing `isLimitReached` mechanism in `TaskBlock`). Reuses the visual vocabulary of the between-task drag clamp.
- **Network failures on PATCH:** unchanged from today — `executePatch` logs and swallows. Optimistic UI stays optimistic.

## Testing strategy

- **Backend unit:** extend `tests/test_database.py` to cover partial `update_chunk` calls (tasks only, times only, both, neither).
- **Backend route:** extend `tests/test_routes.py` to PATCH with each shape and verify 200 + persisted state.
- **Frontend logic unit:** add tests for `calculateLastTaskWithUnassigned`:
  - Grow by delta < unassigned → exact delta applied.
  - Grow by delta > unassigned → clamped to unassigned.
  - Shrink by delta < (duration - min_duration) → exact delta.
  - Shrink past min_duration → clamped.
  - delta === 0 or fully clamped → same reference returned.
- **Manual smoke (UI):**
  - Open editor, tap eyebrow, edit start/end, commit, reload from list → persisted.
  - Try to set new envelope smaller than current task sum → error message shows.
  - Drag terminal divider down → last task grows, unassigned shrinks visibly.
  - Drag terminal divider up → last task shrinks, unassigned grows.
  - Drag past min_duration → clamp + limit ring on last task.
  - Drag past available unassigned → clamp + limit ring on last task.
  - Disappearance of the terminal divider when both `unassigned === 0` and `last.duration === min_duration` (degenerate fully-packed case — no grip needed).

## Open implementation choices (low-stakes; resolve during implementation)

1. **Where `currentTotal` lives for modal validation:** either (a) lift `tasks` up to the screen (bigger refactor), or (b) `ChunkContainer` exposes `currentTotal` to its parent via callback, or (c) compute `currentTotal` inside `ChunkContainer` and render the modal *from inside* `ChunkContainer` instead of the screen. **Prefer (c)** — modal lives where the data is, and the screen just owns the envelope state. The screen passes `editTimesVisible` / `onClose` down, or `ChunkContainer` owns the modal visibility too.
2. **Empty PATCH body handling on backend:** if both `tasks` and times are `None`, either no-op + return current state, or 422. **Prefer no-op + return current state** (idempotent, fits a partial-update model).
3. **Closure-capture for `unassigned` inside `handleLastDrag`:** depending on how the gesture fires, the captured `unassigned` could be stale across rapid snap ticks. **Recompute inside the handler** from the latest `tasks` (use the functional `setTasks` form and compute `unassigned` from `totalDurationMinutes - sum(currentTasks)`).
4. **Renaming `update_chunk_tasks`:** this is an internal symbol; renaming to `update_chunk` is fine. The route changes accordingly. The frontend never sees the symbol.

## Files touched

| File | Change |
|---|---|
| `backend/src/models.py` | `TimeChunkUpdate` becomes partial (tasks + times all optional). |
| `backend/src/database.py` | Rename `update_chunk_tasks` → `update_chunk`; dynamic `UpdateExpression`. |
| `backend/src/routes.py` | Pass `update_data` through to `update_chunk`. |
| `backend/tests/test_database.py` | New cases for partial updates. |
| `backend/tests/test_routes.py` | New PATCH shapes. |
| `frontend/src/api/client.ts` | Generalize executePatch to `(chunkId, ChunkUpdate)`; rename debounced. |
| `frontend/src/components/EditTimesModal.tsx` | **New.** |
| `frontend/src/components/DraggableDivider.tsx` | Add `variant` prop; conditional gesture composition; cool-palette halo. |
| `frontend/src/components/ChunkContainer.tsx` | Render terminal divider; new `handleLastDrag`. |
| `frontend/src/screens/ChunkEditorScreen.tsx` | Lift start/end to state; pressable eyebrow; mount EditTimesModal. |
| `frontend/src/utils/dragMath.ts` | Add `calculateLastTaskWithUnassigned`. |

## Approval

This spec is the source of truth for the implementation plan. The implementation plan (written next via the `writing-plans` skill) will sequence these file changes into review-checkpointed steps.
