import React, { useState, useEffect } from 'react';
import { RawInvoiceInput, StoredInvoice } from '../types/bonus';
import { parseExcelPaste } from '../services/excelService';
import { importInvoicesToDb } from '../services/storageService';
import { getPersonColor, formatCurrency } from '../utils/colors';
import {
  ClipboardPaste,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Trash2,
  Sparkles,
  Calendar,
  Lock,
  Unlock,
  Layers,
} from 'lucide-react';

interface RawDataImportProps {
  existingInvoices: StoredInvoice[];
  onImportSuccess: (importedCount: number, duplicatesCount: number) => void;
  onNavigateToDb: () => void;
}

const SAMPLE_PROMPT_DATA = `Nr faktury\tProwadzący\tProjekt\tNetto\tWaluta\tData Faktury
FW 2/26/042\tWojciech Kozioł\tP/757/31\t5165,1\tEUR\t20.06.2026
FW 2/26/043\tWojciech Robak\tP/979/12\t21582,81\tPLN\t25.06.2026
FW 2/26/044\tMateusz Hluzow\tP/1073/24\t190657,36\tEUR\t29.06.2026
FW 2/26/045\tWojciech Kozioł\tP/979/14\t3320,88\tPLN\t30.06.2026`;

export const RawDataImport: React.FC<RawDataImportProps> = ({
  existingInvoices,
  onImportSuccess,
  onNavigateToDb,
}) => {
  const [pasteText, setPasteText] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('2026-06');
  const [parsedItems, setParsedItems] = useState<RawInvoiceInput[]>([]);
  const [importNotification, setImportNotification] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

  // Month options generator
  const monthOptions = [
    { value: '2026-05', label: 'Maj 2026' },
    { value: '2026-06', label: 'Czerwiec 2026' },
    { value: '2026-07', label: 'Lipiec 2026' },
    { value: '2026-08', label: 'Sierpień 2026' },
    { value: '2026-09', label: 'Wrzesień 2026' },
    { value: '2026-10', label: 'Październik 2026' },
  ];

  // Auto-parse when paste text changes
  const handleProcessText = (text: string, monthVal: string) => {
    if (!text.trim()) {
      setParsedItems([]);
      return;
    }
    const result = parseExcelPaste(text, monthVal);
    if (result.detectedMonth && !monthVal) {
      setSelectedMonth(result.detectedMonth);
    }
    setParsedItems(result.invoices);
    setImportNotification(null);
  };

  const handlePasteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setPasteText(val);
    handleProcessText(val, selectedMonth);
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMonth = e.target.value;
    setSelectedMonth(newMonth);
    setParsedItems((prev) =>
      prev.map((item) => ({
        ...item,
        miesiacRozliczeniowy: newMonth,
      }))
    );
  };

  const loadSampleData = (text: string) => {
    setPasteText(text);
    handleProcessText(text, selectedMonth);
  };

  // Toggle single item block
  const toggleBlock = (index: number) => {
    setParsedItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], isBlocked: !next[index].isBlocked };
      return next;
    });
  };

  // Batch toggle
  const toggleAllBlocks = (blockState: boolean) => {
    setParsedItems((prev) =>
      prev.map((item) => ({ ...item, isBlocked: blockState }))
    );
  };

  // Check which parsed items already exist in database
  const existingSet = new Set(
    existingInvoices.map((inv) => inv.nrFaktury.toLowerCase().trim())
  );

  const blockedCount = parsedItems.filter((i) => i.isBlocked).length;
  const readyCount = parsedItems.filter((i) => !i.isBlocked).length;
  const duplicateCandidateCount = parsedItems.filter((i) =>
    existingSet.has(i.nrFaktury.toLowerCase().trim())
  ).length;

  const handleConfirmImport = () => {
    if (readyCount === 0) {
      setImportNotification({
        type: 'warning',
        message: 'Wszystkie faktury są zablokowane lub brak danych do przeniesienia!',
      });
      return;
    }

    const result = importInvoicesToDb(parsedItems, existingInvoices);
    onImportSuccess(result.addedCount, result.duplicateCount);

    if (result.duplicateCount > 0) {
      setImportNotification({
        type: 'warning',
        message: `Przeniesiono ${result.addedCount} nowych faktur. Pominięto ${result.duplicateCount} duplikatów: (${result.duplicateNumbers.join(', ')}) oraz ${result.skippedBlockedCount} zablokowanych.`,
      });
    } else {
      setImportNotification({
        type: 'success',
        message: `Sukces! Pomyślnie przeniesiono ${result.addedCount} faktur do Bazy Danych.`,
      });
    }

    // Keep only blocked items or clear
    if (result.skippedBlockedCount > 0) {
      setParsedItems((prev) => prev.filter((i) => i.isBlocked));
    } else {
      setParsedItems([]);
      setPasteText('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Description */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800 mb-2">
              <ClipboardPaste className="w-3.5 h-3.5" />
              Krok 1: Wprowadzanie surowych danych
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Wklej dane faktur z Excela
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
              Skopiuj wiersze bezpośrednio z arkusza Excel (wraz z nagłówkiem lub bez) i wklej w poniższe pole jednym ruchem.
              Możesz zablokować wybrane pozycje (czerwone wyróżnienie) przed zatwierdzeniem do bazy danych.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => loadSampleData(SAMPLE_PROMPT_DATA)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition"
              title="Wstaw przykładowe dane z zapytania (Wojciech Kozioł, Wojciech Robak, Mateusz Hluzow)"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Wklej dane przykładowe
            </button>
            {parsedItems.length > 0 && (
              <button
                onClick={() => {
                  setPasteText('');
                  setParsedItems([]);
                  setImportNotification(null);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Wyczyść
              </button>
            )}
          </div>
        </div>

        {/* Input Controls */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Pole wklejania z Excela (Tab-Separated / Tabela)
            </label>
            <div className="relative">
              <textarea
                value={pasteText}
                onChange={handlePasteChange}
                placeholder="Wklej tutaj dane skopiowane z Excela (np. Nr faktury | Prowadzący | Projekt | Netto | Waluta | Data Faktury)..."
                rows={4}
                className="w-full font-mono text-xs p-3.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition resize-y"
              />
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                Miesiąc rozliczeniowy danych
              </label>
              <select
                value={selectedMonth}
                onChange={handleMonthChange}
                className="w-full text-sm py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {monthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} ({opt.value})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                Wszystkie pozycje z tego importu zostaną oznaczone tym miesiącem.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-500">W bazie danych:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {existingInvoices.length} faktur
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Notification Banner */}
      {importNotification && (
        <div
          className={`p-4 rounded-xl text-sm flex items-start gap-3 border ${
            importNotification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-800'
              : importNotification.type === 'warning'
              ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-800'
              : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/50 dark:text-red-200 dark:border-red-800'
          }`}
        >
          {importNotification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          )}
          <div className="flex-1">
            <p className="font-medium">{importNotification.message}</p>
          </div>
          <button
            onClick={onNavigateToDb}
            className="px-3 py-1 bg-white/80 dark:bg-slate-800 text-xs font-semibold rounded-md shadow-xs hover:bg-white transition"
          >
            Przejdź do Bazy Danych
          </button>
        </div>
      )}

      {/* Parsed Items Preview Table */}
      {parsedItems.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          {/* Table Action Bar */}
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Rozpoznano pozycji: {parsedItems.length}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <Unlock className="w-3 h-3" />
                Odblokowane: {readyCount}
              </span>
              {blockedCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
                  <Lock className="w-3 h-3" />
                  Zablokowane: {blockedCount}
                </span>
              )}
              {duplicateCandidateCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  <ShieldAlert className="w-3 h-3" />
                  Już w bazie: {duplicateCandidateCount}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleAllBlocks(false)}
                className="px-2.5 py-1.5 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
              >
                Odblokuj wszystkie
              </button>
              <button
                type="button"
                onClick={() => toggleAllBlocks(true)}
                className="px-2.5 py-1.5 text-xs font-medium rounded-lg text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
              >
                Zablokuj wszystkie
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={readyCount === 0}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowRight className="w-4 h-4" />
                Przenieś do Bazy Danych ({readyCount})
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/50 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4 w-12 text-center">Blokada</th>
                  <th className="py-3 px-4">Nr Faktury</th>
                  <th className="py-3 px-4">Prowadzący</th>
                  <th className="py-3 px-4">Projekt</th>
                  <th className="py-3 px-4 text-right">Netto</th>
                  <th className="py-3 px-4 text-center">Waluta</th>
                  <th className="py-3 px-4">Data Faktury</th>
                  <th className="py-3 px-4 text-center">Miesiąc</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {parsedItems.map((item, index) => {
                  const personColor = getPersonColor(item.prowadzacy);
                  const isExistingDuplicate = existingSet.has(
                    item.nrFaktury.toLowerCase().trim()
                  );

                  return (
                    <tr
                      key={item.id || index}
                      className={`transition-colors ${
                        item.isBlocked
                          ? 'bg-red-50/90 dark:bg-red-950/40 text-red-900 dark:text-red-200 border-l-4 border-l-red-500'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {/* Checkbox to block/unblock */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => toggleBlock(index)}
                          title={
                            item.isBlocked
                              ? 'Kliknij, aby odblokować (zostanie przeniesiona do bazy)'
                              : 'Kliknij, aby zablokować (podświetlenie na czerwono)'
                          }
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
                            item.isBlocked
                              ? 'bg-red-600 text-white shadow-xs hover:bg-red-700'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-500 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-950'
                          }`}
                        >
                          {item.isBlocked ? (
                            <Lock className="w-4 h-4" />
                          ) : (
                            <Unlock className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Nr faktury */}
                      <td className="py-3 px-4 font-mono font-medium text-xs">
                        <span className="flex items-center gap-1.5">
                          {item.nrFaktury}
                          {isExistingDuplicate && (
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-sans"
                              title="Ten numer faktury znajduje się już w bazie danych i zostanie pominięty!"
                            >
                              Duplikat
                            </span>
                          )}
                        </span>
                      </td>

                      {/* Prowadzący with distinctive color badge */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${personColor.bg} ${personColor.text} ${personColor.border}`}
                        >
                          <span className={`w-2 h-2 rounded-full ${personColor.dot}`} />
                          {item.prowadzacy}
                        </span>
                      </td>

                      {/* Projekt */}
                      <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300">
                        {item.projekt}
                      </td>

                      {/* Netto */}
                      <td className="py-3 px-4 text-right font-mono font-semibold">
                        {formatCurrency(item.netto, item.waluta)}
                      </td>

                      {/* Waluta */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-bold ${
                            item.waluta === 'EUR'
                              ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                              : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          }`}
                        >
                          {item.waluta}
                        </span>
                      </td>

                      {/* Data Faktury */}
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-xs">
                        {item.dataFaktury}
                      </td>

                      {/* Miesiąc */}
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                          {item.miesiacRozliczeniowy}
                        </span>
                      </td>

                      {/* Status indicator */}
                      <td className="py-3 px-4 text-center">
                        {item.isBlocked ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-200 text-red-800 dark:bg-red-900/60 dark:text-red-200">
                            <Lock className="w-3 h-3" /> ZABLOKOWANA
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            <CheckCircle2 className="w-3 h-3" /> Gotowa do bazy
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Workflow Information */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-500 dark:text-slate-400">
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">
            1
          </div>
          <div>
            <span className="font-semibold text-slate-800 dark:text-slate-200 block mb-0.5">
              Wklejanie jednym ruchem
            </span>
            Wklejasz kolumny: Nr faktury, Prowadzący, Projekt, Netto, Waluta, Data. Aplikacja automatycznie czyta przecinki dziesiętne i waluty.
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-bold shrink-0">
            2
          </div>
          <div>
            <span className="font-semibold text-slate-800 dark:text-slate-200 block mb-0.5">
              Blokowanie faktur
            </span>
            Kliknij kłódkę na wierszu, aby zablokować pozycję (kolor czerwony). Zablokowane pozycje nie przechodzą do bazy i rozliczeń.
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">
            3
          </div>
          <div>
            <span className="font-semibold text-slate-800 dark:text-slate-200 block mb-0.5">
              Deduplikacja
            </span>
            Przed dodaniem do bazy weryfikowane są numery faktur. Istniejące pozycje nie zostaną zdublowane.
          </div>
        </div>
      </div>
    </div>
  );
};
