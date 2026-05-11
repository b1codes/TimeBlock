import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { PanGestureHandler, PanGestureHandlerGestureEvent, TapGestureHandler, TapGestureHandlerGestureEvent, State } from 'react-native-gesture-handler';
import Animated, { useAnimatedGestureHandler, runOnJS } from 'react-native-reanimated';
import { theme } from '../styles/theme';

interface Props {
  onDrag: (deltaMinutes: number) => void;
  onDragEnd: () => void;
  bufferDuration?: number;
  onPress?: () => void;
}

export const DraggableDivider: React.FC<Props> = ({ onDrag, onDragEnd, bufferDuration = 0, onPress }) => {
  const gestureHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent, { startY: number }>({
    onStart: (_, ctx) => {
      ctx.startY = 0;
    },
    onActive: (event, ctx) => {
      const deltaY = event.translationY - ctx.startY;
      // We only want to signal changes that cross a 5-minute snap boundary
      const snapPx = theme.layout.snapIncrement * theme.layout.minutesToHeight;
      if (Math.abs(deltaY) >= snapPx) {
        const snapDelta = Math.round(deltaY / snapPx) * theme.layout.snapIncrement;
        runOnJS(onDrag)(snapDelta);
        ctx.startY = event.translationY;
      }
    },
    onEnd: () => {
      runOnJS(onDragEnd)();
    },
  });

  const handleTap = ({ nativeEvent }: TapGestureHandlerGestureEvent) => {
    if (nativeEvent.state === State.ACTIVE && onPress) {
      runOnJS(onPress)();
    }
  };

  const isBuffer = bufferDuration > 0;
  const height = isBuffer ? (bufferDuration * theme.layout.minutesToHeight) : 24;

  return (
    <TapGestureHandler onHandlerStateChange={handleTap}>
      <Animated.View>
        <PanGestureHandler onGestureEvent={gestureHandler}>
          <Animated.View style={[
            styles.wrapper, 
            { height },
            isBuffer && styles.bufferWrapper
          ]}>
            <View style={[styles.handle, isBuffer && styles.bufferHandle]} />
            {isBuffer && (
              <Text style={styles.bufferText}>Buffer ({bufferDuration}m)</Text>
            )}
          </Animated.View>
        </PanGestureHandler>
      </Animated.View>
    </TapGestureHandler>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    marginVertical: 4,
  },
  bufferWrapper: {
    backgroundColor: theme.colors.unallocated,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.border,
    marginHorizontal: theme.spacing.m,
  },
  handle: {
    width: 40,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.border,
    borderWidth: 1,
    borderColor: '#CCC',
  },
  bufferHandle: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
    opacity: 0.5,
    position: 'absolute',
    top: -3, // Offset slightly to sit on the edge
  },
  bufferText: {
    ...theme.typography.caption,
    color: theme.colors.text,
    opacity: 0.6,
    fontWeight: '600',
  },
});
