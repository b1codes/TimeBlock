import React from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ChunkContainer } from './components/ChunkContainer';
import { NoiseBackground } from './components/NoiseBackground';
import { TimeChunk } from './types';

const MOCK_CHUNK: TimeChunk = {
  user_id: 'user_1',
  chunk_id: 'chunk_1',
  title: 'Morning Routine',
  start_time: '2023-10-27T07:00:00Z',
  end_time: '2023-10-27T09:00:00Z',
  is_template: false,
  tasks: [
    { task_id: 't1', title: 'Wake up', duration_minutes: 15, min_duration: 5 },
    { task_id: 't2', title: 'Exercise', duration_minutes: 45, min_duration: 10 },
    { task_id: 't3', title: 'Breakfast', duration_minutes: 30, min_duration: 10 },
  ],
};

const App = () => {
  return (
    <GestureHandlerRootView style={styles.container}>
      <ChunkContainer 
        initialChunk={MOCK_CHUNK}
        totalDurationMinutes={120} // 2 hours
      />
      <NoiseBackground />
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
