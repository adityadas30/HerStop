import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Button } from '@/components/ui/Button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ScoreBadge } from '@/components/ui/ScoreBadge';
import { ReviewCard } from '@/components/ReviewCard';
import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/contexts/auth';
import { useSavedStops } from '@/contexts/saved-stops';
import type { StopData } from '@/data/mock-stops';
import { getStopById, getStopReviews, getStopReviewStats, hideReview, reportReview, wasReviewedThisSession } from '@/lib/api';
import { reviewCountLabel, scoreStop } from '@/lib/scoring';
import type { ReportReason, Review, ReviewStats } from '@/lib/types';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** Options shown in the "Report review" reason sheet, in the order the spec lists them. */
const REPORT_REASONS: { label: string; reason: ReportReason }[] = [
  { label: 'Spam', reason: 'spam' },
  { label: 'Offensive or harassing', reason: 'offensive' },
  { label: 'Not about this stop', reason: 'not_about_stop' },
  { label: 'Shares personal info', reason: 'personal_info' },
  { label: 'Other', reason: 'other' },
];

interface FeedbackState {
  loading: boolean;
  error: string | null;
  reviews: Review[];
  stats: ReviewStats | undefined;
}

const INITIAL_FEEDBACK: FeedbackState = { loading: true, error: null, reviews: [], stats: undefined };

/** A single Lighting/Restroom/Cleanliness/Staff average line in the score card. */
function RatingLine({ label, value }: { label: string; value: number }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  return (
    <View style={styles.ratingLine}>
      <Text style={[styles.ratingLabel, { color: colors.secondaryText }]}>{label}</Text>
      <Text style={[styles.ratingValue, { color: colors.text }]}>{value.toFixed(1)} / 5</Text>
    </View>
  );
}

export default function StopDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { isGuest, loading: authLoading } = useAuth();
  const { isSaved, toggleSaved, loading: savedLoading, syncError } = useSavedStops();

  const [stop, setStop] = useState<StopData | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<FeedbackState>(INITIAL_FEEDBACK);
  // Set when a guest taps save: what they wanted to save, held until they're back
  // from signing in.
  const [pendingSaveId, setPendingSaveId] = useState<string | null>(null);

  useEffect(() => {
    getStopById(id ?? '').then((s) => {
      setStop(s);
      setLoading(false);
    });
  }, [id]);

  const loadFeedback = useCallback(async (stopId: string) => {
    setFeedback((prev) => ({ ...prev, loading: true, error: null }));
    const [reviewsResult, statsResult] = await Promise.all([
      getStopReviews(stopId),
      getStopReviewStats([stopId]),
    ]);
    setFeedback({
      loading: false,
      error: reviewsResult.error ?? statsResult.error,
      reviews: reviewsResult.reviews,
      stats: statsResult.stats.get(stopId),
    });
  }, []);

  // Refetch every time this screen gains focus — covers coming back from the
  // review form after a successful submit, and from a report/hide action.
  useFocusEffect(
    useCallback(() => {
      if (id) loadFeedback(id);
    }, [id, loadFeedback]),
  );

  function handleSavePress(stopId: string) {
    // Auth is still restoring the session — we don't yet know if there's a
    // signed-in user, so ignore the tap rather than guessing guest and
    // routing away from this screen.
    if (authLoading) return;
    if (isGuest) {
      // Browsing stays open to everyone; only saving needs an account. Send them
      // to the sign-in flow on Profile and finish the save when they return.
      // `push` (not `navigate`) on purpose: it keeps this screen mounted underneath,
      // which is what lets the effect below complete the save afterwards.
      setPendingSaveId(stopId);
      router.push('/profile');
      return;
    }
    toggleSaved(stopId);
  }

  // Finish a guest's save once they're signed in — but only after their existing
  // saved list has loaded, so this save isn't overwritten by the restore.
  useEffect(() => {
    if (!pendingSaveId || isGuest || savedLoading) return;
    setPendingSaveId(null);
    if (!isSaved(pendingSaveId)) toggleSaved(pendingSaveId);
  }, [pendingSaveId, isGuest, savedLoading, isSaved, toggleSaved]);

  function handleWriteReviewPress() {
    if (!stop) return;
    // Auth is still restoring — same reasoning as handleSavePress above.
    if (authLoading) return;
    if (isGuest) {
      // Guest → sign in on Profile → they land back on this screen (same
      // pattern as guest save), and can tap the button again once signed in.
      router.push('/profile');
      return;
    }
    router.push(`/review/${stop.id}`);
  }

  function handleReport(reviewId: string) {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: [...REPORT_REASONS.map((r) => r.label), 'Cancel'], cancelButtonIndex: REPORT_REASONS.length },
      (buttonIndex) => {
        if (buttonIndex >= REPORT_REASONS.length) return; // Cancel
        void reportReview(reviewId, REPORT_REASONS[buttonIndex].reason, null).then(({ error }) => {
          Alert.alert(error ?? "Thanks — we'll take a look.");
        });
      },
    );
  }

  function handleHide(reviewId: string) {
    Alert.alert('Hide this review?', "You won't see it again.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Hide',
        style: 'destructive',
        onPress: () => {
          void hideReview(reviewId).then(({ error }) => {
            if (error) {
              Alert.alert(error);
              return;
            }
            if (id) loadFeedback(id);
          });
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.tint} />
      </View>
    );
  }

  if (!stop) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[Typography.heading, { color: colors.text }]}>Stop not found</Text>
      </View>
    );
  }

  const score = scoreStop(feedback.stats);
  const myReview = feedback.reviews.find((r) => r.is_mine);
  const wouldStopPct =
    feedback.stats && feedback.stats.review_count > 0
      ? Math.round((feedback.stats.would_stop_again_count / feedback.stats.review_count) * 100)
      : 0;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.scrollContent}>

      {/* Image placeholder */}
      <View style={[styles.imageHero, { backgroundColor: stop.imageColor }]}>
        <IconSymbol name="photo.fill" size={32} color="rgba(255,255,255,0.3)" />

        {/* Bookmark */}
        <TouchableOpacity
          testID="stop-detail-bookmark"
          style={[styles.bookmarkBtn, { backgroundColor: colors.tint }]}
          onPress={() => handleSavePress(stop.id)}
          activeOpacity={0.7}>
          <IconSymbol
            name={isSaved(stop.id) ? 'bookmark.fill' : 'bookmark'}
            size={18}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </View>

      {/* Main info */}
      <View style={styles.body}>
        {/* Badge — only once we actually know the label; never guess during an error */}
        {!feedback.loading && !feedback.error && (
          <View style={styles.metaRow}>
            <ScoreBadge label={score.label} />
          </View>
        )}

        {/* Name + address */}
        <Text style={[styles.stopName, { color: colors.text }]}>{stop.name}</Text>
        <Text style={[styles.address, { color: colors.secondaryText }]}>{stop.address}</Text>

        {syncError && (
          <Text style={[styles.syncError, { color: colors.secondaryText }]}>{syncError}</Text>
        )}

        {/* Tags */}
        <View style={styles.tagsRow}>
          {stop.tags.map((tag) => (
            <View key={tag.label} style={[styles.tag, { borderColor: colors.border }]}>
              <IconSymbol name={tag.icon} size={12} color={colors.secondaryText} />
              <Text style={[styles.tagText, { color: colors.secondaryText }]}>
                {tag.label.toUpperCase()}
              </Text>
            </View>
          ))}
        </View>

        {feedback.loading ? (
          <View style={[styles.card, Shadows.sm, styles.centeredCard, { backgroundColor: colors.card }]}>
            <ActivityIndicator color={colors.tint} />
          </View>
        ) : feedback.error ? (
          <View style={[styles.card, Shadows.sm, styles.centeredCard, { backgroundColor: colors.card }]}>
            <Text style={[Typography.body, { color: colors.text, textAlign: 'center' }]}>
              {feedback.error}
            </Text>
            <Button label="Retry" variant="ghost" onPress={() => id && loadFeedback(id)} />
          </View>
        ) : (
          <>
            {/* Score summary */}
            <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Community Score</Text>
              {score.label === 'limited' ? (
                <Text style={[styles.placeholder, { color: colors.secondaryText }]}>
                  Fewer than 3 traveler reviews so far — not enough to make a recommendation yet.
                </Text>
              ) : (
                <View style={styles.scoreDetails}>
                  <Text style={[styles.placeholder, { color: colors.secondaryText }]}>
                    Based on {reviewCountLabel(feedback.stats!.review_count)}
                  </Text>
                  <RatingLine label="Lighting" value={feedback.stats!.avg_lighting} />
                  <RatingLine label="Restroom" value={feedback.stats!.avg_restroom} />
                  <RatingLine label="Cleanliness" value={feedback.stats!.avg_cleanliness} />
                  <RatingLine label="Staff" value={feedback.stats!.avg_staff} />
                  <Text style={[styles.placeholder, { color: colors.secondaryText }]}>
                    {wouldStopPct}% would stop here alone again
                  </Text>
                  {score.reasons.map((reason) => (
                    <Text key={reason} style={[styles.reasonLine, { color: colors.secondaryText }]}>
                      {reason}
                    </Text>
                  ))}
                </View>
              )}
            </View>

            {/* Reviews */}
            <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Traveler Reviews</Text>
              {feedback.reviews.length === 0 ? (
                <Text style={[styles.placeholder, { color: colors.secondaryText }]}>
                  No reviews yet. Stopped here? Your review helps the next traveler.
                </Text>
              ) : (
                <View style={styles.reviewsList}>
                  {feedback.reviews.map((review) => (
                    <ReviewCard
                      key={review.id}
                      review={review}
                      justReviewedThisSession={review.is_mine && wasReviewedThisSession(stop.id)}
                      onReport={() => handleReport(review.id)}
                      onHide={() => handleHide(review.id)}
                    />
                  ))}
                </View>
              )}
            </View>
          </>
        )}

        <Button
          label={myReview ? 'Edit your review' : 'Write a review'}
          onPress={handleWriteReviewPress}
          fullWidth
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: Spacing.xxl,
  },
  imageHero: {
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookmarkBtn: {
    position: 'absolute',
    top: Spacing.smd,
    right: Spacing.smd,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.screen,
    gap: Spacing.smd,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.smd,
  },
  stopName: {
    ...Typography.title,
  },
  address: {
    ...Typography.body,
    marginTop: -Spacing.xs,
  },
  syncError: {
    ...Typography.caption,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.smd,
    borderRadius: Radius.xs,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
    lineHeight: 14,
  },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.screen,
    marginTop: Spacing.sm,
    gap: Spacing.smd,
  },
  centeredCard: {
    alignItems: 'center',
  },
  cardTitle: {
    ...Typography.subhead,
  },
  placeholder: {
    ...Typography.body,
  },
  scoreDetails: {
    gap: Spacing.sm,
  },
  ratingLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ratingLabel: {
    ...Typography.body,
  },
  ratingValue: {
    ...Typography.bodyMed,
  },
  reasonLine: {
    ...Typography.caption,
  },
  reviewsList: {
    gap: Spacing.smd,
  },
});
