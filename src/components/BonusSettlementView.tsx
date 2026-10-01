import React, { useState, useMemo, useRef, useEffect } from 'react';
import { StoredInvoice, AppSettings } from '../types/bonus';
import { formatCurrency, formatMonthName, formatRate } from '../utils/colors';
import { exportSettlementToExcel, exportSettlementToHtmlFile } from '../services/excelService';
import { downloadElementAsJpg, downloadElementAsPdf } from '../services/exportService';
import { getEurExchangeRateForDate } from '../services/nbpService';
import { saveStoredInvoices, saveAppSettings } from '../services/storageService';
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
  Code,
  Sparkles,
  RefreshCw,
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

  // Editable Beneficiary Name
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(settings.beneficiaryName || 'Jan Kowalski');

  const currentMonth = selectedMonth || settings.activeMonth || '2026-07';

  // Custom date picker for NBP rate
  const [customRateDate, setCustomRateDate] = useState<string>(() => {
    const [y, m] = currentMonth.split('-');
    const lastDay = new Date(parseInt(y, 10), parseInt(m, 10), 0).toISOString().split('T')[0];
    return lastDay;
  });

  const [isFetchingDateRate, setIsFetchingDateRate] = useState(false);
  const [customRateOverride, setCustomRateOverride] = useState<string>('');
  const [customTableOverride, setCustomTableOverride] = useState<string>('');

  // Update date picker whenever month changes
  useEffect(() => {
    if (currentMonth && currentMonth.includes('-')) {
      const [y, m] = currentMonth.split('-');
      const lastDay = new Date(parseInt(y, 10), parseInt(m, 10), 0).toISOString().split('T')[0];
      setCustomRateDate(lastDay);
    }
  }, [currentMonth]);

  const availableMonths = useMemo(() => {
    const list = [...(settings.customMonths || [])];
    invoices.forEach((i) => {
      if (i.miesiacRozliczeniowy && !list.includes(i.miesiacRozliczeniowy)) {
        list.push(i.miesiacRozliczeniowy);
      }
    });
    return Array.from(new Set(list)).sort().reverse();
  }, [invoices, settings.customMonths]);

  // All unblocked invoices assigned to this settlement month
  const eligibleInvoices = useMemo(() => {
    return invoices.filter(
      (inv) => inv.miesiacRozliczeniowy === currentMonth && !inv.isBlocked
    );
  }, [invoices, currentMonth]);

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

  // Dynamic row compact styling based on invoice count to guarantee single A4 page fit
  const rowDensityClass = useMemo(() => {
    const count = eligibleInvoices.length;
    if (count > 28) return 'py-0.5 px-2 text-[10px] leading-tight';
    if (count > 18) return 'py-1 px-2.5 text-[11px] leading-snug';
    return 'py-1.5 px-3 text-xs';
  }, [eligibleInvoices.length]);

  const handleSaveName = () => {
    const trimmed = nameInput.trim() || 'Jan Kowalski';
    const updated = { ...settings, beneficiaryName: trimmed };
    onSettingsChange(updated);
    saveAppSettings(updated);
    setIsEditingName(false);
  };

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
      `Cofnięto status faktur do ZAREZERWOWANA. Możesz teraz dokonywać zmian w Bazie Danych.`
    );
    setTimeout(() => setNotification(null), 5000);
  };

  // Fetch exchange rate from NBP for chosen calendar date
  const handleFetchRateForChosenDate = async () => {
    if (!customRateDate) return;
    setIsFetchingDateRate(true);
    try {
      const res = await getEurExchangeRateForDate(customRateDate);
      const appliedRate = res.rate;
      const appliedTable = res.tableNo.startsWith('Tabela') ? res.tableNo : `Tabela nr ${res.tableNo}`;

      // Apply to all EUR invoices in this settlement month
      const updated = invoices.map((inv) => {
        if (inv.miesiacRozliczeniowy === currentMonth && !inv.isBlocked) {
          if (inv.waluta === 'EUR') {
            const kwotaPln = Math.round(inv.netto * appliedRate * 100) / 100;
            return {
              ...inv,
              kursEurPln: appliedRate,
              nrTabeliNbp: appliedTable,
              dataKursuNbp: res.effectiveDate || customRateDate,
              kwotaPln,
            };
          }
        }
        return inv;
      });

      onInvoicesChange(updated);
      saveStoredInvoices(updated);
      setNotification(`Pobrano kurs z NBP dla daty ${customRateDate}: 1 EUR = ${formatRate(appliedRate)} zł (${appliedTable})!`);
      setTimeout(() => setNotification(null), 5000);
    } catch (err) {
      console.error('Failed to fetch NBP rate', err);
      alert('Nie udało się pobrać kursu dla podanej daty. Możesz wpisać kurs ręcznie.');
    } finally {
      setIsFetchingDateRate(false);
    }
  };

  // Apply custom manual rate
  const handleApplyManualRate = () => {
    const parsed = parseFloat(customRateOverride.replace(',', '.'));
    if (isNaN(parsed) || parsed <= 0) {
      alert('Wpisz poprawny kurs (np. 4,3128)');
      return;
    }
    const tableText = customTableOverride.trim() || `Tabela nr 147/A/NBP/2026 z dnia ${customRateDate}`;

    const updated = invoices.map((inv) => {
      if (inv.miesiacRozliczeniowy === currentMonth && !inv.isBlocked) {
        if (inv.waluta === 'EUR') {
          const kwotaPln = Math.round(inv.netto * parsed * 100) / 100;
          return {
            ...inv,
            kursEurPln: parsed,
            nrTabeliNbp: tableText,
            dataKursuNbp: customRateDate,
            kwotaPln,
          };
        }
      }
      return inv;
    });

    onInvoicesChange(updated);
    saveStoredInvoices(updated);
    setCustomRateOverride('');
    setCustomTableOverride('');
    setNotification(`Ręcznie ustawiono kurs dla miesiąca ${formatMonthName(currentMonth)}: 1 EUR = ${formatRate(parsed)} zł!`);
    setTimeout(() => setNotification(null), 5000);
  };

  // Export to Excel (Styled 01.jpg layout)
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

  // Export to standalone HTML
  const handleExportHtml = () => {
    const monthFormatted = formatMonthName(currentMonth);
    const tableText = `Tabela nr ${activeMonthRate.tableNo} z dnia ${activeMonthRate.date}`;
    exportSettlementToHtmlFile(
      settings.beneficiaryName,
      monthFormatted,
      eligibleInvoices,
      calculations.sumEur,
      activeMonthRate.rate,
      calculations.totalConvertedPln,
      calculations.bonus1Percent,
      tableText
    );
  };

  // Export to PDF
  const handleExportPdf = async () => {
    if (!printRef.current) return;
    setIsExporting(true);
    try {
      await downloadElementAsPdf(
        printRef.current,
        `Premia_${settings.beneficiaryName.replace(/\s+/g, '_')}_${currentMonth}.pdf`
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
        `Premia_${settings.beneficiaryName.replace(/\s+/g, '_')}_${currentMonth}.jpg`
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

  const monthLabel = formatMonthName(currentMonth);

  return (
    <div className="space-y-6">
      {/* Control Toolbar (Hidden during print) */}
      <div className="print:hidden bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800 mb-2">
              <FileText className="w-3.5 h-3.5" />
              Krok 3: Karta rozliczenia premii (Wzór 01.jpg)
            </div>

            {/* Beneficiary Name */}
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
                    title="Zmień nazwisko"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Wydruk i eksporty (PDF, JPG, HTML, Excel) dokładnie odzwierciedlają format Karty Premii.
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
              onClick={handleExportHtml}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white shadow-xs transition"
              title="Pobierz jako samodzielny plik HTML"
            >
              <Code className="w-3.5 h-3.5" />
              HTML
            </button>
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition"
              title="Eksportuj do pliku Excel odzwierciedlającego szatę graficzną"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel (ze stylami)
            </button>
          </div>
        </div>

        {/* Row 1: Month Selector & Settlement Confirmation */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
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
              >
                <RotateCcw className="w-4 h-4" />
                Odznacz (Cofnij do Zarezerwowana)
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Custom Date Picker for NBP Rate & Manual Override */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Wybierz dzień z kalendarza dla kursu NBP:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customRateDate}
                onChange={(e) => setCustomRateDate(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono"
              />
              <button
                onClick={handleFetchRateForChosenDate}
                disabled={isFetchingDateRate}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold whitespace-nowrap transition disabled:opacity-50"
                title="Pobierz oficjalny kurs NBP dla tego wybranego dnia"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetchingDateRate ? 'animate-spin' : ''}`} />
                {isFetchingDateRate ? 'Pobieranie...' : 'Pobierz kurs'}
              </button>
            </div>
          </div>

          <div className="md:col-span-2 flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[120px]">
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Lub wpisz kurs ręcznie:
              </label>
              <input
                type="text"
                value={customRateOverride}
                onChange={(e) => setCustomRateOverride(e.target.value)}
                placeholder="np. 4,3128"
                className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono"
              />
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Opis tabeli:
              </label>
              <input
                type="text"
                value={customTableOverride}
                onChange={(e) => setCustomTableOverride(e.target.value)}
                placeholder="np. Tabela nr 147/A/NBP/2026"
                className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>
            <button
              onClick={handleApplyManualRate}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold whitespace-nowrap transition"
            >
              Zastosuj kurs
            </button>
          </div>
        </div>
      </div>

      {notification && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-800 dark:text-emerald-200 text-xs font-medium">
          {notification}
        </div>
      )}

      {/* Exact Sheet 01.jpg Printable Container (A4 portrait 1-page fit) */}
      <div className="flex justify-center">
        <div
          ref={printRef}
          className="a4-print-sheet w-full max-w-[820px] bg-white text-black p-6 sm:p-10 shadow-md rounded-lg border border-slate-200 font-sans print:border-none print:shadow-none print:p-0 print:m-0"
        >
          {/* Header matching 01.jpg */}
          <div className="text-center mb-4">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-black">
              Premia {settings.beneficiaryName} - {monthLabel}
            </h2>
          </div>

          {/* Main Table: Always showing Kurs EUR and Kwota w PLN */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border-2 border-black">
              <thead>
                <tr className="border-b-2 border-black bg-slate-50 font-bold text-center">
                  <th className="border border-black py-1.5 px-2 w-10 text-center font-bold">
                    Lp.
                  </th>
                  <th className="border border-black py-1.5 px-3 text-center font-bold">
                    Projekt
                  </th>
                  <th
                    colSpan={2}
                    className="border border-black py-1.5 px-3 text-center font-bold"
                  >
                    Numer Faktury
                  </th>
                  <th className="border border-black py-1.5 px-3 text-center font-bold">
                    Kwota
                  </th>
                  <th className="border border-black py-1.5 px-2 text-center font-bold w-24">
                    Kurs EUR
                  </th>
                  <th className="border border-black py-1.5 px-3 text-center font-bold">
                    Kwota w PLN
                  </th>
                </tr>
              </thead>
              <tbody>
                {eligibleInvoices.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="border border-black py-8 text-center text-slate-500 italic"
                    >
                      Brak przypisanych faktur do miesiąca {monthLabel}.
                    </td>
                  </tr>
                ) : (
                  eligibleInvoices.map((inv, idx) => {
                    const rowRate = inv.waluta === 'EUR'
                      ? (settings.useEndOfMonthRate ? activeMonthRate.rate : (inv.kursEurPln || activeMonthRate.rate))
                      : 1.0;
                    const rowPln = inv.waluta === 'EUR' ? inv.netto * rowRate : inv.netto;

                    return (
                      <tr key={inv.id} className="border-b border-black hover:bg-slate-50/50">
                        <td className={`border border-black text-center font-mono ${rowDensityClass}`}>
                          {idx + 1}
                        </td>
                        <td className={`border border-black font-medium ${rowDensityClass}`}>
                          {inv.projekt}
                        </td>
                        <td className={`border border-black text-slate-600 text-center w-16 ${rowDensityClass}`}>
                          Faktura
                        </td>
                        <td className={`border border-black font-mono ${rowDensityClass}`}>
                          {inv.nrFaktury}
                        </td>
                        <td className={`border border-black text-right font-mono font-medium ${rowDensityClass}`}>
                          {formatCurrency(inv.netto, inv.waluta)}
                        </td>
                        <td className={`border border-black text-center font-mono ${rowDensityClass}`}>
                          {inv.waluta === 'EUR' ? formatRate(rowRate) : '1,0000'}
                        </td>
                        <td className={`border border-black text-right font-mono font-bold ${rowDensityClass}`}>
                          {formatCurrency(rowPln, 'PLN')}
                        </td>
                      </tr>
                    );
                  })
                )}

                {/* Subtotal row */}
                <tr className="border-t-2 border-black font-bold">
                  <td colSpan={4} className="py-2 px-3 text-right"></td>
                  <td className="border border-black py-2 px-3 text-right font-mono font-bold bg-slate-50 text-xs sm:text-sm">
                    {formatCurrency(calculations.sumEur, 'EUR')}
                  </td>
                  <td className="border border-black"></td>
                  <td className="border border-black py-2 px-3 text-right font-mono font-bold bg-slate-50 text-xs sm:text-sm">
                    {formatCurrency(calculations.totalConvertedPln, 'PLN')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Underneath Calculation Table: ONLY Summary Row */}
          <div className="mt-5">
            <table className="w-full border-collapse border-2 border-black text-xs sm:text-sm">
              <tbody>
                <tr>
                  <td className="border border-black py-2.5 px-4 font-bold bg-slate-50 w-1/3">
                    Premia 1% (Brutto)
                  </td>
                  <td className="border border-black py-2.5 px-4 text-right font-mono font-bold w-1/3">
                    {formatCurrency(calculations.totalConvertedPln, 'PLN')}
                  </td>
                  <td className="border border-black py-2.5 px-3 text-center font-bold w-16">
                    1%
                  </td>
                  <td className="border border-black py-2.5 px-4 text-right font-mono font-bold bg-slate-100 text-sm sm:text-base w-1/3">
                    {formatCurrency(calculations.bonus1Percent, 'PLN')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* NBP Citation on left AND Signature on right ON THE SAME LEVEL to save space */}
          <div className="mt-6 pt-2 flex flex-wrap items-center justify-between text-xs text-black border-t border-slate-200">
            <div className="space-y-0.5">
              <p className="underline font-semibold">
                Tabela nr {activeMonthRate.tableNo} z dnia {activeMonthRate.date}
              </p>
              <p className="text-slate-600">Tabela A kursów średnich</p>
              <p className="font-bold text-sm text-black">
                1 EUR = {formatRate(activeMonthRate.rate)} zł
              </p>
            </div>

            <div className="text-right mt-2 sm:mt-0">
              <div className="text-xs text-slate-600 mb-2">Podpis</div>
              <div className="w-48 border-b border-dotted border-black inline-block h-2"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
