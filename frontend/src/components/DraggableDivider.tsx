import React from 'react';
import { StyleSheet, View } from 'react-native';
import { PanGestureHandler, PanGestureHandlerGestureEvent } from 'react-native-gesture-handler';
import Animated, { useAnimatedGestureHandler, runOnJS } from 'react-native-reanimated';
import { theme } from '../styles/theme';

interface Props {
  onDrag: (deltaMinutes: number) => void;
  onDragEnd: () => void;
}

export const DraggableDivider: React.FC<Props> = ({ onDrag, onDragEnd }) => {
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

  return (
    <PanGestureHandler onGestureEvent={gestureHandler}>
      <Animated.View style={styles.wrapper}>
        <View style={styles.handle} />
      </Animated.View>
    </PanGestureHandler>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  handle: {
    width: 40,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.border,
    borderWidth: 1,
    borderColor: '#CCC',
  },
});
