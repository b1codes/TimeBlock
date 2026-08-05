import React, { useState, useCallback } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  Pressable,
  Text,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { TimeChunk, Task } from '../types';
import { TaskBlock } from './TaskBlock';
import { DraggableDivider } from './DraggableDivider';
import { BalanceHeader } from './BalanceHeader';
import { GlassSurface } from './GlassSurface';
import {
  calculateZeroSumTasks,
  toggleBuffer,
  calculateLastTaskWithUnassigned,
} from '../utils/dragMath';
import { theme } from '../styles/theme';
import { ApiClient } from '../api/client';

interface Props {
  initialChunk: TimeChunk;
  totalDurationMinutes: number;
  apiClient: ApiClient;
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
}

export const ChunkContainer: React.FC<Props> = ({
  initialChunk,
  totalDurationMinutes,
  apiClient,
  tasks,
  onTasksChange,
}) => {
  const [limitedTaskIds, setLimitedTaskIds] = useState<Set<string>>(new Set());
  const [modalVisible, setModalVisible] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDuration, setNewTaskDuration] = useState('15');

  const currentTotal = (tasks || []).reduce(
    (sum, t) => sum + (t.duration_minutes || 0) + (t.buffer_after_minutes || 0),
    0,
  );
  const unassigned = Math.max(0, totalDurationMinutes - currentTotal) || 0;

  const commitTasks = useCallback(
    (updated: Task[]) => {
      onTasksChange(updated);
      apiClient.debouncedUpdateChunk(initialChunk.chunk_id, { tasks: updated });
    },
    [apiClient, initialChunk.chunk_id, onTasksChange]
  );

  const handleDrag = useCallback(
    (index: number, deltaMinutes: number) => {
      const updatedTasks = calculateZeroSumTasks(tasks, index, deltaMinutes);
      if (updatedTasks === tasks) return;

      const newLimitedIds = new Set<string>();
      if (
        updatedTasks[index].duration_minutes === tasks[index].duration_minutes &&
        deltaMinutes !== 0
      ) {
        newLimitedIds.add(tasks[index].task_id);
      }
      if (
        updatedTasks[index + 1].duration_minutes === tasks[index + 1].duration_minutes &&
        deltaMinutes !== 0
      ) {
        newLimitedIds.add(tasks[index + 1].task_id);
      }

      setLimitedTaskIds(newLimitedIds);
      commitTasks(updatedTasks);
    },
    [commitTasks, tasks]
  );

  const handleLastDrag = useCallback(
    (deltaMinutes: number) => {
      if (tasks.length === 0) return;
      const liveUnassigned = Math.max(
        0,
        totalDurationMinutes -
          tasks.reduce(
            (s, t) => s + (t.duration_minutes || 0) + (t.buffer_after_minutes || 0),
            0
          )
      );
      const updatedTasks = calculateLastTaskWithUnassigned(tasks, deltaMinutes, liveUnassigned);
      if (updatedTasks === tasks) {
        const lastId = tasks[tasks.length - 1].task_id;
        setLimitedTaskIds(new Set([lastId]));
        return;
      }
      setLimitedTaskIds(new Set());
      commitTasks(updatedTasks);
    },
    [commitTasks, tasks, totalDurationMinutes]
  );

  const handleDragEnd = useCallback(() => {
    setLimitedTaskIds(new Set());
  }, []);

  const handleToggleBuffer = useCallback(
    (index: number) => {
      const updatedTasks = toggleBuffer(tasks, index);
      if (updatedTasks === tasks) {
        Alert.alert('Error', 'Not enough unassigned time for buffer');
        return;
      }
      commitTasks(updatedTasks);
    },
    [commitTasks, tasks]
  );

  const handleTitleChange = useCallback(
    (taskId: string, newTitle: string) => {
      const updatedTasks = tasks.map((t) =>
        t.task_id === taskId ? { ...t, title: newTitle } : t
      );
      commitTasks(updatedTasks);
    },
    [commitTasks, tasks]
  );

  const handleAddTask = () => {
    const duration = parseInt(newTaskDuration);
    if (!newTaskTitle.trim() || isNaN(duration)) {
      Alert.alert('Error', 'Please enter a valid title and duration.');
      return;
    }

    if (duration > unassigned) {
      Alert.alert('Error', `Not enough unassigned time: ${unassigned}M available`);
      return;
    }

    const newTask: Task = {
      task_id: Math.random().toString(36).substr(2, 9),
      title: newTaskTitle,
      duration_minutes: duration,
      min_duration: 5,
    };

    commitTasks([...tasks, newTask]);
    setModalVisible(false);
    setNewTaskTitle('');
    setNewTaskDuration('15');
  };

  return (
    <View style={styles.safeArea}>
      <BalanceHeader unassignedMinutes={unassigned} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {tasks.map((task, index) => {
          const isLast = index === tasks.length - 1;
          const canExtendLast =
            isLast && (unassigned > 0 || task.duration_minutes > task.min_duration);

          return (
            <React.Fragment key={task.task_id}>
              <TaskBlock
                {...task}
                isLimitReached={limitedTaskIds.has(task.task_id)}
                onTitleChange={(title) => handleTitleChange(task.task_id, title)}
              />
              {!isLast && (
                <DraggableDivider
                  variant="between"
                  onDrag={(delta) => handleDrag(index, delta)}
                  onDragEnd={handleDragEnd}
                  onPress={() => handleToggleBuffer(index)}
                  bufferDuration={task.buffer_after_minutes}
                />
              )}
              {isLast && canExtendLast && (
                <DraggableDivider
                  variant="terminal"
                  onDrag={handleLastDrag}
                  onDragEnd={handleDragEnd}
                />
              )}
            </React.Fragment>
          );
        })}

        {unassigned > 0 && (
          <UnassignedSlot
            minutes={unassigned}
            onPress={() => setModalVisible(true)}
          />
        )}
      </ScrollView>

      <CreateTaskModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={newTaskTitle}
        setTitle={setNewTaskTitle}
        duration={newTaskDuration}
        setDuration={setNewTaskDuration}
        unassigned={unassigned}
        onSubmit={handleAddTask}
      />
    </View>
  );
};

// --- Unassigned slot ---------------------------------------------------------

const UnassignedSlot: React.FC<{ minutes: number; onPress: () => void }> = ({
  minutes,
  onPress,
}) => {
  const pressScale = useSharedValue(1);
  const pressGlow = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: pressGlow.value }));

  const height = Math.max(minutes * theme.layout.minutesToHeight, 56);

  return (
    <Animated.View style={[styles.slotOuter, { height }, animatedStyle]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          pressScale.value = withSpring(0.985, theme.physics.spring);
          pressGlow.value = withTiming(1, {
            duration: theme.physics.thermal.excitation,
            easing: theme.physics.quartOut,
          });
        }}
        onPressOut={() => {
          pressScale.value = withSpring(1, theme.physics.spring);
          pressGlow.value = withTiming(0, {
            duration: theme.physics.thermal.dissipation,
            easing: theme.physics.quartOut,
          });
        }}
        style={styles.slotPressable}
        accessibilityRole="button"
        accessibilityLabel={`Add task. ${minutes} minutes unassigned.`}
        accessibilityHint="Double tap to open create task modal"
      >
        <View style={styles.slotSurface}>
          {/* Sunken glass tone — feels like a recessed bay */}
          <View style={styles.slotFill} />
          <LinearGradient
            colors={[
              'rgba(255, 255, 255, 0.04)',
              'transparent',
              'rgba(255, 255, 255, 0.04)',
            ]}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          {/* Press thermal wash */}
          <Animated.View style={[StyleSheet.absoluteFill, glowStyle]} pointerEvents="none">
            <LinearGradient
              colors={[theme.colors.thermal.bleed, 'transparent']}
              start={{ x: 0.5, y: 1 }}
              end={{ x: 0.5, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          {/* Dashed inner ring rendered as four hairlines (RN's dashed border is buggy) */}
          <View style={[styles.slotRing]} pointerEvents="none" />

          <View style={styles.slotContent}>
            <View style={styles.slotCross}>
              <View style={styles.slotCrossV} />
              <View style={styles.slotCrossH} />
            </View>
            <Text style={styles.slotLabel}>ADD TASK</Text>
            <Text style={styles.slotMinutes}>{minutes}M UNASSIGNED</Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
};

// --- Create-task modal -------------------------------------------------------

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  setTitle: (s: string) => void;
  duration: string;
  setDuration: (s: string) => void;
  unassigned: number;
  onSubmit: () => void;
}

const CreateTaskModal: React.FC<ModalProps> = ({
  visible,
  onClose,
  title,
  setTitle,
  duration,
  setDuration,
  unassigned,
  onSubmit,
}) => {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* True blur backdrop — what's behind the modal blurs, not a flat veil */}
      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill}>
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
              intensity={40}
              tone="raised"
              borderTone="strong"
              style={styles.modalSheet}
            >
            <Text style={styles.modalEyebrow}>NEW TASK</Text>
            <Text style={styles.modalTitle}>Add task details</Text>

            <Text style={styles.fieldLabel}>NAME</Text>
            <View style={styles.fieldWrap}>
              <TextInput
                style={styles.input}
                placeholder="e.g. Deep work block"
                placeholderTextColor={theme.colors.textTertiary}
                value={title}
                onChangeText={setTitle}
                autoFocus
                accessibilityLabel="Task name field"
                accessibilityHint="Enter the title for the new task"
              />
            </View>

            <Text style={styles.fieldLabel}>DURATION · {unassigned}M UNASSIGNED</Text>
            <View style={styles.fieldWrap}>
              <TextInput
                style={styles.input}
                placeholder="15"
                placeholderTextColor={theme.colors.textTertiary}
                value={duration}
                onChangeText={setDuration}
                keyboardType="numeric"
                accessibilityLabel="Task duration field in minutes"
                accessibilityHint={`Enter duration up to ${unassigned} minutes`}
              />
              <Text style={styles.fieldUnit}>M</Text>
            </View>

            <View style={styles.modalButtons}>
              <Pressable
                style={styles.cancelBtn}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Cancel adding task"
              >
                <Text style={styles.cancelBtnText}>CANCEL</Text>
              </Pressable>
              <Pressable
                style={styles.createBtnOuter}
                onPress={onSubmit}
                accessibilityRole="button"
                accessibilityLabel="Add task"
                accessibilityHint="Creates the new task in this schedule"
              >
                <LinearGradient
                  colors={theme.colors.thermal.glow}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.createBtn}
                >
                  <Text style={styles.createBtnText}>ADD</Text>
                </LinearGradient>
              </Pressable>
            </View>
            </GlassSurface>
          </View>
        </KeyboardAvoidingView>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: {
    paddingVertical: theme.spacing.s,
    paddingBottom: theme.spacing.l,
  },

  // --- Unassigned slot ---
  slotOuter: {
    marginHorizontal: theme.spacing.m,
    marginVertical: 2,
    borderRadius: theme.layout.radius.m,
    overflow: 'hidden',
  },
  slotPressable: { flex: 1 },
  slotSurface: {
    flex: 1,
    borderRadius: theme.layout.radius.m,
    overflow: 'hidden',
  },
  slotFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  slotRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: theme.layout.radius.m,
    borderWidth: theme.layout.hairline,
    borderColor: theme.colors.glass.border,
    borderStyle: 'dashed',
  },
  slotContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.s,
  },
  slotCross: {
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
    opacity: 0.7,
  },
  slotCrossV: {
    position: 'absolute',
    width: 1.5,
    height: 18,
    backgroundColor: theme.colors.thermal.corona,
  },
  slotCrossH: {
    position: 'absolute',
    width: 18,
    height: 1.5,
    backgroundColor: theme.colors.thermal.corona,
  },
  slotLabel: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: theme.typography.caption.fontSize,
    letterSpacing: theme.typography.caption.letterSpacing,
    color: theme.colors.textSecondary,
  },
  slotMinutes: {
    fontFamily: theme.typography.micro.fontFamily,
    fontSize: theme.typography.micro.fontSize,
    letterSpacing: theme.typography.micro.letterSpacing,
    color: theme.colors.textTertiary,
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
    backgroundColor: theme.colors.glass.base,
    borderRadius: theme.layout.radius.s,
    borderWidth: theme.layout.hairline,
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
  fieldUnit: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: theme.typography.caption.fontSize,
    letterSpacing: theme.typography.caption.letterSpacing,
    color: theme.colors.thermal.corona,
  },
  modalButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.s,
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
