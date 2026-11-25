import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/** Small per-device flags ("tour seen"). localStorage on web, SecureStore on phones. Never throws. */
export async function getFlag(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function setFlag(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') localStorage.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  } catch {
    // A missed flag only means the tour may show once more.
  }
}
