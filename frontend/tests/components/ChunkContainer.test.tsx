import React from 'react';
import { render } from '@testing-library/react-native';
import { ChunkContainer } from '../../src/components/ChunkContainer';
import { TimeChunk } from '../../src/types';
import { ApiClient } from '../../src/api/client';

const MOCK_CHUNK: TimeChunk = {
  user_id: 'user_1',
  chunk_id: 'chunk_1',
  title: 'Morning Routine',
  start_time: '2023-10-27T07:00:00Z',
  end_time: '2023-10-27T09:00:00Z',
  is_template: false,
  tasks: [
    { task_id: '71061497-c5db-4507-9062-8b752cde7391', title: 'Task 1', duration_minutes: 30, min_duration: 10 },
    { task_id: '2205fada-bd45-4c3a-8963-ad99c5a7150a', title: 'Task 2', duration_minutes: 30, min_duration: 10 },
  ],
};

const mockApiClient = new ApiClient('http://localhost:8080', 'user_1');
const mockOnTasksChange = jest.fn();

describe('ChunkContainer', () => {
  it('renders tasks and BalanceHeader', () => {
    const { getByText, getAllByText } = render(
      <ChunkContainer 
        initialChunk={MOCK_CHUNK} 
        totalDurationMinutes={120} 
        apiClient={mockApiClient}
        tasks={MOCK_CHUNK.tasks}
        onTasksChange={mockOnTasksChange}
      />
    );

    expect(getByText('Task 1')).toBeTruthy();
    expect(getByText('Task 2')).toBeTruthy();
    // BalanceHeader shows numeral and unit separately
    expect(getByText('60')).toBeTruthy();
    expect(getAllByText('M').length).toBeGreaterThan(0);
  });

  it('calculates unassigned time correctly', () => {
    const { getByText } = render(
      <ChunkContainer 
        initialChunk={MOCK_CHUNK} 
        totalDurationMinutes={100} 
        apiClient={mockApiClient}
        tasks={MOCK_CHUNK.tasks}
        onTasksChange={mockOnTasksChange}
      />
    );
    expect(getByText('40')).toBeTruthy();
  });
});
