import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { parseISO, format, setHours, setMinutes, setSeconds, differenceInMinutes } from 'date-fns';

import { GlassSurface } from './GlassSurface';
import { theme } from '../styles/theme';

interface Props {
  visible: boolean;
  startTime: string; // ISO
  endTime: string;   // ISO
  currentTotalMinutes: number; // sum of task durations + buffers
  onClose: () => void;
  onSubmit: (next: { start_time: string; end_time: string }) => void;
}

export const EditTimesModal: React.FC<Props> = ({
  visible,
  startTime,
  endTime,
  currentTotalMinutes,
  onClose,
  onSubmit,
}) => {
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      try {
        setStartInput(format(parseISO(startTime), 'HH:mm'));
        setEndInput(format(parseISO(endTime), 'HH:mm'));
      } catch {
        setStartInput('');
        setEndInput('');
      }
      setError(null);
    }
  }, [visible, startTime, endTime]);

  const handleSubmit = () => {
    const startParts = parseHHmm(startInput);
    const endParts = parseHHmm(endInput);

    if (!startParts || !endParts) {
      setError('Invalid time format. Use HH:MM');
      return;
    }

    const nextStartISO = composeISO(startTime, startParts[0], startParts[1]);
    const nextEndISO = composeISO(endTime, endParts[0], endParts[1]);

    const newTotal = differenceInMinutes(parseISO(nextEndISO), parseISO(nextStartISO));

    if (newTotal <= 0) {
      setError('End time must be after start time');
      return;
    }

    if (newTotal < currentTotalMinutes) {
      setError(`Time window is too short. Required: ${currentTotalMinutes}M`);
      return;
    }

    onSubmit({ start_time: nextStartISO, end_time: nextEndISO });
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill}>
        <View style={styles.dim} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAvoiding}
          pointerEvents="box-none"
        >
          <View style={styles.center} pointerEvents="box-none">
            <GlassSurface
              radius={theme.layout.radius.xl}
              intensity={40}
              tone="raised"
              borderTone="strong"
              style={styles.sheet}
            >
            <Text style={styles.eyebrow}>ADJUST TIMES</Text>
            <Text style={styles.title}>Re-time the schedule</Text>

            <View style={styles.fieldRow}>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>START</Text>
                <View style={styles.fieldWrap}>
                  <TextInput
                    style={styles.input}
                    placeholder="HH:mm"
                    placeholderTextColor={theme.colors.textTertiary}
                    value={startInput}
                    onChangeText={setStartInput}
                    keyboardType="numbers-and-punctuation"
                    autoFocus
                    maxLength={5}
                    accessibilityLabel="Schedule start time in 24 hour format"
                    accessibilityHint="Enter start time as hours and minutes, e.g. 09:00"
                  />
                </View>
              </View>

              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>END</Text>
                <View style={styles.fieldWrap}>
                  <TextInput
                    style={styles.input}
                    placeholder="HH:mm"
                    placeholderTextColor={theme.colors.textTertiary}
                    value={endInput}
                    onChangeText={setEndInput}
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                    accessibilityLabel="Schedule end time in 24 hour format"
                    accessibilityHint="Enter end time as hours and minutes, e.g. 17:00"
                  />
                </View>
              </View>
            </View>

            {error && (
              <Text
                style={styles.errorText}
                accessibilityRole="alert"
                accessibilityLiveRegion="assertive"
              >
                {error}
              </Text>
            )}

            <View style={styles.buttons}>
              <Pressable
                style={styles.cancelBtn}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Cancel editing times"
              >
                <Text style={styles.cancelBtnText}>CANCEL</Text>
              </Pressable>
              <Pressable
                style={styles.submitOuter}
                onPress={handleSubmit}
                accessibilityRole="button"
                accessibilityLabel="Save schedule times"
                accessibilityHint="Saves the updated start and end times for the schedule"
              >
                <LinearGradient
                  colors={theme.colors.thermal.glow}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.submitBtn}
                >
                  <Text style={styles.submitBtnText}>SAVE</Text>
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
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  keyboardAvoiding: {
    flex: 1,
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.l,
  },
  sheet: {
    padding: theme.spacing.l + 6,
    ...theme.shadows.lifted,
  },
  eyebrow: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: theme.typography.caption.fontSize,
    letterSpacing: theme.typography.caption.letterSpacing,
    color: theme.colors.thermal.corona,
  },
  title: {
    fontFamily: theme.typography.h1.fontFamily,
    fontSize: 22,
    letterSpacing: 0.4,
    color: theme.colors.text,
    marginTop: 4,
    marginBottom: theme.spacing.l,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: theme.spacing.m,
    marginBottom: theme.spacing.m,
  },
  fieldHalf: {
    flex: 1,
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
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    color: theme.colors.text,
    fontFamily: theme.typography.body.fontFamily,
    fontSize: theme.typography.body.fontSize + 1,
  },
  errorText: {
    color: theme.colors.thermal.core,
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: theme.typography.caption.fontSize,
    letterSpacing: theme.typography.caption.letterSpacing,
    marginBottom: theme.spacing.m,
  },
  buttons: {
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
  submitOuter: {
    borderRadius: theme.layout.radius.s,
    overflow: 'hidden',
    ...theme.shadows.thermal,
  },
  submitBtn: {
    paddingHorizontal: theme.spacing.l,
    paddingVertical: 14,
    borderRadius: theme.layout.radius.s,
  },
  submitBtnText: {
    color: '#fff',
    fontFamily: theme.typography.h2.fontFamily,
    fontSize: 13,
    letterSpacing: 1.5,
  },
});

function parseHHmm(value: string): [number, number] | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return [h, m];
}

// setHours/setMinutes operate in local time; .toISOString() then converts to UTC.
// Display uses format(..., 'HH:mm') which is also local, so the round-trip is stable
// as long as the user's timezone doesn't change between display and submit.
function composeISO(baseISO: string, hours: number, minutes: number): string {
  const base = parseISO(baseISO);
  const next = setSeconds(setMinutes(setHours(base, hours), minutes), 0);
  return next.toISOString();
}
