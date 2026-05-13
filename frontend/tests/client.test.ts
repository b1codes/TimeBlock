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
    
    const tasks1: Task[] = [{ task_id: '71061497-c5db-4507-9062-8b752cde7391', title: 'A', duration_minutes: 20, min_duration: 10 }];
    const tasks2: Task[] = [{ task_id: '71061497-c5db-4507-9062-8b752cde7391', title: 'A', duration_minutes: 30, min_duration: 10 }];
    
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

  it('should fetch chunks', async () => {
    const client = new ApiClient('https://api.example.com', 'user123');
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([{ chunk_id: '1' }]),
    });

    const chunks = await client.getChunks();
    expect(chunks).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/chunks', expect.anything());
  });

  it('should create chunk', async () => {
    const client = new ApiClient('https://api.example.com', 'user123');
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ chunk_id: 'new' }),
    });

    const chunk = await client.createChunk({ title: 'New', start_time: '...', end_time: '...' });
    expect(chunk.chunk_id).toBe('new');
    expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/chunks', expect.objectContaining({
      method: 'POST',
    }));
  });

  it('should delete chunk', async () => {
    const client = new ApiClient('https://api.example.com', 'user123');
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
    });

    await client.deleteChunk('1');
    expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/chunks/1', expect.objectContaining({
      method: 'DELETE',
    }));
  });
});

describe('ApiClient.debouncedUpdateChunk', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  it('should debounce a partial chunk update (times only) and send only the provided fields', () => {
    const client = new ApiClient('https://api.example.com', 'user123');

    client.debouncedUpdateChunk('chunk1', {
      start_time: '2023-01-01T06:30:00Z',
      end_time: '2023-01-01T08:00:00Z',
    });

    jest.advanceTimersByTime(750);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const callArgs = (global.fetch as jest.Mock).mock.calls[0];
    expect(callArgs[0]).toBe('https://api.example.com/chunks/chunk1/');
    expect(callArgs[1].method).toBe('PATCH');

    const body = JSON.parse(callArgs[1].body);
    expect(body.start_time).toBe('2023-01-01T06:30:00Z');
    expect(body.end_time).toBe('2023-01-01T08:00:00Z');
    expect(body.tasks).toBeUndefined();
  });

  it('should debounce a tasks-only update through the new generic API', () => {
    const client = new ApiClient('https://api.example.com', 'user123');

    const tasks: Task[] = [
      { task_id: 'a', title: 'A', duration_minutes: 20, min_duration: 10 },
    ];

    client.debouncedUpdateChunk('chunk1', { tasks });
    jest.advanceTimersByTime(750);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.tasks[0].title).toBe('A');
    expect(body.start_time).toBeUndefined();
  });
});
