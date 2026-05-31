/**
 * Giyim günlüğü streak (üst üste gün) hesaplama.
 * worn_at tarihleri (YYYY-MM-DD) üzerinden bugünden/dünden geriye doğru kesintisiz seriyi sayar.
 */

export interface StreakResult {
  current: number;       // mevcut kesintisiz seri (gün)
  longest: number;       // en uzun seri
  loggedToday: boolean;  // bugün kayıt var mı
  atRisk: boolean;       // seri var ama bugün henüz kayıt yok (akşam hatırlatma için)
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function calculateStreak(wornDates: string[]): StreakResult {
  if (!wornDates || wornDates.length === 0) {
    return { current: 0, longest: 0, loggedToday: false, atRisk: false };
  }

  // Benzersiz tarih seti (YYYY-MM-DD)
  const days = new Set(wornDates.map((d) => d.slice(0, 10)));
  const today = toDateKey(new Date());
  const yesterday = toDateKey(new Date(Date.now() - 86_400_000));

  const loggedToday = days.has(today);

  // Mevcut seri: bugünden veya dünden başlayarak geriye say
  let current = 0;
  let cursor: Date;
  if (loggedToday) {
    cursor = new Date();
  } else if (days.has(yesterday)) {
    cursor = new Date(Date.now() - 86_400_000);
  } else {
    cursor = new Date(NaN); // seri kopmuş
  }

  if (!Number.isNaN(cursor.getTime())) {
    while (days.has(toDateKey(cursor))) {
      current += 1;
      cursor = new Date(cursor.getTime() - 86_400_000);
    }
  }

  // En uzun seri: tüm tarihleri sırala, ardışıkları say
  const sorted = [...days].sort();
  let longest = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const key of sorted) {
    const d = new Date(key + "T00:00:00Z");
    if (prev && d.getTime() - prev.getTime() === 86_400_000) {
      run += 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
    prev = d;
  }

  return {
    current,
    longest,
    loggedToday,
    atRisk: current > 0 && !loggedToday,
  };
}
