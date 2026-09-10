import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/contexts/auth';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** Which step of the sign-in flow is showing, when the user is signed out. */
type Step = 'enter-email' | 'enter-code';

/**
 * Supabase lets each project choose how many digits its email codes have
 * (6–10), so accept that whole range instead of hardcoding one length.
 * Hardcoding 6 once made an 8-digit code impossible to type.
 */
const OTP_MIN_LENGTH = 6;
const OTP_MAX_LENGTH = 10;

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const { user, isGuest, loading, sendOtp, verifyOtp, signOut } = useAuth();

  const [step, setStep] = useState<Step>('enter-email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputStyle = [
    styles.input,
    { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border },
  ];

  async function handleSendOtp() {
    setError(null);
    setBusy(true);
    const { error: sendError } = await sendOtp(email.trim());
    setBusy(false);
    if (sendError) {
      setError(sendError);
      return;
    }
    setStep('enter-code');
  }

  async function handleVerifyOtp() {
    setError(null);
    setBusy(true);
    const { error: verifyError } = await verifyOtp(email.trim(), code.trim());
    setBusy(false);
    if (verifyError) {
      setError(verifyError);
      return;
    }
    // Signed in — the auth context updates and this screen re-renders below.
    setCode('');
  }

  function handleChangeEmail() {
    setError(null);
    setCode('');
    setStep('enter-email');
  }

  async function handleSignOut() {
    await signOut();
    // Reset the local sign-in flow too — expo-router keeps tab screens
    // mounted, so without this a re-visit after sign-out would still show
    // the stale "enter the code" step for the old email instead of the
    // guest form.
    setStep('enter-email');
    setEmail('');
    setCode('');
    setError(null);
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top + Spacing.sm },
      ]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Profile</Text>
      </View>

      {loading ? (
        <Card style={styles.card}>
          <ActivityIndicator color={colors.tint} />
        </Card>
      ) : !isGuest && user ? (
        <Card style={styles.card}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Signed in as {user.email}
          </Text>
          <Text style={[styles.cardBody, { color: colors.secondaryText }]}>
            Your saved stops and reviews will carry over across devices.
          </Text>
          <Button
            label="Sign out"
            variant="ghost"
            onPress={() => void handleSignOut()}
            style={styles.actionButton}
          />
        </Card>
      ) : step === 'enter-email' ? (
        <Card style={styles.card}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            You’re browsing as a guest
          </Text>
          <Text style={[styles.cardBody, { color: colors.secondaryText }]}>
            Sign in to save stops across devices and leave reviews for other travelers.
          </Text>
          <TextInput
            style={inputStyle}
            placeholder="you@example.com"
            placeholderTextColor={colors.secondaryText}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            editable={!busy}
          />
          {error && <Text style={styles.errorText}>{error}</Text>}
          <Button
            label={busy ? 'Sending…' : 'Send code'}
            onPress={() => void handleSendOtp()}
            disabled={busy || email.trim().length === 0}
            style={[styles.actionButton, busy && styles.buttonBusy]}
          />
        </Card>
      ) : (
        <Card style={styles.card}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Enter the code sent to your email
          </Text>
          <Text style={[styles.cardBody, { color: colors.secondaryText }]}>
            We sent a sign-in code to {email}.
          </Text>
          <TextInput
            style={inputStyle}
            placeholder="Code from your email"
            placeholderTextColor={colors.secondaryText}
            value={code}
            // Keep digits only, so a pasted code with spaces still works.
            onChangeText={(text) => setCode(text.replace(/\D/g, ''))}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={OTP_MAX_LENGTH}
            editable={!busy}
            testID="otp-code-input"
          />
          {error && <Text style={styles.errorText}>{error}</Text>}
          <Button
            label={busy ? 'Verifying…' : 'Verify'}
            onPress={() => void handleVerifyOtp()}
            disabled={busy || code.length < OTP_MIN_LENGTH}
            style={[styles.actionButton, busy && styles.buttonBusy]}
          />
          <Button
            label="Use a different email"
            variant="ghost"
            onPress={handleChangeEmail}
            disabled={busy}
            style={styles.actionButton}
          />
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.screen,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.title,
  },
  card: {
    padding: Spacing.screen,
    gap: Spacing.sm,
  },
  cardTitle: {
    ...Typography.bodyMed,
    fontWeight: '600',
  },
  cardBody: {
    ...Typography.body,
    fontSize: 15,
    lineHeight: 22,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.smd,
    fontSize: 16,
  },
  actionButton: {
    marginTop: Spacing.xs,
  },
  buttonBusy: {
    opacity: 0.6,
  },
  errorText: {
    ...Typography.caption,
    color: '#C0392B',
  },
});
