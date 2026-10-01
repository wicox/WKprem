import React, { useState, useMemo } from 'react';
import { StoredInvoice } from '../types/bonus';
import { getPersonColor, formatCurrency, formatMonthName, formatRate } from '../utils/colors';
import { getEurExchangeRateForDate, getEurRateForEndOfMonth } from '../services/nbpService';
import { saveStoredInvoices } from '../services/storageService';
import {
  Database,
  Search,
  Filter,
  RefreshCw,
  CheckCircle,
  Lock,
  Unlock,
  Calendar,
  Layers,
  ArrowRight,
  TrendingUp,
  FileSpreadsheet,
  AlertCircle,
  Edit2,
  Trash2,
} from 'lucide-react';

interface DatabaseViewProps {
  invoices: StoredInvoice[];
  onInvoicesChange: (updated: StoredInvoice[]) => void;
  useEndOfMonthRate: boolean;
  onToggleEndOfMonthRate: (val: boolean) => void;
  onNavigateToSettlement: (prowadzacy: string, month: string) => void;
}

export const DatabaseView: React.FC<DatabaseViewProps> = ({
  invoices,
  onInvoicesChange,
  useEndOfMonthRate,
  onToggleEndOfMonthRate,
  onNavigateToSettlement,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterPerson, setFilterPerson] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'unsettled' | 'settled' | 'blocked'>('all');
  const [isUpdatingRates, setIsUpdatingRates] = useState(false);
  const [editingRateId, setEditingRateId] = useState<string | null>(null);
  const [customRateInput, setCustomRateInput] = useState<string>('');

  // Extract unique months and managers
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    invoices.forEach((inv) => {
      if (inv.miesiacRozliczeniowy) set.add(inv.miesiacRozliczeniowy);
    });
    return Array.from(set).sort().reverse();
  }, [invoices]);

  const availablePersons = useMemo(() => {
    const set = new Set<string>();
    invoices.forEach((inv) => {
      if (inv.prowadzacy) set.add(inv.prowadzacy);
    });
    return Array.from(set).sort();
  }, [invoices]);

  // Toggle lock for a single invoice
  const toggleInvoiceLock = (id: string) => {
    const updated = invoices.map((inv) => {
      if (inv.id === id) {
        return { ...inv, isBlocked: !inv.isBlocked };
      }
      return inv;
    });
    onInvoicesChange(updated);
    saveStoredInvoices(updated);
  };

  // Delete invoice
  const deleteInvoice = (id: string) => {
    if (confirm('Czy na pewno chcesz usunąć tę fakturę z bazy danych?')) {
      const updated = invoices.filter((i) => i.id !== id);
      onInvoicesChange(updated);
      saveStoredInvoices(updated);
    }
  };

  // Re-fetch exchange rates from NBP API
  const handleRefreshNbpRates = async () => {
    setIsUpdatingRates(true);
    try {
      // If useEndOfMonthRate is active, fetch month-end rates per month
      const monthRates: Record<string, { rate: number; tableNo: string; date: string }> = {};

      if (useEndOfMonthRate) {
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

          if (useEndOfMonthRate && monthRates[inv.miesiacRozliczeniowy]) {
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

          // Individual daily rate
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
    } catch (err) {
      console.error('Error refreshing NBP rates:', err);
    } finally {
      setIsUpdatingRates(false);
    }
  };

  // Save custom rate for a row
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

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // Month
      if (filterMonth !== 'all' && inv.miesiacRozliczeniowy !== filterMonth) {
        return false;
      }
      // Person
      if (filterPerson !== 'all' && inv.prowadzacy !== filterPerson) {
        return false;
      }
      // Status
      if (filterStatus === 'unsettled' && (inv.rozliczonaWId || inv.isBlocked)) {
        return false;
      }
      if (filterStatus === 'settled' && !inv.rozliczonaWId) {
        return false;
      }
      if (filterStatus === 'blocked' && !inv.isBlocked) {
        return false;
      }
      // Search
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const match =
          inv.nrFaktury.toLowerCase().includes(q) ||
          inv.projekt.toLowerCase().includes(q) ||
          inv.prowadzacy.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [invoices, filterMonth, filterPerson, filterStatus, searchTerm]);

  // Aggregate stats
  const stats = useMemo(() => {
    let eurTotal = 0;
    let plnTotal = 0;
    let totalPlnConverted = 0;
    let settledCount = 0;
    let blockedCount = 0;

    filteredInvoices.forEach((inv) => {
      if (inv.waluta === 'EUR') eurTotal += inv.netto;
      else plnTotal += inv.netto;
      totalPlnConverted += inv.kwotaPln;
      if (inv.rozliczonaWId) settledCount++;
      if (inv.isBlocked) blockedCount++;
    });

    return {
      count: filteredInvoices.length,
      eurTotal,
      plnTotal,
      totalPlnConverted,
      settledCount,
      blockedCount,
      estimatedBonus1Percent: Math.round(totalPlnConverted * 0.01 * 100) / 100,
    };
  }, [filteredInvoices]);

  return (
    <div className="space-y-6">
      {/* Header and Switchers */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 mb-2">
              <Database className="w-3.5 h-3.5" />
              Krok 2: Baza danych i historia
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Główna Baza Faktur i Kursów NBP
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
              Centralne repozytorium faktur z deduplikacją numerów, automatycznym pobieraniem kursów EUR/PLN z Tabeli A NBP oraz statusem rozliczeń w premiach.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Checkbox: Kurs z ostatniego dnia miesiąca */}
            <label className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/70 dark:bg-indigo-950/40 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={useEndOfMonthRate}
                onChange={(e) => {
                  onToggleEndOfMonthRate(e.target.checked);
                  setTimeout(handleRefreshNbpRates, 100);
                }}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <div className="text-xs">
                <span className="font-bold text-indigo-950 dark:text-indigo-200 block">
                  Kurs z ostatniego dnia miesiąca
                </span>
                <span className="text-[11px] text-indigo-700 dark:text-indigo-300">
                  Przelicza cały miesiąc jednym kursem NBP
                </span>
              </div>
            </label>

            <button
              onClick={handleRefreshNbpRates}
              disabled={isUpdatingRates}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isUpdatingRates ? 'animate-spin' : ''}`} />
              {isUpdatingRates ? 'Pobieranie z NBP...' : 'Aktualizuj kursy NBP'}
            </button>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 block">
              Liczba pozycji
            </span>
            <span className="text-lg font-bold text-slate-900 dark:text-white">
              {stats.count}{' '}
              <span className="text-xs font-normal text-slate-500">
                (z {invoices.length} łącznie)
              </span>
            </span>
          </div>

          <div className="p-3 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-indigo-700 dark:text-indigo-400 block">
              Suma Netto EUR
            </span>
            <span className="text-lg font-bold text-indigo-900 dark:text-indigo-200 font-mono">
              {formatCurrency(stats.eurTotal, 'EUR')}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-emerald-700 dark:text-emerald-400 block">
              Suma Netto PLN
            </span>
            <span className="text-lg font-bold text-emerald-900 dark:text-emerald-200 font-mono">
              {formatCurrency(stats.plnTotal, 'PLN')}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-blue-800 dark:text-blue-300 block">
              Łącznie przeliczone na PLN
            </span>
            <span className="text-lg font-bold text-blue-900 dark:text-blue-200 font-mono">
              {formatCurrency(stats.totalPlnConverted, 'PLN')}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-amber-800 dark:text-amber-300 block">
              Szacowana premia 1%
            </span>
            <span className="text-lg font-bold text-amber-900 dark:text-amber-200 font-mono">
              {formatCurrency(stats.estimatedBonus1Percent, 'PLN')}
            </span>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Szukaj po nr faktury, projekcie, nazwisku..."
              className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Month Filter */}
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-slate-400" />
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="text-xs py-2 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium outline-none"
            >
              <option value="all">Wszystkie miesiące</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {formatMonthName(m)} ({m})
                </option>
              ))}
            </select>
          </div>

          {/* Person Filter */}
          <div className="flex items-center gap-1.5">
            <select
              value={filterPerson}
              onChange={(e) => setFilterPerson(e.target.value)}
              className="text-xs py-2 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium outline-none"
            >
              <option value="all">Wszyscy prowadzący</option>
              {availablePersons.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="text-xs py-2 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium outline-none"
          >
            <option value="all">Wszystkie statusy</option>
            <option value="unsettled">Tylko nierozliczone (gotowe)</option>
            <option value="settled">Rozliczone w premiach</option>
            <option value="blocked">Zablokowane</option>
          </select>

          {/* Quick Settlement Shortcut */}
          {filterPerson !== 'all' && filterMonth !== 'all' && (
            <button
              onClick={() => onNavigateToSettlement(filterPerson, filterMonth)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Rozlicz: {filterPerson} ({formatMonthName(filterMonth)})
            </button>
          )}
        </div>
      </div>

      {/* Main Database Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/50 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-3 w-10 text-center">Blokada</th>
                <th className="py-3 px-3">Nr Faktury</th>
                <th className="py-3 px-3">Prowadzący</th>
                <th className="py-3 px-3">Projekt</th>
                <th className="py-3 px-3">Data Faktury</th>
                <th className="py-3 px-3 text-center">Miesiąc</th>
                <th className="py-3 px-3 text-right">Kwota Netto</th>
                <th className="py-3 px-3 text-center">Kurs EUR (NBP)</th>
                <th className="py-3 px-3 text-right font-bold text-slate-800 dark:text-slate-200">
                  Przeliczone PLN
                </th>
                <th className="py-3 px-3 text-center">Status Rozliczenia</th>
                <th className="py-3 px-3 text-right">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-500">
                    Brak faktur spełniających wybrane kryteria wyszukiwania.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const personColor = getPersonColor(inv.prowadzacy);
                  const isEur = inv.waluta === 'EUR';

                  return (
                    <tr
                      key={inv.id}
                      className={`transition-colors ${
                        inv.isBlocked
                          ? 'bg-red-50/70 dark:bg-red-950/30 text-red-900 dark:text-red-200 border-l-4 border-l-red-500'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {/* Blokada */}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => toggleInvoiceLock(inv.id)}
                          title={
                            inv.isBlocked
                              ? 'Faktura jest zablokowana. Kliknij aby odblokować do rozliczenia'
                              : 'Kliknij aby zablokować tę fakturę (nie wejdzie do premii)'
                          }
                          className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${
                            inv.isBlocked
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

                      {/* Prowadzący */}
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${personColor.bg} ${personColor.text} ${personColor.border}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${personColor.dot}`} />
                          {inv.prowadzacy}
                        </span>
                      </td>

                      {/* Projekt */}
                      <td className="py-2.5 px-3 font-medium text-slate-700 dark:text-slate-300 text-xs">
                        {inv.projekt}
                      </td>

                      {/* Data Faktury */}
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 text-xs font-mono">
                        {inv.dataFaktury}
                      </td>

                      {/* Miesiąc */}
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
                          {inv.miesiacRozliczeniowy}
                        </span>
                      </td>

                      {/* Kwota Netto */}
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-xs">
                        <span className="inline-flex items-center gap-1">
                          {formatCurrency(inv.netto, inv.waluta)}
                        </span>
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
                                  useEndOfMonthRate
                                    ? `Kurs końca miesiąca ${inv.miesiacRozliczeniowy}: ${inv.nrTabeliNbp || 'Tabela A NBP'}`
                                    : `Kurs NBP z dnia ${inv.dataKursuNbp || inv.dataFaktury} (${inv.nrTabeliNbp || 'Tabela A'})`
                                }
                              >
                                {inv.kursEurPln ? formatRate(inv.kursEurPln) : '4,3128'}
                              </span>
                              <button
                                onClick={() => {
                                  setEditingRateId(inv.id);
                                  setCustomRateInput(String(inv.kursEurPln || 4.3128));
                                }}
                                className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-blue-600 transition"
                                title="Ręczna edycja kursu dla tej faktury"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </div>
                          )
                        ) : (
                          <span className="text-[11px] text-slate-400 font-mono">1.0000 (PLN)</span>
                        )}
                      </td>

                      {/* Przeliczone PLN */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-xs text-blue-900 dark:text-blue-300">
                        {formatCurrency(inv.kwotaPln, 'PLN')}
                      </td>

                      {/* Status Rozliczenia */}
                      <td className="py-2.5 px-3 text-center">
                        {inv.rozliczonaWId ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            title={`Rozliczona w karcie: ${inv.rozliczonaWId}`}
                          >
                            <CheckCircle className="w-3 h-3" />
                            Rozliczona
                          </span>
                        ) : inv.isBlocked ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
                            <Lock className="w-3 h-3" />
                            Zablokowana
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            Nierozliczona
                          </span>
                        )}
                      </td>

                      {/* Akcje */}
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => deleteInvoice(inv.id)}
                          className="p-1 text-slate-400 hover:text-red-600 transition rounded"
                          title="Usuń fakturę z bazy"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
