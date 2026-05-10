import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  initialChunk?: any;
  totalDurationMinutes?: number;
}

export const ChunkContainer: React.FC<Props> = () => {
  return (
    <View style={styles.container}>
      <Text>ChunkContainer Placeholder</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
