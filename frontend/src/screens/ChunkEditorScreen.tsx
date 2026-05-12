import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { ChunkContainer } from '../components/ChunkContainer';
import { NoiseBackground } from '../components/NoiseBackground';
import { ApiClient } from '../api/client';
import { differenceInMinutes, parseISO } from 'date-fns';

type Props = NativeStackScreenProps<RootStackParamList, 'ChunkEditor'>;

export const ChunkEditorScreen: React.FC<Props> = ({ route }) => {
  const { chunk } = route.params;

  const apiClient = useMemo(() => new ApiClient('http://localhost:8080', chunk.user_id), [chunk.user_id]);

  const totalDurationMinutes = useMemo(() => {
    try {
      const start = parseISO(chunk.start_time);
      const end = parseISO(chunk.end_time);
      const diff = Math.abs(differenceInMinutes(end, start));
      return isNaN(diff) || diff === 0 ? 60 : diff;
    } catch {
      return 60; // Fallback to 1 hour
    }
  }, [chunk.start_time, chunk.end_time]);

  return (
    <View style={styles.container}>
      <NoiseBackground />
      <ChunkContainer 
        initialChunk={chunk}
        totalDurationMinutes={totalDurationMinutes}
        apiClient={apiClient}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
