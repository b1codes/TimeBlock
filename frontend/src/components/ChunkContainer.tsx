import React, { useState } from 'react';
import { 
  ScrollView, 
  StyleSheet, 
  View, 
  TouchableOpacity, 
  Text, 
  Modal, 
  TextInput,
  Button,
  Alert
} from 'react-native';
import { TimeChunk, Task } from '../types';
import { TaskBlock } from './TaskBlock';
import { DraggableDivider } from './DraggableDivider';
import { BalanceHeader } from './BalanceHeader';
import { calculateZeroSumTasks } from '../utils/dragMath';
import { theme } from '../styles/theme';
import { ApiClient } from '../api/client';

interface Props {
  initialChunk: TimeChunk;
  totalDurationMinutes: number;
  apiClient: ApiClient;
}

export const ChunkContainer: React.FC<Props> = ({ initialChunk, totalDurationMinutes, apiClient }) => {
  const [tasks, setTasks] = useState<Task[]>(initialChunk.tasks);
  const [limitedTaskIds, setLimitedTaskIds] = useState<Set<string>>(new Set());
  const [modalVisible, setModalVisible] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDuration, setNewTaskDuration] = useState('15');

  const currentTotal = tasks.reduce((sum, t) => sum + t.duration_minutes, 0);
  const unassigned = totalDurationMinutes - currentTotal;

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
      Alert.alert('Error', 'Please enter a valid title and duration');
      return;
    }

    if (duration > unassigned) {
      Alert.alert('Error', `Not enough time left (${unassigned}m available)`);
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
            <Text style={styles.gapText}>+ Add Task ({unassigned}m left)</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {unassigned === 0 && (
        <TouchableOpacity style={styles.fab} onPress={() => Alert.alert('Full', 'No more unassigned time!')}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Task</Text>
            <TextInput
              style={styles.input}
              placeholder="Task Name"
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
              autoFocus
            />
            <TextInput
              style={styles.input}
              placeholder="Duration (minutes)"
              value={newTaskDuration}
              onChangeText={setNewTaskDuration}
              keyboardType="numeric"
            />
            <View style={styles.modalButtons}>
              <Button title="Cancel" color={theme.colors.error} onPress={() => setModalVisible(false)} />
              <Button title="Add" onPress={handleAddTask} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    paddingVertical: theme.spacing.m,
  },
  gap: {
    marginHorizontal: theme.spacing.m,
    backgroundColor: theme.colors.unallocated,
    borderRadius: 8,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gapText: {
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.5,
  },
  fabText: {
    color: theme.colors.text,
    fontSize: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  }
});
