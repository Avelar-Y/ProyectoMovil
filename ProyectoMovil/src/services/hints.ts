// Servicio centralizado para hints / tooltips de onboarding y micro-marketing.
// Persistimos en AsyncStorage qué hints ya se mostraron por clave.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'featureHints.seen';

let cache: Set<string> | null = null;

async function load(): Promise<Set<string>> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const arr: string[] = raw ? JSON.parse(raw) : [];
    cache = new Set(arr);
    return cache;
  } catch (e) {
    cache = new Set();
    return cache;
  }
}

async function persist() {
  if (!cache) return;
  try { await AsyncStorage.setItem(KEY, JSON.stringify(Array.from(cache))); } catch (e) {}
}

export async function shouldShowHint(id: string): Promise<boolean> {
  const s = await load();
  return !s.has(id);
}

export async function markHintSeen(id: string) {
  const s = await load();
  if (!s.has(id)) {
    s.add(id);
    await persist();
  }
}

export async function resetHints() { cache = null; await AsyncStorage.removeItem(KEY); }

// Posibles IDs: home_intro, service_flow, reservation_status, history_filters
