import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { TimeChunk, Task } from '../types';
import { ApiClient, ChunkUpdate } from '../api/client';

export const apiClient = new ApiClient('http://localhost:8080', 'user_1');

export const fetchChunksThunk = createAsyncThunk(
  'chunks/fetchAll',
  async () => {
    return await apiClient.getChunks();
  }
);

export const createChunkThunk = createAsyncThunk(
  'chunks/create',
  async (params: { title: string; start_time: string; end_time: string }) => {
    return await apiClient.createChunk(params);
  }
);

export const deleteChunkThunk = createAsyncThunk(
  'chunks/delete',
  async (chunkId: string) => {
    await apiClient.deleteChunk(chunkId);
    return chunkId;
  }
);

interface ChunksState {
  chunks: TimeChunk[];
  loading: boolean;
  error: string | null;
}

const initialState: ChunksState = {
  chunks: [],
  loading: false,
  error: null,
};

const chunksSlice = createSlice({
  name: 'chunks',
  initialState,
  reducers: {
    updateChunkLocal: (
      state,
      action: PayloadAction<{ chunkId: string; fields: ChunkUpdate }>
    ) => {
      const { chunkId, fields } = action.payload;
      const chunk = state.chunks.find((c) => c.chunk_id === chunkId);
      if (chunk) {
        if (fields.tasks !== undefined) chunk.tasks = fields.tasks;
        if (fields.start_time !== undefined) chunk.start_time = fields.start_time;
        if (fields.end_time !== undefined) chunk.end_time = fields.end_time;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchChunksThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchChunksThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.chunks = action.payload;
      })
      .addCase(fetchChunksThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch chunks';
      })
      .addCase(createChunkThunk.fulfilled, (state, action) => {
        state.chunks.push(action.payload);
      })
      .addCase(deleteChunkThunk.fulfilled, (state, action) => {
        state.chunks = state.chunks.filter((c) => c.chunk_id !== action.payload);
      });
  },
});

export const { updateChunkLocal } = chunksSlice.actions;
export default chunksSlice.reducer;
