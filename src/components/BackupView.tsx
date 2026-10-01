import React, { useState, useRef } from 'react';
import { StoredInvoice } from '../types/bonus';
import { AppSettings, exportDatabaseToJson, importDatabaseFromJson, saveStoredInvoices, INITIAL_DEMO_INVOICES } from '../services/storageService';
import {
  Save,
  Upload,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  FileCode,
  Database,
  Download,
  Info,
} from 'lucide-react';

interface BackupViewProps {
  invoices: StoredInvoice[];
  settings: AppSettings;
  onInvoicesChange: (invoices: StoredInvoice[]) => void;
  onSettingsChange: (settings: AppSettings) => void;
}

export const BackupView: React.FC<BackupViewProps> = ({
  invoices,
  settings,
  onInvoicesChange,
  onSettingsChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const handleExportJson = () => {
    exportDatabaseToJson(invoices, settings);
    setNotification({
      type: 'success',
      message: 'Baza danych została pomyślnie wyeksportowana do pliku JSON!',
    });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = importDatabaseFromJson(content);
      if (res.success) {
        // reload from storage
        import('../services/storageService').then(({ getStoredInvoices, getAppSettings }) => {
          onInvoicesChange(getStoredInvoices());
          onSettingsChange(getAppSettings());
          setNotification({
            type: 'success',
            message: res.message,
          });
        });
      } else {
        setNotification({
          type: 'error',
          message: res.message,
        });
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  const handleResetToDemo = () => {
    if (confirm('Czy na pewno chcesz przywrócić fabryczne dane demonstracyjne (zgodne z szablonem 01.jpg)?')) {
      saveStoredInvoices(INITIAL_DEMO_INVOICES);
      onInvoicesChange(INITIAL_DEMO_INVOICES);
      setNotification({
        type: 'success',
        message: 'Przywrócono fabryczny zestaw 23 faktur dla Wojciecha Kozioła z szablonu 01.jpg!',
      });
      setTimeout(() => setNotification(null), 5000);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800 mb-2">
          <FileCode className="w-3.5 h-3.5" />
          Krok 5: Kopia zapasowa i format JSON
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Zarządzanie Danymi i Kopia Zapasowa JSON
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Zapisz całą historię faktur, kursów i rozliczeń do pliku JSON lub wgraj wcześniej zapisany plik. Wszystkie dane są przechowywane lokalnie w Twojej przeglądarce.
        </p>

        {notification && (
          <div
            className={`mt-4 p-4 rounded-lg text-sm flex items-center gap-3 border ${
              notification.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300'
                : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <p className="font-medium">{notification.message}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          {/* Card 1: Export JSON */}
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 flex items-center justify-center mb-3">
                <Download className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base mb-1">
                Zapisz do JSON
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
                Pobierz pełną kopię zapasową bazy danych ({invoices.length} faktur) wraz z przypisanymi kursami NBP do pliku tekstowego JSON.
              </p>
            </div>
            <button
              onClick={handleExportJson}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition"
            >
              <Save className="w-4 h-4" />
              Zapisz plik JSON
            </button>
          </div>

          {/* Card 2: Import JSON */}
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center mb-3">
                <Upload className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base mb-1">
                Otwórz plik JSON
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
                Wczytaj bazę danych z dysku z wcześniej wyeksportowanego pliku .json.
              </p>
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleImportJsonFile}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition"
              >
                <Upload className="w-4 h-4" />
                Wybierz plik JSON
              </button>
            </div>
          </div>

          {/* Card 3: Reset to template */}
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-600 flex items-center justify-center mb-3">
                <RotateCcw className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base mb-1">
                Przywróć szablon 01.jpg
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
                Przywróć zestaw 23 faktur dla Wojciecha Kozioła z lipca 2026, dokładnie jak na załączonych grafikach 01.jpg i 02.jpg.
              </p>
            </div>
            <button
              onClick={handleResetToDemo}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold text-xs transition"
            >
              <RotateCcw className="w-4 h-4" />
              Przywróć dane wzorcowe
            </button>
          </div>
        </div>

        {/* Database status information */}
        <div className="mt-8 p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 flex items-start gap-3 text-xs text-blue-900 dark:text-blue-200">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block mb-1">Stan bazy w przeglądarce:</span>
            Aktualnie w pamięci trwałej (Local Storage) zapisanych jest <strong>{invoices.length} faktur</strong>.
            Faktury te zachowują się automatycznie pomiędzy przeładowaniami strony i restartem komputera.
          </div>
        </div>
      </div>
    </div>
  );
};
