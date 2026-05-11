import { Task, TimeChunk } from '../src/types';

describe('Types', () => {
  it('should allow constructing a valid Task object', () => {
    const task: Task = {
      task_id: '71061497-c5db-4507-9062-8b752cde7391',
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
