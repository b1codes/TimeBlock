import React from 'react';
import { StyleSheet, View } from 'react-native';
import { GlassSurface } from './GlassSurface';
import { ChromaticPulse } from './ChromaticPulse';
import { theme } from '../styles/theme';

export const SkeletonTaskCard: React.FC = () => {
  return (
    <View style={styles.cardOuter} testID="skeleton-task-card">
      <GlassSurface radius={theme.layout.radius.l} intensity={22}>
        <View style={styles.cardContent}>
          <View style={styles.cardLeft}>
            {/* Eyebrow placeholder */}
            <ChromaticPulse
              style={styles.eyebrowSkeleton}
            />
            {/* Title placeholder */}
            <ChromaticPulse
              style={styles.titleSkeleton}
            />
            {/* Time row placeholder */}
            <View style={styles.timeRow}>
              <ChromaticPulse style={styles.timeSkeleton} />
              <View style={styles.timeRule} />
              <ChromaticPulse style={styles.timeSkeleton} />
            </View>
          </View>

          <View style={styles.cardRight}>
            <ChromaticPulse style={styles.metricSkeleton} />
            <ChromaticPulse style={styles.metricLabelSkeleton} />
          </View>
        </View>
      </GlassSurface>
    </View>
  );
};

const styles = StyleSheet.create({
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
  eyebrowSkeleton: {
    width: 90,
    height: 10,
    borderRadius: 4,
    marginBottom: 8,
  },
  titleSkeleton: {
    width: '75%',
    height: 20,
    borderRadius: 6,
    marginBottom: 10,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timeSkeleton: {
    width: 44,
    height: 12,
    borderRadius: 3,
  },
  timeRule: {
    width: 16,
    height: theme.layout.hairline,
    backgroundColor: theme.colors.glass.border,
  },
  cardRight: { alignItems: 'flex-end' },
  metricSkeleton: {
    width: 32,
    height: 30,
    borderRadius: 6,
    marginBottom: 4,
  },
  metricLabelSkeleton: {
    width: 40,
    height: 9,
    borderRadius: 2,
  },
});
