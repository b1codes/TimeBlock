import { configureStore, combineReducers } from '@reduxjs/toolkit';
import chunksReducer from './chunksSlice';

const rootReducer = combineReducers({
  chunks: chunksReducer,
});

export const setupStore = (preloadedState?: any) => {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
  });
};

export const store = setupStore();

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export type AppStore = ReturnType<typeof setupStore>;

