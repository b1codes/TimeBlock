import { configureStore } from '@reduxjs/toolkit';
import chunksReducer from './chunksSlice';

export const setupStore = (preloadedState?: any) => {
  return configureStore({
    reducer: {
      chunks: chunksReducer,
    },
    preloadedState,
  });
};

export const store = setupStore();

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export type AppStore = ReturnType<typeof setupStore>;

