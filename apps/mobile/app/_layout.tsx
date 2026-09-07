import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { AuthProvider } from '@/contexts/auth';
import { SavedStopsProvider } from '@/contexts/saved-stops';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
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
          </Stack>
          <StatusBar style="auto" />
        </SavedStopsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
