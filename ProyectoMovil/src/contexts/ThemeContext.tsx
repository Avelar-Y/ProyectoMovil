import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeName = 'light' | 'dark';

// Improved palettes for better contrast and legibility
const LIGHT = {
  background: '#FFFFFF',        // pure white background
  card: '#F8FAFC',             // slight off-white for cards to separate from background
  text: '#0F1724',             // darker text for high contrast
  muted: '#4B5563',            // readable muted color
  primary: '#1D4ED8',          // strong blue (tailwind blue-700)
  surface: '#F3F4F6',          // surfaces / footers
  inputBg: '#FFFFFF',          // inputs remain white with clear border
  border: '#E5E7EB',           // subtle border
};

const DARK = {
  background: '#061025',       // deep dark blue/charcoal
  card: '#07162A',             // slightly lighter than background for cards
  text: '#E6EEF8',             // soft off-white for text
  muted: '#9AA4B2',            // muted gray-blue
  primary: '#3B82F6',          // brighter blue for actions (tailwind blue-500)
  surface: '#071428',          // surface color
  inputBg: '#0B1624',         // input background for contrast
  border: '#1F2A37',          // border in dark mode
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
