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
