# Chunk Editor — Editable Times & Bottom-Task Extension — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the chunk's start/end times editable from `ChunkEditorScreen` via a modal, and let the bottom-most task be extended (or shrunk) by dragging a new "terminal divider" against the Unassigned Time Chunk pool — with end-to-end persistence.

**Architecture:** Backend `TimeChunkUpdate` becomes partial (`tasks?`, `start_time?`, `end_time?`); a single dynamic-`UpdateExpression` DynamoDB writer handles any subset. Frontend `ApiClient` is refactored to a generic `debouncedUpdateChunk(chunkId, partial)` call. `ChunkEditorScreen` lifts `tasks`, `startTime`, `endTime` into its own state (ChunkContainer becomes controlled), giving the new `EditTimesModal` direct access to `currentTotal` for validation. A new `DraggableDivider` `variant="terminal"` (cool-blue halo, no tap/buffer behavior) renders below the last task whenever there's headroom to grow or shrink, dispatching to a new `calculateLastTaskWithUnassigned` helper in `dragMath.ts`.

**Tech Stack:** FastAPI + Pydantic + boto3/DynamoDB (backend); React Native + Expo + Reanimated + react-native-gesture-handler + date-fns (frontend); pytest + moto (backend tests); jest + ts-jest (frontend tests).

**Source of truth:** [`docs/superpowers/specs/2026-05-12-chunk-editor-time-and-bottom-extend-design.md`](../specs/2026-05-12-chunk-editor-time-and-bottom-extend-design.md)

---

## Task 1: Backend — partial `TimeChunkUpdate` model + dynamic writer + route

**Files:**
- Modify: `backend/src/models.py` (the `TimeChunkUpdate` class)
- Modify: `backend/src/database.py` (rename + generalize `update_chunk_tasks` → `update_chunk`)
- Modify: `backend/src/routes.py` (the PATCH route body)
- Test: `backend/tests/test_routes.py` (add three new cases)

- [ ] **Step 1.1: Write the failing tests**

Append to `backend/tests/test_routes.py`:

```python
def test_update_chunk_times_only(client, timechunk_table):
    timechunk_table.put_item(Item={
        'user_id': 'user123',
        'chunk_id': 'chunk1',
        'title': 'Morning',
        'start_time': '2023-01-01T06:00:00',
        'end_time': '2023-01-01T08:00:00',
        'is_template': False,
        'tasks': []
    })

    payload = {
        "start_time": "2023-01-01T06:30:00",
        "end_time": "2023-01-01T09:00:00",
    }
    response = client.patch("/chunks/chunk1/", json=payload, headers={"x-user-id": "user123"})
    assert response.status_code == 200
    data = response.json()
    assert data['start_time'].startswith('2023-01-01T06:30:00')
    assert data['end_time'].startswith('2023-01-01T09:00:00')
    assert data['tasks'] == []


def test_update_chunk_both_tasks_and_times(client, timechunk_table):
    timechunk_table.put_item(Item={
        'user_id': 'user123',
        'chunk_id': 'chunk1',
        'title': 'Morning',
        'start_time': '2023-01-01T06:00:00',
        'end_time': '2023-01-01T08:00:00',
        'is_template': False,
        'tasks': []
    })

    payload = {
        "start_time": "2023-01-01T07:00:00",
        "end_time": "2023-01-01T08:00:00",
        "tasks": [
            {"task_id": "t1", "title": "Read", "duration_minutes": 30, "min_duration": 10}
        ],
    }
    response = client.patch("/chunks/chunk1/", json=payload, headers={"x-user-id": "user123"})
    assert response.status_code == 200
    data = response.json()
    assert data['start_time'].startswith('2023-01-01T07:00:00')
    assert len(data['tasks']) == 1
    assert data['tasks'][0]['title'] == "Read"


def test_update_chunk_empty_payload_is_noop(client, timechunk_table):
    timechunk_table.put_item(Item={
        'user_id': 'user123',
        'chunk_id': 'chunk1',
        'title': 'Morning',
        'start_time': '2023-01-01T06:00:00',
        'end_time': '2023-01-01T08:00:00',
        'is_template': False,
        'tasks': []
    })

    response = client.patch("/chunks/chunk1/", json={}, headers={"x-user-id": "user123"})
    assert response.status_code == 200
    data = response.json()
    assert data['start_time'].startswith('2023-01-01T06:00:00')
    assert data['end_time'].startswith('2023-01-01T08:00:00')
    assert data['tasks'] == []
```

- [ ] **Step 1.2: Run new tests to verify they fail**

Run:
```bash
cd backend && pytest tests/test_routes.py::test_update_chunk_times_only tests/test_routes.py::test_update_chunk_both_tasks_and_times tests/test_routes.py::test_update_chunk_empty_payload_is_noop -v
```

Expected: all three FAIL (either 422 validation error because `tasks` is required today, or 500 because `update_chunk_tasks` doesn't know about times).

- [ ] **Step 1.3: Make `TimeChunkUpdate` partial**

Replace the `TimeChunkUpdate` class in `backend/src/models.py` with:

```python
class TimeChunkUpdate(BaseModel):
    tasks: List[Task] | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
```

- [ ] **Step 1.4: Rename and generalize the DB writer**

In `backend/src/database.py`, replace the `update_chunk_tasks` function with:

```python
def update_chunk(user_id: str, chunk_id: str, update: TimeChunkUpdate) -> TimeChunkResponse:
    table = get_table()

    set_clauses: list[str] = []
    values: dict[str, object] = {}

    if update.tasks is not None:
        set_clauses.append("tasks = :tasks")
        values[":tasks"] = [task.model_dump(mode='json') for task in update.tasks]
    if update.start_time is not None:
        set_clauses.append("start_time = :start_time")
        values[":start_time"] = update.start_time.isoformat()
    if update.end_time is not None:
        set_clauses.append("end_time = :end_time")
        values[":end_time"] = update.end_time.isoformat()

    if not set_clauses:
        # No-op partial update: verify the chunk exists, return current state.
        response = table.get_item(Key={'user_id': user_id, 'chunk_id': chunk_id})
        item = response.get('Item')
        if item is None:
            import botocore.exceptions
            raise botocore.exceptions.ClientError(
                {'Error': {'Code': 'ConditionalCheckFailedException', 'Message': 'Chunk not found'}},
                'GetItem'
            )
        return TimeChunkResponse(**item)

    response = table.update_item(
        Key={'user_id': user_id, 'chunk_id': chunk_id},
        UpdateExpression="SET " + ", ".join(set_clauses),
        ExpressionAttributeValues=values,
        ConditionExpression="attribute_exists(chunk_id)",
        ReturnValues="ALL_NEW"
    )
    return TimeChunkResponse(**response.get('Attributes', {}))
```

Update the import line at the top of `backend/src/database.py` to also import `TimeChunkUpdate`:

```python
from .models import TimeChunkResponse, TimeChunkCreate, Task, TimeChunkUpdate
```

- [ ] **Step 1.5: Update the route to pass the whole update model**

In `backend/src/routes.py`, replace the body of `update_chunk` so it passes the entire `update_data`:

```python
@router.patch("/chunks/{chunk_id}/", response_model=models.TimeChunkResponse)
def update_chunk(chunk_id: str, update_data: models.TimeChunkUpdate, x_user_id: str = Header(...)):
    try:
        return database.update_chunk(x_user_id, chunk_id, update_data)
    except botocore.exceptions.ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            raise HTTPException(status_code=404, detail="Chunk not found")
        raise
```

- [ ] **Step 1.6: Run full backend test suite**

Run:
```bash
cd backend && pytest tests/ -v
```

Expected: all tests pass, including the three new ones AND the pre-existing `test_update_chunk_tasks` and `test_update_missing_chunk` (which exercise the same code paths through the renamed function).

- [ ] **Step 1.7: Commit**

```bash
git add backend/src/models.py backend/src/database.py backend/src/routes.py backend/tests/test_routes.py
git commit -m "feat(backend): support partial chunk PATCH (tasks and/or times)"
```

---

## Task 2: Frontend ApiClient — generalize PATCH to partial payload

**Files:**
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/tests/client.test.ts` (add new debounce-with-partial test)

- [ ] **Step 2.1: Write the failing test**

Append to `frontend/tests/client.test.ts`:

```typescript
describe('ApiClient.debouncedUpdateChunk', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  it('should debounce a partial chunk update (times only) and send only the provided fields', () => {
    const client = new ApiClient('https://api.example.com', 'user123');

    client.debouncedUpdateChunk('chunk1', {
      start_time: '2023-01-01T06:30:00Z',
      end_time: '2023-01-01T08:00:00Z',
    });

    jest.advanceTimersByTime(750);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const callArgs = (global.fetch as jest.Mock).mock.calls[0];
    expect(callArgs[0]).toBe('https://api.example.com/chunks/chunk1/');
    expect(callArgs[1].method).toBe('PATCH');

    const body = JSON.parse(callArgs[1].body);
    expect(body.start_time).toBe('2023-01-01T06:30:00Z');
    expect(body.end_time).toBe('2023-01-01T08:00:00Z');
    expect(body.tasks).toBeUndefined();
  });

  it('should debounce a tasks-only update through the new generic API', () => {
    const client = new ApiClient('https://api.example.com', 'user123');

    const tasks: Task[] = [
      { task_id: 'a', title: 'A', duration_minutes: 20, min_duration: 10 },
    ];

    client.debouncedUpdateChunk('chunk1', { tasks });
    jest.advanceTimersByTime(750);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.tasks[0].title).toBe('A');
    expect(body.start_time).toBeUndefined();
  });
});
```

- [ ] **Step 2.2: Run the new tests to verify they fail**

Run:
```bash
cd frontend && npx jest tests/client.test.ts -t "debouncedUpdateChunk" --verbose
```

Expected: both new tests fail — `client.debouncedUpdateChunk` is not a function.

- [ ] **Step 2.3: Refactor `ApiClient` to a generic patch**

Replace the body of `frontend/src/api/client.ts` with:

```typescript
import debounce from 'lodash/debounce';
import type { DebouncedFunc } from 'lodash';
import { Task, TimeChunk } from '../types';

export type ChunkUpdate = {
  tasks?: Task[];
  start_time?: string;
  end_time?: string;
};

export class ApiClient {
  private baseUrl: string;
  private userId: string;

  constructor(baseUrl: string, userId: string) {
    this.baseUrl = baseUrl;
    this.userId = userId;

    this.sendPatch = this.sendPatch.bind(this);
    this.debouncedUpdateChunk = debounce(this.sendPatch, 750);
  }

  public async getChunks(): Promise<TimeChunk[]> {
    const response = await fetch(`${this.baseUrl}/chunks/`, {
      headers: { 'x-user-id': this.userId },
    });
    if (!response.ok) throw new Error('Failed to fetch chunks');
    return response.json();
  }

  public async getTemplates(): Promise<TimeChunk[]> {
    const response = await fetch(`${this.baseUrl}/templates/`, {
      headers: { 'x-user-id': this.userId },
    });
    if (!response.ok) throw new Error('Failed to fetch templates');
    return response.json();
  }

  public async createChunk(params: {
    title: string;
    start_time: string;
    end_time: string;
    template_id?: string;
  }): Promise<TimeChunk> {
    const response = await fetch(`${this.baseUrl}/chunks/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': this.userId,
      },
      body: JSON.stringify(params),
    });
    if (!response.ok) throw new Error('Failed to create chunk');
    return response.json();
  }

  public async deleteChunk(chunkId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/chunks/${chunkId}/`, {
      method: 'DELETE',
      headers: { 'x-user-id': this.userId },
    });
    if (!response.ok) throw new Error('Failed to delete chunk');
  }

  private async sendPatch(chunkId: string, payload: ChunkUpdate): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/chunks/${chunkId}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': this.userId,
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error('Failed to sync chunk', error);
    }
  }

  public debouncedUpdateChunk: DebouncedFunc<(chunkId: string, payload: ChunkUpdate) => Promise<void>>;
}
```

Note: the previous `executePatch` method has been renamed to `sendPatch` and the previous `debouncedUpdateChunkTasks` is replaced by `debouncedUpdateChunk`. Call sites are migrated in Task 6.

- [ ] **Step 2.4: Run the new tests to verify they pass**

Run:
```bash
cd frontend && npx jest tests/client.test.ts -t "debouncedUpdateChunk" --verbose
```

Expected: both new tests PASS.

- [ ] **Step 2.5: Type-check the project**

Run:
```bash
cd frontend && npx tsc --noEmit
```

Expected: TypeScript errors in `ChunkContainer.tsx` pointing to the now-missing `debouncedUpdateChunkTasks` symbol. **Do not fix those yet** — Task 6 migrates that call site. The errors clear after Task 6.

- [ ] **Step 2.6: Commit**

```bash
git add frontend/src/api/client.ts frontend/tests/client.test.ts
git commit -m "refactor(frontend): generalize ApiClient patch to ChunkUpdate payload"
```


---

## Task 3: Frontend dragMath — `calculateLastTaskWithUnassigned`

**Files:**
- Modify: `frontend/src/utils/dragMath.ts`
- Test: `frontend/tests/dragMath.test.ts`

- [ ] **Step 3.1: Write the failing tests**

Append to `frontend/tests/dragMath.test.ts`:

```typescript
import { calculateLastTaskWithUnassigned } from '../src/utils/dragMath';

describe('calculateLastTaskWithUnassigned', () => {
  it('grows the last task by exact delta when delta <= unassigned', () => {
    const tasks: Task[] = [
      { task_id: '1', title: 'A', duration_minutes: 5, min_duration: 5 },
      { task_id: '2', title: 'B', duration_minutes: 15, min_duration: 5 },
    ];
    const result = calculateLastTaskWithUnassigned(tasks, 10, 20);
    expect(result[1].duration_minutes).toBe(25);
    expect(result[0]).toBe(tasks[0]);
  });

  it('clamps growth to available unassigned minutes', () => {
    const tasks: Task[] = [
      { task_id: '1', title: 'A', duration_minutes: 5, min_duration: 5 },
      { task_id: '2', title: 'B', duration_minutes: 15, min_duration: 5 },
    ];
    const result = calculateLastTaskWithUnassigned(tasks, 25, 10);
    expect(result[1].duration_minutes).toBe(25);
  });

  it('shrinks the last task when delta is negative', () => {
    const tasks: Task[] = [
      { task_id: '1', title: 'A', duration_minutes: 5, min_duration: 5 },
      { task_id: '2', title: 'B', duration_minutes: 25, min_duration: 5 },
    ];
    const result = calculateLastTaskWithUnassigned(tasks, -10, 0);
    expect(result[1].duration_minutes).toBe(15);
  });

  it('clamps shrink at min_duration', () => {
    const tasks: Task[] = [
      { task_id: '1', title: 'A', duration_minutes: 5, min_duration: 5 },
      { task_id: '2', title: 'B', duration_minutes: 10, min_duration: 8 },
    ];
    const result = calculateLastTaskWithUnassigned(tasks, -10, 0);
    expect(result[1].duration_minutes).toBe(8);
  });

  it('returns same reference when delta clamps to 0 (no unassigned, growth requested)', () => {
    const tasks: Task[] = [
      { task_id: '1', title: 'A', duration_minutes: 5, min_duration: 5 },
      { task_id: '2', title: 'B', duration_minutes: 15, min_duration: 5 },
    ];
    const result = calculateLastTaskWithUnassigned(tasks, 5, 0);
    expect(result).toBe(tasks);
  });

  it('returns same reference when delta clamps to 0 (at min_duration, shrink requested)', () => {
    const tasks: Task[] = [
      { task_id: '1', title: 'A', duration_minutes: 5, min_duration: 5 },
      { task_id: '2', title: 'B', duration_minutes: 8, min_duration: 8 },
    ];
    const result = calculateLastTaskWithUnassigned(tasks, -5, 0);
    expect(result).toBe(tasks);
  });

  it('returns same reference when tasks is empty', () => {
    const tasks: Task[] = [];
    const result = calculateLastTaskWithUnassigned(tasks, 5, 10);
    expect(result).toBe(tasks);
  });
});
```

- [ ] **Step 3.2: Run the new tests to verify they fail**

Run:
```bash
cd frontend && npx jest tests/dragMath.test.ts -t "calculateLastTaskWithUnassigned" --verbose
```

Expected: all seven tests fail — `calculateLastTaskWithUnassigned` is not exported.

- [ ] **Step 3.3: Implement the helper**

Append to `frontend/src/utils/dragMath.ts`:

```typescript
/**
 * Calculates the new duration for the LAST task when its terminal divider is dragged
 * against the unassigned pool. Returns a new tasks array with only the last task mutated.
 * Returns the same reference if the clamp resolves to zero delta (or tasks is empty).
 *
 * @param tasks Full list of tasks in the chunk.
 * @param deltaMinutes Positive = grow last task; negative = shrink.
 * @param unassigned Minutes currently unassigned in the chunk.
 */
export function calculateLastTaskWithUnassigned(
  tasks: Task[],
  deltaMinutes: number,
  unassigned: number,
): Task[] {
  if (tasks.length === 0) return tasks;

  const lastIndex = tasks.length - 1;
  const last = tasks[lastIndex];

  let actualDelta = deltaMinutes;
  if (deltaMinutes > 0) {
    if (actualDelta > unassigned) actualDelta = unassigned;
  } else if (deltaMinutes < 0) {
    const maxShrink = last.duration_minutes - last.min_duration;
    if (Math.abs(actualDelta) > maxShrink) actualDelta = -maxShrink;
  }

  if (actualDelta === 0) return tasks;

  const newTasks = [...tasks];
  newTasks[lastIndex] = {
    ...last,
    duration_minutes: last.duration_minutes + actualDelta,
  };
  return newTasks;
}
```

- [ ] **Step 3.4: Run the new tests to verify they pass**

Run:
```bash
cd frontend && npx jest tests/dragMath.test.ts --verbose
```

Expected: all `calculateLastTaskWithUnassigned` tests PASS, and the pre-existing `calculateZeroSumTasks` / `toggleBuffer` tests still PASS.

- [ ] **Step 3.5: Commit**

```bash
git add frontend/src/utils/dragMath.ts frontend/tests/dragMath.test.ts
git commit -m "feat(frontend): add calculateLastTaskWithUnassigned for terminal drag"
```

---

## Task 4: DraggableDivider — `variant` prop with cool-blue terminal styling

**Files:**
- Modify: `frontend/src/components/DraggableDivider.tsx`

There are no existing unit tests for this component (it's a visual/gesture component). We rely on type-check and manual smoke testing.

- [ ] **Step 4.1: Add the `variant` prop and conditionally adjust gesture composition + halo colors**

Replace the contents of `frontend/src/components/DraggableDivider.tsx` with:

```tsx
import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { theme } from '../styles/theme';

interface Props {
  onDrag: (deltaMinutes: number) => void;
  onDragEnd: () => void;
  bufferDuration?: number;
  onPress?: () => void;
  variant?: 'between' | 'terminal';
}

const BETWEEN_HALO_COLORS = [
  'rgba(255, 59, 48, 0)',
  'rgba(255, 59, 48, 0.45)',
  'rgba(255, 149, 0, 0.18)',
  'rgba(255, 149, 0, 0)',
] as const;

const TERMINAL_HALO_COLORS = [
  'rgba(20, 90, 200, 0)',
  'rgba(30, 110, 220, 0.45)',
  'rgba(20, 90, 200, 0.18)',
  'rgba(20, 90, 200, 0)',
] as const;

export const DraggableDivider: React.FC<Props> = ({
  onDrag,
  onDragEnd,
  bufferDuration = 0,
  onPress,
  variant = 'between',
}) => {
  const isDragging = useSharedValue(0);
  const lastEmittedY = useSharedValue(0);
  const isTerminal = variant === 'terminal';

  const snapPx = theme.layout.snapIncrement * theme.layout.minutesToHeight;

  const panGesture = Gesture.Pan()
    .activeOffsetY([-4, 4])
    .onStart(() => {
      lastEmittedY.value = 0;
      isDragging.value = withTiming(1, { duration: 90, easing: theme.physics.quartOut });
    })
    .onUpdate((event) => {
      const deltaY = event.translationY - lastEmittedY.value;
      if (Math.abs(deltaY) >= snapPx) {
        const steps = Math.round(deltaY / snapPx);
        const snapDelta = steps * theme.layout.snapIncrement;
        runOnJS(onDrag)(snapDelta);
        lastEmittedY.value += steps * snapPx;
      }
    })
    .onEnd(() => {
      isDragging.value = withTiming(0, { duration: 280, easing: theme.physics.quartOut });
      runOnJS(onDragEnd)();
    });

  const tapGesture = Gesture.Tap()
    .maxDuration(250)
    .onEnd((_e, success) => {
      if (success && onPress) runOnJS(onPress)();
    });

  // Terminal variant is drag-only: no tap composition.
  const composed = isTerminal ? panGesture : Gesture.Exclusive(panGesture, tapGesture);

  const animatedBarStyle = useAnimatedStyle(() => ({
    opacity: interpolate(isDragging.value, [0, 1], [0.45, 1], Extrapolation.CLAMP),
    transform: [
      { scaleX: withSpring(1 + isDragging.value * 0.35, theme.physics.spring) },
      { scaleY: withSpring(1 + isDragging.value * 1.6, theme.physics.spring) },
    ],
  }));

  const animatedHaloStyle = useAnimatedStyle(() => ({
    opacity: isDragging.value,
    transform: [
      { scale: interpolate(isDragging.value, [0, 1], [0.6, 1.1], Extrapolation.CLAMP) },
    ],
  }));

  const animatedTrackStyle = useAnimatedStyle(() => ({
    opacity: interpolate(isDragging.value, [0, 1], [0.5, 0.15], Extrapolation.CLAMP),
  }));

  // Buffer is only meaningful for between-variant dividers.
  const isBuffer = !isTerminal && bufferDuration > 0;
  const height = isBuffer ? bufferDuration * theme.layout.minutesToHeight : 28;
  const haloColors = isTerminal ? TERMINAL_HALO_COLORS : BETWEEN_HALO_COLORS;

  return (
    <GestureDetector gesture={composed}>
      <View style={[styles.wrapper, { height }]}>
        {isBuffer && (
          <>
            <View style={styles.bufferFill} />
            <LinearGradient
              colors={[
                'rgba(255, 149, 0, 0.04)',
                'transparent',
                'rgba(255, 149, 0, 0.04)',
              ]}
              locations={[0, 0.5, 1]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
          </>
        )}

        <Animated.View style={[styles.track, styles.trackLeft, animatedTrackStyle]} />
        <Animated.View style={[styles.track, styles.trackRight, animatedTrackStyle]} />

        <Animated.View style={[styles.haloWrap, animatedHaloStyle]} pointerEvents="none">
          <LinearGradient
            colors={haloColors as unknown as readonly [string, string, ...string[]]}
            locations={[0, 0.4, 0.6, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <Animated.View style={[styles.handleWrap, animatedBarStyle]}>
          <LinearGradient
            colors={[
              theme.colors.glass.highlight,
              theme.colors.glass.specular,
              theme.colors.glass.highlight,
            ]}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.handle}
          />
        </Animated.View>

        {isBuffer && (
          <View style={styles.bufferLabelWrap} pointerEvents="none">
            <View style={styles.bufferDot} />
            <Text style={styles.bufferText}>BUFFER · {bufferDuration}M</Text>
          </View>
        )}
      </View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: theme.spacing.m,
    zIndex: 100,
  },
  bufferFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.018)',
    borderRadius: theme.layout.radius.s,
  },
  track: {
    position: 'absolute',
    top: '50%',
    height: 1,
    backgroundColor: theme.colors.glass.border,
  },
  trackLeft: { left: 0, right: '55%' },
  trackRight: { left: '55%', right: 0 },
  haloWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 32,
    justifyContent: 'center',
  },
  handleWrap: {
    width: 84,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  handle: { flex: 1, borderRadius: 2 },
  bufferLabelWrap: {
    position: 'absolute',
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bufferDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.thermal.corona,
    opacity: 0.7,
  },
  bufferText: {
    fontFamily: theme.typography.micro.fontFamily,
    fontSize: theme.typography.micro.fontSize,
    letterSpacing: theme.typography.micro.letterSpacing,
    color: theme.colors.textTertiary,
  },
});
```

- [ ] **Step 4.2: Type-check the project**

Run:
```bash
cd frontend && npx tsc --noEmit
```

Expected: no new errors from `DraggableDivider.tsx`.

- [ ] **Step 4.3: Run the existing test suite to confirm no regressions**

Run:
```bash
cd frontend && npx jest --testPathIgnorePatterns=node_modules
```

Expected: every test that passed before still passes.

- [ ] **Step 4.4: Commit**

```bash
git add frontend/src/components/DraggableDivider.tsx
git commit -m "feat(frontend): add terminal variant to DraggableDivider"
```


---

## Task 5: EditTimesModal — new component

**Files:**
- Create: `frontend/src/components/EditTimesModal.tsx`

- [ ] **Step 5.1: Create the modal component**

Create `frontend/src/components/EditTimesModal.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { parseISO, format, setHours, setMinutes, setSeconds, differenceInMinutes } from 'date-fns';

import { GlassSurface } from './GlassSurface';
import { theme } from '../styles/theme';

interface Props {
  visible: boolean;
  startTime: string; // ISO
  endTime: string;   // ISO
  currentTotalMinutes: number; // sum of task durations + buffers
  onClose: () => void;
  onSubmit: (next: { start_time: string; end_time: string }) => void;
}

function parseHHmm(value: string): [number, number] | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return [h, m];
}

function composeISO(baseISO: string, hours: number, minutes: number): string {
  const base = parseISO(baseISO);
  const next = setSeconds(setMinutes(setHours(base, hours), minutes), 0);
  return next.toISOString();
}

export const EditTimesModal: React.FC<Props> = ({
  visible,
  startTime,
  endTime,
  currentTotalMinutes,
  onClose,
  onSubmit,
}) => {
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      try {
        setStartInput(format(parseISO(startTime), 'HH:mm'));
        setEndInput(format(parseISO(endTime), 'HH:mm'));
      } catch {
        setStartInput('');
        setEndInput('');
      }
      setError(null);
    }
  }, [visible, startTime, endTime]);

  const handleSubmit = () => {
    const startParts = parseHHmm(startInput);
    const endParts = parseHHmm(endInput);

    if (!startParts || !endParts) {
      setError('INVALID TIME FORMAT — USE HH:MM');
      return;
    }

    const nextStartISO = composeISO(startTime, startParts[0], startParts[1]);
    const nextEndISO = composeISO(endTime, endParts[0], endParts[1]);

    const newTotal = differenceInMinutes(parseISO(nextEndISO), parseISO(nextStartISO));

    if (newTotal <= 0) {
      setError('END MUST BE AFTER START');
      return;
    }

    if (newTotal < currentTotalMinutes) {
      setError(`INSUFFICIENT ATMOSPHERE — ${currentTotalMinutes}M REQUIRED, ${newTotal}M REQUESTED`);
      return;
    }

    onSubmit({ start_time: nextStartISO, end_time: nextEndISO });
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill}>
        <View style={styles.dim} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.center} pointerEvents="box-none">
          <GlassSurface
            radius={theme.layout.radius.xl}
            intensity={40}
            tone="raised"
            borderTone="strong"
            style={styles.sheet}
          >
            <Text style={styles.eyebrow}>ADJUST ENVELOPE</Text>
            <Text style={styles.title}>Re-time the schedule</Text>

            <View style={styles.fieldRow}>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>START</Text>
                <View style={styles.fieldWrap}>
                  <TextInput
                    style={styles.input}
                    placeholder="HH:mm"
                    placeholderTextColor={theme.colors.textTertiary}
                    value={startInput}
                    onChangeText={setStartInput}
                    keyboardType="numbers-and-punctuation"
                    autoFocus
                    maxLength={5}
                  />
                </View>
              </View>

              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>END</Text>
                <View style={styles.fieldWrap}>
                  <TextInput
                    style={styles.input}
                    placeholder="HH:mm"
                    placeholderTextColor={theme.colors.textTertiary}
                    value={endInput}
                    onChangeText={setEndInput}
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                  />
                </View>
              </View>
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}

            <View style={styles.buttons}>
              <Pressable style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelBtnText}>ABORT</Text>
              </Pressable>
              <Pressable style={styles.submitOuter} onPress={handleSubmit}>
                <LinearGradient
                  colors={theme.colors.thermal.glow}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.submitBtn}
                >
                  <Text style={styles.submitBtnText}>COMMIT</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </GlassSurface>
        </View>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.l,
  },
  sheet: {
    padding: theme.spacing.l + 6,
    ...theme.shadows.lifted,
  },
  eyebrow: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: theme.typography.caption.fontSize,
    letterSpacing: theme.typography.caption.letterSpacing,
    color: theme.colors.thermal.corona,
  },
  title: {
    fontFamily: theme.typography.h1.fontFamily,
    fontSize: 22,
    letterSpacing: 0.4,
    color: theme.colors.text,
    marginTop: 4,
    marginBottom: theme.spacing.l,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: theme.spacing.m,
    marginBottom: theme.spacing.m,
  },
  fieldHalf: {
    flex: 1,
  },
  fieldLabel: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: theme.typography.caption.fontSize,
    letterSpacing: theme.typography.caption.letterSpacing,
    color: theme.colors.textTertiary,
    marginBottom: 6,
  },
  fieldWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: theme.layout.radius.s,
    borderWidth: 1,
    borderColor: theme.colors.glass.border,
    paddingHorizontal: theme.spacing.m,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    color: theme.colors.text,
    fontFamily: theme.typography.body.fontFamily,
    fontSize: theme.typography.body.fontSize + 1,
  },
  errorText: {
    color: theme.colors.thermal.core,
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: theme.typography.caption.fontSize,
    letterSpacing: theme.typography.caption.letterSpacing,
    marginBottom: theme.spacing.m,
  },
  buttons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.s,
  },
  cancelBtn: {
    paddingVertical: 14,
    paddingHorizontal: theme.spacing.m,
  },
  cancelBtnText: {
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.h2.fontFamily,
    fontSize: 13,
    letterSpacing: 1.5,
  },
  submitOuter: {
    borderRadius: theme.layout.radius.s,
    overflow: 'hidden',
    ...theme.shadows.thermal,
  },
  submitBtn: {
    paddingHorizontal: theme.spacing.l,
    paddingVertical: 14,
    borderRadius: theme.layout.radius.s,
  },
  submitBtnText: {
    color: '#fff',
    fontFamily: theme.typography.h2.fontFamily,
    fontSize: 13,
    letterSpacing: 1.5,
  },
});
```

- [ ] **Step 5.2: Type-check**

Run:
```bash
cd frontend && npx tsc --noEmit
```

Expected: no new errors from `EditTimesModal.tsx`. (Pre-existing errors from Task 2 in `ChunkContainer.tsx` still present — clears in Task 6.)

- [ ] **Step 5.3: Commit**

```bash
git add frontend/src/components/EditTimesModal.tsx
git commit -m "feat(frontend): add EditTimesModal component"
```


---

## Task 6: ChunkContainer — controlled tasks + terminal divider rendering

This task lifts `tasks` ownership to the parent screen (resolving open implementation choice #1 in the spec) so the modal can read `currentTotal` from one source. It also adds the terminal-divider rendering and migrates the API call from `debouncedUpdateChunkTasks` to `debouncedUpdateChunk`.

**Files:**
- Modify: `frontend/src/components/ChunkContainer.tsx`

- [ ] **Step 6.1: Make `ChunkContainer` controlled and render the terminal divider**

Replace `frontend/src/components/ChunkContainer.tsx` with the following. Key changes from the current file:

- `Props` adds `tasks: Task[]` and `onTasksChange: (tasks: Task[]) => void`; removes internal `useState<Task[]>`.
- `currentTotal` and `unassigned` derive from the controlled `tasks` prop (unchanged formula).
- All four mutation handlers (`handleDrag`, `handleToggleBuffer`, `handleTitleChange`, `handleAddTask`) call `onTasksChange(updated)` plus `apiClient.debouncedUpdateChunk(chunkId, { tasks: updated })` via a shared `commitTasks` helper.
- New `handleLastDrag` for the terminal divider.
- The map block emits a terminal divider after the last task when `canExtendLast` is true.

```tsx
import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  Pressable,
  Text,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { TimeChunk, Task } from '../types';
import { TaskBlock } from './TaskBlock';
import { DraggableDivider } from './DraggableDivider';
import { BalanceHeader } from './BalanceHeader';
import { GlassSurface } from './GlassSurface';
import {
  calculateZeroSumTasks,
  toggleBuffer,
  calculateLastTaskWithUnassigned,
} from '../utils/dragMath';
import { theme } from '../styles/theme';
import { ApiClient } from '../api/client';

interface Props {
  initialChunk: TimeChunk;
  totalDurationMinutes: number;
  apiClient: ApiClient;
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
}

export const ChunkContainer: React.FC<Props> = ({
  initialChunk,
  totalDurationMinutes,
  apiClient,
  tasks,
  onTasksChange,
}) => {
  const [limitedTaskIds, setLimitedTaskIds] = useState<Set<string>>(new Set());
  const [modalVisible, setModalVisible] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDuration, setNewTaskDuration] = useState('15');

  const currentTotal = (tasks || []).reduce(
    (sum, t) => sum + (t.duration_minutes || 0) + (t.buffer_after_minutes || 0),
    0,
  );
  const unassigned = Math.max(0, totalDurationMinutes - currentTotal) || 0;

  const commitTasks = (updated: Task[]) => {
    onTasksChange(updated);
    apiClient.debouncedUpdateChunk(initialChunk.chunk_id, { tasks: updated });
  };

  const handleDrag = (index: number, deltaMinutes: number) => {
    const updatedTasks = calculateZeroSumTasks(tasks, index, deltaMinutes);
    if (updatedTasks === tasks) return;

    const newLimitedIds = new Set<string>();
    if (
      updatedTasks[index].duration_minutes === tasks[index].duration_minutes &&
      deltaMinutes !== 0
    ) {
      newLimitedIds.add(tasks[index].task_id);
    }
    if (
      updatedTasks[index + 1].duration_minutes === tasks[index + 1].duration_minutes &&
      deltaMinutes !== 0
    ) {
      newLimitedIds.add(tasks[index + 1].task_id);
    }

    setLimitedTaskIds(newLimitedIds);
    commitTasks(updatedTasks);
  };

  const handleLastDrag = (deltaMinutes: number) => {
    if (tasks.length === 0) return;
    const updatedTasks = calculateLastTaskWithUnassigned(tasks, deltaMinutes, unassigned);
    if (updatedTasks === tasks) {
      const lastId = tasks[tasks.length - 1].task_id;
      setLimitedTaskIds(new Set([lastId]));
      return;
    }
    setLimitedTaskIds(new Set());
    commitTasks(updatedTasks);
  };

  const handleDragEnd = () => {
    setLimitedTaskIds(new Set());
  };

  const handleToggleBuffer = (index: number) => {
    const updatedTasks = toggleBuffer(tasks, index);
    if (updatedTasks === tasks) {
      Alert.alert('ERROR', 'INSUFFICIENT ATMOSPHERE FOR BUFFER');
      return;
    }
    commitTasks(updatedTasks);
  };

  const handleTitleChange = (taskId: string, newTitle: string) => {
    const updatedTasks = tasks.map((t) =>
      t.task_id === taskId ? { ...t, title: newTitle } : t,
    );
    commitTasks(updatedTasks);
  };

  const handleAddTask = () => {
    const duration = parseInt(newTaskDuration);
    if (!newTaskTitle.trim() || isNaN(duration)) {
      Alert.alert('ERROR', 'INVALID SYSTEM DESIGNATION OR PARAMETERS');
      return;
    }

    if (duration > unassigned) {
      Alert.alert('ERROR', `INSUFFICIENT ATMOSPHERE: ${unassigned}M AVAILABLE`);
      return;
    }

    const newTask: Task = {
      task_id: Math.random().toString(36).substr(2, 9),
      title: newTaskTitle,
      duration_minutes: duration,
      min_duration: 5,
    };

    commitTasks([...tasks, newTask]);
    setModalVisible(false);
    setNewTaskTitle('');
    setNewTaskDuration('15');
  };

  return (
    <View style={styles.safeArea}>
      <BalanceHeader unassignedMinutes={unassigned} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {tasks.map((task, index) => {
          const isLast = index === tasks.length - 1;
          const canExtendLast =
            isLast && (unassigned > 0 || task.duration_minutes > task.min_duration);

          return (
            <React.Fragment key={task.task_id}>
              <TaskBlock
                {...task}
                isLimitReached={limitedTaskIds.has(task.task_id)}
                onTitleChange={(title) => handleTitleChange(task.task_id, title)}
              />
              {!isLast && (
                <DraggableDivider
                  variant="between"
                  onDrag={(delta) => handleDrag(index, delta)}
                  onDragEnd={handleDragEnd}
                  onPress={() => handleToggleBuffer(index)}
                  bufferDuration={task.buffer_after_minutes}
                />
              )}
              {isLast && canExtendLast && (
                <DraggableDivider
                  variant="terminal"
                  onDrag={handleLastDrag}
                  onDragEnd={handleDragEnd}
                />
              )}
            </React.Fragment>
          );
        })}

        {unassigned > 0 && (
          <UnassignedSlot
            minutes={unassigned}
            onPress={() => setModalVisible(true)}
          />
        )}
      </ScrollView>

      <CreateTaskModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={newTaskTitle}
        setTitle={setNewTaskTitle}
        duration={newTaskDuration}
        setDuration={setNewTaskDuration}
        unassigned={unassigned}
        onSubmit={handleAddTask}
      />
    </View>
  );
};

// --- Unassigned slot ---------------------------------------------------------
// (unchanged from previous version — copy verbatim from the existing file)

// --- Create-task modal -------------------------------------------------------
// (unchanged from previous version — copy verbatim from the existing file)

// (styles object — unchanged from previous version)
```

**IMPORTANT NOTE FOR THE IMPLEMENTING ENGINEER:** Only the top portion of the file (the `ChunkContainer` component itself, plus the new imports) changes. The bottom sections — `UnassignedSlot` component, `CreateTaskModal` component, and the entire `styles` StyleSheet — are unchanged from the current `frontend/src/components/ChunkContainer.tsx`. Preserve them byte-for-byte from the existing file when applying this edit; do not rewrite or simplify those sections.

- [ ] **Step 6.2: Type-check**

Run:
```bash
cd frontend && npx tsc --noEmit
```

Expected: errors now move to `ChunkEditorScreen.tsx` (the screen passes `chunk` but no longer satisfies the new required `tasks` / `onTasksChange` props). Those clear in Task 7.

- [ ] **Step 6.3: Run the existing ChunkContainer test to confirm no regressions in its internal logic**

Run:
```bash
cd frontend && npx jest tests/components/ChunkContainer.test.tsx --verbose
```

If the test relied on the previous uncontrolled API and now fails, do not patch it in this commit — note the failure for Task 7 (the screen will then satisfy the controlled contract end-to-end, and any test changes should be made in a follow-up if pre-existing fixtures are stale).

If the existing test was already failing on `main` (likely — it predates the trailing-slash fix in commit b570837), it's acceptable to leave it failing in the same way. Confirm any failures pre-existed by running the same test on `main` first if uncertain.

- [ ] **Step 6.4: Commit**

```bash
git add frontend/src/components/ChunkContainer.tsx
git commit -m "feat(frontend): controlled ChunkContainer + terminal divider rendering"
```


---

## Task 7: ChunkEditorScreen — lift envelope/tasks state and wire EditTimesModal

**Files:**
- Modify: `frontend/src/screens/ChunkEditorScreen.tsx`

- [ ] **Step 7.1: Wire envelope + tasks state into the screen and mount the modal**

Replace `frontend/src/screens/ChunkEditorScreen.tsx` with:

```tsx
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, Pressable, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { differenceInMinutes, parseISO, format } from 'date-fns';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

import { RootStackParamList } from '../navigation/types';
import { ChunkContainer } from '../components/ChunkContainer';
import { EditTimesModal } from '../components/EditTimesModal';
import { NoiseBackground } from '../components/NoiseBackground';
import { ApiClient } from '../api/client';
import { Task } from '../types';
import { theme } from '../styles/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ChunkEditor'>;

export const ChunkEditorScreen: React.FC<Props> = ({ route, navigation }) => {
  const { chunk } = route.params;
  const insets = useSafeAreaInsets();

  const [startTime, setStartTime] = useState(chunk.start_time);
  const [endTime, setEndTime] = useState(chunk.end_time);
  const [tasks, setTasks] = useState<Task[]>(chunk.tasks || []);
  const [editTimesVisible, setEditTimesVisible] = useState(false);

  const apiClient = useMemo(
    () => new ApiClient('http://localhost:8080', chunk.user_id),
    [chunk.user_id],
  );

  useEffect(() => {
    return () => {
      apiClient.debouncedUpdateChunk.flush();
    };
  }, [apiClient]);

  const totalDurationMinutes = useMemo(() => {
    try {
      const start = parseISO(startTime);
      const end = parseISO(endTime);
      const diff = Math.abs(differenceInMinutes(end, start));
      return isNaN(diff) || diff === 0 ? 60 : diff;
    } catch {
      return 60;
    }
  }, [startTime, endTime]);

  const startLabel = useMemo(() => {
    try {
      return format(parseISO(startTime), 'HH:mm');
    } catch {
      return '';
    }
  }, [startTime]);

  const endLabel = useMemo(() => {
    try {
      return format(parseISO(endTime), 'HH:mm');
    } catch {
      return '';
    }
  }, [endTime]);

  const currentTotalMinutes = useMemo(
    () =>
      tasks.reduce(
        (sum, t) => sum + (t.duration_minutes || 0) + (t.buffer_after_minutes || 0),
        0,
      ),
    [tasks],
  );

  const handleTimesCommit = (next: { start_time: string; end_time: string }) => {
    setStartTime(next.start_time);
    setEndTime(next.end_time);
    setEditTimesVisible(false);
    apiClient.debouncedUpdateChunk(chunk.chunk_id, next);
  };

  return (
    <View style={styles.container}>
      <NoiseBackground />

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={styles.titleBlock}>
          <Pressable
            onPress={() => setEditTimesVisible(true)}
            hitSlop={8}
            disabled={!startLabel || !endLabel}
          >
            <Text style={styles.eyebrow} numberOfLines={1}>
              {startLabel && endLabel ? `${startLabel} — ${endLabel}` : 'SCHEDULE'}
            </Text>
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>
            {chunk.title}
          </Text>
        </View>
        <View style={styles.topBarSpacer} />
      </View>

      <ChunkContainer
        initialChunk={chunk}
        totalDurationMinutes={totalDurationMinutes}
        apiClient={apiClient}
        tasks={tasks}
        onTasksChange={setTasks}
      />

      <EditTimesModal
        visible={editTimesVisible}
        startTime={startTime}
        endTime={endTime}
        currentTotalMinutes={currentTotalMinutes}
        onClose={() => setEditTimesVisible(false)}
        onSubmit={handleTimesCommit}
      />
    </View>
  );
};

const BackButton: React.FC<{ onPress: () => void }> = ({ onPress }) => {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.backOuter, animatedStyle]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          scale.value = withSpring(0.9, theme.physics.spring);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, theme.physics.spring);
        }}
        hitSlop={12}
        style={styles.backPressable}
      >
        <View style={styles.chevron} />
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.m,
    paddingBottom: 8,
  },
  backOuter: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  backPressable: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.glass.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  chevron: {
    width: 9,
    height: 9,
    marginLeft: 3,
    borderLeftWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: theme.colors.text,
    transform: [{ rotate: '45deg' }],
  },
  titleBlock: {
    flex: 1,
    paddingHorizontal: theme.spacing.m,
  },
  eyebrow: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: theme.typography.caption.fontSize,
    letterSpacing: theme.typography.caption.letterSpacing,
    color: theme.colors.thermal.corona,
  },
  title: {
    fontFamily: theme.typography.h1.fontFamily,
    fontSize: 18,
    letterSpacing: 1.2,
    color: theme.colors.text,
    marginTop: 2,
  },
  topBarSpacer: {
    width: 40,
  },
});
```

- [ ] **Step 7.2: Type-check the project — should be fully clean now**

Run:
```bash
cd frontend && npx tsc --noEmit
```

Expected: no TypeScript errors anywhere in `frontend/src` related to this feature. (Pre-existing test rot in `client.test.ts` that called the old method name or stale URLs is unrelated to this feature — those errors, if any, should already be gone after Task 2 updated the tests, or remain only in unrelated tests that should be addressed separately.)

- [ ] **Step 7.3: Run the full frontend test suite**

Run:
```bash
cd frontend && npx jest --testPathIgnorePatterns=node_modules
```

Expected: at minimum, all newly added tests in `dragMath.test.ts` and `client.test.ts` (the `debouncedUpdateChunk` describe block) pass. Pre-existing failures from rotted tests can remain unchanged.

- [ ] **Step 7.4: Manual smoke test (UI)**

Run the dev server and exercise the feature in the iOS or Android simulator:

```bash
cd frontend && npm start
```

Walk through:
1. Open the app, tap a chunk to enter the editor.
2. Tap the `HH:mm — HH:mm` eyebrow → modal opens with current times pre-filled.
3. **Happy path:** change end to a later time → COMMIT → modal closes, top bar shows new range, unassigned slot grows.
4. **Validation:** try setting end before start → red error `END MUST BE AFTER START`. Modal stays open.
5. **Insufficient atmosphere:** with several tasks summing to 60m, try to shrink envelope to 30m → red error `INSUFFICIENT ATMOSPHERE — 60M REQUIRED, 30M REQUESTED`.
6. **Persistence:** after committing a valid change, back out to the list, re-open the same chunk → new times persist.
7. **Terminal divider grow:** with unassigned > 0, grab the cool-blue divider below the last task → drag down → last task duration increases in 5m steps, unassigned shrinks.
8. **Terminal divider shrink:** drag up → last task shrinks until it hits `min_duration`, then clamps; the limit ring flashes on the last task.
9. **Visual check:** confirm the terminal divider's halo on drag is visibly cool blue, distinct from the warm thermal halo on between-task dividers.
10. **Degenerate case:** create a chunk fully packed (last task at min_duration AND unassigned === 0) → the terminal divider should not render.

If anything misbehaves, file follow-up issues — do not silently patch in this task.

- [ ] **Step 7.5: Commit**

```bash
git add frontend/src/screens/ChunkEditorScreen.tsx
git commit -m "feat(frontend): editable chunk times via EditTimesModal"
```

---

## Self-Review (run before claiming the plan is complete)

**1. Spec coverage:**
- Goal 1 (editable start/end): Tasks 1, 2, 5, 7 — modal + backend + API + screen wiring. ✓
- Goal 2 (bottom-task extension): Tasks 3, 4, 6 — dragMath helper + terminal variant + container wiring. ✓
- Goal 3 (preserve zero-sum): Task 6 keeps `calculateZeroSumTasks` unchanged; Task 3 added tests verify only the last task is mutated by the new helper. ✓
- Goal 4 (reject overflow): Task 5's EditTimesModal validates `newTotal >= currentTotalMinutes`. ✓

**2. Placeholder scan:** No "TBD"/"TODO"/"add validation" left. All code is concrete.

**3. Type/symbol consistency:**
- `debouncedUpdateChunk` is the new method name everywhere (Tasks 2, 6, 7). ✓
- `ChunkUpdate` type defined in Task 2, used implicitly via `apiClient.debouncedUpdateChunk(chunkId, { … })` in Tasks 6 and 7. ✓
- `calculateLastTaskWithUnassigned` defined in Task 3 with signature `(tasks: Task[], deltaMinutes: number, unassigned: number) => Task[]`, called identically in Task 6. ✓
- `DraggableDivider` `variant` prop introduced in Task 4 with `'between' | 'terminal'`, used identically in Task 6. ✓
- `EditTimesModal` props (Task 5) match what the screen passes (Task 7): `visible`, `startTime`, `endTime`, `currentTotalMinutes`, `onClose`, `onSubmit`. ✓
- `update_chunk` (renamed from `update_chunk_tasks`) defined in Task 1 step 1.4, called from `routes.py` in step 1.5. ✓
- `sendPatch` (renamed from the previous private patch method in `ApiClient`) referenced consistently in Task 2. ✓
