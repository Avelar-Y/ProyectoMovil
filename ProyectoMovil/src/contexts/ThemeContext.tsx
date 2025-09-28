import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';

type ThemeName = 'light' | 'dark';
type ThemePreference = 'light' | 'dark' | 'system';

// Extended palettes
const LIGHT = {
  background: '#FFFFFF',
  card: '#F8FAFC',
  text: '#0F1724',
  muted: '#4B5563',
  primary: '#1D4ED8',
  surface: '#F3F4F6',
  inputBg: '#FFFFFF',
  border: '#E5E7EB',
  accent: '#10B981',       // emerald 500
  danger: '#DC2626',       // red 600
  overlay: 'rgba(0,0,0,0.4)',
  elevation1: '#FFFFFF',
  elevation2: '#F1F5F9',
  tabBar: 'rgba(255,255,255,0.92)',
  highlight: '#DBEAFE',
};

const DARK = {
  background: '#040B18',
  card: '#0A1624',
  text: '#E6EEF8',
  muted: '#98A4B3',
  primary: '#3B82F6',
  surface: '#0C1E33',
  inputBg: '#0F2439',
  border: '#1E2B38',
  accent: '#14B8A6',       // teal 500
  danger: '#F87171',       // red 400
  overlay: 'rgba(0,0,0,0.55)',
  elevation1: '#0F2236',
  elevation2: '#132C45',
  tabBar: 'rgba(13,30,50,0.92)',
  highlight: '#1E3A8A',
};

interface ThemeContextValue {
  themeName: ThemeName;         // resolved (actual) theme in uso
  preference: ThemePreference;  // preferencia del usuario (incluye system)
  colors: typeof LIGHT;
  setPreference: (p: ThemePreference) => void;
  toggle: () => void;           // alterna solo entre light/dark y fija preference explícita
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [preference, setPreference] = useState<ThemePreference>('light');
  const [themeName, setThemeName] = useState<ThemeName>('light');

  // cargar preferencia inicial
  useEffect(() => {
    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem('themePreference');
        if (stored === 'dark' || stored === 'light' || stored === 'system') {
          setPreference(stored);
        }
      } catch {}
    };
    load();
  }, []);

  // escuchar cambios de apariencia del sistema cuando preference = system
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      if (preference === 'system') {
        setThemeName(colorScheme === 'dark' ? 'dark' : 'light');
      }
    });
    return () => sub.remove();
  }, [preference]);

  // recalcular themeName al cambiar preference
  useEffect(() => {
    if (preference === 'system') {
      const scheme = Appearance.getColorScheme();
      setThemeName(scheme === 'dark' ? 'dark' : 'light');
    } else {
      setThemeName(preference);
    }
    AsyncStorage.setItem('themePreference', preference).catch(() => null);
  }, [preference]);

  const setPreferenceSafe = React.useCallback((p: ThemePreference) => setPreference(p), []);
  const toggle = React.useCallback(() => {
    setPreferenceSafe(preference === 'dark' ? 'light' : 'dark');
  }, [preference, setPreferenceSafe]);

  const colors = React.useMemo(() => (themeName === 'light' ? LIGHT : DARK), [themeName]);
  const value = React.useMemo<ThemeContextValue>(() => ({ themeName, preference, colors, setPreference: setPreferenceSafe, toggle }), [themeName, preference, colors, toggle, setPreferenceSafe]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
};

export default ThemeContext;
