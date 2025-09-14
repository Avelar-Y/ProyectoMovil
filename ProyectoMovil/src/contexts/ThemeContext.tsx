import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeName = 'light' | 'dark';

const LIGHT = {
  background: '#ffffff',
  card: '#ffffff',
  text: '#111827',
  muted: '#6b7280',
  primary: '#2563eb',
  surface: '#f5f6fa',
  inputBg: '#ffffff',
  border: '#e6e6e6',
};

const DARK = {
  background: '#0b1220',
  card: '#071022cc',
  text: '#e6eef8',
  muted: '#9aa4b2',
  primary: '#4f8cff',
  surface: '#071022',
  inputBg: '#0f1724',
  border: '#1f2937',
};

const ThemeContext = createContext<{
  themeName: ThemeName;
  colors: typeof LIGHT;
  toggle: () => void;
} | null>(null);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [themeName, setThemeName] = useState<ThemeName>('light');

  useEffect(() => {
    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem('theme');
        if (stored === 'dark' || stored === 'light') setThemeName(stored);
      } catch (e) {
        // ignore
      }
    };
    load();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem('theme', themeName).catch(() => null);
  }, [themeName]);

  const toggle = () => setThemeName(t => (t === 'light' ? 'dark' : 'light'));

  const colors = themeName === 'light' ? LIGHT : DARK;

  return (
    <ThemeContext.Provider value={{ themeName, colors, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
};

export default ThemeContext;
