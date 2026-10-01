// Consistent distinctive color mapping for person names
const PALETTES = [
  { bg: 'bg-blue-100 dark:bg-blue-950/50', text: 'text-blue-800 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800', dot: 'bg-blue-500' },
  { bg: 'bg-emerald-100 dark:bg-emerald-950/50', text: 'text-emerald-800 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800', dot: 'bg-emerald-500' },
  { bg: 'bg-purple-100 dark:bg-purple-950/50', text: 'text-purple-800 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800', dot: 'bg-purple-500' },
  { bg: 'bg-amber-100 dark:bg-amber-950/50', text: 'text-amber-900 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800', dot: 'bg-amber-500' },
  { bg: 'bg-rose-100 dark:bg-rose-950/50', text: 'text-rose-800 dark:text-rose-300', border: 'border-rose-200 dark:border-rose-800', dot: 'bg-rose-500' },
  { bg: 'bg-cyan-100 dark:bg-cyan-950/50', text: 'text-cyan-800 dark:text-cyan-300', border: 'border-cyan-200 dark:border-cyan-800', dot: 'bg-cyan-500' },
  { bg: 'bg-indigo-100 dark:bg-indigo-950/50', text: 'text-indigo-800 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-800', dot: 'bg-indigo-500' },
  { bg: 'bg-teal-100 dark:bg-teal-950/50', text: 'text-teal-800 dark:text-teal-300', border: 'border-teal-200 dark:border-teal-800', dot: 'bg-teal-500' },
  { bg: 'bg-orange-100 dark:bg-orange-950/50', text: 'text-orange-800 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-800', dot: 'bg-orange-500' },
  { bg: 'bg-violet-100 dark:bg-violet-950/50', text: 'text-violet-800 dark:text-violet-300', border: 'border-violet-200 dark:border-violet-800', dot: 'bg-violet-500' },
];

export function getPersonColor(name: string) {
  if (!name) return PALETTES[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PALETTES.length;
  return PALETTES[index];
}

export function formatMonthName(monthStr: string): string {
  // Format YYYY-MM into Polish text, e.g. "2026-07" -> "lipiec 2026"
  if (!monthStr || !monthStr.includes('-')) return monthStr;
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
  const formatted = new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  if (currency === 'EUR' || currency === '€') {
    return `${formatted} €`;
  }
  if (currency === 'PLN' || currency === 'zł') {
    return `${formatted} zł`;
  }
  return `${formatted} ${currency}`;
}

export function formatRate(rate: number): string {
  return new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(rate);
}
