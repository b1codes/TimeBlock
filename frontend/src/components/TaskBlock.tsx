import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { 
  useAnimatedStyle, 
  withTiming, 
  useSharedValue,
  withSequence,
  interpolateColor
} from 'react-native-reanimated';
import { theme } from '../styles/theme';
import { Task } from '../types';

interface Props extends Task {
  isLimitReached?: boolean;
  onTitleChange?: (newTitle: string) => void;
}

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

export const TaskBlock: React.FC<Props> = ({ 
  task_id, 
  title, 
  duration_minutes, 
  isLimitReached,
  onTitleChange 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localTitle, setLocalTitle] = useState(title);
  
  const excitement = useSharedValue(0);

  const height = duration_minutes * theme.layout.minutesToHeight;

  const handleBlur = () => {
    setIsEditing(false);
    if (localTitle !== title && onTitleChange) {
      onTitleChange(localTitle);
    }
  };

  const handlePressIn = () => {
    excitement.value = withTiming(1, { duration: 50 });
  };

  const handlePressOut = () => {
    excitement.value = withTiming(0, { duration: 300 });
  };

  const animatedGlowStyle = useAnimatedStyle(() => ({
    opacity: excitement.value,
    transform: [{ scale: 1 + excitement.value * 0.05 }],
  }));

  const animatedContainerStyle = useAnimatedStyle(() => ({
    borderColor: isLimitReached 
      ? theme.colors.error 
      : interpolateColor(
          excitement.value,
          [0, 1],
          [theme.colors.glass.border, theme.colors.thermal.core]
        ),
    borderWidth: isLimitReached ? 2 : 1,
  }));

  return (
    <View style={[styles.outer, { height }]}>
      <Pressable 
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onLongPress={() => setIsEditing(true)}
        style={styles.pressable}
      >
        <Animated.View style={[styles.container, animatedContainerStyle, { height }]}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill}>
            <LinearGradient
              colors={['rgba(255,255,255,0.05)', 'transparent']}
              style={StyleSheet.absoluteFill}
            />
          </BlurView>

          {/* Thermal Glow Layer */}
          <Animated.View style={[StyleSheet.absoluteFill, animatedGlowStyle]}>
             <LinearGradient
              colors={['rgba(255, 59, 48, 0.2)', 'transparent']}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

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
              />
            ) : (
              <Text style={styles.title}>{title}</Text>
            )}
            <Text style={styles.duration}>{duration_minutes}m</Text>
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  outer: {
    marginHorizontal: theme.spacing.m,
    marginVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
    ...theme.shadows.lifted,
  },
  pressable: {
    flex: 1,
  },
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: theme.colors.glass.base,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    zIndex: 10,
    alignItems: 'center',
  },
  title: {
    fontFamily: theme.typography.h2.fontFamily,
    fontSize: theme.typography.h2.fontSize,
    color: theme.colors.text,
    textAlign: 'center',
    minWidth: 100,
  },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.thermal.core,
  },
  duration: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: theme.typography.caption.fontSize,
    color: theme.colors.textSecondary,
    marginTop: 2,
  }
});
