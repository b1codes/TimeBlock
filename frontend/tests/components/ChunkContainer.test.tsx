import React from 'react';
import { render } from '@testing-library/react-native';
import { ChunkContainer } from '../../src/components/ChunkContainer';
import { TimeChunk } from '../../src/types';

const MOCK_CHUNK: TimeChunk = {
  user_id: 'user_1',
  chunk_id: 'chunk_1',
  title: 'Morning Routine',
  start_time: '2023-10-27T07:00:00Z',
  end_time: '2023-10-27T09:00:00Z',
  is_template: false,
  tasks: [
    { task_id: 't1', title: 'Task 1', duration_minutes: 30, min_duration: 10 },
    { task_id: 't2', title: 'Task 2', duration_minutes: 30, min_duration: 10 },
  ],
};

describe('ChunkContainer', () => {
  it('renders tasks and BalanceHeader', () => {
    const { getByText } = render(
      <ChunkContainer initialChunk={MOCK_CHUNK} totalDurationMinutes={120} />
    );

    expect(getByText('Task 1')).toBeTruthy();
    expect(getByText('Task 2')).toBeTruthy();
    expect(getByText('Unassigned: 60m')).toBeTruthy();
  });

  it('calculates unassigned time correctly', () => {
    const { getByText } = render(
      <ChunkContainer initialChunk={MOCK_CHUNK} totalDurationMinutes={100} />
    );
    expect(getByText('Unassigned: 40m')).toBeTruthy();
  });
});
