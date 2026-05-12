import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../styles/theme';

/**
 * GlassSurface — the foundational LLC Technical Luxury material.
 *
 * Renders, bottom to top:
 *   1. BlurView (intensity 20) — true backdrop blur, brand standard
 *   2. Base translucent fill — glass.base
 *   3. Top→bottom inner highlight — simulates ambient light through the volume
 *   4. 1px specular hairline at the top edge — the "edge of cut glass" cue
 *   5. Hairline border on all sides for structural clarity
 *   6. Children
 *
 * This is what separates "blur + dark rectangle" from "glass."
 */

interface Props {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  intensity?: number;       // BlurView intensity, default 20 per brand
  tone?: 'neutral' | 'raised' | 'sunken';
  borderTone?: 'subtle' | 'strong';
}

export const GlassSurface: React.FC<Props> = ({
  children,
  style,
  radius = theme.layout.radius.m,
  intensity = 20,
  tone = 'neutral',
  borderTone = 'subtle',
}) => {
  const fill =
    tone === 'raised'
      ? theme.colors.glass.raised
      : tone === 'sunken'
      ? theme.colors.glass.sunken
      : theme.colors.glass.base;

  const border =
    borderTone === 'strong' ? theme.colors.glass.borderStrong : theme.colors.glass.border;

  return (
    <View style={[{ borderRadius: radius, overflow: 'hidden' }, style]}>
      {/* 1. True backdrop blur */}
      <BlurView
        intensity={intensity}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />

      {/* 2. Base fill */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: fill },
        ]}
      />

      {/* 3. Inner highlight — soft upper sheen */}
      <LinearGradient
        colors={[
          'rgba(255, 255, 255, 0.10)',
          'rgba(255, 255, 255, 0.02)',
          'rgba(0, 0, 0, 0.10)',
        ]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* 4. Top specular hairline — the brightest pixel on a glass edge */}
      <LinearGradient
        colors={[theme.colors.glass.specular, 'transparent']}
        locations={[0, 1]}
        style={styles.specular}
        pointerEvents="none"
      />

      {/* 5. Structural border */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: radius,
            borderWidth: theme.layout.hairline,
            borderColor: border,
          },
        ]}
      />

      {/* 6. Content */}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  specular: {
    position: 'absolute',
    top: 0,
    left: 8,
    right: 8,
    height: 1.5,
  },
});
