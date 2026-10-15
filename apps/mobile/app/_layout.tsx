import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as Sentry from '@sentry/react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import 'react-native-reanimated';

import { AuthProvider } from '@/contexts/auth';
import { SavedStopsProvider } from '@/contexts/saved-stops';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { initMonitoring } from '@/lib/monitoring';

// No-op unless EXPO_PUBLIC_SENTRY_DSN is set.
initMonitoring();

function CrashFallback({ resetError }: { resetError: () => void }) {
  return (
    <View style={styles.fallback}>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.body}>HerStop hit an unexpected problem. Please try again.</Text>
      <Pressable accessibilityRole="button" onPress={resetError} style={styles.button}>
        <Text style={styles.buttonText}>Try again</Text>
      </Pressable>
    </View>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <Sentry.ErrorBoundary fallback={({ resetError }) => <CrashFallback resetError={resetError} />}>
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {/* AuthProvider is outermost so SavedStopsProvider (and its future
          Supabase-backed version) can read the signed-in user via useAuth(). */}
      <AuthProvider>
        <SavedStopsProvider>
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="stop/[id]"
              options={{ title: 'Stop Details', headerBackTitle: 'Back' }}
            />
            <Stack.Screen
              name="review/[stopId]"
              options={{ presentation: 'modal', title: 'Write a Review' }}
            />
            <Stack.Screen
              name="legal/privacy"
              options={{ title: 'Privacy Policy', headerBackTitle: 'Back' }}
            />
            <Stack.Screen
              name="legal/support"
              options={{ title: 'Support', headerBackTitle: 'Back' }}
            />
            <Stack.Screen
              name="legal/safety-disclosure"
              options={{ title: 'Safety Disclosure', headerBackTitle: 'Back' }}
            />
          </Stack>
          <StatusBar style="auto" />
        </SavedStopsProvider>
      </AuthProvider>
    </ThemeProvider>
    </Sentry.ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FAFAFA',
  },
  title: { fontSize: 20, fontWeight: '600', color: '#1C1C1E', marginBottom: 8 },
  body: { fontSize: 15, color: '#6E6E73', textAlign: 'center', marginBottom: 20 },
  button: { backgroundColor: '#7c5556', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
