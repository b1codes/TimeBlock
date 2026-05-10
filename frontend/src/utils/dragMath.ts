import { Task } from '../types';

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
