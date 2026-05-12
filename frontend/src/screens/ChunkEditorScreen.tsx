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
    const start = parseISO(chunk.start_time);
    const end = parseISO(chunk.end_time);
    return Math.abs(differenceInMinutes(end, start));
  }, [chunk.start_time, chunk.end_time]);

  return (
    <View style={styles.container}>
      <ChunkContainer 
        initialChunk={chunk}
        totalDurationMinutes={totalDurationMinutes}
        apiClient={apiClient}
      />
      <NoiseBackground />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
