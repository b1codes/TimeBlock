# App Overhaul: Editing Capabilities Design

## Background & Motivation
TimeBlock currently exists as a static display of mock data. To be a functional application, users must be able to create, edit, and delete their schedules. This overhaul transitions the app from a single-screen mock to a dynamic, interactive scheduler.

## Scope & Impact
The overhaul introduces React Navigation to support multiple screens. It implements a "Hybrid" creation flow for Time Chunks (Blank Slate or Template) and provides inline editing and modal creation for the Task Blocks within those chunks.

## Architecture & Navigation
1.  **React Navigation:** Implement a Native Stack Navigator.
    *   **`ChunkListScreen`:** The primary entry point displaying all active user chunks.
    *   **`ChunkEditorScreen`:** The detailed view containing the drag-and-drop interface, receiving chunk data via navigation params.
2.  **State Management:**
    *   `ChunkListScreen` manages the list state (fetching via `ApiClient`).
    *   `ChunkEditorScreen` manages the local state for drag mechanics, syncing via the existing debounced `ApiClient`.

## Components & Interactions
1.  **Adding a Chunk (Hybrid Flow):** A Floating Action Button (FAB) on the list screen opens a modal. The user can either select an existing "Master Template" or create a blank chunk by defining start/end times.
2.  **Deleting a Chunk:** Implement swipe-to-delete on the `ChunkListScreen` list items.
3.  **Inline Task Editing:** Modify `TaskBlock.tsx` to conditionally render a `TextInput`. Tapping the title enters edit mode. Changes sync on blur/submit.
4.  **Task Creation:** A "+" button at the bottom of the `ChunkContainer` opens a modal for "Task Name" and "Duration".
5.  **Zero-Sum Preservation:** `dragMath.ts` and `ChunkContainer` logic must dynamically handle the addition/removal of tasks, recalculating dividers to maintain the fixed total duration.

## Alternatives Considered
-   **State-Centric Refactor:** Using a global store (Zustand) was considered but deferred. A surgical implementation using React Navigation and local state provides the quickest path to a functional editor without over-engineering early.