import {
  FrankRuhlLibre_400Regular,
  FrankRuhlLibre_500Medium,
} from '@expo-google-fonts/frank-ruhl-libre';
import { Heebo_300Light, Heebo_400Regular, Heebo_500Medium } from '@expo-google-fonts/heebo';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    FrankRuhlLibre_400Regular,
    FrankRuhlLibre_500Medium,
    Heebo_300Light,
    Heebo_400Regular,
    Heebo_500Medium,
  });
  const ready = fontsLoaded || !!fontError;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'fade',
        }}>
        <Stack.Screen name="index" options={{ contentStyle: { backgroundColor: colors.night } }} />
      </Stack>
    </>
  );
}
