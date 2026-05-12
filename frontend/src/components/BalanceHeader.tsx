import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { theme } from '../styles/theme';

interface Props {
  unassignedMinutes: number;
}

export const BalanceHeader: React.FC<Props> = ({ unassignedMinutes }) => {
  return (
    <View style={styles.outer}>
      <BlurView intensity={30} tint="dark" style={styles.blur}>
        <View 
          style={styles.container}
          accessibilityRole="header"
          accessibilityLabel={`Unassigned time: ${unassignedMinutes} minutes`}
        >
          <Text style={styles.label}>UNASSIGNED ATMOSPHERE</Text>
          <Text style={styles.text}>{unassignedMinutes}M</Text>
        </View>
      </BlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  outer: {
    zIndex: 200,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
  },
  blur: {
    paddingTop: 40, // Account for status bar
    paddingBottom: theme.spacing.m,
  },
  container: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.m,
  },
  label: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 10,
    letterSpacing: 2,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  text: {
    fontFamily: theme.typography.h1.fontFamily,
    fontSize: 28,
    color: theme.colors.thermal.core,
  },
});
