/**
 * App language preference (Hebrew / English). Stored per device.
 * The full English translation is a separate step; until then choosing English shows a
 * short notice and the app stays in Hebrew.
 */
import { createContext, useContext, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

export type Lang = 'he' | 'en';

const KEY = 'soon.lang';
const read = (): Lang => {
  try {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === 'en') return 'en';
  } catch {
    // storage blocked: default
  }
  return 'he';
};

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: 'he', setLang: () => undefined });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setState] = useState<Lang>(read);
  const setLang = (l: Lang) => {
    setState(l);
    try {
      if (Platform.OS === 'web') localStorage.setItem(KEY, l);
    } catch {
      // ignore
    }
  };
  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);

/** Whether the English UI is available yet. */
export const ENGLISH_READY = false;
