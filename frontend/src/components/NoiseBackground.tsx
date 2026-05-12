import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * High-fidelity background for LLC Technical Luxury standards.
 * Implements the deep atmosphere and glass base.
 */
export const NoiseBackground: React.FC = () => {
  return (
    <View testID="noise-background" pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* Deep Space Base */}
      <View style={styles.base} />
      
      {/* Refractive Atmosphere */}
      <LinearGradient
        colors={['#0A0A0A', '#050505', '#000000']}
        style={StyleSheet.absoluteFill}
      />

      {/* Subtle Noise Texture Simulation */}
      <View style={styles.noiseOverlay} />

      {/* Peripheral Light bleed */}
      <View style={styles.glow} />
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#050505',
  },
  noiseOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    opacity: 0.03,
  },
  glow: {
    position: 'absolute',
    top: -100,
    left: -100,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(13, 71, 161, 0.05)', // Subtle primary bleed
    opacity: 0.5,
  }
});
