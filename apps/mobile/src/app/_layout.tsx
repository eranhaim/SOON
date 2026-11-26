import {
  FrankRuhlLibre_300Light,
  FrankRuhlLibre_400Regular,
  FrankRuhlLibre_500Medium,
  FrankRuhlLibre_700Bold,
} from '@expo-google-fonts/frank-ruhl-libre';
import { Heebo_300Light, Heebo_400Regular, Heebo_500Medium, Heebo_700Bold } from '@expo-google-fonts/heebo';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { DialogHost } from '@/components/DialogHost';
import { GuideHost } from '@/components/GuideHost';
import { LangProvider } from '@/lib/lang';
import { QueryProvider } from '@/lib/query';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    FrankRuhlLibre_300Light,
    FrankRuhlLibre_400Regular,
    FrankRuhlLibre_500Medium,
    FrankRuhlLibre_700Bold,
    Heebo_300Light,
    Heebo_400Regular,
    Heebo_500Medium,
    Heebo_700Bold,
  });
  const ready = fontsLoaded || !!fontError;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <QueryProvider>
      <LangProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            animation: 'fade',
          }}>
          <Stack.Screen name="index" options={{ contentStyle: { backgroundColor: colors.night } }} />
        </Stack>
        <GuideHost />
        <DialogHost />
      </LangProvider>
    </QueryProvider>
  );
}
