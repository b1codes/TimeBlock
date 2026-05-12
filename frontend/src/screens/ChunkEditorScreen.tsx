import React, { useEffect, useMemo } from 'react';
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
import { NoiseBackground } from '../components/NoiseBackground';
import { ApiClient } from '../api/client';
import { theme } from '../styles/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ChunkEditor'>;

export const ChunkEditorScreen: React.FC<Props> = ({ route, navigation }) => {
  const { chunk } = route.params;
  const insets = useSafeAreaInsets();

  const apiClient = useMemo(
    () => new ApiClient('http://localhost:8080', chunk.user_id),
    [chunk.user_id],
  );

  useEffect(() => {
    return () => {
      apiClient.debouncedUpdateChunkTasks.flush();
    };
  }, [apiClient]);

  const totalDurationMinutes = useMemo(() => {
    try {
      const start = parseISO(chunk.start_time);
      const end = parseISO(chunk.end_time);
      const diff = Math.abs(differenceInMinutes(end, start));
      return isNaN(diff) || diff === 0 ? 60 : diff;
    } catch {
      return 60;
    }
  }, [chunk.start_time, chunk.end_time]);

  const start = useMemo(() => {
    try {
      return format(parseISO(chunk.start_time), 'HH:mm');
    } catch {
      return '';
    }
  }, [chunk.start_time]);

  const end = useMemo(() => {
    try {
      return format(parseISO(chunk.end_time), 'HH:mm');
    } catch {
      return '';
    }
  }, [chunk.end_time]);

  return (
    <View style={styles.container}>
      <NoiseBackground />

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={styles.titleBlock}>
          <Text style={styles.eyebrow} numberOfLines={1}>
            {start && end ? `${start} — ${end}` : 'SCHEDULE'}
          </Text>
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
        {/* Chevron: square corner rotated 45° = clean leftward < */}
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
