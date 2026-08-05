import React, { useEffect, useState } from 'react';
import { StyleSheet, ViewStyle, StyleProp, AccessibilityInfo } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
  interpolateColor,
} from 'react-native-reanimated';
import { theme } from '../styles/theme';

export const CHROMATIC_PULSE_DURATION_MS = 3200;
// Easing.bezier(0.45, 0, 0.55, 1) represents CHROMATIC_EASE per llc-standards
export const CHROMATIC_EASE = Easing.bezier(0.45, 0, 0.55, 1);

export interface ChromaticPulseProps {
  /** Consumer app theme colors in cycle order. Min 2 colors. */
  colors?: string[];
  /** Duration of one full loop in ms. Default 3200ms. */
  durationMs?: number;
  /** Style for outer container. */
  style?: StyleProp<ViewStyle>;
  /** Optional children if container wraps content. */
  children?: React.ReactNode;
}

const DEFAULT_PALETTE = [
  theme.colors.thermal.core,
  theme.colors.thermal.corona,
  theme.colors.secondary,
  theme.colors.primary,
];

function ChromaticPulseBase({
  colors = DEFAULT_PALETTE,
  durationMs = CHROMATIC_PULSE_DURATION_MS,
  style,
  children,
}: ChromaticPulseProps) {
  const palette = colors.length >= 2 ? colors : DEFAULT_PALETTE;
  const progress = useSharedValue(0);
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);

  useEffect(() => {
    // Accessibility: Reduced Motion detection
    let isMounted = true;
    if (AccessibilityInfo.isReduceMotionEnabled) {
      const promise = AccessibilityInfo.isReduceMotionEnabled();
      if (promise && typeof promise.then === 'function') {
        promise.then((enabled) => {
          if (isMounted) setReduceMotionEnabled(enabled);
        }).catch(() => {});
      }
    }

    let subscription: any;
    if (AccessibilityInfo.addEventListener) {
      subscription = AccessibilityInfo.addEventListener(
        'reduceMotionChanged',
        (enabled) => {
          if (isMounted) setReduceMotionEnabled(enabled);
        }
      );
    }

    return () => {
      isMounted = false;
      if (subscription) {
        subscription.remove();
      }
    };
  }, []);

  useEffect(() => {
    if (reduceMotionEnabled) {
      // Freeze loop when reduced motion is enabled
      progress.value = 0;
    } else {
      progress.value = withRepeat(
        withTiming(1, {
          duration: durationMs,
          easing: CHROMATIC_EASE,
        }),
        -1,
        false
      );
    }
  }, [durationMs, progress, reduceMotionEnabled]);

  const animatedStyle = useAnimatedStyle(() => {
    if (reduceMotionEnabled) {
      return {
        backgroundColor: palette[0],
        opacity: 1,
      };
    }

    // Generate stop points for color interpolation looping back to first color
    const stopCount = palette.length;
    const inputRange = Array.from({ length: stopCount + 1 }, (_, i) => i / stopCount);
    const outputRange = [...palette, palette[0]];

    const backgroundColor = interpolateColor(progress.value, inputRange, outputRange);

    // Opacity modulates between 0.55 and 1.0 continuously
    const opacity = interpolate(
      progress.value,
      [0, 0.5, 1],
      [0.55, 1.0, 0.55]
    );

    return {
      backgroundColor,
      opacity,
    };
  });

  return (
    <Animated.View style={[styles.default, style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  default: {
    overflow: 'hidden',
  },
});

export const ChromaticPulse = React.memo(ChromaticPulseBase);
