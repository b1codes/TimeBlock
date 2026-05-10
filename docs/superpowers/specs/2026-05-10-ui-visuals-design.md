# Design Spec: TimeBlock Visuals and UI (The "Tactile Stack")

**Date:** 2026-05-10
**Status:** Approved
**Topic:** Frontend Visuals and Interaction Model

## 1. Goal
Implement a visually rich, tactile, and functional UI for the TimeBlock mobile application. The interface must make time feel spatial and easy to manipulate through a vertical "stack" of tasks.

## 2. Interaction Model: The Vertical Stack
The application will use a vertical timeline where each task is represented as a block whose height is proportional to its duration.

- **Primary View:** A vertical list of tasks within a `TimeChunk`.
- **Zero-Sum Drags:** Dragging the divider between two tasks resizes them relative to each other (Task A grows, Task B shrinks, or vice versa).
- **Unallocated Time:** 
    - **Visual Gap:** Empty time in the chunk is rendered as a textured or dotted "gap" between or below tasks.
    - **Balance Counter:** A sticky header at the top of the screen displays "Unassigned: XXm".
    - **Automatic Balancing:** Extra time is automatically absorbed into this "Buffer" gap.

## 3. High-Fidelity UX & Aesthetics
To create a premium feel, the following design tokens and effects will be applied:

- **Snapping:** Drag interactions snap to **5-minute increments**.
- **Tactile Background:** A subtle noise texture is applied to the main application background.
- **Shadows & Depth:** 
    - Task blocks use multi-layered drop shadows to appear "lifted."
    - Interactive elements (dividers, buttons) feature a soft "glow" effect using the primary brand or category color.
- **Feedback:** 
    - When a task reaches its `min_duration` during a drag, the divider stops, and the task block displays a subtle visual warning (e.g., a soft red border glow).

## 4. Technical Architecture

### Components
- `ChunkContainer`: Manages the overall layout and total duration.
- `TaskBlock`: Renders the title and handles its own responsive height.
- `DraggableDivider`: The interactive handle between tasks.
- `BalanceHeader`: Sticky component for the "Unassigned" time counter.

### State & Sync
- **Local State:** High-frequency updates during dragging are handled on the UI thread (via `react-native-reanimated` if on mobile).
- **Business Logic:** `calculateZeroSumTasks` (from `dragMath.ts`) performs the final duration calculations.
- **API Sync:** `ApiClient.debouncedUpdateChunkTasks` synchronizes the final state with the backend after a 750ms pause in user activity.

## 5. Testing Strategy
- **Snapshot Testing:** Verify the layout and visual consistency of the `TaskBlock`.
- **Interaction Tests:** Simulate drags to ensure the 5-minute snapping and `min_duration` constraints are visually enforced.
- **Accessibility:** Ensure the Balance Counter is announced correctly by screen readers during adjustments.
