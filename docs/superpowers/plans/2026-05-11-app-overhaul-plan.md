# Implementation Plan: App Overhaul (Editing Capabilities)

**Objective:** Transition TimeBlock from a static mock display to a functional scheduler by adding navigation, chunk management, and task editing capabilities.

**Key Files:**
- `frontend/App.tsx`
- `frontend/package.json`
- `frontend/src/components/TaskBlock.tsx`
- `frontend/src/components/ChunkContainer.tsx`

## Implementation Steps

- [ ] **Step 1: Install React Navigation**
  - Install `@react-navigation/native` and `@react-navigation/native-stack`.
  - Install necessary dependencies (e.g., `react-native-screens`, `react-native-safe-area-context`).

- [ ] **Step 2: Setup Navigation Stack**
  - Refactor `App.tsx` to include a Native Stack Navigator.
  - Create `src/screens/ChunkListScreen.tsx`.
  - Create `src/screens/ChunkEditorScreen.tsx` (moving current `ChunkContainer` logic here).

- [ ] **Step 3: Chunk List & Management**
  - Implement `ChunkListScreen` to fetch and display chunks using `ApiClient`.
  - Add a FAB to trigger chunk creation.
  - Implement a Modal for the Hybrid creation flow (Template vs. Blank).
  - Implement swipe-to-delete functionality for the list items.

- [ ] **Step 4: Task Interaction (Inline Edit & Add)**
  - Update `TaskBlock.tsx` to support inline editing of the title via `TextInput`.
  - Update `ChunkContainer.tsx` to include an "Add Task" button and modal.
  - Ensure the "Zero-Sum" logic (`dragMath.ts`) correctly handles dynamically added and removed tasks, maintaining the chunk's total duration.

## Verification
- Verify navigation between the list and editor works.
- Verify new chunks can be created (both blank and from template).
- Verify tasks can be renamed inline.
- Verify new tasks can be added and the drag logic remains fluid and accurate.