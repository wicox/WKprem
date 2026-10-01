import React, { useState, useMemo, useRef } from 'react';
import { StoredInvoice, AppSettings } from '../types/bonus';
import { formatCurrency, formatMonthName, formatRate } from '../utils/colors';
import { exportSettlementToExcel } from '../services/excelService';
import { saveStoredInvoices, saveAppSettings } from '../services/storageService';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  FileText,
  Printer,
  FileSpreadsheet,
  Image as ImageIcon,
  CheckCircle,
  Calendar,
  Download,
  Edit2,
  Check,
  RotateCcw,
  AlertCircle,
  PlusCircle,
} from 'lucide-react';

interface BonusSettlementViewProps {
  invoices: StoredInvoice[];
  onInvoicesChange: (updated: StoredInvoice[]) => void;
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
}

export const BonusSettlementView: React.FC<BonusSettlementViewProps> = ({
  invoices,
  onInvoicesChange,
  settings,
  onSettingsChange,
  selectedMonth,
  onSelectMonth,
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Editable Beneficiary Name state
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(settings.beneficiaryName || 'Jan Kowalski');

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

  // All unblocked invoices assigned to this settlement month (regardless of manager)
  const eligibleInvoices = useMemo(() => {
    return invoices.filter(
      (inv) => inv.miesiacRozliczeniowy === currentMonth && !inv.isBlocked
    );
  }, [invoices, currentMonth]);

  // Check settlement status of this month's invoices
  const allSettled = eligibleInvoices.length > 0 && eligibleInvoices.every((i) => i.status === 'ROZLICZONA');

  // Active rate for month
  const activeMonthRate = useMemo(() => {
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

  // Bonus Calculations
  const calculations = useMemo(() => {
    let sumEur = 0;
    let sumPln = 0;
    let totalConvertedPln = 0;

    eligibleInvoices.forEach((inv) => {
      if (inv.waluta === 'EUR') {
        sumEur += inv.netto;
        if (settings.useEndOfMonthRate) {
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
  }, [eligibleInvoices, settings.useEndOfMonthRate, activeMonthRate]);

  // Save new beneficiary name
  const handleSaveName = () => {
    const trimmed = nameInput.trim() || 'Jan Kowalski';
    const updated = { ...settings, beneficiaryName: trimmed };
    onSettingsChange(updated);
    saveAppSettings(updated);
    setIsEditingName(false);
  };

  // Mark all invoices in this month as ROZLICZONA
  const handleMarkAsSettled = () => {
    const updated = invoices.map((inv) => {
      if (inv.miesiacRozliczeniowy === currentMonth && !inv.isBlocked) {
        return {
          ...inv,
          status: 'ROZLICZONA' as const,
          rozliczonaWId: currentMonth,
        };
      }
      return inv;
    });

    onInvoicesChange(updated);
    saveStoredInvoices(updated);
    setNotification(
      `Faktury z miesiąca ${formatMonthName(currentMonth)} (${eligibleInvoices.length} szt.) zostały zatwierdzone jako ROZLICZONE w bazie!`
    );
    setTimeout(() => setNotification(null), 5000);
  };

  // Revert / unmark as settled to allow editing
  const handleRevertToReserved = () => {
    const updated = invoices.map((inv) => {
      if (inv.miesiacRozliczeniowy === currentMonth && !inv.isBlocked) {
        return {
          ...inv,
          status: 'ZAREZERWOWANA' as const,
          rozliczonaWId: undefined,
        };
      }
      return inv;
    });

    onInvoicesChange(updated);
    saveStoredInvoices(updated);
    setNotification(
      `Cofnięto status faktur do ZAREZERWOWANA. Możesz teraz dodawać, modyfikować lub usuwać faktury z tego miesiąca w Bazie Danych.`
    );
    setTimeout(() => setNotification(null), 5000);
  };

  // Export to Excel
  const handleExportExcel = () => {
    const monthFormatted = formatMonthName(currentMonth);
    const tableText = `Tabela nr ${activeMonthRate.tableNo} z dnia ${activeMonthRate.date}`;
    exportSettlementToExcel(
      `Premia ${settings.beneficiaryName} - ${monthFormatted}`,
      settings.beneficiaryName,
      monthFormatted,
      eligibleInvoices,
      calculations.sumEur,
      calculations.sumPln,
      activeMonthRate.rate,
      calculations.totalConvertedPln,
      calculations.bonus1Percent,
      tableText,
      settings.useEndOfMonthRate
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
      pdf.save(`Premia_${settings.beneficiaryName.replace(/\s+/g, '_')}_${currentMonth}.pdf`);
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
      link.download = `Premia_${settings.beneficiaryName.replace(/\s+/g, '_')}_${currentMonth}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      link.click();
    } catch (err) {
      console.error('JPG export failed', err);
    } finally {
      setIsExporting(false);
    }
  };

  const monthLabel = formatMonthName(currentMonth);

  return (
    <div className="space-y-6">
      {/* Control Toolbar */}
      <div className="print:hidden bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800 mb-2">
              <FileText className="w-3.5 h-3.5" />
              Krok 3: Karta rozliczenia premii (Wzór 01.jpg)
            </div>

            {/* Editable Beneficiary Name */}
            <div className="flex items-center gap-2">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="text-xl font-bold p-1 rounded border border-blue-400 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveName}
                    className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold"
                    title="Zapisz nazwisko"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    Premia: {settings.beneficiaryName}
                  </h1>
                  <button
                    onClick={() => {
                      setNameInput(settings.beneficiaryName);
                      setIsEditingName(true);
                    }}
                    className="p-1 text-slate-400 hover:text-blue-600 transition"
                    title="Kliknij, aby zmienić Imię i Nazwisko osoby premiowanej"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Rozliczenie premii dla wskazanego miesiąca. Wszystkie przypisane faktury tworzą jeden wspólny worek rozliczeniowy.
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

        {/* Month Selector and Rate Setting */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              Wybierz Miesiąc Rozliczeniowy
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
                checked={settings.useEndOfMonthRate}
                onChange={(e) => {
                  const updated = { ...settings, useEndOfMonthRate: e.target.checked };
                  onSettingsChange(updated);
                  saveAppSettings(updated);
                }}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Kurs z ostatniego dnia miesiąca
              </span>
            </label>
          </div>

          {/* Settlement Status and Revert / Settle buttons */}
          <div className="flex items-end gap-2">
            {!allSettled ? (
              <button
                onClick={handleMarkAsSettled}
                disabled={eligibleInvoices.length === 0}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                Zatwierdź jako ROZLICZONE w bazie
              </button>
            ) : (
              <button
                onClick={handleRevertToReserved}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition"
                title="Cofnij do statusu Zarezerwowana, aby dokonać zmian w bazie danych"
              >
                <RotateCcw className="w-4 h-4" />
                Odznacz (Cofnij do Zarezerwowana)
              </button>
            )}
          </div>
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
              Premia {settings.beneficiaryName} - {monthLabel}
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
                  {!settings.useEndOfMonthRate && (
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
                      colSpan={settings.useEndOfMonthRate ? 5 : 6}
                      className="border border-black py-8 text-center text-slate-500 italic"
                    >
                      Brak przypisanych faktur do miesiąca {monthLabel}. Przypisz faktury w zakładce Baza Danych.
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
                      {!settings.useEndOfMonthRate && (
                        <td className="border border-black py-1.5 px-3 text-center font-mono text-[11px]">
                          {inv.waluta === 'EUR' ? formatRate(inv.kursEurPln || activeMonthRate.rate) : '-'}
                        </td>
                      )}
                    </tr>
                  ))
                )}

                {/* Subtotal row */}
                <tr className="border-t-2 border-black font-bold">
                  <td colSpan={4} className="py-2.5 px-3 text-right"></td>
                  <td className="border border-black py-2.5 px-4 text-right font-mono font-bold bg-slate-50 text-sm">
                    {formatCurrency(calculations.sumEur, 'EUR')}
                  </td>
                  {!settings.useEndOfMonthRate && <td className="border border-black"></td>}
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

          {/* Signature */}
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
