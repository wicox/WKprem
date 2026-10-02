// Color logic for persons:
// If "Wojciech Kozioł" -> Zielony (Green), any other -> Żółty (Yellow)
export function getPersonColor(name: string) {
  const normalized = (name || '')
    .trim()
    .toLowerCase()
    .replace(/ł/g, 'l')
    .replace(/ó/g, 'o')
    .replace(/ą/g, 'a')
    .replace(/ę/g, 'e')
    .replace(/ś/g, 's')
    .replace(/ć/g, 'c')
    .replace(/ż/g, 'z')
    .replace(/ź/g, 'z')
    .replace(/ń/g, 'n');

  if (normalized.includes('wojciech koziol')) {
    return {
      bg: 'bg-emerald-100 dark:bg-emerald-950/60',
      text: 'text-emerald-800 dark:text-emerald-200',
      border: 'border-emerald-300 dark:border-emerald-700',
      dot: 'bg-emerald-500',
    };
  }

  // Any other person: Yellow / Amber
  return {
    bg: 'bg-amber-100 dark:bg-amber-950/60',
    text: 'text-amber-900 dark:text-amber-200',
    border: 'border-amber-300 dark:border-amber-700',
    dot: 'bg-amber-500',
  };
}

// Distinct, high-contrast colors for each billing month (1..12)
const MONTH_PALETTES: Record<number, { bg: string; text: string; border: string; dot: string }> = {
  1: {
    bg: 'bg-cyan-100 dark:bg-cyan-950/60',
    text: 'text-cyan-900 dark:text-cyan-200',
    border: 'border-cyan-400 dark:border-cyan-700',
    dot: 'bg-cyan-500',
  },
  2: {
    bg: 'bg-sky-100 dark:bg-sky-950/60',
    text: 'text-sky-900 dark:text-sky-200',
    border: 'border-sky-400 dark:border-sky-700',
    dot: 'bg-sky-500',
  },
  3: {
    bg: 'bg-lime-100 dark:bg-lime-950/60',
    text: 'text-lime-900 dark:text-lime-200',
    border: 'border-lime-400 dark:border-lime-700',
    dot: 'bg-lime-500',
  },
  4: {
    bg: 'bg-teal-100 dark:bg-teal-950/60',
    text: 'text-teal-900 dark:text-teal-200',
    border: 'border-teal-400 dark:border-teal-700',
    dot: 'bg-teal-500',
  },
  5: {
    // Maj: Fiolet
    bg: 'bg-purple-100 dark:bg-purple-950/60',
    text: 'text-purple-900 dark:text-purple-200',
    border: 'border-purple-400 dark:border-purple-700',
    dot: 'bg-purple-500',
  },
  6: {
    // Czerwiec: Indygo
    bg: 'bg-indigo-100 dark:bg-indigo-950/60',
    text: 'text-indigo-900 dark:text-indigo-200',
    border: 'border-indigo-400 dark:border-indigo-700',
    dot: 'bg-indigo-500',
  },
  7: {
    // Lipiec: Niebieski
    bg: 'bg-blue-100 dark:bg-blue-950/60',
    text: 'text-blue-900 dark:text-blue-200',
    border: 'border-blue-400 dark:border-blue-700',
    dot: 'bg-blue-500',
  },
  8: {
    // Sierpień: Pomarańczowy
    bg: 'bg-orange-100 dark:bg-orange-950/60',
    text: 'text-orange-900 dark:text-orange-200',
    border: 'border-orange-400 dark:border-orange-700',
    dot: 'bg-orange-500',
  },
  9: {
    // Wrzesień: Zielony
    bg: 'bg-emerald-100 dark:bg-emerald-950/60',
    text: 'text-emerald-900 dark:text-emerald-200',
    border: 'border-emerald-400 dark:border-emerald-700',
    dot: 'bg-emerald-500',
  },
  10: {
    // Październik: Fuchsia / Magenta
    bg: 'bg-fuchsia-100 dark:bg-fuchsia-950/60',
    text: 'text-fuchsia-900 dark:text-fuchsia-200',
    border: 'border-fuchsia-400 dark:border-fuchsia-700',
    dot: 'bg-fuchsia-500',
  },
  11: {
    // Listopad: Różowy / Rose
    bg: 'bg-rose-100 dark:bg-rose-950/60',
    text: 'text-rose-900 dark:text-rose-200',
    border: 'border-rose-400 dark:border-rose-700',
    dot: 'bg-rose-500',
  },
  12: {
    // Grudzień: Violet / Śliwka
    bg: 'bg-violet-100 dark:bg-violet-950/60',
    text: 'text-violet-900 dark:text-violet-200',
    border: 'border-violet-400 dark:border-violet-700',
    dot: 'bg-violet-500',
  },
};

export function getMonthColor(monthStr?: string) {
  if (!monthStr || !monthStr.includes('-')) {
    // Wolna (brak przypisanego miesiąca)
    return {
      bg: 'bg-slate-100 dark:bg-slate-800',
      text: 'text-slate-600 dark:text-slate-400',
      border: 'border-slate-300 dark:border-slate-700',
      dot: 'bg-slate-400',
    };
  }

  const parts = monthStr.split('-');
  const monthNum = parseInt(parts[1], 10);
  const palette = MONTH_PALETTES[monthNum] || MONTH_PALETTES[((monthNum - 1) % 12) + 1] || MONTH_PALETTES[7];
  return palette;
}

export function formatMonthName(monthStr: string): string {
  // Format YYYY-MM into Polish text, e.g. "2026-07" -> "lipiec 2026"
  if (!monthStr || !monthStr.includes('-')) return monthStr || 'Brak miesiąca';
  const [year, month] = monthStr.split('-');
  const monthNum = parseInt(month, 10);
  const months = [
    'styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec',
    'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'
  ];
  const mName = months[monthNum - 1] || month;
  return `${mName} ${year}`;
}

export function formatCurrency(amount: number, currency: string = 'PLN'): string {
  const rounded = (Math.round((amount || 0) * 100) / 100).toFixed(2).replace('.', ',');

  if (currency === 'EUR' || currency === '€') {
    return `${rounded} €`;
  }
  if (currency === 'PLN' || currency === 'zł') {
    return `${rounded} zł`;
  }
  return `${rounded} ${currency}`;
}

export function formatRate(rate: number): string {
  return (rate || 0).toFixed(4).replace('.', ',');
}
