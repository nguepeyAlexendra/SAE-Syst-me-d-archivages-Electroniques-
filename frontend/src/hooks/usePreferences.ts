import { useState, useEffect } from 'react';

export interface Preferences {
  themeColor: 'entreprise' | 'violet' | 'steel' | 'crimson' | 'brown' | 'vert' | 'or';
  sidebarTheme: 'colored' | 'dark';
  density: 'comfortable' | 'compact';
  startPage: 'dashboard' | 'documents';
  linesPerPage: number;
  weeklyEmail: boolean;
}

const KEY = 'sae_preferences';

const DEFAULT_PREFERENCES: Preferences = {
  themeColor: 'entreprise',
  sidebarTheme: 'colored',
  density: 'comfortable',
  startPage: 'dashboard',
  linesPerPage: 20,
  weeklyEmail: false,
};

function lire(): Preferences {
  try {
    const s = localStorage.getItem(KEY);
    return s ? { ...DEFAULT_PREFERENCES, ...JSON.parse(s) } : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function usePreferences() {
  const [preferences, setPreferences] = useState<Preferences>(lire);

  // 🔄 Synchronise toutes les instances (Layout + PreferencesSheet)
  useEffect(() => {
    const reload = () => setPreferences(lire());
    window.addEventListener('sae:preferences', reload);
    return () => window.removeEventListener('sae:preferences', reload);
  }, []);

  // 🎨 Couleur primaire
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-entreprise', 'theme-violet', 'theme-steel', 'theme-crimson', 'theme-brown', 'theme-vert', 'theme-or');
    root.classList.add(`theme-${preferences.themeColor}`);
  }, [preferences.themeColor]);

  const updatePreference = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    const next = { ...preferences, [key]: value };
    localStorage.setItem(KEY, JSON.stringify(next));
    setPreferences(next);
    window.dispatchEvent(new Event('sae:preferences'));
  };

  const resetPreferences = () => {
    localStorage.setItem(KEY, JSON.stringify(DEFAULT_PREFERENCES));
    setPreferences(DEFAULT_PREFERENCES);
    window.dispatchEvent(new Event('sae:preferences'));
  };

  return { preferences, updatePreference, resetPreferences };
}