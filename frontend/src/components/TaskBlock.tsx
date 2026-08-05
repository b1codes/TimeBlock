import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  interpolate,
  interpolateColor,
  Extrapolation,
} from 'react-native-reanimated';
import { theme } from '../styles/theme';
import { Task } from '../types';
import { GlassSurface } from './GlassSurface';

interface Props extends Task {
  isLimitReached?: boolean;
  onTitleChange?: (newTitle: string) => void;
}

const TaskBlockBase: React.FC<Props> = ({
  task_id,
  title,
  duration_minutes,
  isLimitReached,
  onTitleChange,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localTitle, setLocalTitle] = useState(title);

  useEffect(() => {
    if (!isEditing) setLocalTitle(title);
  }, [title, isEditing]);

  // Per interaction-physics.md: two-phase thermal event
  // Phase 1: Excitation — 50ms rapid expansion of thermal heat
  // Phase 2: Dissipation — 300ms cool/fade
  const excitement = useSharedValue(0);
  // Press-in scale, governed by the brand spring (180, 12, 1.2)
  const pressScale = useSharedValue(1);
  // Limit warning pulse — short, decisive
  const limitPulse = useSharedValue(0);

  // Minimum height set to 44 pt to comply with iOS HIG minimum touch targets
  const height = Math.max(duration_minutes * theme.layout.minutesToHeight, 44);

  useEffect(() => {
    if (isLimitReached) {
      limitPulse.value = withTiming(1, { duration: 60, easing: theme.physics.quartOut });
    } else {
      limitPulse.value = withTiming(0, { duration: 240, easing: theme.physics.quartOut });
    }
  }, [isLimitReached, limitPulse]);

  const handleBlur = () => {
    setIsEditing(false);
    if (localTitle !== title && onTitleChange) {
      onTitleChange(localTitle);
    }
  };

  const handlePressIn = () => {
    excitement.value = withTiming(1, {
      duration: theme.physics.thermal.excitation,
      easing: theme.physics.quartOut,
    });
    pressScale.value = withSpring(0.985, theme.physics.spring);
  };

  const handlePressOut = () => {
    excitement.value = withTiming(0, {
      duration: theme.physics.thermal.dissipation,
      easing: theme.physics.quartOut,
    });
    pressScale.value = withSpring(1, theme.physics.spring);
  };

  // Radial thermal glow — expands from the surface on press
  const animatedGlowStyle = useAnimatedStyle(() => ({
    opacity: excitement.value,
    transform: [
      { scale: interpolate(excitement.value, [0, 1], [0.85, 1.05], Extrapolation.CLAMP) },
    ],
  }));

  const animatedContainerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  // Limit warning — border flashes thermal
  const animatedLimitRingStyle = useAnimatedStyle(() => ({
    opacity: limitPulse.value,
    borderColor: interpolateColor(
      limitPulse.value,
      [0, 1],
      ['transparent', theme.colors.thermal.core],
    ),
  }));

  return (
    <Animated.View
      testID={`task-block-${task_id}`}
      style={[
        styles.outer,
        { height },
        animatedContainerStyle,
        isLimitReached && { borderColor: theme.colors.error, borderWidth: 1.5 }
      ]}
    >
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onLongPress={() => setIsEditing(true)}
        style={styles.pressable}
        accessibilityRole="button"
        accessibilityLabel={`${title}, duration ${duration_minutes} minutes.`}
        accessibilityHint="Double tap and hold to rename task."
      >
        <GlassSurface
          radius={theme.layout.radius.m}
          intensity={20}
          style={StyleSheet.absoluteFill}
        >
          {/* Radial thermal press-glow — additive build-up via stacked translucent gradients */}
          <Animated.View
            style={[StyleSheet.absoluteFill, animatedGlowStyle]}
            pointerEvents="none"
          >
            {/* Outer corona — warm wash */}
            <LinearGradient
              colors={[theme.colors.thermal.coronaSoft, 'transparent']}
              start={{ x: 0.5, y: 1 }}
              end={{ x: 0.5, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            {/* Inner core — concentrated thermal */}
            <View style={styles.glowCoreWrap}>
              <LinearGradient
                colors={[theme.colors.thermal.coreSoft, 'transparent']}
                start={{ x: 0.5, y: 1 }}
                end={{ x: 0.5, y: 0.3 }}
                style={StyleSheet.absoluteFill}
              />
            </View>
          </Animated.View>

          {/* Limit warning ring — thermal border flash */}
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              styles.limitRing,
              animatedLimitRingStyle,
            ]}
          />

          {/* Content */}
          <View style={styles.content}>
            {isEditing ? (
              <TextInput
                style={[styles.title, styles.input]}
                value={localTitle}
                onChangeText={setLocalTitle}
                onBlur={handleBlur}
                onSubmitEditing={handleBlur}
                autoFocus
                selectTextOnFocus
                placeholderTextColor="rgba(255,255,255,0.3)"
                accessibilityLabel="Task title edit field"
                accessibilityHint="Enter the new name for the task and press submit to save."
              />
            ) : (
              <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
                {title}
              </Text>
            )}
            <View style={styles.durationRow}>
              <Text style={styles.duration}>{duration_minutes}</Text>
              <Text style={styles.durationUnit}>M</Text>
            </View>
          </View>
        </GlassSurface>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  outer: {
    marginHorizontal: theme.spacing.m,
    marginVertical: 1.5,
    borderRadius: theme.layout.radius.m,
    ...theme.shadows.lifted,
  },
  pressable: {
    flex: 1,
  },
  glowCoreWrap: {
    position: 'absolute',
    left: '20%',
    right: '20%',
    top: '30%',
    bottom: 0,
  },
  limitRing: {
    borderRadius: theme.layout.radius.m,
    borderWidth: 1.5,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.l,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  title: {
    fontFamily: theme.typography.h2.fontFamily,
    fontSize: theme.typography.h2.fontSize,
    letterSpacing: theme.typography.h2.letterSpacing,
    color: theme.colors.text,
  },
  input: {
    borderBottomWidth: theme.layout.hairline,
    borderBottomColor: theme.colors.thermal.core,
    paddingVertical: 2,
    minWidth: 140,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: theme.spacing.xs,
  },
  duration: {
    fontFamily: theme.typography.h2.fontFamily,
    fontSize: 13,
    letterSpacing: 1.4,
    color: theme.colors.textSecondary,
  },
  durationUnit: {
    fontFamily: theme.typography.micro.fontFamily,
    fontSize: theme.typography.micro.fontSize,
    letterSpacing: theme.typography.micro.letterSpacing,
    color: theme.colors.textTertiary,
    marginLeft: 3,
  },
});

export const TaskBlock = React.memo(TaskBlockBase);
