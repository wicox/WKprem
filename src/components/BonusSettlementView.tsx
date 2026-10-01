import React, { useState, useMemo, useRef } from 'react';
import { StoredInvoice } from '../types/bonus';
import { formatCurrency, formatMonthName, formatRate } from '../utils/colors';
import { exportSettlementToExcel } from '../services/excelService';
import { saveStoredInvoices } from '../services/storageService';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  FileText,
  Printer,
  FileSpreadsheet,
  Image as ImageIcon,
  CheckCircle,
  Calendar,
  User,
  ExternalLink,
  Info,
  DollarSign,
  Download,
} from 'lucide-react';

interface BonusSettlementViewProps {
  invoices: StoredInvoice[];
  onInvoicesChange: (updated: StoredInvoice[]) => void;
  selectedPerson: string;
  onSelectPerson: (person: string) => void;
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
  useEndOfMonthRate: boolean;
  onToggleEndOfMonthRate: (val: boolean) => void;
}

export const BonusSettlementView: React.FC<BonusSettlementViewProps> = ({
  invoices,
  onInvoicesChange,
  selectedPerson,
  onSelectPerson,
  selectedMonth,
  onSelectMonth,
  useEndOfMonthRate,
  onToggleEndOfMonthRate,
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

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

  // Set default person and month if not set
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

  // Determine active rate for the month
  const activeMonthRate = useMemo(() => {
    // If end of month, pick the representative rate from the invoices or default 4.3128
    const eurInv = eligibleInvoices.find((i) => i.waluta === 'EUR' && i.kursEurPln);
    if (eurInv && eurInv.kursEurPln) {
      return {
        rate: eurInv.kursEurPln,
        tableNo: eurInv.nrTabeliNbp || '147/A/NBP/2026',
        date: eurInv.dataKursuNbp || `${currentMonth}-31`,
      };
    }
    return {
      rate: 4.3128,
      tableNo: '147/A/NBP/2026',
      date: `${currentMonth}-31`,
    };
  }, [eligibleInvoices, currentMonth]);

  // Calculations
  const calculations = useMemo(() => {
    let sumEur = 0;
    let sumPln = 0;
    let totalConvertedPln = 0;

    eligibleInvoices.forEach((inv) => {
      if (inv.waluta === 'EUR') {
        sumEur += inv.netto;
        if (useEndOfMonthRate) {
          totalConvertedPln += inv.netto * activeMonthRate.rate;
        } else {
          totalConvertedPln += inv.kwotaPln;
        }
      } else {
        sumPln += inv.netto;
        totalConvertedPln += inv.netto;
      }
    });

    sumEur = Math.round(sumEur * 100) / 100;
    sumPln = Math.round(sumPln * 100) / 100;
    totalConvertedPln = Math.round(totalConvertedPln * 100) / 100;
    const bonus1Percent = Math.round(totalConvertedPln * 0.01 * 100) / 100;

    return {
      sumEur,
      sumPln,
      totalConvertedPln,
      bonus1Percent,
    };
  }, [eligibleInvoices, useEndOfMonthRate, activeMonthRate]);

  // Mark these invoices as settled
  const handleMarkAsSettled = () => {
    const settlementId = `${currentPerson}_${currentMonth}`;
    const updated = invoices.map((inv) => {
      if (
        inv.prowadzacy === currentPerson &&
        inv.miesiacRozliczeniowy === currentMonth &&
        !inv.isBlocked
      ) {
        return {
          ...inv,
          rozliczonaWId: settlementId,
        };
      }
      return inv;
    });

    onInvoicesChange(updated);
    saveStoredInvoices(updated);
    setNotification(
      `Faktury (${eligibleInvoices.length} szt.) zostały pomyślnie oznaczone jako rozliczone w karcie: ${settlementId}!`
    );
    setTimeout(() => setNotification(null), 5000);
  };

  // Export to Excel
  const handleExportExcel = () => {
    const monthFormatted = formatMonthName(currentMonth);
    const tableText = `Tabela nr ${activeMonthRate.tableNo} z dnia ${activeMonthRate.date}`;
    exportSettlementToExcel(
      `Premia ${currentPerson} - ${monthFormatted}`,
      currentPerson,
      monthFormatted,
      eligibleInvoices,
      calculations.sumEur,
      calculations.sumPln,
      activeMonthRate.rate,
      calculations.totalConvertedPln,
      calculations.bonus1Percent,
      tableText,
      useEndOfMonthRate
    );
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
      pdf.save(`Premia_${currentPerson.replace(/\s+/g, '_')}_${currentMonth}.pdf`);
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
      link.download = `Premia_${currentPerson.replace(/\s+/g, '_')}_${currentMonth}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      link.click();
    } catch (err) {
      console.error('JPG export failed', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Direct Window Print
  const handlePrint = () => {
    window.print();
  };

  const monthLabel = formatMonthName(currentMonth);

  return (
    <div className="space-y-6">
      {/* Control Toolbar (Hidden on print) */}
      <div className="print:hidden bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800 mb-2">
              <FileText className="w-3.5 h-3.5" />
              Krok 3: Karta rozliczenia premii (Wzór 01.jpg)
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Karta Premii: {currentPerson}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Podsumowanie faktur z wyliczeniem 1% premii brutto, kursem EUR z NBP oraz formatem wydruku identycznym z wzorcem 01.jpg.
            </p>
          </div>

          {/* Action Export Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition"
              title="Drukuj bezpośrednio na drukarce lub do pliku"
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

        {/* Filters and Rate Toggle */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              <User className="w-3.5 h-3.5 text-blue-600" />
              Wybierz Prowadzącego
            </label>
            <select
              value={currentPerson}
              onChange={(e) => onSelectPerson(e.target.value)}
              className="w-full text-sm py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium outline-none focus:ring-2 focus:ring-blue-500"
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
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              Miesiąc Rozliczeniowy
            </label>
            <select
              value={currentMonth}
              onChange={(e) => onSelectMonth(e.target.value)}
              className="w-full text-sm py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium outline-none focus:ring-2 focus:ring-blue-500"
            >
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {formatMonthName(m)} ({m})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col justify-end">
            <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={useEndOfMonthRate}
                onChange={(e) => onToggleEndOfMonthRate(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Kurs z ostatniego dnia miesiąca
              </span>
            </label>
          </div>
        </div>

        {/* Settlement status action */}
        <div className="mt-4 flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
          <span className="text-slate-500">
            Faktur w tym rozliczeniu: <strong className="text-slate-800 dark:text-slate-200">{eligibleInvoices.length}</strong>
          </span>
          <button
            onClick={handleMarkAsSettled}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 text-white dark:text-slate-900 font-semibold transition"
          >
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" />
            Oznacz faktury jako rozliczone w bazie
          </button>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-800 dark:text-emerald-200 text-xs font-medium">
          {notification}
        </div>
      )}

      {/* Exact Sheet 01.jpg Container */}
      <div className="flex justify-center">
        <div
          ref={printRef}
          className="w-full max-w-[820px] bg-white text-slate-950 p-8 sm:p-12 shadow-md rounded-lg border border-slate-200 font-sans print:border-none print:shadow-none print:p-0 print:m-0"
          style={{ minHeight: '1050px' }}
        >
          {/* Header centered matching 01.jpg */}
          <div className="text-center mb-6">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Premia {currentPerson} - {monthLabel}
            </h2>
          </div>

          {/* Main Table Matching 01.jpg */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border-2 border-black text-sm">
              <thead>
                <tr className="border-b-2 border-black bg-slate-50 font-bold text-center">
                  <th className="border border-black py-2 px-3 w-12 text-center font-bold">
                    Lp.
                  </th>
                  <th className="border border-black py-2 px-4 text-center font-bold">
                    Projekt
                  </th>
                  <th
                    colSpan={2}
                    className="border border-black py-2 px-4 text-center font-bold"
                  >
                    Numer Faktury
                  </th>
                  <th className="border border-black py-2 px-4 text-center font-bold">
                    Kwota
                  </th>
                  {/* Show rate column if individual daily rate is active (as requested by user) */}
                  {!useEndOfMonthRate && (
                    <th className="border border-black py-2 px-3 text-center font-bold text-xs">
                      Kurs NBP
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {eligibleInvoices.length === 0 ? (
                  <tr>
                    <td
                      colSpan={useEndOfMonthRate ? 5 : 6}
                      className="border border-black py-8 text-center text-slate-500 italic"
                    >
                      Brak odblokowanych faktur dla prowadzącego {currentPerson} w miesiącu {monthLabel}.
                    </td>
                  </tr>
                ) : (
                  eligibleInvoices.map((inv, idx) => (
                    <tr key={inv.id} className="border-b border-black text-xs hover:bg-slate-50/50">
                      <td className="border border-black py-1.5 px-3 text-center font-mono">
                        {idx + 1}
                      </td>
                      <td className="border border-black py-1.5 px-3 font-medium">
                        {inv.projekt}
                      </td>
                      <td className="border border-black py-1.5 px-3 text-slate-600 text-center w-20">
                        Faktura
                      </td>
                      <td className="border border-black py-1.5 px-3 font-mono">
                        {inv.nrFaktury}
                      </td>
                      <td className="border border-black py-1.5 px-4 text-right font-mono font-medium">
                        {formatCurrency(inv.netto, inv.waluta)}
                      </td>
                      {!useEndOfMonthRate && (
                        <td className="border border-black py-1.5 px-3 text-center font-mono text-[11px]">
                          {inv.waluta === 'EUR' ? formatRate(inv.kursEurPln || activeMonthRate.rate) : '-'}
                        </td>
                      )}
                    </tr>
                  ))
                )}

                {/* Subtotal row inside table matching 01.jpg */}
                <tr className="border-t-2 border-black font-bold">
                  <td colSpan={4} className="py-2.5 px-3 text-right"></td>
                  <td className="border border-black py-2.5 px-4 text-right font-mono font-bold bg-slate-50 text-sm">
                    {formatCurrency(calculations.sumEur, 'EUR')}
                  </td>
                  {!useEndOfMonthRate && <td className="border border-black"></td>}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Underneath Calculation Table Matching 01.jpg */}
          <div className="mt-8">
            <table className="w-full border-collapse border-2 border-black text-sm">
              <tbody>
                {/* Suma PLN */}
                <tr className="border-b border-black">
                  <td className="border border-black py-2.5 px-4 font-bold bg-slate-50 w-1/4">
                    Suma PLN
                  </td>
                  <td className="border border-black py-2.5 px-4 text-right font-mono font-bold w-1/4">
                    {formatCurrency(calculations.sumEur, 'EUR')}
                  </td>
                  <td className="border border-black py-2.5 px-4 text-center font-mono font-medium w-1/4">
                    {formatRate(activeMonthRate.rate)} PLN
                  </td>
                  <td className="border border-black py-2.5 px-4 text-right font-mono font-bold w-1/4 bg-slate-50">
                    {formatCurrency(calculations.totalConvertedPln, 'PLN')}
                  </td>
                </tr>

                {/* Premia 1% (Brutto) */}
                <tr>
                  <td className="border border-black py-2.5 px-4 font-bold bg-slate-50">
                    Premia 1% (Brutto)
                  </td>
                  <td className="border border-black py-2.5 px-4 text-right font-mono font-bold">
                    {formatCurrency(calculations.totalConvertedPln, 'PLN')}
                  </td>
                  <td className="border border-black py-2.5 px-4 text-center font-bold">
                    1%
                  </td>
                  <td className="border border-black py-2.5 px-4 text-right font-mono font-bold bg-slate-100 text-base">
                    {formatCurrency(calculations.bonus1Percent, 'PLN')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* NBP Citation & Signature matching 01.jpg */}
          <div className="mt-8 text-xs text-slate-800 space-y-1">
            <p className="underline text-blue-800 font-medium">
              Tabela nr {activeMonthRate.tableNo} z dnia {activeMonthRate.date}
            </p>
            <p>Tabela A kursów średnich</p>
            <div className="flex items-center justify-between pt-2">
              <span className="font-bold text-sm">
                1 EUR = {formatRate(activeMonthRate.rate)} zł
              </span>
            </div>
          </div>

          {/* Signature area at bottom */}
          <div className="mt-16 pt-8 flex justify-end">
            <div className="text-right">
              <div className="text-xs text-slate-600 mb-1">Podpis</div>
              <div className="w-56 border-b border-dotted border-slate-600 inline-block h-4"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
