import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../styles/theme';

interface Props {
  unassignedMinutes: number;
}

export const BalanceHeader: React.FC<Props> = ({ unassignedMinutes }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Unassigned: {unassignedMinutes}m</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.m,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    alignItems: 'center',
    zIndex: 10,
  },
  text: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
});
