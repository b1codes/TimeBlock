import { Task } from '../types';

/**
 * Calculates new durations for two adjacent tasks when a divider is dragged.
 * @param tasks The full list of tasks in the chunk.
 * @param topTaskIndex The index of the task directly above the dragged divider.
 * @param deltaMinutes The change in minutes (positive means divider moved down, expanding the top task).
 * @returns A new array of tasks with updated durations.
 */
export function calculateZeroSumTasks(tasks: Task[], topTaskIndex: number, deltaMinutes: number): Task[] {
  const topTaskOrig = tasks[topTaskIndex];
  const bottomTaskOrig = tasks[topTaskIndex + 1];
  
  if (!topTaskOrig || !bottomTaskOrig) {
    return tasks;
  }

  // Calculate the maximum allowed delta based on min_durations
  let actualDelta = deltaMinutes;

  if (deltaMinutes > 0) {
    // Divider moving down: top task grows, bottom task shrinks
    const maxShrink = bottomTaskOrig.duration_minutes - bottomTaskOrig.min_duration;
    if (actualDelta > maxShrink) {
      actualDelta = maxShrink;
    }
  } else {
    // Divider moving up: top task shrinks, bottom task grows
    // delta is negative here
    const maxShrink = topTaskOrig.duration_minutes - topTaskOrig.min_duration;
    if (Math.abs(actualDelta) > maxShrink) {
      actualDelta = -maxShrink;
    }
  }

  if (actualDelta === 0) {
    return tasks;
  }

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

/**
 * Toggles a 5-minute buffer after the task at the given index.
 * @param tasks The full list of tasks.
 * @param index The index of the task to toggle the buffer after.
 * @returns A new array of tasks.
 */
export function toggleBuffer(tasks: Task[], index: number): Task[] {
  const task = tasks[index];
  const nextTask = tasks[index + 1];
  if (!task || !nextTask) return tasks;

  const newTasks = [...tasks];
  const currentBuffer = task.buffer_after_minutes || 0;
  const isAdding = currentBuffer === 0;

  if (isAdding) {
    const BUFFER_SIZE = 5;
    // Try to take from top task first, then bottom task
    let takenFromTop = Math.min(BUFFER_SIZE, task.duration_minutes - task.min_duration);
    let remaining = BUFFER_SIZE - takenFromTop;
    let takenFromBottom = Math.min(remaining, nextTask.duration_minutes - nextTask.min_duration);
    
    if (takenFromTop + takenFromBottom < BUFFER_SIZE) {
      // Cannot add buffer, not enough time in adjacent tasks
      return tasks;
    }

    newTasks[index] = {
      ...task,
      duration_minutes: task.duration_minutes - takenFromTop,
      buffer_after_minutes: BUFFER_SIZE,
    };
    newTasks[index + 1] = {
      ...nextTask,
      duration_minutes: nextTask.duration_minutes - takenFromBottom,
    };
  } else {
    // Removing buffer: give time back to the task that had the buffer
    newTasks[index] = {
      ...task,
      duration_minutes: task.duration_minutes + currentBuffer,
      buffer_after_minutes: 0,
    };
  }

  return newTasks;
}

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

  let clampedDelta = deltaMinutes;
  if (deltaMinutes > 0) {
    if (clampedDelta > unassigned) clampedDelta = unassigned;
  } else if (deltaMinutes < 0) {
    const maxShrink = last.duration_minutes - last.min_duration;
    if (Math.abs(clampedDelta) > maxShrink) clampedDelta = -maxShrink;
  }

  if (clampedDelta === 0) return tasks;

  const newTasks = [...tasks];
  newTasks[lastIndex] = {
    ...last,
    duration_minutes: last.duration_minutes + clampedDelta,
  };
  return newTasks;
}
