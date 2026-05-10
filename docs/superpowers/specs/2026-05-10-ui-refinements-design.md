# UI Refinements Design Spec

This spec covers refinements to the TimeBlock UI, focusing on API integration and performance optimization.

## Goals
1. Integrate `ApiClient` into the task dragging workflow to ensure changes are synced with the backend.
2. Optimize the task duration calculation logic to reduce unnecessary object allocations.

## Proposed Changes

### 1. `dragMath.ts` Optimization
Optimize `calculateZeroSumTasks` to avoid cloning every task in the array.

**Current:**
```typescript
const newTasks = [...tasks.map(t => ({...t}))];
```

**New:**
```typescript
const newTasks = [...tasks];
newTasks[topTaskIndex] = { ...tasks[topTaskIndex] };
newTasks[topTaskIndex + 1] = { ...tasks[topTaskIndex + 1] };
```

### 2. `App.tsx` Integration
Instantiate `ApiClient` and pass it to `ChunkContainer`.

```typescript
const apiClient = useMemo(() => new ApiClient('http://localhost:8000', 'user_1'), []);
// ...
<ChunkContainer 
  initialChunk={MOCK_CHUNK}
  totalDurationMinutes={120}
  apiClient={apiClient}
/>
```

### 3. `ChunkContainer.tsx` Integration
Use the `apiClient` to sync tasks on every drag event.

```typescript
// Inside handleDrag
apiClient.debouncedUpdateChunkTasks(initialChunk.chunk_id, updatedTasks);
```

## Verification Plan
1. **Unit Tests:** Update `dragMath.test.ts` if needed (it shouldn't change behavior, just performance).
2. **Integration:** Verify that `debouncedUpdateChunkTasks` is called with the correct arguments when dragging a divider.
3. **Manual Check:** Ensure the app still functions correctly and drags are smooth.
