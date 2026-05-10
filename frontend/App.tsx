import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ChunkContainer } from './src/components/ChunkContainer';
import { NoiseBackground } from './src/components/NoiseBackground';
import { TimeChunk } from './src/types';
import { ApiClient } from './src/api/client';

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
  const apiClient = useMemo(() => new ApiClient('http://localhost:8000', 'user_1'), []);

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.inner}>
        <ChunkContainer 
          initialChunk={MOCK_CHUNK}
          totalDurationMinutes={120} // 2 hours
          apiClient={apiClient}
        />
        <NoiseBackground />
      </View>
      <StatusBar style="auto" />
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
    paddingTop: 40, // Space for status bar on some devices
  }
});

export default App;
