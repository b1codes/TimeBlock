import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ChunkListScreen } from '../../src/screens/ChunkListScreen';
import { ApiClient } from '../../src/api/client';
import { NavigationContainer } from '@react-navigation/native';
import { Provider } from 'react-redux';
import { setupStore } from '../../src/store';
import { apiClient } from '../../src/store/chunksSlice';

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
  let testStore: any;

  beforeEach(() => {
    testStore = setupStore();
    jest.spyOn(apiClient, 'getChunks').mockResolvedValue(MOCK_CHUNKS);
    jest.spyOn(apiClient, 'createChunk').mockResolvedValue({ ...MOCK_CHUNKS[0], chunk_id: '2', title: 'New Chunk' });
    jest.spyOn(apiClient, 'deleteChunk').mockResolvedValue(undefined);
  });

  it('renders chunks from API', async () => {
    const { getByText } = render(
      <Provider store={testStore}>
        <NavigationContainer>
          <ChunkListScreen navigation={{} as any} route={{} as any} />
        </NavigationContainer>
      </Provider>
    );

    await waitFor(() => {
      expect(getByText('Test Chunk')).toBeTruthy();
    });
  });

  it('opens creation modal when FAB is pressed', async () => {
    const { getByText, getByTestId } = render(
      <Provider store={testStore}>
        <NavigationContainer>
          <ChunkListScreen navigation={{} as any} route={{} as any} />
        </NavigationContainer>
      </Provider>
    );

    fireEvent.press(getByTestId('thermal-fab'));
    expect(getByText('NEW SCHEDULE')).toBeTruthy();
  });
});
