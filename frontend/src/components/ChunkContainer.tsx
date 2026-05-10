import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
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

  const currentTotal = tasks.reduce((sum, t) => sum + t.duration_minutes, 0);
  const unassigned = totalDurationMinutes - currentTotal;

  const handleDrag = (index: number, deltaMinutes: number) => {
    const updatedTasks = calculateZeroSumTasks(tasks, index, deltaMinutes);
    
    if (updatedTasks === tasks) {
      return;
    }

    // Check if limits were hit
    const newLimitedIds = new Set<string>();
    if (updatedTasks[index].duration_minutes === tasks[index].duration_minutes && deltaMinutes !== 0) {
      // Top task hit its limit
      newLimitedIds.add(tasks[index].task_id);
    }
    if (updatedTasks[index + 1].duration_minutes === tasks[index + 1].duration_minutes && deltaMinutes !== 0) {
      // Bottom task hit its limit
      newLimitedIds.add(tasks[index + 1].task_id);
    }

    setTasks(updatedTasks);
    setLimitedTaskIds(newLimitedIds);

    // Sync with API
    apiClient.debouncedUpdateChunkTasks(initialChunk.chunk_id, updatedTasks);
  };

  const handleDragEnd = () => {
    setLimitedTaskIds(new Set());
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
          <View 
            style={[
              styles.gap, 
              { height: unassigned * theme.layout.minutesToHeight }
            ]} 
          />
        )}
      </ScrollView>
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
  }
});
