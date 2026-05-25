import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, Pressable, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { differenceInMinutes, parseISO, format } from 'date-fns';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

import { RootStackParamList } from '../navigation/types';
import { ChunkContainer } from '../components/ChunkContainer';
import { EditTimesModal } from '../components/EditTimesModal';
import { NoiseBackground } from '../components/NoiseBackground';
import { Task } from '../types';
import { theme } from '../styles/theme';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { apiClient, updateChunkLocal } from '../store/chunksSlice';

type Props = NativeStackScreenProps<RootStackParamList, 'ChunkEditor'>;

export const ChunkEditorScreen: React.FC<Props> = ({ route, navigation }) => {
  const { chunkId } = route.params;
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();

  const chunk = useAppSelector((state) =>
    state.chunks.chunks.find((c) => c.chunk_id === chunkId)
  );

  const [editTimesVisible, setEditTimesVisible] = useState(false);

  const eyebrowScale = useSharedValue(1);
  const eyebrowAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: eyebrowScale.value }],
  }));

  useEffect(() => {
    if (!chunk) {
      navigation.goBack();
    }
  }, [chunk, navigation]);

  useEffect(() => {
    return () => {
      apiClient.debouncedUpdateChunk.flush();
    };
  }, []);

  if (!chunk) {
    return null;
  }

  const startTime = chunk.start_time;
  const endTime = chunk.end_time;
  const tasks = chunk.tasks || [];

  const totalDurationMinutes = useMemo(() => {
    try {
      const start = parseISO(startTime);
      const end = parseISO(endTime);
      const diff = differenceInMinutes(end, start);
      if (isNaN(diff)) return 60;
      if (diff <= 0) {
        console.error('ChunkEditorScreen: end_time is not after start_time', { startTime, endTime });
        return 60;
      }
      return diff;
    } catch {
      return 60;
    }
  }, [startTime, endTime]);

  const startLabel = useMemo(() => {
    try {
      return format(parseISO(startTime), 'HH:mm');
    } catch {
      return '';
    }
  }, [startTime]);

  const endLabel = useMemo(() => {
    try {
      return format(parseISO(endTime), 'HH:mm');
    } catch {
      return '';
    }
  }, [endTime]);

  const currentTotalMinutes = useMemo(
    () =>
      tasks.reduce(
        (sum, t) => sum + (t.duration_minutes || 0) + (t.buffer_after_minutes || 0),
        0,
      ),
    [tasks],
  );

  const handleTimesCommit = (next: { start_time: string; end_time: string }) => {
    dispatch(updateChunkLocal({ chunkId: chunk.chunk_id, fields: next }));
    apiClient.debouncedUpdateChunk(chunk.chunk_id, next);
    setEditTimesVisible(false);
  };

  return (
    <View style={styles.container}>
      <NoiseBackground />

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={styles.titleBlock}>
          <Animated.View style={eyebrowAnimStyle}>
            <Pressable
              onPress={() => setEditTimesVisible(true)}
              onPressIn={() => {
                eyebrowScale.value = withSpring(0.93, theme.physics.spring);
              }}
              onPressOut={() => {
                eyebrowScale.value = withSpring(1, theme.physics.spring);
              }}
              hitSlop={{ top: 16, bottom: 16, left: 8, right: 8 }}
              disabled={!startLabel || !endLabel}
            >
              <Text style={styles.eyebrow} numberOfLines={1}>
                {startLabel && endLabel ? `${startLabel} — ${endLabel}` : 'SCHEDULE'}
              </Text>
            </Pressable>
          </Animated.View>
          <Text style={styles.title} numberOfLines={1}>
            {chunk.title}
          </Text>
        </View>
        <View style={styles.topBarSpacer} />
      </View>

      <ChunkContainer
        initialChunk={chunk}
        totalDurationMinutes={totalDurationMinutes}
        apiClient={apiClient}
        tasks={tasks}
        onTasksChange={(updatedTasks) => {
          dispatch(updateChunkLocal({ chunkId: chunk.chunk_id, fields: { tasks: updatedTasks } }));
        }}
      />

      <EditTimesModal
        visible={editTimesVisible}
        startTime={startTime}
        endTime={endTime}
        currentTotalMinutes={currentTotalMinutes}
        onClose={() => setEditTimesVisible(false)}
        onSubmit={handleTimesCommit}
      />
    </View>
  );
};

const BackButton: React.FC<{ onPress: () => void }> = ({ onPress }) => {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.backOuter, animatedStyle]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          scale.value = withSpring(0.9, theme.physics.spring);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, theme.physics.spring);
        }}
        hitSlop={12}
        style={styles.backPressable}
      >
        <View style={styles.chevron} />
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.m,
    paddingBottom: 8,
  },
  backOuter: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  backPressable: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.glass.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  chevron: {
    width: 9,
    height: 9,
    marginLeft: 3,
    borderLeftWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: theme.colors.text,
    transform: [{ rotate: '45deg' }],
  },
  titleBlock: {
    flex: 1,
    paddingHorizontal: theme.spacing.m,
  },
  eyebrow: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: theme.typography.caption.fontSize,
    letterSpacing: theme.typography.caption.letterSpacing,
    color: theme.colors.thermal.corona,
  },
  title: {
    fontFamily: theme.typography.h1.fontFamily,
    fontSize: 18,
    letterSpacing: 1.2,
    color: theme.colors.text,
    marginTop: 2,
  },
  topBarSpacer: {
    width: 40,
  },
});
