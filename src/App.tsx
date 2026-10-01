import React, { useState, useEffect } from 'react';
import { StoredInvoice } from './types/bonus';
import {
  getStoredInvoices,
  saveStoredInvoices,
  getAppSettings,
  saveAppSettings,
  AppSettings,
} from './services/storageService';
import { RawDataImport } from './components/RawDataImport';
import { DatabaseView } from './components/DatabaseView';
import { BonusSettlementView } from './components/BonusSettlementView';
import { ProjectAllocationView } from './components/ProjectAllocationView';
import { BackupView } from './components/BackupView';
import {
  ClipboardPaste,
  Database,
  FileText,
  PieChart,
  FileCode,
  Calculator,
  Moon,
  Sun,
  ShieldCheck,
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'import' | 'database' | 'settlement' | 'projects' | 'backup'>('settlement');
  const [invoices, setInvoices] = useState<StoredInvoice[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    useEndOfMonthRate: true,
    activeMonth: '2026-07',
    defaultBonusPercent: 1.0,
    beneficiaryName: 'Jan Kowalski',
    customMonths: ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'],
  });

  const [selectedPerson, setSelectedPerson] = useState<string>('Wojciech Kozioł');
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-07');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  // Initialize data on mount
  useEffect(() => {
    const loadedInvoices = getStoredInvoices();
    const loadedSettings = getAppSettings();
    setInvoices(loadedInvoices);
    setSettings(loadedSettings);
    setSelectedMonth(loadedSettings.activeMonth || '2026-07');
  }, []);

  // Sync settings when end-of-month toggle changes
  const handleToggleEndOfMonthRate = (val: boolean) => {
    const updated = { ...settings, useEndOfMonthRate: val };
    setSettings(updated);
    saveAppSettings(updated);
  };

  const handleInvoicesChange = (updated: StoredInvoice[]) => {
    setInvoices(updated);
  };

  const handleImportSuccess = (_addedCount: number, _duplicatesCount: number) => {
    // Reload updated invoices from storage
    const reloaded = getStoredInvoices();
    setInvoices(reloaded);
  };

  const handleNavigateToSettlement = (person: string, month: string) => {
    setSelectedPerson(person);
    setSelectedMonth(month);
    setActiveTab('settlement');
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark bg-slate-950 text-slate-50' : 'bg-slate-100/70 text-slate-900'}`}>
      {/* Top Navbar */}
      <header className="print:hidden sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and App Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <span className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white block leading-none">
                  System Rozliczania Premii
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  Faktury • Kursy NBP • Obciążenia Projektów
                </span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="hidden md:flex items-center gap-1 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('import')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'import'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                1. Wprowadzanie
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('database')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'database'
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                2. Baza Danych ({invoices.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('settlement')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'settlement'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                3. Karta Premii (01.jpg)
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('projects')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'projects'
                    ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <PieChart className="w-3.5 h-3.5" />
                4. Obciążenie (02.jpg)
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('backup')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'backup'
                    ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                5. Kopia JSON
              </button>
            </nav>

            {/* Dark Mode & Quick Status */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                title={isDarkMode ? 'Tryb jasny' : 'Tryb ciemny'}
              >
                {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Mobile Navigation Tabs */}
          <div className="md:hidden flex items-center gap-1 overflow-x-auto py-2 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setActiveTab('import')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap ${
                activeTab === 'import' ? 'bg-blue-600 text-white' : 'text-slate-600'
              }`}
            >
              1. Wprowadzanie
            </button>
            <button
              onClick={() => setActiveTab('database')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap ${
                activeTab === 'database' ? 'bg-emerald-600 text-white' : 'text-slate-600'
              }`}
            >
              2. Baza danych
            </button>
            <button
              onClick={() => setActiveTab('settlement')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap ${
                activeTab === 'settlement' ? 'bg-blue-600 text-white' : 'text-slate-600'
              }`}
            >
              3. Karta Premii
            </button>
            <button
              onClick={() => setActiveTab('projects')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap ${
                activeTab === 'projects' ? 'bg-purple-600 text-white' : 'text-slate-600'
              }`}
            >
              4. Obciążenie
            </button>
            <button
              onClick={() => setActiveTab('backup')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap ${
                activeTab === 'backup' ? 'bg-amber-600 text-white' : 'text-slate-600'
              }`}
            >
              5. JSON
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === 'import' && (
          <RawDataImport
            existingInvoices={invoices}
            onImportSuccess={handleImportSuccess}
            onNavigateToDb={() => setActiveTab('database')}
          />
        )}

        {activeTab === 'database' && (
          <DatabaseView
            invoices={invoices}
            onInvoicesChange={handleInvoicesChange}
            settings={settings}
            onSettingsChange={setSettings}
            onNavigateToSettlement={(month) => {
              setSelectedMonth(month);
              setActiveTab('settlement');
            }}
          />
        )}

        {activeTab === 'settlement' && (
          <BonusSettlementView
            invoices={invoices}
            onInvoicesChange={handleInvoicesChange}
            settings={settings}
            onSettingsChange={setSettings}
            selectedMonth={selectedMonth}
            onSelectMonth={setSelectedMonth}
          />
        )}

        {activeTab === 'projects' && (
          <ProjectAllocationView
            invoices={invoices}
            settings={settings}
            selectedMonth={selectedMonth}
            onSelectMonth={setSelectedMonth}
          />
        )}

        {activeTab === 'backup' && (
          <BackupView
            invoices={invoices}
            settings={settings}
            onInvoicesChange={handleInvoicesChange}
            onSettingsChange={setSettings}
          />
        )}
      </main>
    </div>
  );
}
