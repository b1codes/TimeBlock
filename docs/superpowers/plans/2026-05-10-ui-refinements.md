# UI Refinements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Perform final refinements to the TimeBlock UI, including API integration and optimization.

**Architecture:** Integrate `ApiClient` into the component tree and optimize utility functions for better performance.

**Tech Stack:** React, TypeScript, React Native, lodash (debounce).

---

### Task 1: Optimize `calculateZeroSumTasks` in `dragMath.ts`

**Files:**
- Modify: `frontend/src/utils/dragMath.ts`
- Test: `frontend/tests/dragMath.test.ts`

- [ ] **Step 1: Write a test to verify immutability and targeted cloning**

```typescript
it('should not clone tasks that are not affected', () => {
  const tasks: Task[] = [
    { task_id: '1', title: 'A', duration_minutes: 30, min_duration: 10 },
    { task_id: '2', title: 'B', duration_minutes: 30, min_duration: 10 },
    { task_id: '3', title: 'C', duration_minutes: 30, min_duration: 10 }
  ];
  const result = calculateZeroSumTasks(tasks, 0, 5);
  expect(result).not.toBe(tasks);
  expect(result[2]).toBe(tasks[2]); // Task C should be the same object reference
  expect(result[0]).not.toBe(tasks[0]);
  expect(result[1]).not.toBe(tasks[1]);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test frontend/tests/dragMath.test.ts`
Expected: FAIL on the reference check for `result[2]`.

- [ ] **Step 3: Implement optimized cloning**

```typescript
export function calculateZeroSumTasks(tasks: Task[], topTaskIndex: number, deltaMinutes: number): Task[] {
  const topTaskOrig = tasks[topTaskIndex];
  const bottomTaskOrig = tasks[topTaskIndex + 1];
  
  if (!topTaskOrig || !bottomTaskOrig) {
    return tasks;
  }

  // Calculate actual delta first
  let actualDelta = deltaMinutes;
  if (deltaMinutes > 0) {
    const maxShrink = bottomTaskOrig.duration_minutes - bottomTaskOrig.min_duration;
    actualDelta = Math.min(deltaMinutes, maxShrink);
  } else {
    const maxShrink = topTaskOrig.duration_minutes - topTaskOrig.min_duration;
    actualDelta = Math.max(deltaMinutes, -maxShrink);
  }

  if (actualDelta === 0) return tasks;

  const newTasks = [...tasks];
  newTasks[topTaskIndex] = { 
    ...topTaskOrig, 
    duration_minutes: topTaskOrig.duration_minutes + actualDelta 
  };
  newTasks[topTaskIndex + 1] = { 
    ...bottomTaskOrig, 
    duration_minutes: bottomTaskOrig.duration_minutes - actualDelta 
  };

  return newTasks;
}
```

- [ ] **Step 4: Run tests to verify success**

Run: `npm test frontend/tests/dragMath.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/dragMath.ts frontend/tests/dragMath.test.ts
git commit -m "perf: optimize array cloning in dragMath"
```

### Task 2: Instantiate `ApiClient` in `App.tsx`

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Import `ApiClient` and `useMemo`**

```typescript
import React, { useMemo } from 'react';
import { ApiClient } from './api/client';
```

- [ ] **Step 2: Instantiate client and pass to `ChunkContainer`**

```typescript
const App = () => {
  const apiClient = useMemo(() => new ApiClient('http://localhost:8000', 'user_1'), []);

  return (
    <GestureHandlerRootView style={styles.container}>
      <ChunkContainer 
        initialChunk={MOCK_CHUNK}
        totalDurationMinutes={120} // 2 hours
        apiClient={apiClient}
      />
      <NoiseBackground />
    </GestureHandlerRootView>
  );
};
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: provide ApiClient to ChunkContainer"
```

### Task 3: Integrate `ApiClient` into `ChunkContainer.tsx`

**Files:**
- Modify: `frontend/src/components/ChunkContainer.tsx`

- [ ] **Step 1: Update `Props` interface**

```typescript
import { ApiClient } from '../api/client';

interface Props {
  initialChunk: TimeChunk;
  totalDurationMinutes: number;
  apiClient: ApiClient;
}
```

- [ ] **Step 2: Call `debouncedUpdateChunkTasks` in `handleDrag`**

```typescript
const handleDrag = (index: number, deltaMinutes: number) => {
  const updatedTasks = calculateZeroSumTasks(tasks, index, deltaMinutes);
  
  if (updatedTasks === tasks) return;

  // ... (limit checks)

  setTasks(updatedTasks);
  setLimitedTaskIds(newLimitedIds);

  // Sync with API
  apiClient.debouncedUpdateChunkTasks(initialChunk.chunk_id, updatedTasks);
};
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ChunkContainer.tsx
git commit -m "feat: integrate ApiClient into ChunkContainer for real-time sync"
```
