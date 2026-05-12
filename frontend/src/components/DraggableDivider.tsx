import React from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import { PanGestureHandler, PanGestureHandlerGestureEvent } from 'react-native-gesture-handler';
import Animated, { 
  useAnimatedGestureHandler, 
  runOnJS,
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';
import { theme } from '../styles/theme';

interface Props {
  onDrag: (deltaMinutes: number) => void;
  onDragEnd: () => void;
  bufferDuration?: number;
  onPress?: () => void;
}

export const DraggableDivider: React.FC<Props> = ({ onDrag, onDragEnd, bufferDuration = 0, onPress }) => {
  const isDragging = useSharedValue(0);
  
  const gestureHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent, { startY: number }>({
    onStart: (_, ctx) => {
      ctx.startY = 0;
      isDragging.value = withTiming(1, { duration: 100 });
    },
    onActive: (event, ctx) => {
      const deltaY = event.translationY - ctx.startY;
      const snapPx = theme.layout.snapIncrement * theme.layout.minutesToHeight;
      if (Math.abs(deltaY) >= snapPx) {
        const snapDelta = Math.round(deltaY / snapPx) * theme.layout.snapIncrement;
        runOnJS(onDrag)(snapDelta);
        ctx.startY = event.translationY;
      }
    },
    onEnd: () => {
      isDragging.value = withTiming(0, { duration: 200 });
      runOnJS(onDragEnd)();
    },
  });

  const animatedHandleStyle = useAnimatedStyle(() => ({
    backgroundColor: isDragging.value 
      ? theme.colors.thermal.core 
      : theme.colors.glass.highlight,
    transform: [
      { scaleX: withSpring(isDragging.value ? 1.5 : 1, theme.physics.spring) },
      { scaleY: withSpring(isDragging.value ? 1.2 : 1, theme.physics.spring) }
    ],
    opacity: isDragging.value ? 1 : 0.6,
  }));

  const isBuffer = bufferDuration > 0;
  const height = isBuffer ? (bufferDuration * theme.layout.minutesToHeight) : 32;

  return (
    <Animated.View>
      <PanGestureHandler onGestureEvent={gestureHandler}>
        <Animated.View style={[
          styles.wrapper, 
          { height },
          isBuffer && styles.bufferWrapper
        ]}>
          <Pressable onPress={onPress} style={StyleSheet.absoluteFill}>
            <View style={styles.hitTarget}>
              <Animated.View style={[styles.handle, animatedHandleStyle]} />
              {isBuffer && (
                <Text style={styles.bufferText}>BUFFER {bufferDuration}M</Text>
              )}
            </View>
          </Pressable>
        </Animated.View>
      </PanGestureHandler>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  hitTarget: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bufferWrapper: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginHorizontal: theme.spacing.m,
  },
  handle: {
    width: 60,
    height: 2,
    borderRadius: 1,
    backgroundColor: theme.colors.glass.highlight,
  },
  bufferText: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 10,
    letterSpacing: 1.5,
    color: theme.colors.text,
    opacity: 0.4,
    marginTop: 8,
  },
});
