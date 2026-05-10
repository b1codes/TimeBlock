# TimeBlock Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the core frontend logic for TimeBlock, including the debounced API client and the zero-sum dragging math to handle task durations.

**Architecture:** A React Native application (assumed Expo structure) utilizing `react-native-reanimated` and `react-native-gesture-handler` for fluid, bridge-free 60fps animations. State and side-effects (API syncing) are decoupled from the high-frequency UI thread.

**Tech Stack:** React Native, TypeScript, Jest, Lodash.

*Note: This plan focuses on the core logical components and the API layer that can be verified via Jest unit tests. Full visual component rendering involves complex device setups which fall outside the scope of this unit-testable plan.*

---

### Task 1: Project Setup and Types

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/jest.config.js`
- Create: `frontend/src/types.ts`
- Create: `frontend/tests/types.test.ts`

- [ ] **Step 1: Write scaffolding and config**

```json
// frontend/package.json
{
  "name": "timeblock-frontend",
  "version": "1.0.0",
  "scripts": {
    "test": "jest"
  },
  "devDependencies": {
    "@types/jest": "^29.5.0",
    "@types/lodash": "^4.14.0",
    "jest": "^29.5.0",
    "ts-jest": "^29.1.0",
    "typescript": "^5.0.0"
  },
  "dependencies": {
    "lodash": "^4.17.21"
  }
}
```

```json
// frontend/tsconfig.json
{
  "compilerOptions": {
    "target": "es2022",
    "module": "commonjs",
    "lib": ["es2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

```javascript
// frontend/jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/'],
};
```

- [ ] **Step 2: Write the failing test for types**

```typescript
// frontend/tests/types.test.ts
import { Task, TimeChunk } from '../src/types';

describe('Types', () => {
  it('should allow constructing a valid Task object', () => {
    const task: Task = {
      task_id: '123-uuid',
      title: 'Read',
      duration_minutes: 30,
      min_duration: 10
    };
    expect(task.title).toBe('Read');
  });

  it('should allow constructing a valid TimeChunk object', () => {
    const chunk: TimeChunk = {
      user_id: 'user1',
      chunk_id: 'chunk1',
      title: 'Morning',
      start_time: '2023-01-01T06:00:00Z',
      end_time: '2023-01-01T08:00:00Z',
      is_template: false,
      tasks: []
    };
    expect(chunk.chunk_id).toBe('chunk1');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && npm install && npm test`
Expected: FAIL (Cannot find module '../src/types')

- [ ] **Step 4: Write minimal implementation**

```typescript
// frontend/src/types.ts
export interface Task {
  task_id: string;
  title: string;
  duration_minutes: number;
  min_duration: number;
}

export interface TimeChunk {
  user_id: string;
  chunk_id: string;
  title: string;
  start_time: string; // ISO string
  end_time: string;   // ISO string
  is_template: boolean;
  tasks: Task[];
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/
git commit -m "chore: setup frontend typescript project and types"
```

---

### Task 2: Pure Zero-Sum Dragging Math

**Files:**
- Create: `frontend/src/utils/dragMath.ts`
- Create: `frontend/tests/dragMath.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/tests/dragMath.test.ts
import { calculateZeroSumTasks } from '../src/utils/dragMath';
import { Task } from '../src/types';

describe('calculateZeroSumTasks', () => {
  it('should increase task A and decrease task B by the exact delta', () => {
    const tasks: Task[] = [
      { task_id: '1', title: 'A', duration_minutes: 30, min_duration: 10 },
      { task_id: '2', title: 'B', duration_minutes: 30, min_duration: 10 }
    ];
    
    // We are dragging the divider between task 0 and 1 down by 5 minutes.
    // Task A grows by 5, Task B shrinks by 5.
    const result = calculateZeroSumTasks(tasks, 0, 5);
    
    expect(result[0].duration_minutes).toBe(35);
    expect(result[1].duration_minutes).toBe(25);
  });

  it('should respect min_duration constraints', () => {
    const tasks: Task[] = [
      { task_id: '1', title: 'A', duration_minutes: 30, min_duration: 10 },
      { task_id: '2', title: 'B', duration_minutes: 30, min_duration: 28 }
    ];
    
    // Attempting to grow A by 10, which would shrink B by 10 (down to 20).
    // But B's min_duration is 28. So B can only shrink by 2, meaning A can only grow by 2.
    const result = calculateZeroSumTasks(tasks, 0, 10);
    
    expect(result[0].duration_minutes).toBe(32);
    expect(result[1].duration_minutes).toBe(28);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test tests/dragMath.test.ts`
Expected: FAIL (Cannot find module '../src/utils/dragMath')

- [ ] **Step 3: Write minimal implementation**

```typescript
// frontend/src/utils/dragMath.ts
import { Task } from '../src/types';

/**
 * Calculates new durations for two adjacent tasks when a divider is dragged.
 * @param tasks The full list of tasks in the chunk.
 * @param topTaskIndex The index of the task directly above the dragged divider.
 * @param deltaMinutes The change in minutes (positive means divider moved down, expanding the top task).
 * @returns A new array of tasks with updated durations.
 */
export function calculateZeroSumTasks(tasks: Task[], topTaskIndex: number, deltaMinutes: number): Task[] {
  const newTasks = [...tasks.map(t => ({...t}))];
  
  const topTask = newTasks[topTaskIndex];
  const bottomTask = newTasks[topTaskIndex + 1];
  
  if (!topTask || !bottomTask) {
    return newTasks;
  }

  // Calculate the maximum allowed delta based on min_durations
  let actualDelta = deltaMinutes;

  if (deltaMinutes > 0) {
    // Divider moving down: top task grows, bottom task shrinks
    const maxShrink = bottomTask.duration_minutes - bottomTask.min_duration;
    if (actualDelta > maxShrink) {
      actualDelta = maxShrink;
    }
  } else {
    // Divider moving up: top task shrinks, bottom task grows
    // delta is negative here
    const maxShrink = topTask.duration_minutes - topTask.min_duration;
    if (Math.abs(actualDelta) > maxShrink) {
      actualDelta = -maxShrink;
    }
  }

  topTask.duration_minutes += actualDelta;
  bottomTask.duration_minutes -= actualDelta;

  return newTasks;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test tests/dragMath.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/dragMath.ts frontend/tests/dragMath.test.ts
git commit -m "feat: implement pure zero-sum math logic for dragging"
```

---

### Task 3: API Client with Debouncing

**Files:**
- Create: `frontend/src/api/client.ts`
- Create: `frontend/tests/client.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/tests/client.test.ts
import { ApiClient } from '../src/api/client';
import { Task } from '../src/types';

// Mock global fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({ success: true }),
  })
) as jest.Mock;

jest.useFakeTimers();

describe('ApiClient', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  it('should debounce patch chunk requests by 750ms and send the batch payload', () => {
    const client = new ApiClient('https://api.example.com', 'user123');
    
    const tasks1: Task[] = [{ task_id: '1', title: 'A', duration_minutes: 20, min_duration: 10 }];
    const tasks2: Task[] = [{ task_id: '1', title: 'A', duration_minutes: 30, min_duration: 10 }];
    
    // Call multiple times in rapid succession
    client.debouncedUpdateChunkTasks('chunk1', tasks1);
    client.debouncedUpdateChunkTasks('chunk1', tasks2);
    
    // Fast-forward 500ms - should not have fired yet
    jest.advanceTimersByTime(500);
    expect(global.fetch).not.toHaveBeenCalled();
    
    // Fast-forward another 250ms (total 750ms) - should fire now
    jest.advanceTimersByTime(250);
    
    expect(global.fetch).toHaveBeenCalledTimes(1);
    
    // Verify it sent the LATEST payload (tasks2) as a batch
    const callArgs = (global.fetch as jest.Mock).mock.calls[0];
    expect(callArgs[0]).toBe('https://api.example.com/chunks/chunk1');
    expect(callArgs[1].method).toBe('PATCH');
    
    const body = JSON.parse(callArgs[1].body);
    expect(body.tasks[0].duration_minutes).toBe(30);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test tests/client.test.ts`
Expected: FAIL (Cannot find module '../src/api/client')

- [ ] **Step 3: Write minimal implementation**

```typescript
// frontend/src/api/client.ts
import debounce from 'lodash/debounce';
import { Task } from '../types';

export class ApiClient {
  private baseUrl: string;
  private userId: string;

  constructor(baseUrl: string, userId: string) {
    this.baseUrl = baseUrl;
    this.userId = userId;
    
    // Bind the method so `this` context is preserved in the debounced function
    this.executePatch = this.executePatch.bind(this);
    
    // Spec: Debounce payload dispatch by a minimum of 750ms
    this.debouncedUpdateChunkTasks = debounce(this.executePatch, 750);
  }

  private async executePatch(chunkId: string, tasks: Task[]): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/chunks/${chunkId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': this.userId
        },
        // Spec: Batch Payload - expect entire modified array in single JSON payload
        body: JSON.stringify({ tasks })
      });
    } catch (error) {
      console.error('Failed to sync tasks', error);
    }
  }

  // The public debounced method
  public debouncedUpdateChunkTasks: (chunkId: string, tasks: Task[]) => void;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test tests/client.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/client.ts frontend/tests/client.test.ts
git commit -m "feat: implement debounced api client for chunk updates"
```
