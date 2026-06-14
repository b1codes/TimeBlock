import chunksReducer, {
  updateChunkLocal,
  fetchChunksThunk,
  createChunkThunk,
  deleteChunkThunk,
} from '../../src/store/chunksSlice';
import { TimeChunk } from '../../src/types';

const MOCK_CHUNKS: TimeChunk[] = [
  {
    chunk_id: '1',
    title: 'Test Chunk',
    start_time: '2026-05-25T07:00:00Z',
    end_time: '2026-05-25T09:00:00Z',
    tasks: [
      { task_id: 't1', title: 'Task 1', duration_minutes: 30, min_duration: 10 }
    ],
    user_id: 'user_1',
    is_template: false,
  }
];

describe('chunksSlice', () => {
  it('should return the initial state', () => {
    expect(chunksReducer(undefined, { type: '@@INIT' })).toEqual({
      chunks: [],
      loading: false,
      error: null,
    });
  });

  it('should handle updateChunkLocal updating task list', () => {
    const initialState = {
      chunks: MOCK_CHUNKS,
      loading: false,
      error: null,
    };

    const newTasks = [
      { task_id: 't1', title: 'Updated Task 1', duration_minutes: 40, min_duration: 10 }
    ];

    const action = updateChunkLocal({
      chunkId: '1',
      fields: { tasks: newTasks }
    });

    const state = chunksReducer(initialState, action);
    expect(state.chunks[0].tasks).toEqual(newTasks);
  });

  it('should handle updateChunkLocal updating start/end times', () => {
    const initialState = {
      chunks: MOCK_CHUNKS,
      loading: false,
      error: null,
    };

    const action = updateChunkLocal({
      chunkId: '1',
      fields: {
        start_time: '2026-05-25T08:00:00Z',
        end_time: '2026-05-25T10:00:00Z'
      }
    });

    const state = chunksReducer(initialState, action);
    expect(state.chunks[0].start_time).toBe('2026-05-25T08:00:00Z');
    expect(state.chunks[0].end_time).toBe('2026-05-25T10:00:00Z');
  });

  it('should handle fetchChunksThunk.fulfilled', () => {
    const action = { type: fetchChunksThunk.fulfilled.type, payload: MOCK_CHUNKS };
    const state = chunksReducer(undefined, action);
    expect(state.loading).toBe(false);
    expect(state.chunks).toEqual(MOCK_CHUNKS);
  });

  it('should handle createChunkThunk.fulfilled', () => {
    const newChunk: TimeChunk = {
      chunk_id: '2',
      title: 'Created Chunk',
      start_time: '2026-05-25T10:00:00Z',
      end_time: '2026-05-25T11:00:00Z',
      tasks: [],
      user_id: 'user_1',
      is_template: false,
    };

    const action = { type: createChunkThunk.fulfilled.type, payload: newChunk };
    const state = chunksReducer(
      { chunks: MOCK_CHUNKS, loading: false, error: null },
      action
    );

    expect(state.chunks.length).toBe(2);
    expect(state.chunks[1]).toEqual(newChunk);
  });

  it('should handle deleteChunkThunk.fulfilled', () => {
    const action = { type: deleteChunkThunk.fulfilled.type, payload: '1' };
    const state = chunksReducer(
      { chunks: MOCK_CHUNKS, loading: false, error: null },
      action
    );

    expect(state.chunks.length).toBe(0);
  });
});
