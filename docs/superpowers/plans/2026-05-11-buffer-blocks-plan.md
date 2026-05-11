# Implementation Plan: Buffer Time Blocks

**Objective:** Implement optional, 5-minute "Buffer Blocks" between tasks, interacting as "fat" draggable dividers.

**Key Files:**
- `frontend/src/types.ts`
- `frontend/src/components/DraggableDivider.tsx`
- `frontend/src/components/ChunkContainer.tsx`
- `frontend/src/utils/dragMath.ts`
- `backend/src/models.py`

## Implementation Steps

- [ ] **Step 1: Data Model Updates**
  - Update `backend/src/models.py` `Task` model: Add `buffer_after_minutes: int = 0`.
  - Update `frontend/src/types.ts` `Task` interface: Add `buffer_after_minutes?: number`.

- [ ] **Step 2: UI Updates (Fat Divider)**
  - Modify `DraggableDivider.tsx` to accept a `bufferDuration` prop.
  - If `bufferDuration > 0`, render the divider with a larger height and distinct styling (e.g., a dashed background or a specific label).
  - Add an `onPress` handler to the divider to toggle the buffer state (0 or 5).

- [ ] **Step 3: Zero-Sum Math Integration**
  - Update `ChunkContainer.tsx` to handle the divider `onPress` event.
  - Update `dragMath.ts`: Implement the logic to subtract/add 5 minutes from adjacent tasks when a buffer is toggled, ensuring `min_duration` constraints are respected.
  - Update `dragMath.ts`: Ensure the dragging calculation accounts for the `buffer_after_minutes` of the task being dragged over, moving the whole buffer block instead of just a thin line.

## Verification
- Verify tapping a divider expands it to a 5-minute buffer.
- Verify the total duration of the chunk remains unchanged when a buffer is toggled (adjacent tasks shrink).
- Verify dragging a buffer correctly adjusts the tasks above and below it.
- Verify tapping an active buffer removes it, returning the time to the adjacent tasks.