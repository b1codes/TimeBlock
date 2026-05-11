# Buffer Time Blocks Design

## Background & Motivation
Users need flexibility within their scheduled chunks to account for transitions, location changes, or brief rest periods. Currently, tasks are contiguous, meaning any delay in one task immediately affects the start time of the next. Buffer Time Blocks provide optional, fixed-duration padding between tasks.

## Scope & Impact
This design introduces "Buffer Blocks" as a togglable state on the draggable dividers between tasks within the `ChunkEditorScreen`. It will impact the UI rendering of the dividers and the core `dragMath.ts` logic that maintains the Zero-Sum duration of a chunk.

## Architecture & Interaction
1.  **"Fat" Dividers (Option B):** 
    *   Instead of being represented as independent tasks in the list, buffers exist as a state of the divider itself.
    *   Tapping a standard divider toggles it into a "Buffer" (defaulting to 5 minutes). Tapping it again removes the buffer.
    *   Visually, the divider expands to represent the 5-minute block.
    *   Dragging a buffer moves the entire 5-minute block, shrinking the task above and growing the task below (or vice-versa).
2.  **Zero-Sum Integration:**
    *   When a buffer is added (5 minutes), those 5 minutes must be subtracted from the adjacent tasks (e.g., 2.5 minutes from the task above, 2.5 minutes from the task below, or according to specific rules if tasks hit their `min_duration`).
    *   The total duration of the chunk must remain constant.
3.  **Data Model Updates:**
    *   The backend and frontend data models need to represent these buffers. They could be stored as an array of `Buffer` objects indicating the index they follow, or as properties of the `Task` object (e.g., `buffer_after_minutes: number`).

## Alternatives Considered
-   **Buffer as a "Special Task" (Option A):** Treating the buffer as a regular task in the list with a specific type was considered. However, the "Fat Divider" approach provides a cleaner visual hierarchy and interaction model, clearly distinguishing between "work to be done" and "transition time."

## Spec Self-Review
-   *Data Model:* How exactly will it be stored? I should specify `buffer_after_minutes` on the `Task` model as the most robust way to store it without complicating the array indices.
-   *Update Data Model:* `Task` model will have `buffer_after_minutes: int` defaulting to 0.

### Updated Data Model
- The `Task` model will be updated to include an optional `buffer_after_minutes` property (defaulting to 0). This indicates the duration of the buffer following that specific task.