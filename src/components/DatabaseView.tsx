import React, { useState, useMemo } from 'react';
import { StoredInvoice, InvoiceStatus, AppSettings, DatabaseFilters } from '../types/bonus';
import { getPersonColor, formatCurrency, formatMonthName, formatRate } from '../utils/colors';
import { getEurExchangeRateForDate, getEurRateForEndOfMonth } from '../services/nbpService';
import { saveStoredInvoices, saveAppSettings } from '../services/storageService';
import {
  Database,
  Search,
  RefreshCw,
  CheckCircle,
  Lock,
  Unlock,
  Calendar,
  FileSpreadsheet,
  Trash2,
  Plus,
  Sparkles,
  CheckSquare,
  Square,
  Bookmark,
  X,
  Edit2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

interface DatabaseViewProps {
  invoices: StoredInvoice[];
  onInvoicesChange: (updated: StoredInvoice[]) => void;
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  onNavigateToSettlement: (month: string) => void;
}

const DEFAULT_FILTERS: DatabaseFilters = {
  rangeStartMonth: 'all',
  rangeEndMonth: 'all',
  includeFreeInvoices: true,
  filterStatus: 'all',
  searchTerm: '',
  sortField: null,
  sortDirection: 'asc',
};

export const DatabaseView: React.FC<DatabaseViewProps> = ({
  invoices,
  onInvoicesChange,
  settings,
  onSettingsChange,
  onNavigateToSettlement,
}) => {
  // Read persistent filters from settings (or defaults) so tab switching NEVER resets selection
  const filters: DatabaseFilters = settings.dbFilters || DEFAULT_FILTERS;

  const updateFilters = (partial: Partial<DatabaseFilters>) => {
    const updatedFilters = { ...filters, ...partial };
    const updatedSettings = { ...settings, dbFilters: updatedFilters };
    onSettingsChange(updatedSettings);
    saveAppSettings(updatedSettings);
  };

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isUpdatingRates, setIsUpdatingRates] = useState(false);
  const [editingRateId, setEditingRateId] = useState<string | null>(null);
  const [customRateInput, setCustomRateInput] = useState<string>('');

  // Auto-allocate algorithm state
  const [targetAmountInput, setTargetAmountInput] = useState<string>('200000');
  const [targetMonthSelect, setTargetMonthSelect] = useState<string>(settings.activeMonth || '2026-08');
  const [isAutoAllocModalOpen, setIsAutoAllocModalOpen] = useState(false);

  // New month creation modal
  const [isNewMonthModalOpen, setIsNewMonthModalOpen] = useState(false);
  const [newMonthInput, setNewMonthInput] = useState<string>('2026-11');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Sorted list of months
  const availableMonths = useMemo(() => {
    const list = [...(settings.customMonths || [])];
    invoices.forEach((inv) => {
      if (inv.miesiacRozliczeniowy && !list.includes(inv.miesiacRozliczeniowy)) {
        list.push(inv.miesiacRozliczeniowy);
      }
    });
    return Array.from(new Set(list)).sort();
  }, [invoices, settings.customMonths]);

  // Handle adding new month
  const handleAddNewMonth = () => {
    const trimmed = newMonthInput.trim();
    if (!trimmed) return;
    if (!availableMonths.includes(trimmed)) {
      const updatedMonths = [...availableMonths, trimmed].sort();
      const updatedSettings = { ...settings, customMonths: updatedMonths };
      onSettingsChange(updatedSettings);
      saveAppSettings(updatedSettings);
      setTargetMonthSelect(trimmed);
      setFeedbackMessage(`Dodano nowy miesiąc rozliczeniowy: ${formatMonthName(trimmed)} (${trimmed})`);
      setTimeout(() => setFeedbackMessage(null), 4000);
    }
    setIsNewMonthModalOpen(false);
  };

  // Toggle column sorting
  const handleHeaderSort = (field: string) => {
    if (filters.sortField === field) {
      if (filters.sortDirection === 'asc') {
        updateFilters({ sortDirection: 'desc' });
      } else {
        updateFilters({ sortField: null, sortDirection: 'asc' });
      }
    } else {
      updateFilters({ sortField: field, sortDirection: 'asc' });
    }
  };

  // Toggle single item selection (only if not ROZLICZONA)
  const toggleSelectRow = (inv: StoredInvoice) => {
    if (inv.status === 'ROZLICZONA') {
      alert('Ta faktura jest ROZLICZONA i nie może być modyfikowana ani usunięta. Aby ją odblokować, cofnij rozliczenie w Karcie Premii.');
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(inv.id)) next.delete(inv.id);
      else next.add(inv.id);
      return next;
    });
  };

  // Filtered and sorted invoices
  const filteredAndSortedInvoices = useMemo(() => {
    let result = invoices.filter((inv) => {
      const isFree = !inv.miesiacRozliczeniowy || inv.status === 'WOLNA';

      if (isFree) {
        if (!filters.includeFreeInvoices) return false;
      } else {
        if (filters.rangeStartMonth !== 'all' && inv.miesiacRozliczeniowy < filters.rangeStartMonth) {
          return false;
        }
        if (filters.rangeEndMonth !== 'all' && inv.miesiacRozliczeniowy > filters.rangeEndMonth) {
          return false;
        }
      }

      if (filters.filterStatus === 'WOLNA' && inv.status !== 'WOLNA') return false;
      if (filters.filterStatus === 'ZAREZERWOWANA' && inv.status !== 'ZAREZERWOWANA') return false;
      if (filters.filterStatus === 'ROZLICZONA' && inv.status !== 'ROZLICZONA') return false;
      if (filters.filterStatus === 'BLOCKED' && !inv.isBlocked) return false;

      if (filters.searchTerm.trim()) {
        const q = filters.searchTerm.toLowerCase();
        const match =
          inv.nrFaktury.toLowerCase().includes(q) ||
          inv.projekt.toLowerCase().includes(q) ||
          inv.prowadzacy.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });

    // Sorting
    if (filters.sortField) {
      const field = filters.sortField;
      const factor = filters.sortDirection === 'asc' ? 1 : -1;

      result = [...result].sort((a: any, b: any) => {
        let valA = a[field];
        let valB = b[field];

        if (valA === undefined || valA === null) valA = '';
        if (valB === undefined || valB === null) valB = '';

        if (typeof valA === 'number' && typeof valB === 'number') {
          return (valA - valB) * factor;
        }
        return String(valA).localeCompare(String(valB), 'pl', { numeric: true }) * factor;
      });
    }

    return result;
  }, [invoices, filters]);

  const selectableVisibleIds = useMemo(() => {
    return filteredAndSortedInvoices.filter((i) => i.status !== 'ROZLICZONA').map((i) => i.id);
  }, [filteredAndSortedInvoices]);

  const isAllSelectableSelected =
    selectableVisibleIds.length > 0 && selectableVisibleIds.every((id) => selectedIds.has(id));

  const handleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (isAllSelectableSelected) {
        selectableVisibleIds.forEach((id) => next.delete(id));
      } else {
        selectableVisibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    if (confirm(`Czy na pewno chcesz usunąć zaznaczone (${selectedIds.size}) faktury z bazy danych?`)) {
      const updated = invoices.filter((i) => !selectedIds.has(i.id));
      onInvoicesChange(updated);
      saveStoredInvoices(updated);
      setSelectedIds(new Set());
      setFeedbackMessage(`Usunięto pomyślnie ${selectedIds.size} faktur.`);
      setTimeout(() => setFeedbackMessage(null), 4000);
    }
  };

  const handleBatchAssignMonth = (monthVal: string) => {
    if (selectedIds.size === 0) return;
    const updated = invoices.map((inv) => {
      if (selectedIds.has(inv.id) && inv.status !== 'ROZLICZONA') {
        return {
          ...inv,
          miesiacRozliczeniowy: monthVal,
          status: monthVal ? ('ZAREZERWOWANA' as InvoiceStatus) : ('WOLNA' as InvoiceStatus),
        };
      }
      return inv;
    });
    onInvoicesChange(updated);
    saveStoredInvoices(updated);
    setSelectedIds(new Set());
    setFeedbackMessage(
      monthVal
        ? `Przypisano ${selectedIds.size} faktur do miesiąca: ${formatMonthName(monthVal)} (status: ZAREZERWOWANA).`
        : `Uwolniono ${selectedIds.size} faktur (status: WOLNA).`
    );
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  const handleInvoiceMonthChange = (id: string, newMonth: string) => {
    const targetInv = invoices.find((i) => i.id === id);
    if (targetInv && targetInv.status === 'ROZLICZONA') {
      alert('Ta faktura jest ROZLICZONA i nie można jej zmienić miesiąca. Aby dokonać zmian, wejdź w Kartę Premii i cofnij rozliczenie.');
      return;
    }

    const updated = invoices.map((inv) => {
      if (inv.id === id) {
        return {
          ...inv,
          miesiacRozliczeniowy: newMonth,
          status: newMonth ? ('ZAREZERWOWANA' as InvoiceStatus) : ('WOLNA' as InvoiceStatus),
        };
      }
      return inv;
    });
    onInvoicesChange(updated);
    saveStoredInvoices(updated);
  };

  const toggleInvoiceLock = (inv: StoredInvoice) => {
    if (inv.status === 'ROZLICZONA') {
      alert('Ta faktura jest ROZLICZONA i nie można zmienić jej blokady.');
      return;
    }
    const updated = invoices.map((i) => {
      if (i.id === inv.id) {
        return { ...i, isBlocked: !i.isBlocked };
      }
      return i;
    });
    onInvoicesChange(updated);
    saveStoredInvoices(updated);
  };

  const handleAutoAllocateInvoices = () => {
    const target = parseFloat(targetAmountInput.replace(/\s+/g, '').replace(',', '.'));
    if (isNaN(target) || target <= 0) {
      alert('Wpisz poprawną kwotę docelową w PLN (np. 150000)');
      return;
    }

    const freeInvoices = invoices.filter((i) => !i.isBlocked && (!i.miesiacRozliczeniowy || i.status === 'WOLNA'));
    freeInvoices.sort((a, b) => a.dataFaktury.localeCompare(b.dataFaktury));

    let accumulatedPln = 0;
    const assignedIds = new Set<string>();

    for (const inv of freeInvoices) {
      if (accumulatedPln >= target) break;
      assignedIds.add(inv.id);
      accumulatedPln += inv.kwotaPln;
    }

    if (assignedIds.size === 0) {
      alert('Brak wolnych (nierozliczonych) faktur w bazie danych do przydziału!');
      return;
    }

    const updated = invoices.map((inv) => {
      if (assignedIds.has(inv.id)) {
        return {
          ...inv,
          miesiacRozliczeniowy: targetMonthSelect,
          status: 'ZAREZERWOWANA' as InvoiceStatus,
        };
      }
      return inv;
    });

    onInvoicesChange(updated);
    saveStoredInvoices(updated);
    setIsAutoAllocModalOpen(false);
    setFeedbackMessage(
      `Algorytm dobrał ${assignedIds.size} faktur o wartości ${formatCurrency(accumulatedPln, 'PLN')} do miesiąca ${formatMonthName(targetMonthSelect)}!`
    );
    setTimeout(() => setFeedbackMessage(null), 6000);
  };

  const handleRefreshNbpRates = async () => {
    setIsUpdatingRates(true);
    try {
      const monthRates: Record<string, { rate: number; tableNo: string; date: string }> = {};

      if (settings.useEndOfMonthRate) {
        for (const m of availableMonths) {
          const res = await getEurRateForEndOfMonth(m);
          monthRates[m] = {
            rate: res.rate,
            tableNo: res.tableNo,
            date: res.effectiveDate,
          };
        }
      }

      const updated = await Promise.all(
        invoices.map(async (inv) => {
          if (inv.waluta !== 'EUR') {
            return {
              ...inv,
              kursEurPln: 1.0,
              kwotaPln: inv.netto,
            };
          }

          if (settings.useEndOfMonthRate && inv.miesiacRozliczeniowy && monthRates[inv.miesiacRozliczeniowy]) {
            const mRate = monthRates[inv.miesiacRozliczeniowy];
            const kwotaPln = Math.round(inv.netto * mRate.rate * 100) / 100;
            return {
              ...inv,
              kursEurPln: mRate.rate,
              nrTabeliNbp: mRate.tableNo,
              dataKursuNbp: mRate.date,
              kwotaPln,
            };
          }

          const rateRes = await getEurExchangeRateForDate(inv.dataFaktury);
          const kwotaPln = Math.round(inv.netto * rateRes.rate * 100) / 100;
          return {
            ...inv,
            kursEurPln: rateRes.rate,
            nrTabeliNbp: rateRes.tableNo,
            dataKursuNbp: rateRes.effectiveDate,
            kwotaPln,
          };
        })
      );

      onInvoicesChange(updated);
      saveStoredInvoices(updated);
      setFeedbackMessage('Zaktualizowano kursy EUR z Narodowego Banku Polskiego!');
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (err) {
      console.error('Error refreshing NBP rates:', err);
    } finally {
      setIsUpdatingRates(false);
    }
  };

  const handleSaveCustomRate = (id: string) => {
    const parsed = parseFloat(customRateInput.replace(',', '.'));
    if (!isNaN(parsed) && parsed > 0) {
      const updated = invoices.map((inv) => {
        if (inv.id === id) {
          const kwotaPln = inv.waluta === 'EUR' ? Math.round(inv.netto * parsed * 100) / 100 : inv.netto;
          return {
            ...inv,
            kursEurPln: parsed,
            kwotaPln,
            nrTabeliNbp: 'Ręczna korekta',
          };
        }
        return inv;
      });
      onInvoicesChange(updated);
      saveStoredInvoices(updated);
    }
    setEditingRateId(null);
  };

  // Exact Monetary Summary Statistics (Amounts only, no counts)
  const stats = useMemo(() => {
    let sumWolnePln = 0;
    let sumZarezerwowanePln = 0;
    let sumRozliczonePln = 0;
    let totalPln = 0;

    filteredAndSortedInvoices.forEach((inv) => {
      totalPln += inv.kwotaPln;
      if (inv.status === 'ROZLICZONA') {
        sumRozliczonePln += inv.kwotaPln;
      } else if (inv.status === 'ZAREZERWOWANA') {
        sumZarezerwowanePln += inv.kwotaPln;
      } else {
        sumWolnePln += inv.kwotaPln;
      }
    });

    sumWolnePln = Math.round(sumWolnePln * 100) / 100;
    sumZarezerwowanePln = Math.round(sumZarezerwowanePln * 100) / 100;
    sumRozliczonePln = Math.round(sumRozliczonePln * 100) / 100;
    totalPln = Math.round(totalPln * 100) / 100;
    const bonus1Percent = Math.round(totalPln * 0.01 * 100) / 100;

    return {
      sumWolnePln,
      sumZarezerwowanePln,
      sumRozliczonePln,
      totalPln,
      bonus1Percent,
    };
  }, [filteredAndSortedInvoices]);

  // Render sort icon on headers
  const renderSortIndicator = (field: string) => {
    if (filters.sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 inline ml-1" />;
    }
    return filters.sortDirection === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-blue-600 inline ml-1 font-bold" />
    ) : (
      <ArrowDown className="w-3 h-3 text-blue-600 inline ml-1 font-bold" />
    );
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 mb-2">
              <Database className="w-3.5 h-3.5" />
              Krok 2: Baza danych i historia faktur
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Baza Faktur i Przypisania Miesięcy
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
              Zakres miesięcy i filtry są <strong>automatycznie zapamiętywane</strong> po przechodzeniu między zakładkami. Kliknij nagłówek kolumny, aby posortować rekordy.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setIsNewMonthModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition"
              title="Dodaj nowy miesiąc rozliczeniowy"
            >
              <Plus className="w-3.5 h-3.5 text-blue-600" />
              Nowy miesiąc
            </button>

            <button
              onClick={() => setIsAutoAllocModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition"
              title="Dobierz wolne faktury do zadanej kwoty PLN"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              Dobierz faktury do kwoty
            </button>

            <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/70 dark:bg-indigo-950/40 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={settings.useEndOfMonthRate}
                onChange={(e) => {
                  const updated = { ...settings, useEndOfMonthRate: e.target.checked };
                  onSettingsChange(updated);
                  saveAppSettings(updated);
                }}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                Kurs z końca miesiąca
              </span>
            </label>

            <button
              onClick={handleRefreshNbpRates}
              disabled={isUpdatingRates}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isUpdatingRates ? 'animate-spin' : ''}`} />
              {isUpdatingRates ? 'Pobieranie...' : 'Aktualizuj NBP'}
            </button>
          </div>
        </div>

        {feedbackMessage && (
          <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center justify-between">
            <span>{feedbackMessage}</span>
            <button onClick={() => setFeedbackMessage(null)} className="text-emerald-600 hover:text-emerald-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Monetary Summary Statistics Bar */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
          <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-amber-800 dark:text-amber-400 block">
              Kwota Wolne
            </span>
            <span className="text-base sm:text-lg font-bold text-amber-900 dark:text-amber-200 font-mono">
              {formatCurrency(stats.sumWolnePln, 'PLN')}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-blue-800 dark:text-blue-400 block">
              Kwota Zarezerwowane
            </span>
            <span className="text-base sm:text-lg font-bold text-blue-900 dark:text-blue-200 font-mono">
              {formatCurrency(stats.sumZarezerwowanePln, 'PLN')}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-emerald-800 dark:text-emerald-400 block">
              Kwota Rozliczone
            </span>
            <span className="text-base sm:text-lg font-bold text-emerald-900 dark:text-emerald-200 font-mono">
              {formatCurrency(stats.sumRozliczonePln, 'PLN')}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-indigo-800 dark:text-indigo-300 block">
              Łączna suma PLN w zakresie
            </span>
            <span className="text-base sm:text-lg font-bold text-indigo-900 dark:text-indigo-200 font-mono">
              {formatCurrency(stats.totalPln, 'PLN')}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-900 text-white dark:bg-slate-800 border border-slate-700">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-300 block">
              Premia 1% (Brutto)
            </span>
            <span className="text-base sm:text-lg font-bold text-white font-mono">
              {formatCurrency(stats.bonus1Percent, 'PLN')}
            </span>
          </div>
        </div>

        {/* Range Filters: Od - Do & Search */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={filters.searchTerm}
              onChange={(e) => updateFilters({ searchTerm: e.target.value })}
              placeholder="Szukaj po nr faktury, projekcie..."
              className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Month Range: OD */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Od:</span>
            <select
              value={filters.rangeStartMonth}
              onChange={(e) => updateFilters({ rangeStartMonth: e.target.value })}
              className="text-xs py-2 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium outline-none"
            >
              <option value="all">Początek</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {formatMonthName(m)} ({m})
                </option>
              ))}
            </select>
          </div>

          {/* Month Range: DO */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Do:</span>
            <select
              value={filters.rangeEndMonth}
              onChange={(e) => updateFilters({ rangeEndMonth: e.target.value })}
              className="text-xs py-2 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium outline-none"
            >
              <option value="all">Koniec</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {formatMonthName(m)} ({m})
                </option>
              ))}
            </select>
          </div>

          {/* Include Free Invoices toggle */}
          <label className="flex items-center gap-1.5 px-2.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filters.includeFreeInvoices}
              onChange={(e) => updateFilters({ includeFreeInvoices: e.target.checked })}
              className="w-3.5 h-3.5 text-blue-600 rounded"
            />
            <span className="text-slate-700 dark:text-slate-300 font-medium">
              Pokaż wolne (bez miesiąca)
            </span>
          </label>

          {/* Status Filter */}
          <select
            value={filters.filterStatus}
            onChange={(e) => updateFilters({ filterStatus: e.target.value })}
            className="text-xs py-2 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium outline-none"
          >
            <option value="all">Wszystkie statusy</option>
            <option value="WOLNA">Tylko wolne</option>
            <option value="ZAREZERWOWANA">Zarezerwowane</option>
            <option value="ROZLICZONA">Rozliczone</option>
            <option value="BLOCKED">Zablokowane</option>
          </select>
        </div>
      </div>

      {/* Group Action Toolbar */}
      {selectedIds.size > 0 && (
        <div className="bg-slate-900 text-white dark:bg-slate-800 p-3.5 rounded-xl shadow-lg flex flex-wrap items-center justify-between gap-3 border border-slate-700">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold bg-blue-600 px-2.5 py-1 rounded">
              Zaznaczono: {selectedIds.size}
            </span>
            <span className="text-xs text-slate-300">
              Akcje dla zaznaczonych (faktury rozliczone są chronione):
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-400">Przypisz do:</span>
              <select
                onChange={(e) => {
                  if (e.target.value) handleBatchAssignMonth(e.target.value);
                }}
                defaultValue=""
                className="text-xs py-1.5 px-2 rounded bg-slate-800 dark:bg-slate-700 text-white border border-slate-600 outline-none"
              >
                <option value="" disabled>
                  Wybierz miesiąc...
                </option>
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthName(m)} ({m})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => handleBatchAssignMonth('')}
              className="px-2.5 py-1.5 text-xs font-semibold rounded bg-amber-600 hover:bg-amber-700 text-white transition"
              title="Usuń przypisanie do miesiąca (status WOLNA)"
            >
              Uwolnij
            </button>

            <button
              onClick={handleBatchDelete}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-red-600 hover:bg-red-700 text-white transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Usuń zaznaczone ({selectedIds.size})
            </button>

            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-2.5 py-1.5 text-xs rounded bg-slate-700 hover:bg-slate-600 text-slate-200 transition"
            >
              Odznacz
            </button>
          </div>
        </div>
      )}

      {/* Main Database Table with Clickable Sort Headers */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/50 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider select-none">
                <th className="py-3 px-3 w-10 text-center">
                  <button
                    type="button"
                    onClick={handleSelectAllVisible}
                    className="p-1 hover:text-blue-600"
                    title={isAllSelectableSelected ? 'Odznacz wszystkie' : 'Zaznacz wszystkie nierozliczone'}
                  >
                    {isAllSelectableSelected ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-3 w-10 text-center">Blokada</th>

                <th
                  onClick={() => handleHeaderSort('nrFaktury')}
                  className="py-3 px-3 cursor-pointer hover:text-blue-600 transition"
                >
                  Nr Faktury {renderSortIndicator('nrFaktury')}
                </th>

                <th
                  onClick={() => handleHeaderSort('projekt')}
                  className="py-3 px-3 cursor-pointer hover:text-blue-600 transition"
                >
                  Projekt {renderSortIndicator('projekt')}
                </th>

                <th
                  onClick={() => handleHeaderSort('dataFaktury')}
                  className="py-3 px-3 cursor-pointer hover:text-blue-600 transition"
                >
                  Data wystawienia {renderSortIndicator('dataFaktury')}
                </th>

                <th
                  onClick={() => handleHeaderSort('miesiacRozliczeniowy')}
                  className="py-3 px-3 text-center min-w-[150px] cursor-pointer hover:text-blue-600 transition"
                >
                  Miesiąc {renderSortIndicator('miesiacRozliczeniowy')}
                </th>

                <th
                  onClick={() => handleHeaderSort('netto')}
                  className="py-3 px-3 text-right cursor-pointer hover:text-blue-600 transition"
                >
                  Netto {renderSortIndicator('netto')}
                </th>

                <th
                  onClick={() => handleHeaderSort('kursEurPln')}
                  className="py-3 px-3 text-center cursor-pointer hover:text-blue-600 transition"
                >
                  Kurs EUR {renderSortIndicator('kursEurPln')}
                </th>

                <th
                  onClick={() => handleHeaderSort('kwotaPln')}
                  className="py-3 px-3 text-right font-bold text-slate-800 dark:text-slate-200 cursor-pointer hover:text-blue-600 transition"
                >
                  Przeliczone PLN {renderSortIndicator('kwotaPln')}
                </th>

                <th
                  onClick={() => handleHeaderSort('status')}
                  className="py-3 px-3 text-center cursor-pointer hover:text-blue-600 transition"
                >
                  Status {renderSortIndicator('status')}
                </th>

                <th
                  onClick={() => handleHeaderSort('prowadzacy')}
                  className="py-3 px-3 cursor-pointer hover:text-blue-600 transition"
                >
                  Prowadzący {renderSortIndicator('prowadzacy')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredAndSortedInvoices.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-500">
                    Brak faktur spełniających wybrane kryteria zakresu.
                  </td>
                </tr>
              ) : (
                filteredAndSortedInvoices.map((inv) => {
                  const personColor = getPersonColor(inv.prowadzacy);
                  const isEur = inv.waluta === 'EUR';
                  const isSettled = inv.status === 'ROZLICZONA';
                  const isSelected = selectedIds.has(inv.id);

                  return (
                    <tr
                      key={inv.id}
                      className={`transition-colors ${
                        inv.isBlocked
                          ? 'bg-red-50/70 dark:bg-red-950/30 text-red-900 dark:text-red-200 border-l-4 border-l-red-500'
                          : isSettled
                          ? 'bg-emerald-50/30 dark:bg-emerald-950/20 text-slate-900 dark:text-white'
                          : isSelected
                          ? 'bg-blue-50/60 dark:bg-blue-950/40 text-slate-900 dark:text-white'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {/* Checkbox (disabled if settled) */}
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="checkbox"
                          disabled={isSettled}
                          checked={isSelected}
                          onChange={() => toggleSelectRow(inv)}
                          className={`w-4 h-4 rounded text-blue-600 focus:ring-blue-500 ${
                            isSettled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                          }`}
                          title={isSettled ? 'Faktura rozliczona - nie można zaznaczyć do usunięcia' : 'Zaznacz fakturę'}
                        />
                      </td>

                      {/* Lock (disabled if settled) */}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          disabled={isSettled}
                          onClick={() => toggleInvoiceLock(inv)}
                          title={
                            isSettled
                              ? 'Faktura jest rozliczona. Aby odblokować, cofnij rozliczenie w Karcie Premii.'
                              : inv.isBlocked
                              ? 'Odblokuj fakturę'
                              : 'Zablokuj fakturę'
                          }
                          className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${
                            isSettled
                              ? 'bg-slate-100 text-slate-400 opacity-60 cursor-not-allowed'
                              : inv.isBlocked
                              ? 'bg-red-600 text-white hover:bg-red-700'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-red-600 hover:bg-red-50'
                          }`}
                        >
                          {inv.isBlocked ? (
                            <Lock className="w-3.5 h-3.5" />
                          ) : (
                            <Unlock className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </td>

                      {/* Nr Faktury */}
                      <td className="py-2.5 px-3 font-mono font-medium text-xs">
                        {inv.nrFaktury}
                      </td>

                      {/* Projekt */}
                      <td className="py-2.5 px-3 font-medium text-slate-700 dark:text-slate-300 text-xs">
                        {inv.projekt}
                      </td>

                      {/* Data wystawienia faktury */}
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 text-xs font-mono">
                        {inv.dataFaktury}
                      </td>

                      {/* Editable Miesiąc Rozliczeniowy (Locked if settled) */}
                      <td className="py-2.5 px-3 text-center">
                        {isSettled ? (
                          <div
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 cursor-not-allowed"
                            title="Faktura jest ROZLICZONA. Miesiąc jest całkowicie zablokowany."
                          >
                            <Lock className="w-3 h-3 text-emerald-700" />
                            {formatMonthName(inv.miesiacRozliczeniowy)}
                          </div>
                        ) : (
                          <select
                            value={inv.miesiacRozliczeniowy || ''}
                            onChange={(e) => handleInvoiceMonthChange(inv.id, e.target.value)}
                            className={`text-xs py-1 px-2 rounded-md font-medium border outline-none cursor-pointer transition ${
                              inv.miesiacRozliczeniowy
                                ? 'bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800'
                                : 'bg-slate-50 text-slate-500 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                            }`}
                            title="Kliknij, aby zmienić miesiąc rozliczeniowy"
                          >
                            <option value="">— Wolna (brak) —</option>
                            {availableMonths.map((m) => (
                              <option key={m} value={m}>
                                {formatMonthName(m)} ({m})
                              </option>
                            ))}
                          </select>
                        )}
                      </td>

                      {/* Kwota Netto */}
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-xs">
                        {formatCurrency(inv.netto, inv.waluta)}
                      </td>

                      {/* Kurs EUR */}
                      <td className="py-2.5 px-3 text-center">
                        {isEur ? (
                          editingRateId === inv.id ? (
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="text"
                                value={customRateInput}
                                onChange={(e) => setCustomRateInput(e.target.value)}
                                className="w-16 text-center text-xs p-1 rounded border border-blue-400 bg-white dark:bg-slate-900 font-mono"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveCustomRate(inv.id)}
                                className="px-1.5 py-1 text-[10px] bg-emerald-600 text-white rounded font-bold"
                              >
                                OK
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1 group">
                              <span
                                className="font-mono text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-medium"
                                title={
                                  settings.useEndOfMonthRate
                                    ? `Kurs końca miesiąca: ${inv.nrTabeliNbp || 'Tabela A NBP'}`
                                    : `Kurs NBP z dnia ${inv.dataKursuNbp || inv.dataFaktury} (${inv.nrTabeliNbp || 'Tabela A'})`
                                }
                              >
                                {inv.kursEurPln ? formatRate(inv.kursEurPln) : '4,3128'}
                              </span>
                              {!isSettled && (
                                <button
                                  onClick={() => {
                                    setEditingRateId(inv.id);
                                    setCustomRateInput(String(inv.kursEurPln || 4.3128));
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-blue-600 transition"
                                  title="Ręczna edycja kursu"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          )
                        ) : (
                          <span className="text-[11px] text-slate-400 font-mono">1,0000 (PLN)</span>
                        )}
                      </td>

                      {/* Przeliczone PLN */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-xs text-blue-900 dark:text-blue-300">
                        {formatCurrency(inv.kwotaPln, 'PLN')}
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 text-center">
                        {inv.status === 'ROZLICZONA' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            <CheckCircle className="w-3 h-3" />
                            Rozliczona
                          </span>
                        ) : inv.status === 'ZAREZERWOWANA' || inv.miesiacRozliczeniowy ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                            <Bookmark className="w-3 h-3" />
                            Zarezerwowana
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            Wolna
                          </span>
                        )}
                      </td>

                      {/* Prowadzący */}
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${personColor.bg} ${personColor.text} ${personColor.border}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${personColor.dot}`} />
                          {inv.prowadzacy}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Stwórz nowy miesiąc */}
      {isNewMonthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              Stwórz nowy miesiąc rozliczeniowy
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
              Wpisz oznaczenie miesiąca w formacie YYYY-MM (np. <code>2026-11</code>).
            </p>
            <div className="space-y-3">
              <div>
                <input
                  type="text"
                  value={newMonthInput}
                  onChange={(e) => setNewMonthInput(e.target.value)}
                  placeholder="2026-11"
                  className="w-full text-sm p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  autoFocus
                />
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsNewMonthModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={handleAddNewMonth}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white"
              >
                Dodaj miesiąc
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Algorytm dobierania wolnych faktur do kwoty */}
      {isAutoAllocModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-xl">
            <div className="flex items-center gap-2 mb-2 text-indigo-600">
              <Sparkles className="w-5 h-5" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Algorytm doboru wolnych faktur
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
              Wpisz docelową kwotę rozliczenia (w PLN). Algorytm pobierze wolne faktury chronologicznie, aż suma osiągnie wskazaną wartość.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Docelowa kwota rozliczenia (PLN)
                </label>
                <input
                  type="text"
                  value={targetAmountInput}
                  onChange={(e) => setTargetAmountInput(e.target.value)}
                  placeholder="np. 200000"
                  className="w-full text-base font-mono font-bold p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Do jakiego miesiąca przypisać faktury?
                </label>
                <select
                  value={targetMonthSelect}
                  onChange={(e) => setTargetMonthSelect(e.target.value)}
                  className="w-full text-sm p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                >
                  {availableMonths.map((m) => (
                    <option key={m} value={m}>
                      {formatMonthName(m)} ({m})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAutoAllocModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={handleAutoAllocateInvoices}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Dobierz i przypisz faktury
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
