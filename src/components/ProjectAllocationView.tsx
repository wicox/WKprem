import React, { useState, useMemo, useRef } from 'react';
import { StoredInvoice } from '../types/bonus';
import { formatCurrency, formatMonthName, formatRate } from '../utils/colors';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import {
  PieChart,
  Printer,
  FileSpreadsheet,
  Image as ImageIcon,
  Download,
  Calendar,
  User,
  Layers,
} from 'lucide-react';

interface ProjectAllocationViewProps {
  invoices: StoredInvoice[];
  selectedPerson: string;
  onSelectPerson: (person: string) => void;
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
  useEndOfMonthRate: boolean;
}

export const ProjectAllocationView: React.FC<ProjectAllocationViewProps> = ({
  invoices,
  selectedPerson,
  onSelectPerson,
  selectedMonth,
  onSelectMonth,
  useEndOfMonthRate,
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [viewMode, setViewMode] = useState<'itemized' | 'aggregated'>('itemized');

  // Available unique people and months
  const availablePersons = useMemo(() => {
    const set = new Set<string>();
    invoices.forEach((i) => {
      if (i.prowadzacy) set.add(i.prowadzacy);
    });
    return Array.from(set).sort();
  }, [invoices]);

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    invoices.forEach((i) => {
      if (i.miesiacRozliczeniowy) set.add(i.miesiacRozliczeniowy);
    });
    return Array.from(set).sort().reverse();
  }, [invoices]);

  const currentPerson = selectedPerson || availablePersons[0] || 'Wojciech Kozioł';
  const currentMonth = selectedMonth || availableMonths[0] || '2026-07';

  // Filter invoices for this settlement
  const eligibleInvoices = useMemo(() => {
    return invoices.filter(
      (inv) =>
        inv.prowadzacy === currentPerson &&
        inv.miesiacRozliczeniowy === currentMonth &&
        !inv.isBlocked
    );
  }, [invoices, currentPerson, currentMonth]);

  // Determine rate
  const activeRate = useMemo(() => {
    const eurInv = eligibleInvoices.find((i) => i.waluta === 'EUR' && i.kursEurPln);
    return eurInv?.kursEurPln || 4.3128;
  }, [eligibleInvoices]);

  // Itemized rows (1-to-1 match with 02.jpg)
  const itemizedRows = useMemo(() => {
    return eligibleInvoices.map((inv, idx) => {
      const rate = inv.waluta === 'EUR' ? (useEndOfMonthRate ? activeRate : (inv.kursEurPln || activeRate)) : 1.0;
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
  }, [eligibleInvoices, activeRate, useEndOfMonthRate]);

  // Aggregated by project
  const aggregatedRows = useMemo(() => {
    const map = new Map<
      string,
      { kwotaEur: number; kwotaPln: number; chargePln: number; count: number }
    >();

    eligibleInvoices.forEach((inv) => {
      const rate = inv.waluta === 'EUR' ? (useEndOfMonthRate ? activeRate : (inv.kursEurPln || activeRate)) : 1.0;
      const kwotaPln = inv.waluta === 'EUR' ? inv.netto * rate : inv.netto;
      const charge = Math.round(kwotaPln * 0.01 * 100) / 100;

      const cur = map.get(inv.projekt) || { kwotaEur: 0, kwotaPln: 0, chargePln: 0, count: 0 };
      if (inv.waluta === 'EUR') cur.kwotaEur += inv.netto;
      else cur.kwotaPln += inv.netto;
      cur.chargePln += charge;
      cur.count += 1;
      map.set(inv.projekt, cur);
    });

    return Array.from(map.entries()).map(([projekt, data], idx) => ({
      lp: idx + 1,
      projekt,
      kwotaEur: data.kwotaEur,
      kwotaPln: data.kwotaPln,
      chargePln: Math.round(data.chargePln * 100) / 100,
      count: data.count,
    }));
  }, [eligibleInvoices, activeRate, useEndOfMonthRate]);

  // Total charge
  const totalChargePln = useMemo(() => {
    const sum = itemizedRows.reduce((acc, row) => acc + row.chargePln, 0);
    return Math.round(sum * 100) / 100;
  }, [itemizedRows]);

  const monthLabel = formatMonthName(currentMonth);

  // Export to Excel
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const rows: (string | number)[][] = [
      [`Premia ${currentPerson} - ${monthLabel}`],
      ['Premia - kwoty z podziałem na projekty.'],
      [],
      ['Lp.', 'Projekt', 'Kwota EUR - Projekt-Serwis', 'Kwota obciążenia - Projekt-Serwis'],
    ];

    itemizedRows.forEach((r) => {
      rows.push([
        r.lp,
        r.projekt,
        `${r.kwotaWaluta.toFixed(2)} ${r.waluta === 'EUR' ? '€' : 'zł'}`,
        `${r.chargePln.toFixed(2)} zł`,
      ]);
    });

    rows.push([]);
    rows.push(['', '', 'SUMA OBCIĄŻEŃ:', `${totalChargePln.toFixed(2)} zł`]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Obciążenie Projektów');
    XLSX.writeFile(wb, `Obciazenie_Projektow_${currentPerson.replace(/\s+/g, '_')}_${currentMonth}.xlsx`);
  };

  // Export to PDF
  const handleExportPdf = async () => {
    if (!printRef.current) return;
    setIsExporting(true);
    try {
      const element = printRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 10, pdfWidth, pdfHeight);
      pdf.save(`Obciazenie_Projektow_${currentPerson.replace(/\s+/g, '_')}_${currentMonth}.pdf`);
    } catch (err) {
      console.error('PDF export failed', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Export to JPG
  const handleExportJpg = async () => {
    if (!printRef.current) return;
    setIsExporting(true);
    try {
      const element = printRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      const link = document.createElement('a');
      link.download = `Obciazenie_Projektow_${currentPerson.replace(/\s+/g, '_')}_${currentMonth}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      link.click();
    } catch (err) {
      console.error('JPG export failed', err);
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
              Obciążenie Projektów 1%
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Kalkulacja kwoty obciążenia Projekt-Serwis dla każdego projektu z osobna. Łączna suma obciążeń odpowiada 1% premii.
            </p>
          </div>

          {/* Action Export Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition"
            >
              <Printer className="w-3.5 h-3.5" />
              Drukuj
            </button>
            <button
              onClick={handleExportPdf}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition"
            >
              <Download className="w-3.5 h-3.5" />
              PDF
            </button>
            <button
              onClick={handleExportJpg}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              JPG
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              <User className="w-3.5 h-3.5 text-purple-600" />
              Prowadzący
            </label>
            <select
              value={currentPerson}
              onChange={(e) => onSelectPerson(e.target.value)}
              className="w-full text-sm py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium outline-none focus:ring-2 focus:ring-purple-500"
            >
              {availablePersons.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

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

      {/* Exact Sheet 02.jpg Printable Container */}
      <div className="flex justify-center">
        <div
          ref={printRef}
          className="w-full max-w-[820px] bg-white text-slate-950 p-8 sm:p-12 shadow-md rounded-lg border border-slate-200 font-sans print:border-none print:shadow-none print:p-0 print:m-0"
          style={{ minHeight: '1050px' }}
        >
          {/* Header matching 02.jpg */}
          <div className="text-center mb-6">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 mb-1">
              Premia {currentPerson} - {monthLabel}
            </h2>
            <h3 className="text-sm sm:text-base font-bold text-slate-900">
              Premia - kwoty z podziałem na projekty.
            </h3>
          </div>

          {/* Table matching 02.jpg */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border-2 border-black text-sm">
              <thead>
                <tr className="border-b-2 border-black bg-slate-50 font-bold text-center">
                  <th className="border border-black py-2.5 px-3 w-14 text-center font-bold">
                    Lp.
                  </th>
                  <th className="border border-black py-2.5 px-6 text-center font-bold">
                    Projekt
                  </th>
                  <th className="border border-black py-2.5 px-6 text-center font-bold">
                    Kwota EUR - Projekt-Serwis
                  </th>
                  <th className="border border-black py-2.5 px-6 text-center font-bold">
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
                      <tr key={row.lp} className="border-b border-black text-xs hover:bg-slate-50/50">
                        <td className="border border-black py-1.5 px-3 text-center font-mono">
                          {row.lp}
                        </td>
                        <td className="border border-black py-1.5 px-6 font-medium">
                          {row.projekt}
                        </td>
                        <td className="border border-black py-1.5 px-6 text-right font-mono font-medium">
                          {formatCurrency(row.kwotaWaluta, row.waluta)}
                        </td>
                        <td className="border border-black py-1.5 px-6 text-right font-mono font-bold">
                          {formatCurrency(row.chargePln, 'PLN')}
                        </td>
                      </tr>
                    ))
                  )
                ) : (
                  aggregatedRows.map((row) => (
                    <tr key={row.lp} className="border-b border-black text-xs hover:bg-slate-50/50">
                      <td className="border border-black py-1.5 px-3 text-center font-mono">
                        {row.lp}
                      </td>
                      <td className="border border-black py-1.5 px-6 font-medium">
                        {row.projekt}
                        {row.count > 1 && (
                          <span className="text-[10px] text-slate-500 ml-2">({row.count} faktury)</span>
                        )}
                      </td>
                      <td className="border border-black py-1.5 px-6 text-right font-mono font-medium">
                        {row.kwotaEur > 0
                          ? formatCurrency(row.kwotaEur, 'EUR')
                          : formatCurrency(row.kwotaPln, 'PLN')}
                      </td>
                      <td className="border border-black py-1.5 px-6 text-right font-mono font-bold">
                        {formatCurrency(row.chargePln, 'PLN')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                {/* Total row matching 02.jpg bottom right cell */}
                <tr>
                  <td colSpan={3} className="border-t-2 border-black"></td>
                  <td className="border-2 border-black py-2.5 px-6 text-right font-mono font-extrabold text-sm sm:text-base bg-slate-100">
                    {formatCurrency(totalChargePln, 'PLN')}
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
