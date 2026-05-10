# TimeBlock UI Visuals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the "Tactile Stack" UI for TimeBlock, featuring a vertical timeline of task blocks with 5-minute snapping, unallocated time gaps, and high-fidelity aesthetics.

**Architecture:** A React Native component architecture utilizing `react-native-reanimated` for smooth resizing and `react-native-gesture-handler` for tactile dragging. Logic is kept in pure utility functions (`dragMath.ts`) while components handle the spatial mapping of time to height.

**Tech Stack:** React Native, TypeScript, Jest, react-native-reanimated, react-native-gesture-handler, lodash.

---

### Task 1: Environment and Core Dependencies

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/tsconfig.json`

- [ ] **Step 1: Update package.json with React Native dependencies**

```json
{
  "name": "timeblock-frontend",
  "version": "1.0.0",
  "scripts": {
    "test": "jest"
  },
  "devDependencies": {
    "@types/jest": "^29.5.0",
    "@types/lodash": "^4.14.0",
    "@types/react": "^18.2.0",
    "@types/react-native": "^0.72.0",
    "jest": "^29.5.0",
    "ts-jest": "^29.1.0",
    "typescript": "^5.0.0"
  },
  "dependencies": {
    "lodash": "^4.17.21",
    "react": "18.2.0",
    "react-native": "0.72.6",
    "react-native-gesture-handler": "^2.12.0",
    "react-native-reanimated": "^3.3.0"
  }
}
```

- [ ] **Step 2: Update tsconfig.json for React Native (JSX support)**

```json
{
  "compilerOptions": {
    "target": "es2022",
    "module": "commonjs",
    "lib": ["es2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "jsx": "react-native"
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 3: Install dependencies**

Run: `cd frontend && npm install`
Expected: Successful installation of new packages.

- [ ] **Step 4: Commit**

```bash
git add frontend/package.json frontend/tsconfig.json
git commit -m "chore: add react-native dependencies and jsx support"
```

---

### Task 2: Design Tokens and Theme

**Files:**
- Create: `frontend/src/styles/theme.ts`

- [ ] **Step 1: Define the design tokens**

```typescript
// frontend/src/styles/theme.ts
export const theme = {
  colors: {
    background: '#FEFEFE',
    text: '#212121',
    primary: '#0D47A1',
    secondary: '#1976D2',
    accent: '#FFC107',
    unallocated: '#F0F0F0',
    border: '#E0E0E0',
    error: '#D32F2F',
  },
  spacing: {
    xs: 4,
    s: 8,
    m: 16,
    l: 24,
  },
  layout: {
    minutesToHeight: 4, // 1 minute = 4 logical pixels
    snapIncrement: 5,   // Snap to 5 minutes
  },
  shadows: {
    lifted: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 5,
    }
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/styles/theme.ts
git commit -m "style: define design tokens and theme"
```

---

### Task 3: BalanceHeader Component

**Files:**
- Create: `frontend/src/components/BalanceHeader.tsx`
- Create: `frontend/tests/components/BalanceHeader.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/tests/components/BalanceHeader.test.tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { BalanceHeader } from '../../src/components/BalanceHeader';

describe('BalanceHeader', () => {
  it('should display the correct unassigned minutes', () => {
    const { getByText } = render(<BalanceHeader unassignedMinutes={15} />);
    expect(getByText('Unassigned: 15m')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test tests/components/BalanceHeader.test.tsx`
Expected: FAIL (Cannot find module)

- [ ] **Step 3: Write minimal implementation**

```tsx
// frontend/src/components/BalanceHeader.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../styles/theme';

interface Props {
  unassignedMinutes: number;
}

export const BalanceHeader: React.FC<Props> = ({ unassignedMinutes }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Unassigned: {unassignedMinutes}m</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.m,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    alignItems: 'center',
    zIndex: 10,
  },
  text: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test tests/components/BalanceHeader.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/BalanceHeader.tsx frontend/tests/components/BalanceHeader.test.tsx
git commit -m "feat: implement BalanceHeader component"
```

---

### Task 4: Static TaskBlock Component

**Files:**
- Create: `frontend/src/components/TaskBlock.tsx`
- Create: `frontend/tests/components/TaskBlock.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/tests/components/TaskBlock.test.tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { TaskBlock } from '../../src/components/TaskBlock';
import { theme } from '../../src/styles/theme';

describe('TaskBlock', () => {
  it('should render the title and correct height based on duration', () => {
    const { getByText, getByTestId } = render(
      <TaskBlock task_id="1" title="Research" duration_minutes={30} min_duration={10} isLimitReached={false} />
    );
    
    expect(getByText('Research')).toBeTruthy();
    
    const container = getByTestId('task-block-1');
    expect(container.props.style.some((s: any) => s.height === 30 * theme.layout.minutesToHeight)).toBeTruthy();
  });

  it('should show error border when isLimitReached is true', () => {
    const { getByTestId } = render(
      <TaskBlock task_id="1" title="Research" duration_minutes={10} min_duration={10} isLimitReached={true} />
    );
    const container = getByTestId('task-block-1');
    expect(container.props.style.some((s: any) => s.borderColor === theme.colors.error)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test tests/components/TaskBlock.test.tsx`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```tsx
// frontend/src/components/TaskBlock.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../styles/theme';
import { Task } from '../types';

interface Props extends Task {
  isLimitReached?: boolean;
}

export const TaskBlock: React.FC<Props> = ({ task_id, title, duration_minutes, isLimitReached }) => {
  const height = duration_minutes * theme.layout.minutesToHeight;

  return (
    <View 
      testID={`task-block-${task_id}`}
      style={[
        styles.container, 
        { height },
        isLimitReached && styles.limitReached
      ]}
    >
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.duration}>{duration_minutes}m</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF',
    marginHorizontal: theme.spacing.m,
    marginVertical: 2,
    padding: theme.spacing.s,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.lifted,
  },
  limitReached: {
    borderColor: theme.colors.error,
    borderWidth: 2,
    shadowColor: theme.colors.error,
    shadowOpacity: 0.3,
  },
  title: {
    fontWeight: '600',
    color: theme.colors.text,
  },
  duration: {
    fontSize: 12,
    color: theme.colors.secondary,
  }
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test tests/components/TaskBlock.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/TaskBlock.tsx frontend/tests/components/TaskBlock.test.tsx
git commit -m "feat: implement static TaskBlock component with limit feedback"
```

---

### Task 5: DraggableDivider Component

**Files:**
- Create: `frontend/src/components/DraggableDivider.tsx`

- [ ] **Step 1: Implement the interactive divider**

```tsx
// frontend/src/components/DraggableDivider.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { PanGestureHandler, PanGestureHandlerGestureEvent } from 'react-native-gesture-handler';
import Animated, { useAnimatedGestureHandler } from 'react-native-reanimated';
import { theme } from '../styles/theme';

interface Props {
  onDrag: (deltaY: number) => void;
  onDragEnd: () => void;
}

export const DraggableDivider: React.FC<Props> = ({ onDrag, onDragEnd }) => {
  const gestureHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent, { startY: number }>({
    onStart: (_, ctx) => {
      ctx.startY = 0;
    },
    onActive: (event, ctx) => {
      const deltaY = event.translationY - ctx.startY;
      // We only want to signal changes that cross a 5-minute snap boundary
      const snapPx = theme.layout.snapIncrement * theme.layout.minutesToHeight;
      if (Math.abs(deltaY) >= snapPx) {
        const snapDelta = Math.round(deltaY / snapPx) * theme.layout.snapIncrement;
        onDrag(snapDelta);
        ctx.startY = event.translationY;
      }
    },
    onEnd: () => {
      onDragEnd();
    },
  });

  return (
    <PanGestureHandler onGestureEvent={gestureHandler}>
      <Animated.View style={styles.wrapper}>
        <View style={styles.handle} />
      </Animated.View>
    </PanGestureHandler>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  handle: {
    width: 40,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.border,
    borderWidth: 1,
    borderColor: '#CCC',
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/DraggableDivider.tsx
git commit -m "feat: implement DraggableDivider with gesture snapping"
```

---

### Task 6: ChunkContainer & Interaction Integration

**Files:**
- Create: `frontend/src/components/ChunkContainer.tsx`

- [ ] **Step 1: Implement the main container that ties everything together**

```tsx
// frontend/src/components/ChunkContainer.tsx
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { TimeChunk, Task } from '../types';
import { TaskBlock } from './TaskBlock';
import { DraggableDivider } from './DraggableDivider';
import { BalanceHeader } from './BalanceHeader';
import { calculateZeroSumTasks } from '../utils/dragMath';
import { theme } from '../styles/theme';

interface Props {
  initialChunk: TimeChunk;
  totalDurationMinutes: number;
}

export const ChunkContainer: React.FC<Props> = ({ initialChunk, totalDurationMinutes }) => {
  const [tasks, setTasks] = useState<Task[]>(initialChunk.tasks);
  const [limitedTaskIds, setLimitedTaskIds] = useState<Set<string>>(new Set());

  const currentTotal = tasks.reduce((sum, t) => sum + t.duration_minutes, 0);
  const unassigned = totalDurationMinutes - currentTotal;

  const handleDrag = (index: number, deltaMinutes: number) => {
    const updatedTasks = calculateZeroSumTasks(tasks, index, deltaMinutes);
    
    // Check if limits were hit
    const newLimitedIds = new Set<string>();
    if (updatedTasks[index].duration_minutes === tasks[index].duration_minutes && deltaMinutes !== 0) {
      // Top task hit its limit
      newLimitedIds.add(tasks[index].task_id);
    }
    if (updatedTasks[index + 1].duration_minutes === tasks[index + 1].duration_minutes && deltaMinutes !== 0) {
      // Bottom task hit its limit
      newLimitedIds.add(tasks[index + 1].task_id);
    }

    setTasks(updatedTasks);
    setLimitedTaskIds(newLimitedIds);
  };

  const handleDragEnd = () => {
    setLimitedTaskIds(new Set());
  };

  return (
    <View style={styles.safeArea}>
      <BalanceHeader unassignedMinutes={unassigned} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {tasks.map((task, index) => (
          <React.Fragment key={task.task_id}>
            <TaskBlock 
              {...task} 
              isLimitReached={limitedTaskIds.has(task.task_id)} 
            />
            {index < tasks.length - 1 && (
              <DraggableDivider 
                onDrag={(delta) => handleDrag(index, delta)}
                onDragEnd={handleDragEnd}
              />
            )}
          </React.Fragment>
        ))}
        {unassigned > 0 && (
          <View 
            style={[
              styles.gap, 
              { height: unassigned * theme.layout.minutesToHeight }
            ]} 
          />
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    paddingVertical: theme.spacing.m,
  },
  gap: {
    marginHorizontal: theme.spacing.m,
    backgroundColor: theme.colors.unallocated,
    borderRadius: 8,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: theme.colors.border,
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ChunkContainer.tsx
git commit -m "feat: implement ChunkContainer with drag integration"
```

---

### Task 7: Aesthetic Polish (Noise Background)

**Files:**
- Create: `frontend/src/components/NoiseBackground.tsx`

- [ ] **Step 1: Implement a subtle noise background overlay**

```tsx
// frontend/src/components/NoiseBackground.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * A simple component that provides a textured feel to the background.
 * In a real app, this would use a small tiled PNG or an SVG.
 * Here we'll use a semi-transparent overlay to simulate depth.
 */
export const NoiseBackground: React.FC = () => {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.noise} />
    </View>
  );
};

const styles = StyleSheet.create({
  noise: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    opacity: 0.02, // Extremely subtle
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/NoiseBackground.tsx
git commit -m "style: add subtle noise background component"
```
