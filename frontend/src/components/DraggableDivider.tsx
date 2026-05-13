import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { theme } from '../styles/theme';

interface Props {
  onDrag: (deltaMinutes: number) => void;
  onDragEnd: () => void;
  bufferDuration?: number;
  onPress?: () => void;
  variant?: 'between' | 'terminal';
}

const BETWEEN_HALO_COLORS = [
  'rgba(255, 59, 48, 0)',
  'rgba(255, 59, 48, 0.45)',
  'rgba(255, 149, 0, 0.18)',
  'rgba(255, 149, 0, 0)',
] as const;

const TERMINAL_HALO_COLORS = [
  'rgba(20, 90, 200, 0)',
  'rgba(30, 110, 220, 0.45)',
  'rgba(20, 90, 200, 0.18)',
  'rgba(20, 90, 200, 0)',
] as const;

export const DraggableDivider: React.FC<Props> = ({
  onDrag,
  onDragEnd,
  bufferDuration = 0,
  onPress,
  variant = 'between',
}) => {
  const isDragging = useSharedValue(0);
  const lastEmittedY = useSharedValue(0);
  const isTerminal = variant === 'terminal';

  const snapPx = theme.layout.snapIncrement * theme.layout.minutesToHeight;

  const panGesture = Gesture.Pan()
    .activeOffsetY([-4, 4])
    .onStart(() => {
      lastEmittedY.value = 0;
      isDragging.value = withTiming(1, { duration: 90, easing: theme.physics.quartOut });
    })
    .onUpdate((event) => {
      const deltaY = event.translationY - lastEmittedY.value;
      if (Math.abs(deltaY) >= snapPx) {
        const steps = Math.round(deltaY / snapPx);
        const snapDelta = steps * theme.layout.snapIncrement;
        runOnJS(onDrag)(snapDelta);
        lastEmittedY.value += steps * snapPx;
      }
    })
    .onEnd(() => {
      isDragging.value = withTiming(0, { duration: 280, easing: theme.physics.quartOut });
      runOnJS(onDragEnd)();
    });

  const tapGesture = Gesture.Tap()
    .maxDuration(250)
    .onEnd((_e, success) => {
      if (success && onPress) runOnJS(onPress)();
    });

  // Terminal variant is drag-only: no tap composition.
  const composed = isTerminal ? panGesture : Gesture.Exclusive(panGesture, tapGesture);

  const animatedBarStyle = useAnimatedStyle(() => ({
    opacity: interpolate(isDragging.value, [0, 1], [0.45, 1], Extrapolation.CLAMP),
    transform: [
      { scaleX: withSpring(1 + isDragging.value * 0.35, theme.physics.spring) },
      { scaleY: withSpring(1 + isDragging.value * 1.6, theme.physics.spring) },
    ],
  }));

  const animatedHaloStyle = useAnimatedStyle(() => ({
    opacity: isDragging.value,
    transform: [
      { scale: interpolate(isDragging.value, [0, 1], [0.6, 1.1], Extrapolation.CLAMP) },
    ],
  }));

  const animatedTrackStyle = useAnimatedStyle(() => ({
    opacity: interpolate(isDragging.value, [0, 1], [0.5, 0.15], Extrapolation.CLAMP),
  }));

  // Buffer is only meaningful for between-variant dividers.
  const isBuffer = !isTerminal && bufferDuration > 0;
  const height = isBuffer ? bufferDuration * theme.layout.minutesToHeight : 28;
  const haloColors = isTerminal ? TERMINAL_HALO_COLORS : BETWEEN_HALO_COLORS;

  return (
    <GestureDetector gesture={composed}>
      <View style={[styles.wrapper, { height }]}>
        {isBuffer && (
          <>
            <View style={styles.bufferFill} />
            <LinearGradient
              colors={[
                'rgba(255, 149, 0, 0.04)',
                'transparent',
                'rgba(255, 149, 0, 0.04)',
              ]}
              locations={[0, 0.5, 1]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
          </>
        )}

        <Animated.View style={[styles.track, styles.trackLeft, animatedTrackStyle]} />
        <Animated.View style={[styles.track, styles.trackRight, animatedTrackStyle]} />

        <Animated.View style={[styles.haloWrap, animatedHaloStyle]} pointerEvents="none">
          <LinearGradient
            colors={[...haloColors]}
            locations={[0, 0.4, 0.6, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <Animated.View style={[styles.handleWrap, animatedBarStyle]}>
          <LinearGradient
            colors={[
              theme.colors.glass.highlight,
              theme.colors.glass.specular,
              theme.colors.glass.highlight,
            ]}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.handle}
          />
        </Animated.View>

        {isBuffer && (
          <View style={styles.bufferLabelWrap} pointerEvents="none">
            <View style={styles.bufferDot} />
            <Text style={styles.bufferText}>BUFFER · {bufferDuration}M</Text>
          </View>
        )}
      </View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: theme.spacing.m,
    zIndex: 100,
  },
  bufferFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.018)',
    borderRadius: theme.layout.radius.s,
  },
  track: {
    position: 'absolute',
    top: '50%',
    height: 1,
    backgroundColor: theme.colors.glass.border,
  },
  trackLeft: { left: 0, right: '55%' },
  trackRight: { left: '55%', right: 0 },
  haloWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 32,
    justifyContent: 'center',
  },
  handleWrap: {
    width: 84,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  handle: { flex: 1, borderRadius: 2 },
  bufferLabelWrap: {
    position: 'absolute',
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bufferDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.thermal.corona,
    opacity: 0.7,
  },
  bufferText: {
    fontFamily: theme.typography.micro.fontFamily,
    fontSize: theme.typography.micro.fontSize,
    letterSpacing: theme.typography.micro.letterSpacing,
    color: theme.colors.textTertiary,
  },
});
