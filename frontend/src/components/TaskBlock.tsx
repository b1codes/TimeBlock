import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { theme } from '../styles/theme';
import { Task } from '../types';

interface Props extends Task {
  isLimitReached?: boolean;
  onTitleChange?: (newTitle: string) => void;
}

export const TaskBlock: React.FC<Props> = ({ 
  task_id, 
  title, 
  duration_minutes, 
  isLimitReached,
  onTitleChange 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localTitle, setLocalTitle] = useState(title);

  const height = duration_minutes * theme.layout.minutesToHeight;

  const handleBlur = () => {
    setIsEditing(false);
    if (localTitle !== title && onTitleChange) {
      onTitleChange(localTitle);
    }
  };

  return (
    <View 
      testID={`task-block-${task_id}`}
      style={[
        styles.container, 
        { height },
        isLimitReached && styles.limitReached
      ]}
    >
      {isEditing ? (
        <TextInput
          style={[styles.title, styles.input]}
          value={localTitle}
          onChangeText={setLocalTitle}
          onBlur={handleBlur}
          onSubmitEditing={handleBlur}
          autoFocus
          selectTextOnFocus
        />
      ) : (
        <Text 
          style={styles.title}
          onPress={() => setIsEditing(true)}
        >
          {title}
        </Text>
      )}
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
    textAlign: 'center',
    minWidth: 100,
  },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.primary,
  },
  duration: {
    fontSize: 12,
    color: theme.colors.secondary,
  }
});
