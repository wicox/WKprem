import React, { useState, useMemo, useRef } from 'react';
import { StoredInvoice, AppSettings } from '../types/bonus';
import { formatCurrency, formatMonthName } from '../utils/colors';
import { downloadElementAsJpg, downloadElementAsPdf } from '../services/exportService';
import * as XLSX from 'xlsx';
import {
  PieChart,
  Printer,
  FileSpreadsheet,
  Image as ImageIcon,
  Download,
  Calendar,
  Layers,
} from 'lucide-react';

interface ProjectAllocationViewProps {
  invoices: StoredInvoice[];
  settings: AppSettings;
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
}

export const ProjectAllocationView: React.FC<ProjectAllocationViewProps> = ({
  invoices,
  settings,
  selectedMonth,
  onSelectMonth,
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [viewMode, setViewMode] = useState<'itemized' | 'aggregated'>('itemized');
  const [notification, setNotification] = useState<string | null>(null);

  const currentMonth = selectedMonth || settings.activeMonth || '2026-07';

  const availableMonths = useMemo(() => {
    const list = [...(settings.customMonths || [])];
    invoices.forEach((i) => {
      if (i.miesiacRozliczeniowy && !list.includes(i.miesiacRozliczeniowy)) {
        list.push(i.miesiacRozliczeniowy);
      }
    });
    return Array.from(new Set(list)).sort().reverse();
  }, [invoices, settings.customMonths]);

  // All eligible invoices in this month
  const eligibleInvoices = useMemo(() => {
    return invoices.filter(
      (inv) => inv.miesiacRozliczeniowy === currentMonth && !inv.isBlocked
    );
  }, [invoices, currentMonth]);

  // Active rate
  const activeRate = useMemo(() => {
    const eurInv = eligibleInvoices.find((i) => i.waluta === 'EUR' && i.kursEurPln);
    return eurInv?.kursEurPln || 4.3128;
  }, [eligibleInvoices]);

  // Grand total converted PLN and exact 1% bonus to guarantee 1-to-1 match with Karta Premii
  const { exactBonus1Percent } = useMemo(() => {
    let totalPln = 0;
    eligibleInvoices.forEach((inv) => {
      if (inv.waluta === 'EUR') {
        const rate = settings.useEndOfMonthRate ? activeRate : (inv.kursEurPln || activeRate);
        totalPln += inv.netto * rate;
      } else {
        totalPln += inv.netto;
      }
    });
    const exact = Math.round(totalPln * 0.01 * 100) / 100;
    return { exactBonus1Percent: exact };
  }, [eligibleInvoices, activeRate, settings.useEndOfMonthRate]);

  // Itemized rows
  const itemizedRows = useMemo(() => {
    const rows = eligibleInvoices.map((inv, idx) => {
      const rate = inv.waluta === 'EUR' ? (settings.useEndOfMonthRate ? activeRate : (inv.kursEurPln || activeRate)) : 1.0;
      const kwotaPln = inv.waluta === 'EUR' ? inv.netto * rate : inv.netto;
      const chargePln = Math.round(kwotaPln * 0.01 * 100) / 100;

      return {
        lp: idx + 1,
        projekt: inv.projekt,
        nrFaktury: inv.nrFaktury,
        kwotaWaluta: inv.netto,
        waluta: inv.waluta,
        chargePln,
      };
    });

    if (rows.length > 0) {
      const sumOfRounded = rows.reduce((acc, r) => acc + r.chargePln, 0);
      const diff = Math.round((exactBonus1Percent - sumOfRounded) * 100) / 100;
      if (Math.abs(diff) > 0 && Math.abs(diff) < 0.1) {
        rows[rows.length - 1].chargePln = Math.round((rows[rows.length - 1].chargePln + diff) * 100) / 100;
      }
    }

    return rows;
  }, [eligibleInvoices, activeRate, settings.useEndOfMonthRate, exactBonus1Percent]);

  // Aggregated by project
  const aggregatedRows = useMemo(() => {
    const map = new Map<
      string,
      { kwotaEur: number; kwotaPln: number; chargePln: number; count: number }
    >();

    eligibleInvoices.forEach((inv) => {
      const rate = inv.waluta === 'EUR' ? (settings.useEndOfMonthRate ? activeRate : (inv.kursEurPln || activeRate)) : 1.0;
      const kwotaPln = inv.waluta === 'EUR' ? inv.netto * rate : inv.netto;
      const charge = Math.round(kwotaPln * 0.01 * 100) / 100;

      const cur = map.get(inv.projekt) || { kwotaEur: 0, kwotaPln: 0, chargePln: 0, count: 0 };
      if (inv.waluta === 'EUR') cur.kwotaEur += inv.netto;
      else cur.kwotaPln += inv.netto;
      cur.chargePln += charge;
      cur.count += 1;
      map.set(inv.projekt, cur);
    });

    const rows = Array.from(map.entries()).map(([projekt, data], idx) => ({
      lp: idx + 1,
      projekt,
      kwotaEur: data.kwotaEur,
      kwotaPln: data.kwotaPln,
      chargePln: Math.round(data.chargePln * 100) / 100,
      count: data.count,
    }));

    if (rows.length > 0) {
      const sumOfRounded = rows.reduce((acc, r) => acc + r.chargePln, 0);
      const diff = Math.round((exactBonus1Percent - sumOfRounded) * 100) / 100;
      if (Math.abs(diff) > 0 && Math.abs(diff) < 0.1) {
        rows[rows.length - 1].chargePln = Math.round((rows[rows.length - 1].chargePln + diff) * 100) / 100;
      }
    }

    return rows;
  }, [eligibleInvoices, activeRate, settings.useEndOfMonthRate, exactBonus1Percent]);

  const monthLabel = formatMonthName(currentMonth);

  const rowDensityClass = useMemo(() => {
    const count = viewMode === 'itemized' ? itemizedRows.length : aggregatedRows.length;
    if (count > 28) return 'py-0.5 px-2 text-[10px] leading-tight';
    if (count > 18) return 'py-1 px-3 text-[11px] leading-snug';
    return 'py-1.5 px-4 text-xs';
  }, [viewMode, itemizedRows.length, aggregatedRows.length]);

  // Export to Excel
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const rows: (string | number)[][] = [
      [`Premia ${settings.beneficiaryName} - ${monthLabel}`],
      ['Premia - kwoty z podziałem na projekty.'],
      [],
      ['Lp.', 'Projekt', 'Kwota EUR - Projekt-Serwis', 'Kwota obciążenia - Projekt-Serwis'],
    ];

    itemizedRows.forEach((r) => {
      rows.push([
        r.lp,
        r.projekt,
        `${r.kwotaWaluta.toFixed(2).replace('.', ',')} ${r.waluta === 'EUR' ? '€' : 'zł'}`,
        `${r.chargePln.toFixed(2).replace('.', ',')} zł`,
      ]);
    });

    rows.push([]);
    rows.push(['', '', 'SUMA OBCIĄŻEŃ:', `${exactBonus1Percent.toFixed(2).replace('.', ',')} zł`]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Podział na Projekty');
    XLSX.writeFile(wb, `Obciazenie_Projektow_${settings.beneficiaryName.replace(/\s+/g, '_')}_${currentMonth}.xlsx`);
  };

  // Export to PDF
  const handleExportPdf = async () => {
    if (!printRef.current) return;
    setIsExporting(true);
    try {
      await downloadElementAsPdf(
        printRef.current,
        `Obciazenie_Projektow_${settings.beneficiaryName.replace(/\s+/g, '_')}_${currentMonth}.pdf`
      );
      setNotification('Pomyślnie wygenerowano i pobrano plik PDF!');
      setTimeout(() => setNotification(null), 4000);
    } catch (err) {
      console.error('PDF export failed', err);
      window.print();
    } finally {
      setIsExporting(false);
    }
  };

  // Export to JPG
  const handleExportJpg = async () => {
    if (!printRef.current) return;
    setIsExporting(true);
    try {
      await downloadElementAsJpg(
        printRef.current,
        `Obciazenie_Projektow_${settings.beneficiaryName.replace(/\s+/g, '_')}_${currentMonth}.jpg`
      );
      setNotification('Pomyślnie wygenerowano i pobrano plik JPG!');
      setTimeout(() => setNotification(null), 4000);
    } catch (err) {
      console.error('JPG export failed', err);
      alert('Nie udało się wygenerować JPG: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Control Toolbar */}
      <div className="print:hidden bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800 mb-2">
              <PieChart className="w-3.5 h-3.5" />
              Krok 4: Podział obciążenia na projekty (Wzór 02.jpg)
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Obciążenie Projektów 1%: {settings.beneficiaryName}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Kalkulacja kwoty obciążenia Projekt-Serwis dla każdego projektu. Suma końcowa zgadza się 1-do-1 co do grosza z kwotą 1% Premii Brutto.
            </p>
          </div>

          {/* Action Export Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition"
              title="Drukuj bezpośrednio na A4 bez nagłówków i stopki"
            >
              <Printer className="w-3.5 h-3.5" />
              Drukuj A4
            </button>
            <button
              onClick={handleExportPdf}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              {isExporting ? 'Generowanie...' : 'PDF'}
            </button>
            <button
              onClick={handleExportJpg}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition disabled:opacity-50"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              {isExporting ? 'Generowanie...' : 'JPG'}
            </button>
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel (.xlsx)
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              <Calendar className="w-3.5 h-3.5 text-purple-600" />
              Miesiąc Rozliczeniowy
            </label>
            <select
              value={currentMonth}
              onChange={(e) => onSelectMonth(e.target.value)}
              className="w-full text-sm py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium outline-none focus:ring-2 focus:ring-purple-500"
            >
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {formatMonthName(m)} ({m})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              <Layers className="w-3.5 h-3.5 text-purple-600" />
              Układ Tabeli
            </label>
            <div className="flex rounded-lg border border-slate-300 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setViewMode('itemized')}
                className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition ${
                  viewMode === 'itemized'
                    ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Pozycja po pozycji (02.jpg)
              </button>
              <button
                type="button"
                onClick={() => setViewMode('aggregated')}
                className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition ${
                  viewMode === 'aggregated'
                    ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Zagregowane wg projektu
              </button>
            </div>
          </div>
        </div>
      </div>

      {notification && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-800 dark:text-emerald-200 text-xs font-medium">
          {notification}
        </div>
      )}

      {/* Exact Sheet 02.jpg Printable Container (A4 portrait 1-page fit) */}
      <div className="flex justify-center">
        <div
          ref={printRef}
          className="a4-print-sheet w-full max-w-[820px] bg-white text-black p-6 sm:p-10 shadow-md rounded-lg border border-slate-200 font-sans print:border-none print:shadow-none print:p-0 print:m-0"
        >
          {/* Header matching 02.jpg */}
          <div className="text-center mb-4">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-black mb-1">
              Premia {settings.beneficiaryName} - {monthLabel}
            </h2>
            <h3 className="text-sm sm:text-base font-bold text-black">
              Premia - kwoty z podziałem na projekty.
            </h3>
          </div>

          {/* Table matching 02.jpg */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border-2 border-black">
              <thead>
                <tr className="border-b-2 border-black bg-slate-50 font-bold text-center">
                  <th className="border border-black py-2 px-2 w-12 text-center font-bold">
                    Lp.
                  </th>
                  <th className="border border-black py-2 px-4 text-center font-bold">
                    Projekt
                  </th>
                  <th className="border border-black py-2 px-4 text-center font-bold">
                    Kwota EUR - Projekt-Serwis
                  </th>
                  <th className="border border-black py-2 px-4 text-center font-bold">
                    Kwota obciążenia - Projekt-Serwis
                  </th>
                </tr>
              </thead>
              <tbody>
                {viewMode === 'itemized' ? (
                  itemizedRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="border border-black py-8 text-center text-slate-500 italic">
                        Brak projektów do obciążenia dla wybranego okresu.
                      </td>
                    </tr>
                  ) : (
                    itemizedRows.map((row) => (
                      <tr key={row.lp} className="border-b border-black hover:bg-slate-50/50">
                        <td className={`border border-black text-center font-mono ${rowDensityClass}`}>
                          {row.lp}
                        </td>
                        <td className={`border border-black font-medium ${rowDensityClass}`}>
                          {row.projekt}
                        </td>
                        <td className={`border border-black text-right font-mono font-medium ${rowDensityClass}`}>
                          {formatCurrency(row.kwotaWaluta, row.waluta)}
                        </td>
                        <td className={`border border-black text-right font-mono font-bold ${rowDensityClass}`}>
                          {formatCurrency(row.chargePln, 'PLN')}
                        </td>
                      </tr>
                    ))
                  )
                ) : (
                  aggregatedRows.map((row) => (
                    <tr key={row.lp} className="border-b border-black hover:bg-slate-50/50">
                      <td className={`border border-black text-center font-mono ${rowDensityClass}`}>
                        {row.lp}
                      </td>
                      <td className={`border border-black font-medium ${rowDensityClass}`}>
                        {row.projekt}
                        {row.count > 1 && (
                          <span className="text-[10px] text-slate-500 ml-2">({row.count} faktury)</span>
                        )}
                      </td>
                      <td className={`border border-black text-right font-mono font-medium ${rowDensityClass}`}>
                        {row.kwotaEur > 0
                          ? formatCurrency(row.kwotaEur, 'EUR')
                          : formatCurrency(row.kwotaPln, 'PLN')}
                      </td>
                      <td className={`border border-black text-right font-mono font-bold ${rowDensityClass}`}>
                        {formatCurrency(row.chargePln, 'PLN')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="border-t-2 border-black"></td>
                  <td className="border-2 border-black py-2.5 px-4 text-right font-mono font-extrabold text-sm sm:text-base bg-slate-100">
                    {formatCurrency(exactBonus1Percent, 'PLN')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
