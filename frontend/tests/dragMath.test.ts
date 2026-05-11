import { calculateZeroSumTasks, toggleBuffer } from '../src/utils/dragMath';
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

  it('should not clone tasks that are not affected', () => {
    const tasks: Task[] = [
      { task_id: '1', title: 'A', duration_minutes: 30, min_duration: 10 },
      { task_id: '2', title: 'B', duration_minutes: 30, min_duration: 10 },
      { task_id: '3', title: 'C', duration_minutes: 30, min_duration: 10 }
    ];
    const result = calculateZeroSumTasks(tasks, 0, 5);
    expect(result).not.toBe(tasks);
    expect(result[2]).toBe(tasks[2]); // Task C should be the same object reference
    expect(result[0]).not.toBe(tasks[0]);
    expect(result[1]).not.toBe(tasks[1]);
  });
});

describe('toggleBuffer', () => {
  it('should add a 5-minute buffer and reduce durations of adjacent tasks', () => {
    const tasks: Task[] = [
      { task_id: '1', title: 'A', duration_minutes: 30, min_duration: 10 },
      { task_id: '2', title: 'B', duration_minutes: 30, min_duration: 10 }
    ];
    const result = toggleBuffer(tasks, 0);
    expect(result[0].buffer_after_minutes).toBe(5);
    // 5 minutes taken from A because it had enough.
    expect(result[0].duration_minutes).toBe(25);
    expect(result[1].duration_minutes).toBe(30);
  });

  it('should take from bottom task if top task is at min_duration', () => {
    const tasks: Task[] = [
      { task_id: '1', title: 'A', duration_minutes: 10, min_duration: 10 },
      { task_id: '2', title: 'B', duration_minutes: 30, min_duration: 10 }
    ];
    const result = toggleBuffer(tasks, 0);
    expect(result[0].buffer_after_minutes).toBe(5);
    expect(result[0].duration_minutes).toBe(10);
    expect(result[1].duration_minutes).toBe(25);
  });

  it('should remove a buffer and return time to the top task', () => {
    const tasks: Task[] = [
      { task_id: '1', title: 'A', duration_minutes: 25, min_duration: 10, buffer_after_minutes: 5 },
      { task_id: '2', title: 'B', duration_minutes: 30, min_duration: 10 }
    ];
    const result = toggleBuffer(tasks, 0);
    expect(result[0].buffer_after_minutes).toBe(0);
    expect(result[0].duration_minutes).toBe(30);
    expect(result[1].duration_minutes).toBe(30);
  });
});
