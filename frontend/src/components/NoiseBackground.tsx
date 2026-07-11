import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../styles/theme';

/**
 * Atmospheric backdrop for LLC Technical Luxury.
 *
 * The scene is not "black"; it's a deep-space environment lit by two
 * directional sources: a cool ambient (upper-left) and a warm thermal
 * bleed (lower-right), with a soft vignette to push the eye inward.
 *
 * This is the foundation that makes everything sitting on top of it
 * read as translucent glass — there must be light *behind* glass for
 * it to refract.
 */
export const NoiseBackground: React.FC = () => {
  const { width, height } = useWindowDimensions();

  const coolBleedStyle = {
    top: -height * 0.2,
    left: -width * 0.3,
    width: width * 1.1,
    height: height * 0.75,
    borderRadius: width,
  };

  const warmBleedStyle = {
    bottom: -height * 0.15,
    right: -width * 0.35,
    width: width * 1.1,
    height: height * 0.7,
    borderRadius: width,
  };

  return (
    <View testID="noise-background" pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* Deep base — slight blue-violet tilt, never pure black */}
      <View style={styles.base} />

      {/* Vertical atmospheric gradient — slightly lighter at top */}
      <LinearGradient
          colors={['#0B0B10', '#06060A', '#020205']}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
      />

      {/* Cool primary bleed — upper-left ambient */}
      <View style={[styles.coolBleed, coolBleedStyle]}>
        <LinearGradient
          colors={[theme.colors.cool.bleedStrong, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Warm thermal bleed — lower-right machine heat signature */}
      <View style={[styles.warmBleed, warmBleedStyle]}>
        <LinearGradient
          colors={[theme.colors.thermal.bleed, 'transparent']}
          start={{ x: 1, y: 1 }}
          end={{ x: 0, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Edge vignette — top */}
      <LinearGradient
        colors={['rgba(0,0,0,0.45)', 'transparent']}
        style={styles.vignetteTop}
      />

      {/* Edge vignette — bottom */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.55)']}
        style={styles.vignetteBottom}
      />

      {/* Subtle film grain — flat opacity overlay; cheap stand-in for noise */}
      <View style={styles.grain} />
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#04040A',
  },
  coolBleed: {
    position: 'absolute',
    overflow: 'hidden',
    opacity: 0.9,
  },
  warmBleed: {
    position: 'absolute',
    overflow: 'hidden',
    opacity: 0.85,
  },
  vignetteTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 180,
  },
  vignetteBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 240,
  },
  grain: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    opacity: 0.012,
  },
});
