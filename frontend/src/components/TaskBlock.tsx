import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../styles/theme';
import { Task } from '../types';

interface Props extends Task {
  isLimitReached?: boolean;
}

export const TaskBlock: React.FC<Props> = ({ task_id, title, duration_minutes, isLimitReached }) => {
  const height = duration_minutes * theme.layout.minutesToHeight;

  return (
    <View 
      testID={`task-block-${task_id}`}
      style={[
        styles.container, 
        { height },
        isLimitReached && styles.limitReached
      ]}
    >
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.duration}>{duration_minutes}m</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF',
    marginHorizontal: theme.spacing.m,
    marginVertical: 2,
    padding: theme.spacing.s,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.lifted,
  },
  limitReached: {
    borderColor: theme.colors.error,
    borderWidth: 2,
    shadowColor: theme.colors.error,
    shadowOpacity: 0.3,
  },
  title: {
    fontWeight: '600',
    color: theme.colors.text,
  },
  duration: {
    fontSize: 12,
    color: theme.colors.secondary,
  }
});
