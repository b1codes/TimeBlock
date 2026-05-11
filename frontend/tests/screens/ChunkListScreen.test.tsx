import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ChunkListScreen } from '../../src/screens/ChunkListScreen';
import { ApiClient } from '../../src/api/client';
import { NavigationContainer } from '@react-navigation/native';

// Mock ApiClient
jest.mock('../../src/api/client');

const MOCK_CHUNKS = [
  {
    chunk_id: '1',
    title: 'Test Chunk',
    start_time: '2023-10-27T07:00:00Z',
    end_time: '2023-10-27T09:00:00Z',
    tasks: [],
    user_id: 'user_1',
    is_template: false,
  }
];

describe('ChunkListScreen', () => {
  beforeEach(() => {
    (ApiClient as jest.Mock).mockImplementation(() => ({
      getChunks: jest.fn().mockResolvedValue(MOCK_CHUNKS),
      createChunk: jest.fn().mockResolvedValue({ ...MOCK_CHUNKS[0], chunk_id: '2', title: 'New Chunk' }),
      deleteChunk: jest.fn().mockResolvedValue({}),
    }));
  });

  it('renders chunks from API', async () => {
    const { getByText } = render(
      <NavigationContainer>
        <ChunkListScreen navigation={{} as any} route={{} as any} />
      </NavigationContainer>
    );

    await waitFor(() => {
      expect(getByText('Test Chunk')).toBeTruthy();
    });
  });

  it('opens creation modal when FAB is pressed', async () => {
    const { getByText } = render(
      <NavigationContainer>
        <ChunkListScreen navigation={{} as any} route={{} as any} />
      </NavigationContainer>
    );

    fireEvent.press(getByText('+'));
    expect(getByText('Create Schedule')).toBeTruthy();
  });
});
