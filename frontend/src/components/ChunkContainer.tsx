import React, { useState } from 'react';
import { 
  ScrollView, 
  StyleSheet, 
  View, 
  TouchableOpacity, 
  Text, 
  Modal, 
  TextInput,
  Alert
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { TimeChunk, Task } from '../types';
import { TaskBlock } from './TaskBlock';
import { DraggableDivider } from './DraggableDivider';
import { BalanceHeader } from './BalanceHeader';
import { calculateZeroSumTasks, toggleBuffer } from '../utils/dragMath';
import { theme } from '../styles/theme';
import { ApiClient } from '../api/client';

interface Props {
  initialChunk: TimeChunk;
  totalDurationMinutes: number;
  apiClient: ApiClient;
}

export const ChunkContainer: React.FC<Props> = ({ initialChunk, totalDurationMinutes, apiClient }) => {
  const [tasks, setTasks] = useState<Task[]>(initialChunk.tasks || []);
  const [limitedTaskIds, setLimitedTaskIds] = useState<Set<string>>(new Set());
  const [modalVisible, setModalVisible] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDuration, setNewTaskDuration] = useState('15');

  const currentTotal = (tasks || []).reduce((sum, t) => sum + (t.duration_minutes || 0) + (t.buffer_after_minutes || 0), 0);
  const unassigned = Math.max(0, totalDurationMinutes - currentTotal) || 0;

  const handleDrag = (index: number, deltaMinutes: number) => {
    const updatedTasks = calculateZeroSumTasks(tasks, index, deltaMinutes);
    
    if (updatedTasks === tasks) {
      return;
    }

    const newLimitedIds = new Set<string>();
    if (updatedTasks[index].duration_minutes === tasks[index].duration_minutes && deltaMinutes !== 0) {
      newLimitedIds.add(tasks[index].task_id);
    }
    if (updatedTasks[index + 1].duration_minutes === tasks[index + 1].duration_minutes && deltaMinutes !== 0) {
      newLimitedIds.add(tasks[index + 1].task_id);
    }

    setTasks(updatedTasks);
    setLimitedTaskIds(newLimitedIds);
    apiClient.debouncedUpdateChunkTasks(initialChunk.chunk_id, updatedTasks);
  };

  const handleDragEnd = () => {
    setLimitedTaskIds(new Set());
  };

  const handleTitleChange = (taskId: string, newTitle: string) => {
    const updatedTasks = tasks.map(t => t.task_id === taskId ? { ...t, title: newTitle } : t);
    setTasks(updatedTasks);
    apiClient.debouncedUpdateChunkTasks(initialChunk.chunk_id, updatedTasks);
  };

  const handleAddTask = () => {
    const duration = parseInt(newTaskDuration);
    if (!newTaskTitle.trim() || isNaN(duration)) {
      Alert.alert('ERROR', 'INVALID SYSTEM DESIGNATION OR PARAMETERS');
      return;
    }

    if (duration > unassigned) {
      Alert.alert('ERROR', `INSUFFICIENT ATMOSPHERE: ${unassigned}M AVAILABLE`);
      return;
    }

    const newTask: Task = {
      task_id: Math.random().toString(36).substr(2, 9),
      title: newTaskTitle,
      duration_minutes: duration,
      min_duration: 5,
    };

    const updatedTasks = [...tasks, newTask];
    setTasks(updatedTasks);
    setModalVisible(false);
    setNewTaskTitle('');
    setNewTaskDuration('15');
    apiClient.debouncedUpdateChunkTasks(initialChunk.chunk_id, updatedTasks);
  };

  return (
    <View style={styles.safeArea}>
      <BalanceHeader unassignedMinutes={unassigned} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {tasks.map((task, index) => (
          <React.Fragment key={task.task_id}>
            <TaskBlock 
              {...task} 
              isLimitReached={limitedTaskIds.has(task.task_id)} 
              onTitleChange={(title) => handleTitleChange(task.task_id, title)}
            />
            {index < tasks.length - 1 && (
              <DraggableDivider 
                onDrag={(delta) => handleDrag(index, delta)}
                onDragEnd={handleDragEnd}
                bufferDuration={task.buffer_after_minutes}
              />
            )}
          </React.Fragment>
        ))}
        {unassigned > 0 && (
          <TouchableOpacity 
            style={[
              styles.gap, 
              { height: unassigned * theme.layout.minutesToHeight }
            ]} 
            onPress={() => setModalVisible(true)}
          >
            <BlurView intensity={5} tint="dark" style={StyleSheet.absoluteFill} />
            <Text style={styles.gapText}>+ INITIALIZE INSTRUMENT ({unassigned}M)</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <BlurView intensity={40} tint="dark" style={styles.modalContent}>
            <Text style={styles.modalTitle}>ADD INSTRUMENT</Text>
            <TextInput
              style={styles.input}
              placeholder="Designation"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
              autoFocus
            />
            <TextInput
              style={styles.input}
              placeholder="Duration (M)"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={newTaskDuration}
              onChangeText={setNewTaskDuration}
              keyboardType="numeric"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>ABORT</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.createBtn} onPress={handleAddTask}>
                <Text style={styles.createBtnText}>INITIALIZE</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: theme.spacing.m,
  },
  gap: {
    marginHorizontal: theme.spacing.m,
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    borderRadius: 12,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  gapText: {
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 10,
    letterSpacing: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    borderRadius: 24,
    padding: 32,
    borderWidth: 1,
    borderColor: theme.colors.glass.border,
    overflow: 'hidden',
  },
  modalTitle: {
    fontFamily: theme.typography.h2.fontFamily,
    fontSize: 18,
    color: theme.colors.text,
    marginBottom: 24,
    textAlign: 'center',
    letterSpacing: 2,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    color: '#FFF',
    fontFamily: theme.typography.body.fontFamily,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.glass.border,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  cancelBtn: {
    padding: 16,
  },
  cancelBtnText: {
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.h2.fontFamily,
    letterSpacing: 1,
  },
  createBtn: {
    backgroundColor: theme.colors.thermal.core,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
  },
  createBtnText: {
    color: '#FFF',
    fontFamily: theme.typography.h2.fontFamily,
    letterSpacing: 1,
  }
});
