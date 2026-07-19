import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, AccessibilityInfo } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../styles/theme';

interface Props {
  unassignedMinutes: number;
}

export const BalanceHeader: React.FC<Props> = ({ unassignedMinutes }) => {
  const insets = useSafeAreaInsets();
  const breath = useSharedValue(0.6);
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);

  useEffect(() => {
    // Check initial state
    if (AccessibilityInfo.isReduceMotionEnabled) {
      const promise = AccessibilityInfo.isReduceMotionEnabled();
      if (promise && typeof promise.then === 'function') {
        promise.then((enabled) => {
          setReduceMotionEnabled(enabled);
        }).catch(() => {});
      }
    }

    // Listen for changes
    let subscription: any;
    if (AccessibilityInfo.addEventListener) {
      subscription = AccessibilityInfo.addEventListener(
        'reduceMotionChanged',
        (enabled) => {
          setReduceMotionEnabled(enabled);
        }
      );
    }

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, []);

  useEffect(() => {
    if (reduceMotionEnabled) {
      // Per DESIGN.md: static at full opacity
      breath.value = 1.0;
    } else {
      breath.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1800, easing: Easing.bezier(0.23, 1, 0.32, 1) }),
          withTiming(0.55, { duration: 1800, easing: Easing.bezier(0.23, 1, 0.32, 1) }),
        ),
        -1,
        false,
      );
    }
  }, [breath, reduceMotionEnabled]);

  const hairlineStyle = useAnimatedStyle(() => ({
    opacity: breath.value,
  }));

  return (
    <View style={styles.outer}>
      <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
      {/* Bottom thermal bleed — radiates heat at the seam */}
      <LinearGradient
        colors={['transparent', theme.colors.thermal.bleed]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View
        style={[styles.container, { paddingTop: insets.top + 12 }]}
        accessibilityRole="header"
        accessibilityLabel={`Unassigned time: ${unassignedMinutes} minutes`}
      >
        <View style={styles.row}>
          <View style={styles.statusDot} />
          <Text style={styles.eyebrow}>UNASSIGNED TIME</Text>
        </View>

        <View style={styles.readout}>
          <Text style={styles.numeral}>{unassignedMinutes}</Text>
          <Text style={styles.unit}>M</Text>
        </View>
      </View>

      {/* Breathing thermal hairline at the bottom — the "live signal" */}
      <Animated.View style={[styles.hairlineWrap, hairlineStyle]} pointerEvents="none">
        <LinearGradient
          colors={[
            'transparent',
            theme.colors.thermal.core,
            theme.colors.thermal.corona,
            'transparent',
          ]}
          locations={[0, 0.42, 0.58, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.hairline}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  outer: {
    overflow: 'hidden',
    zIndex: 200,
  },
  container: {
    paddingHorizontal: theme.spacing.l,
    paddingBottom: theme.spacing.s,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.thermal.core,
    shadowColor: theme.colors.thermal.core,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  eyebrow: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: theme.typography.caption.fontSize,
    letterSpacing: theme.typography.caption.letterSpacing,
    color: theme.colors.textSecondary,
  },
  readout: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 2,
  },
  numeral: {
    fontFamily: theme.typography.h1.fontFamily,
    fontSize: 32,
    letterSpacing: -1,
    color: theme.colors.text,
    lineHeight: 36,
  },
  unit: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 12,
    letterSpacing: 3,
    color: theme.colors.thermal.corona,
    marginLeft: 6,
  },
  hairlineWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 1,
  },
  hairline: {
    width: '100%',
    height: '100%',
  },
});
