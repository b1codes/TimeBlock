import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Pressable,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  AccessibilityInfo,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Swipeable } from 'react-native-gesture-handler';
import { format, parseISO, addHours, startOfHour } from 'date-fns';

import { RootStackParamList } from '../navigation/types';
import { TimeChunk } from '../types';
import { theme } from '../styles/theme';
import { NoiseBackground } from '../components/NoiseBackground';
import { GlassSurface } from '../components/GlassSurface';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchChunksThunk, createChunkThunk, deleteChunkThunk } from '../store/chunksSlice';

type Props = NativeStackScreenProps<RootStackParamList, 'ChunkList'>;

export const ChunkListScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const { chunks, loading } = useAppSelector((state) => state.chunks);
  const [modalVisible, setModalVisible] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState('');
  const [startTime] = React.useState(
    format(startOfHour(new Date()), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
  );
  const [endTime] = React.useState(
    format(addHours(startOfHour(new Date()), 2), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
  );

  useEffect(() => {
    loadChunks();
  }, []);

  const loadChunks = async () => {
    try {
      await dispatch(fetchChunksThunk()).unwrap();
    } catch (error) {
      console.error('Failed to load chunks:', error);
      Alert.alert('Error', 'Failed to load your schedules.');
    }
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }
    try {
      const newChunk = await dispatch(
        createChunkThunk({
          title: newTitle,
          start_time: startTime,
          end_time: endTime,
        })
      ).unwrap();
      setModalVisible(false);
      setNewTitle('');
      navigation.navigate('ChunkEditor', { chunkId: newChunk.chunk_id });
    } catch (error) {
      Alert.alert('Error', 'Failed to create schedule');
    }
  };

  const handleDelete = async (chunkId: string) => {
    try {
      await dispatch(deleteChunkThunk(chunkId)).unwrap();
    } catch (error) {
      Alert.alert('Error', 'Failed to delete schedule');
    }
  };

  const renderRightActions = (chunkId: string) => (
    <Pressable
      style={styles.deleteAction}
      onPress={() => handleDelete(chunkId)}
      accessibilityRole="button"
      accessibilityLabel="Delete schedule"
    >
      <LinearGradient
        colors={['rgba(255, 59, 48, 0.85)', 'rgba(255, 59, 48, 0.65)']}
        style={StyleSheet.absoluteFill}
      />
      <Text style={styles.deleteActionText}>DELETE</Text>
    </Pressable>
  );

  const renderItem = ({ item }: { item: TimeChunk }) => (
    <View
      accessibilityActions={[{ name: 'delete', label: 'Delete schedule' }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'delete') {
          handleDelete(item.chunk_id);
        }
      }}
    >
      <Swipeable renderRightActions={() => renderRightActions(item.chunk_id)}>
        <ChunkCard
          chunk={item}
          onPress={() => navigation.navigate('ChunkEditor', { chunkId: item.chunk_id })}
        />
      </Swipeable>
    </View>
  );

  return (
    <View style={styles.container}>
      <NoiseBackground />

      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.l }]}>
        <View style={styles.headerRow}>
          <View style={styles.brandDot} />
          <Text style={styles.eyebrow}>TIMEBLOCK · PLANNING</Text>
        </View>
        <Text style={styles.headerTitle}>TIMEBLOCK</Text>
        <View style={styles.headerRule} />
      </View>

      <FlatList
        data={chunks}
        renderItem={renderItem}
        keyExtractor={(item) => item.chunk_id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 120 },
        ]}
        onRefresh={loadChunks}
        refreshing={loading}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>NO ACTIVE SCHEDULES</Text>
              <Text style={styles.emptySub}>
                Create a schedule to start planning.
              </Text>
            </View>
          ) : null
        }
      />

      <ThermalFab
        bottom={insets.bottom + theme.spacing.l}
        onPress={() => setModalVisible(true)}
      />

      <CreateScheduleModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={newTitle}
        setTitle={setNewTitle}
        onSubmit={handleCreate}
      />
    </View>
  );
};

// --- ChunkCard ---------------------------------------------------------------

const ChunkCard: React.FC<{ chunk: TimeChunk; onPress: () => void }> = ({
  chunk,
  onPress,
}) => {
  const press = useSharedValue(0);
  const start = parseISO(chunk.start_time);
  const end = parseISO(chunk.end_time);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(press.value, [0, 1], [1, 0.985]) },
    ],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: press.value * 0.7 }));

  return (
    <Animated.View style={[styles.cardOuter, animatedStyle]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          press.value = withTiming(1, {
            duration: theme.physics.thermal.excitation,
            easing: theme.physics.quartOut,
          });
        }}
        onPressOut={() => {
          press.value = withTiming(0, {
            duration: theme.physics.thermal.dissipation,
            easing: theme.physics.quartOut,
          });
        }}
        accessibilityRole="button"
        accessibilityLabel={`${chunk.title}, scheduled from ${format(start, 'EEE MMM d, HH:mm')} to ${format(end, 'HH:mm')}. Contains ${chunk.tasks.length} ${chunk.tasks.length === 1 ? 'task' : 'tasks'}.`}
        accessibilityHint="Double tap to open editor"
      >
        <GlassSurface radius={theme.layout.radius.l} intensity={22}>
          {/* Thermal press wash */}
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, glowStyle]}
          >
            <LinearGradient
              colors={[theme.colors.thermal.bleed, 'transparent']}
              start={{ x: 0, y: 1 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          <View style={styles.cardContent}>
            <View style={styles.cardLeft}>
              <Text style={styles.cardEyebrow}>
                {format(start, 'EEE · MMM d').toUpperCase()}
              </Text>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {chunk.title}
              </Text>
              <View style={styles.cardTimeRow}>
                <Text style={styles.cardTime}>{format(start, 'HH:mm')}</Text>
                <View style={styles.cardTimeRule} />
                <Text style={styles.cardTime}>{format(end, 'HH:mm')}</Text>
              </View>
            </View>

            <View style={styles.cardRight}>
              <Text style={styles.cardMetric}>{chunk.tasks.length}</Text>
              <Text style={styles.cardMetricLabel}>
                {chunk.tasks.length === 1 ? 'TASK' : 'TASKS'}
              </Text>
            </View>
          </View>
        </GlassSurface>
      </Pressable>
    </Animated.View>
  );
};

// --- ThermalFab --------------------------------------------------------------

const ThermalFab: React.FC<{ bottom: number; onPress: () => void }> = ({
  bottom,
  onPress,
}) => {
  const press = useSharedValue(1);
  const breath = useSharedValue(0.5);

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
      breath.value = 0.7; // Static full glow
    } else {
      breath.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 2200, easing: Easing.bezier(0.23, 1, 0.32, 1) }),
          withTiming(0.45, { duration: 2200, easing: Easing.bezier(0.23, 1, 0.32, 1) }),
        ),
        -1,
        false,
      );
    }
  }, [breath, reduceMotionEnabled]);

  const animatedScale = useAnimatedStyle(() => ({
    transform: [{ scale: press.value }],
  }));
  const animatedHalo = useAnimatedStyle(() => ({ opacity: breath.value }));

  return (
    <Animated.View style={[styles.fab, { bottom }, animatedScale]}>
      {/* Halo behind the FAB — gives the thermal "incandescent" feel */}
      <Animated.View style={[styles.fabHalo, animatedHalo]} pointerEvents="none">
        <LinearGradient
          colors={['rgba(255, 59, 48, 0.45)', 'rgba(255, 149, 0, 0.18)', 'transparent']}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <Pressable
        testID="thermal-fab"
        onPress={onPress}
        onPressIn={() => {
          press.value = withSpring(0.92, theme.physics.spring);
        }}
        onPressOut={() => {
          press.value = withSpring(1, theme.physics.spring);
        }}
        style={styles.fabPressable}
        accessibilityRole="button"
        accessibilityLabel="Create new schedule"
        accessibilityHint="Creates a new daily timeblock"
      >
        <LinearGradient
          colors={theme.colors.thermal.glow}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabGradient}
        >
          {/* Inner specular */}
          <LinearGradient
            colors={['rgba(255,255,255,0.35)', 'transparent']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.55 }}
            style={StyleSheet.absoluteFill}
          />
          {/* + reticle, two crossed hairlines */}
          <View style={styles.fabCross}>
            <View style={styles.fabCrossV} />
            <View style={styles.fabCrossH} />
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
};

// --- Create-schedule modal ---------------------------------------------------

interface ScheduleModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  setTitle: (s: string) => void;
  onSubmit: () => void;
}

const CreateScheduleModal: React.FC<ScheduleModalProps> = ({
  visible,
  onClose,
  title,
  setTitle,
  onSubmit,
}) => (
  <Modal
    visible={visible}
    animationType="fade"
    transparent
    onRequestClose={onClose}
    statusBarTranslucent
  >
    <BlurView intensity={32} tint="dark" style={StyleSheet.absoluteFill}>
      <View style={styles.modalDim} />
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoiding}
        pointerEvents="box-none"
      >
        <View style={styles.modalCenter} pointerEvents="box-none">
          <GlassSurface
            radius={theme.layout.radius.xl}
            intensity={42}
            tone="raised"
            borderTone="strong"
            style={styles.modalSheet}
          >
          <Text style={styles.modalEyebrow}>NEW SCHEDULE</Text>
          <Text style={styles.modalTitle}>Create a new schedule</Text>

          <Text style={styles.fieldLabel}>SCHEDULE NAME</Text>
          <View style={styles.fieldWrap}>
            <TextInput
              style={styles.input}
              placeholder="e.g. Morning routine"
              placeholderTextColor={theme.colors.textTertiary}
              value={title}
              onChangeText={setTitle}
              autoFocus
            />
          </View>

          <View style={styles.modalButtons}>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>CANCEL</Text>
            </Pressable>
            <Pressable style={styles.createBtnOuter} onPress={onSubmit}>
              <LinearGradient
                colors={theme.colors.thermal.glow}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.createBtn}
              >
                <Text style={styles.createBtnText}>CREATE</Text>
              </LinearGradient>
            </Pressable>
          </View>
          </GlassSurface>
        </View>
      </KeyboardAvoidingView>
    </BlurView>
  </Modal>
);

const styles = StyleSheet.create({
  container: { flex: 1 },

  // --- Header ---
  header: {
    paddingHorizontal: theme.spacing.l,
    paddingBottom: theme.spacing.l,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.s,
    marginBottom: theme.spacing.s,
  },
  brandDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.thermal.corona,
    shadowColor: theme.colors.thermal.corona,
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
  headerTitle: {
    fontFamily: theme.typography.h1.fontFamily,
    fontSize: 44,
    color: theme.colors.text,
    letterSpacing: 6,
    lineHeight: 50,
  },
  headerRule: {
    marginTop: theme.spacing.m,
    height: theme.layout.hairline,
    width: 64,
    backgroundColor: theme.colors.thermal.core,
    opacity: 0.85,
  },

  // --- List ---
  listContent: {
    paddingHorizontal: theme.spacing.l,
    paddingTop: theme.spacing.s,
  },
  cardOuter: {
    marginBottom: theme.spacing.m,
    borderRadius: theme.layout.radius.l,
    ...theme.shadows.lifted,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.l - 2,
    paddingHorizontal: theme.spacing.l,
  },
  cardLeft: { flex: 1, paddingRight: theme.spacing.m },
  cardEyebrow: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: theme.typography.caption.fontSize,
    letterSpacing: theme.typography.caption.letterSpacing,
    color: theme.colors.thermal.corona,
    marginBottom: 6,
  },
  cardTitle: {
    fontFamily: theme.typography.h1.fontFamily,
    fontSize: 20,
    letterSpacing: 0.4,
    color: theme.colors.text,
  },
  cardTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 10,
  },
  cardTime: {
    fontFamily: theme.typography.h2.fontFamily,
    fontSize: 13,
    letterSpacing: 1.6,
    color: theme.colors.textSecondary,
  },
  cardTimeRule: {
    width: 16,
    height: theme.layout.hairline,
    backgroundColor: theme.colors.glass.border,
  },
  cardRight: { alignItems: 'flex-end' },
  cardMetric: {
    fontFamily: theme.typography.h1.fontFamily,
    fontSize: 30,
    letterSpacing: -0.5,
    color: theme.colors.text,
    lineHeight: 32,
  },
  cardMetricLabel: {
    fontFamily: theme.typography.micro.fontFamily,
    fontSize: theme.typography.micro.fontSize,
    letterSpacing: theme.typography.micro.letterSpacing,
    color: theme.colors.textTertiary,
    marginTop: 2,
  },

  // --- Swipe action ---
  deleteAction: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: theme.spacing.l,
    width: 120,
    marginBottom: theme.spacing.m,
    borderRadius: theme.layout.radius.l,
    overflow: 'hidden',
  },
  deleteActionText: {
    color: '#fff',
    fontFamily: theme.typography.h2.fontFamily,
    fontSize: 12,
    letterSpacing: 2,
  },

  // --- Empty state ---
  emptyState: {
    marginTop: 80,
    alignItems: 'center',
    paddingHorizontal: theme.spacing.l,
  },
  emptyText: {
    fontFamily: theme.typography.h2.fontFamily,
    fontSize: 14,
    letterSpacing: 2.5,
    color: theme.colors.textSecondary,
    marginBottom: 6,
  },
  emptySub: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.textTertiary,
    textAlign: 'center',
    maxWidth: 260,
  },

  // --- FAB ---
  fab: {
    position: 'absolute',
    right: theme.spacing.l,
    width: 64,
    height: 64,
  },
  fabHalo: {
    position: 'absolute',
    left: -24,
    right: -24,
    top: -24,
    bottom: -24,
    borderRadius: 56,
    overflow: 'hidden',
  },
  fabPressable: {
    flex: 1,
    borderRadius: 32,
    overflow: 'hidden',
    ...theme.shadows.thermal,
  },
  fabGradient: {
    flex: 1,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabCross: {
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabCrossV: {
    position: 'absolute',
    width: 1.5,
    height: 18,
    backgroundColor: '#fff',
    borderRadius: 1,
  },
  fabCrossH: {
    position: 'absolute',
    width: 18,
    height: 1.5,
    backgroundColor: '#fff',
    borderRadius: 1,
  },

  // --- Modal ---
  modalDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  keyboardAvoiding: {
    flex: 1,
    justifyContent: 'center',
  },
  modalCenter: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.l,
  },
  modalSheet: {
    padding: theme.spacing.l + 6,
    ...theme.shadows.lifted,
  },
  modalEyebrow: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: theme.typography.caption.fontSize,
    letterSpacing: theme.typography.caption.letterSpacing,
    color: theme.colors.thermal.corona,
  },
  modalTitle: {
    fontFamily: theme.typography.h1.fontFamily,
    fontSize: 22,
    letterSpacing: 0.4,
    color: theme.colors.text,
    marginTop: 4,
    marginBottom: theme.spacing.l,
  },
  fieldLabel: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: theme.typography.caption.fontSize,
    letterSpacing: theme.typography.caption.letterSpacing,
    color: theme.colors.textTertiary,
    marginBottom: 6,
  },
  fieldWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: theme.layout.radius.s,
    borderWidth: 1,
    borderColor: theme.colors.glass.border,
    paddingHorizontal: theme.spacing.m,
    marginBottom: theme.spacing.l,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    color: theme.colors.text,
    fontFamily: theme.typography.body.fontFamily,
    fontSize: theme.typography.body.fontSize + 1,
  },
  modalButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cancelBtn: {
    paddingVertical: 14,
    paddingHorizontal: theme.spacing.m,
  },
  cancelBtnText: {
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.h2.fontFamily,
    fontSize: 13,
    letterSpacing: 1.5,
  },
  createBtnOuter: {
    borderRadius: theme.layout.radius.s,
    overflow: 'hidden',
    ...theme.shadows.thermal,
  },
  createBtn: {
    paddingHorizontal: theme.spacing.l,
    paddingVertical: 14,
    borderRadius: theme.layout.radius.s,
  },
  createBtnText: {
    color: '#fff',
    fontFamily: theme.typography.h2.fontFamily,
    fontSize: 13,
    letterSpacing: 1.5,
  },
});
