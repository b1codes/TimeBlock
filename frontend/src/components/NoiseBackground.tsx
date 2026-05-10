import React from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * A simple component that provides a textured feel to the background.
 * In a real app, this would use a small tiled PNG or an SVG.
 * Here we'll use a semi-transparent overlay to simulate depth.
 */
export const NoiseBackground: React.FC = () => {
  return (
    <View testID="noise-background" pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.noise} />
    </View>
  );
};

const styles = StyleSheet.create({
  noise: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    opacity: 0.02, // Extremely subtle
  },
});
