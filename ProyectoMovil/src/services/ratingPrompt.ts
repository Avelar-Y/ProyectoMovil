// Utilidad simple para decidir si mostrar un prompt de calificación / reseña.
// Estrategia: después de N reservas completadas (ej. 3, luego 10) y sólo si no se ha mostrado previamente.
// Se apoya en AsyncStorage para persistir hits locales. En futuro se puede mover a backend.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'ratingPrompt';
const COMPLETED_COUNT_KEY = `${KEY_PREFIX}:completedCount`;
const ASKED_KEY = `${KEY_PREFIX}:askedStages`; // JSON array de etapas ya mostradas

// Etapas en las que queremos gatillar el prompt.
const STAGES = [3, 10];

export async function incrementCompletedReservations() {
  try {
    const raw = await AsyncStorage.getItem(COMPLETED_COUNT_KEY);
    const current = raw ? parseInt(raw, 10) : 0;
    const next = current + 1;
    await AsyncStorage.setItem(COMPLETED_COUNT_KEY, String(next));
    return next;
  } catch (e) {
    return 0;
  }
}

export interface RatingCheckResult {
  shouldAsk: boolean;
  stage?: number; // número de la etapa alcanzada
}

export async function shouldAskForRating(): Promise<RatingCheckResult> {
  try {
    const raw = await AsyncStorage.getItem(COMPLETED_COUNT_KEY);
    const count = raw ? parseInt(raw, 10) : 0;
    const askedRaw = await AsyncStorage.getItem(ASKED_KEY);
    const asked: number[] = askedRaw ? JSON.parse(askedRaw) : [];

    for (const stage of STAGES) {
      if (count >= stage && !asked.includes(stage)) {
        return { shouldAsk: true, stage };
      }
    }
    return { shouldAsk: false };
  } catch (e) {
    return { shouldAsk: false };
  }
}

export async function markRatingAsked(stage: number) {
  try {
    const askedRaw = await AsyncStorage.getItem(ASKED_KEY);
    const asked: number[] = askedRaw ? JSON.parse(askedRaw) : [];
    if (!asked.includes(stage)) {
      asked.push(stage);
      await AsyncStorage.setItem(ASKED_KEY, JSON.stringify(asked));
    }
  } catch (e) {}
}

// Helper directo para flujo de reserva completada.
export async function notifyReservationCompletedAndCheck(): Promise<RatingCheckResult> {
  const total = await incrementCompletedReservations();
  const res = await shouldAskForRating();
  return res;
}
