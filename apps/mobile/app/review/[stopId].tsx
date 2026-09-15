import { useCallback, useEffect, useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Button } from '@/components/ui/Button';
import { ChoiceChip } from '@/components/ui/ChoiceChip';
import { StarRatingInput } from '@/components/ui/StarRatingInput';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { deleteReview, getStopReviews, upsertReview } from '@/lib/api';
import type { LoiteringConcern, Review, ReviewInput, TimeOfVisit } from '@/lib/types';

const NOTE_MAX_LENGTH = 280;

const LOITERING_OPTIONS: { label: string; value: LoiteringConcern }[] = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
];

const TIME_OF_VISIT_OPTIONS: { label: string; value: TimeOfVisit }[] = [
  { label: 'Day', value: 'day' },
  { label: 'Night', value: 'night' },
  { label: 'Not sure', value: 'unknown' },
];

/** A required-field section: a title plus whatever input row the caller passes in. */
function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {children}
    </View>
  );
}

export default function ReviewFormScreen() {
  const { stopId } = useLocalSearchParams<{ stopId: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();

  const [existing, setExisting] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [overallFeeling, setOverallFeeling] = useState<number>();
  const [lighting, setLighting] = useState<number>();
  const [restroomQuality, setRestroomQuality] = useState<number>();
  const [cleanliness, setCleanliness] = useState<number>();
  const [staffKindness, setStaffKindness] = useState<number>();
  const [loiteringConcern, setLoiteringConcern] = useState<LoiteringConcern>();
  const [wouldStopAgain, setWouldStopAgain] = useState<boolean>();
  const [timeOfVisit, setTimeOfVisit] = useState<TimeOfVisit>();
  const [note, setNote] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Load the caller's own review (if any) so editing pre-fills. This uses the
  // same get_stop_reviews RPC the detail screen uses, so it fails the same way
  // before migration 003 is applied — that failure blocks the form instead of
  // silently guessing "create" and risking overwriting an existing review.
  const load = useCallback(async () => {
    if (!stopId) return;
    setLoading(true);
    setLoadError(null);
    const { reviews, error } = await getStopReviews(stopId);
    setLoading(false);
    if (error) {
      setLoadError(error);
      return;
    }
    const mine = reviews.find((r) => r.is_mine) ?? null;
    setExisting(mine);
    if (mine) {
      setOverallFeeling(mine.overall_feeling);
      setLighting(mine.lighting);
      setRestroomQuality(mine.restroom_quality);
      setCleanliness(mine.cleanliness);
      setStaffKindness(mine.staff_kindness);
      setLoiteringConcern(mine.loitering_concern);
      setWouldStopAgain(mine.would_stop_again);
      setTimeOfVisit(mine.time_of_visit);
      setNote(mine.note ?? '');
    }
  }, [stopId]);

  useEffect(() => {
    void load();
  }, [load]);

  const isValid =
    overallFeeling !== undefined &&
    lighting !== undefined &&
    restroomQuality !== undefined &&
    cleanliness !== undefined &&
    staffKindness !== undefined &&
    loiteringConcern !== undefined &&
    wouldStopAgain !== undefined &&
    timeOfVisit !== undefined;

  async function handleSubmit() {
    if (!isValid || !stopId || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    const input: ReviewInput = {
      overall_feeling: overallFeeling!,
      lighting: lighting!,
      restroom_quality: restroomQuality!,
      cleanliness: cleanliness!,
      staff_kindness: staffKindness!,
      loitering_concern: loiteringConcern!,
      would_stop_again: wouldStopAgain!,
      time_of_visit: timeOfVisit!,
      note: note.trim().length > 0 ? note.trim() : null,
    };
    const { error } = await upsertReview(stopId, input);
    setSubmitting(false);
    if (error) {
      // Failure → inline error, form state preserved (nothing is cleared here).
      setSubmitError(error);
      return;
    }
    router.back();
  }

  function handleDelete() {
    if (!stopId) return;
    Alert.alert('Delete review?', 'This removes your review from this stop.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setSubmitting(true);
          void deleteReview(stopId).then(({ error }) => {
            setSubmitting(false);
            if (error) {
              setSubmitError(error);
              return;
            }
            router.back();
          });
        },
      },
    ]);
  }

  return (
    <>
      <Stack.Screen options={{ title: existing ? 'Edit Your Review' : 'Write a Review' }} />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.tint} />
          </View>
        ) : loadError ? (
          <View style={styles.centered}>
            <Text style={[Typography.body, { color: colors.text, textAlign: 'center' }]}>
              {loadError}
            </Text>
            <Button label="Retry" variant="ghost" onPress={() => void load()} style={styles.retryButton} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <FormSection title="Overall feeling">
              <StarRatingInput value={overallFeeling} onChange={setOverallFeeling} />
            </FormSection>
            <FormSection title="Lighting">
              <StarRatingInput value={lighting} onChange={setLighting} />
            </FormSection>
            <FormSection title="Restroom">
              <StarRatingInput value={restroomQuality} onChange={setRestroomQuality} />
            </FormSection>
            <FormSection title="Cleanliness">
              <StarRatingInput value={cleanliness} onChange={setCleanliness} />
            </FormSection>
            <FormSection title="Staff kindness">
              <StarRatingInput value={staffKindness} onChange={setStaffKindness} />
            </FormSection>

            <FormSection title="Loitering concern">
              <View style={styles.chipRow}>
                {LOITERING_OPTIONS.map((opt) => (
                  <ChoiceChip
                    key={opt.value}
                    label={opt.label}
                    selected={loiteringConcern === opt.value}
                    onPress={() => setLoiteringConcern(opt.value)}
                  />
                ))}
              </View>
            </FormSection>

            <FormSection title="Would you stop here alone again?">
              <View style={styles.chipRow}>
                <ChoiceChip label="Yes" selected={wouldStopAgain === true} onPress={() => setWouldStopAgain(true)} />
                <ChoiceChip label="No" selected={wouldStopAgain === false} onPress={() => setWouldStopAgain(false)} />
              </View>
            </FormSection>

            <FormSection title="Time of visit">
              <View style={styles.chipRow}>
                {TIME_OF_VISIT_OPTIONS.map((opt) => (
                  <ChoiceChip
                    key={opt.value}
                    label={opt.label}
                    selected={timeOfVisit === opt.value}
                    onPress={() => setTimeOfVisit(opt.value)}
                  />
                ))}
              </View>
            </FormSection>

            <FormSection title="Note (optional)">
              <TextInput
                style={[
                  styles.noteInput,
                  { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border },
                ]}
                placeholder="What should the next traveler know?"
                placeholderTextColor={colors.secondaryText}
                value={note}
                onChangeText={(text) => setNote(text.slice(0, NOTE_MAX_LENGTH))}
                multiline
                maxLength={NOTE_MAX_LENGTH}
              />
              <Text style={[styles.helperText, { color: colors.secondaryText }]}>
                Describe the stop, not people. Don&apos;t include names or personal details.
              </Text>
              <Text style={[styles.counter, { color: colors.secondaryText }]}>
                {note.length}/{NOTE_MAX_LENGTH}
              </Text>
            </FormSection>

            {submitError && (
              <Text style={[styles.errorText, { color: colors.text }]}>{submitError}</Text>
            )}

            <Button
              label={submitting ? 'Saving…' : existing ? 'Save changes' : 'Submit review'}
              onPress={() => void handleSubmit()}
              disabled={!isValid || submitting}
              fullWidth
              style={styles.submitButton}
            />

            {existing && (
              <TouchableOpacity onPress={handleDelete} disabled={submitting} hitSlop={8}>
                <Text style={[styles.deleteText, { color: colors.secondaryText }]}>Delete review</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.smd,
    paddingHorizontal: Spacing.screen,
  },
  retryButton: {
    marginTop: Spacing.xs,
  },
  scrollContent: {
    padding: Spacing.screen,
    gap: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.bodyMed,
    fontWeight: '600' as const,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  noteInput: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.smd,
    minHeight: 90,
    textAlignVertical: 'top',
    ...Typography.body,
  },
  helperText: {
    ...Typography.caption,
  },
  counter: {
    ...Typography.small,
    alignSelf: 'flex-end',
  },
  errorText: {
    ...Typography.body,
    textAlign: 'center' as const,
  },
  submitButton: {
    marginTop: Spacing.sm,
  },
  deleteText: {
    ...Typography.body,
    textAlign: 'center' as const,
    textDecorationLine: 'underline' as const,
  },
});
