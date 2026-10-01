import { StoredInvoice, RawInvoiceInput } from '../types/bonus';
import { normalizeDate } from './nbpService';

const DB_KEY = 'bonus_app_invoices_db_v1';
const SETTINGS_KEY = 'bonus_app_settings_v1';

export interface AppSettings {
  useEndOfMonthRate: boolean;
  activeMonth: string; // e.g. "2026-07"
  defaultBonusPercent: number; // e.g. 1.0
}

export const INITIAL_DEMO_INVOICES: StoredInvoice[] = [
  // User's template data from 01.jpg & 02.jpg (lipiec 2026, Wojciech Kozioł)
  {
    id: 'demo-01',
    nrFaktury: 'FD2/26/001',
    prowadzacy: 'Wojciech Kozioł',
    projekt: 'P/1223/93/03',
    netto: 5021.47,
    waluta: 'EUR',
    dataFaktury: '2026-07-02',
    miesiacRozliczeniowy: '2026-07',
    isBlocked: false,
    kursEurPln: 4.3128,
    nrTabeliNbp: '147/A/NBP/2026',
    dataKursuNbp: '2026-07-31',
    kwotaPln: 21656.60,
    rozliczonaWId: 'Wojciech Kozioł_2026-07',
    dataDodania: '2026-07-02T10:00:00Z',
  },
  {
    id: 'demo-02',
    nrFaktury: 'FW/26/012',
    prowadzacy: 'Wojciech Kozioł',
    projekt: 'P/722/44',
    netto: 2057.00,
    waluta: 'EUR',
    dataFaktury: '2026-07-05',
    miesiacRozliczeniowy: '2026-07',
    isBlocked: false,
    kursEurPln: 4.3128,
    nrTabeliNbp: '147/A/NBP/2026',
    dataKursuNbp: '2026-07-31',
    kwotaPln: 8871.43,
    rozliczonaWId: 'Wojciech Kozioł_2026-07',
    dataDodania: '2026-07-05T10:00:00Z',
  },
  {
    id: 'demo-03',
    nrFaktury: 'FW/26/013',
    prowadzacy: 'Wojciech Kozioł',
    projekt: 'P/1722/15',
    netto: 2047.50,
    waluta: 'EUR',
    dataFaktury: '2026-07-06',
    miesiacRozliczeniowy: '2026-07',
    isBlocked: false,
    kursEurPln: 4.3128,
    nrTabeliNbp: '147/A/NBP/2026',
    dataKursuNbp: '2026-07-31',
    kwotaPln: 8830.46,
    rozliczonaWId: 'Wojciech Kozioł_2026-07',
    dataDodania: '2026-07-06T10:00:00Z',
  },
  {
    id: 'demo-04',
    nrFaktury: 'FW/26/015',
    prowadzacy: 'Wojciech Kozioł',
    projekt: 'P/1722/13',
    netto: 1402.50,
    waluta: 'EUR',
    dataFaktury: '2026-07-08',
    miesiacRozliczeniowy: '2026-07',
    isBlocked: false,
    kursEurPln: 4.3128,
    nrTabeliNbp: '147/A/NBP/2026',
    dataKursuNbp: '2026-07-31',
    kwotaPln: 6048.70,
    rozliczonaWId: 'Wojciech Kozioł_2026-07',
    dataDodania: '2026-07-08T10:00:00Z',
  },
  {
    id: 'demo-05',
    nrFaktury: 'FW/26/025',
    prowadzacy: 'Wojciech Kozioł',
    projekt: 'P/722/45',
    netto: 6339.50,
    waluta: 'EUR',
    dataFaktury: '2026-07-10',
    miesiacRozliczeniowy: '2026-07',
    isBlocked: false,
    kursEurPln: 4.3128,
    nrTabeliNbp: '147/A/NBP/2026',
    dataKursuNbp: '2026-07-31',
    kwotaPln: 27341.00,
    rozliczonaWId: 'Wojciech Kozioł_2026-07',
    dataDodania: '2026-07-10T10:00:00Z',
  },
  {
    id: 'demo-06',
    nrFaktury: 'FD2/26/011',
    prowadzacy: 'Wojciech Kozioł',
    projekt: 'P/1223/93/05',
    netto: 2800.00,
    waluta: 'EUR',
    dataFaktury: '2026-07-12',
    miesiacRozliczeniowy: '2026-07',
    isBlocked: false,
    kursEurPln: 4.3128,
    nrTabeliNbp: '147/A/NBP/2026',
    dataKursuNbp: '2026-07-31',
    kwotaPln: 12075.84,
    rozliczonaWId: 'Wojciech Kozioł_2026-07',
    dataDodania: '2026-07-12T10:00:00Z',
  },
  {
    id: 'demo-07',
    nrFaktury: 'FW/26/010',
    prowadzacy: 'Wojciech Kozioł',
    projekt: 'P/1501/24',
    netto: 2477.00,
    waluta: 'EUR',
    dataFaktury: '2026-07-14',
    miesiacRozliczeniowy: '2026-07',
    isBlocked: false,
    kursEurPln: 4.3128,
    nrTabeliNbp: '147/A/NBP/2026',
    dataKursuNbp: '2026-07-31',
    kwotaPln: 10682.81,
    rozliczonaWId: 'Wojciech Kozioł_2026-07',
    dataDodania: '2026-07-14T10:00:00Z',
  },
  {
    id: 'demo-08',
    nrFaktury: 'FD2/26/008',
    prowadzacy: 'Wojciech Kozioł',
    projekt: 'P/1684/32',
    netto: 2522.75,
    waluta: 'EUR',
    dataFaktury: '2026-07-15',
    miesiacRozliczeniowy: '2026-07',
    isBlocked: false,
    kursEurPln: 4.3128,
    nrTabeliNbp: '147/A/NBP/2026',
    dataKursuNbp: '2026-07-31',
    kwotaPln: 10880.12,
    rozliczonaWId: 'Wojciech Kozioł_2026-07',
    dataDodania: '2026-07-15T10:00:00Z',
  },
  {
    id: 'demo-09',
    nrFaktury: 'FD2/26/017',
    prowadzacy: 'Wojciech Kozioł',
    projekt: 'P/1223/18/05',
    netto: 117.55,
    waluta: 'EUR',
    dataFaktury: '2026-07-17',
    miesiacRozliczeniowy: '2026-07',
    isBlocked: false,
    kursEurPln: 4.3128,
    nrTabeliNbp: '147/A/NBP/2026',
    dataKursuNbp: '2026-07-31',
    kwotaPln: 506.97,
    rozliczonaWId: 'Wojciech Kozioł_2026-07',
    dataDodania: '2026-07-17T10:00:00Z',
  },
  {
    id: 'demo-10',
    nrFaktury: 'FW/26/016',
    prowadzacy: 'Wojciech Kozioł',
    projekt: 'P/785/11',
    netto: 6283.50,
    waluta: 'EUR',
    dataFaktury: '2026-07-18',
    miesiacRozliczeniowy: '2026-07',
    isBlocked: false,
    kursEurPln: 4.3128,
    nrTabeliNbp: '147/A/NBP/2026',
    dataKursuNbp: '2026-07-31',
    kwotaPln: 27099.49,
    rozliczonaWId: 'Wojciech Kozioł_2026-07',
    dataDodania: '2026-07-18T10:00:00Z',
  },
  {
    id: 'demo-11',
    nrFaktury: 'FW 2/26/010',
    prowadzacy: 'Wojciech Kozioł',
    projekt: 'P/1934/04',
    netto: 2724.00,
    waluta: 'EUR',
    dataFaktury: '2026-07-19',
    miesiacRozliczeniowy: '2026-07',
    isBlocked: false,
    kursEurPln: 4.3128,
    nrTabeliNbp: '147/A/NBP/2026',
    dataKursuNbp: '2026-07-31',
    kwotaPln: 11748.07,
    rozliczonaWId: 'Wojciech Kozioł_2026-07',
    dataDodania: '2026-07-19T10:00:00Z',
  },
  {
    id: 'demo-12',
    nrFaktury: 'FW/26/017',
    prowadzacy: 'Wojciech Kozioł',
    projekt: 'P/693/28',
    netto: 55.00,
    waluta: 'EUR',
    dataFaktury: '2026-07-20',
    miesiacRozliczeniowy: '2026-07',
    isBlocked: false,
    kursEurPln: 4.3128,
    nrTabeliNbp: '147/A/NBP/2026',
    dataKursuNbp: '2026-07-31',
    kwotaPln: 237.20,
    rozliczonaWId: 'Wojciech Kozioł_2026-07',
    dataDodania: '2026-07-20T10:00:00Z',
  },
  {
    id: 'demo-13',
    nrFaktury: 'FD2/26/020',
    prowadzacy: 'Wojciech Kozioł',
    projekt: 'P/1756/23',
    netto: 435.00,
    waluta: 'EUR',
    dataFaktury: '2026-07-21',
    miesiacRozliczeniowy: '2026-07',
    isBlocked: false,
    kursEurPln: 4.3128,
    nrTabeliNbp: '147/A/NBP/2026',
    dataKursuNbp: '2026-07-31',
    kwotaPln: 1876.07,
    rozliczonaWId: 'Wojciech Kozioł_2026-07',
    dataDodania: '2026-07-21T10:00:00Z',
  },
  {
    id: 'demo-14',
    nrFaktury: 'FW/26/018',
    prowadzacy: 'Wojciech Kozioł',
    projekt: 'P/1223/93/05',
    netto: 4489.00,
    waluta: 'EUR',
    dataFaktury: '2026-07-22',
    miesiacRozliczeniowy: '2026-07',
    isBlocked: false,
    kursEurPln: 4.3128,
    nrTabeliNbp: '147/A/NBP/2026',
    dataKursuNbp: '2026-07-31',
    kwotaPln: 19360.16,
    rozliczonaWId: 'Wojciech Kozioł_2026-07',
    dataDodania: '2026-07-22T10:00:00Z',
  },
  {
    id: 'demo-15',
    nrFaktury: 'FW 2/26/012',
    prowadzacy: 'Wojciech Kozioł',
    projekt: 'P/1061/02',
    netto: 193.00,
    waluta: 'EUR',
    dataFaktury: '2026-07-23',
    miesiacRozliczeniowy: '2026-07',
    isBlocked: false,
    kursEurPln: 4.3128,
    nrTabeliNbp: '147/A/NBP/2026',
    dataKursuNbp: '2026-07-31',
    kwotaPln: 832.37,
    rozliczonaWId: 'Wojciech Kozioł_2026-07',
    dataDodania: '2026-07-23T10:00:00Z',
  },
  {
    id: 'demo-16',
    nrFaktury: 'FW/26/019',
    prowadzacy: 'Wojciech Kozioł',
    projekt: 'P/722/47',
    netto: 2134.00,
    waluta: 'EUR',
    dataFaktury: '2026-07-24',
    miesiacRozliczeniowy: '2026-07',
    isBlocked: false,
    kursEurPln: 4.3128,
    nrTabeliNbp: '147/A/NBP/2026',
    dataKursuNbp: '2026-07-31',
    kwotaPln: 9203.52,
    rozliczonaWId: 'Wojciech Kozioł_2026-07',
    dataDodania: '2026-07-24T10:00:00Z',
  },
  {
    id: 'demo-17',
    nrFaktury: 'FW/26/020',
    prowadzacy: 'Wojciech Kozioł',
    projekt: 'P/1501/27',
    netto: 385.00,
    waluta: 'EUR',
    dataFaktury: '2026-07-25',
    miesiacRozliczeniowy: '2026-07',
    isBlocked: false,
    kursEurPln: 4.3128,
    nrTabeliNbp: '147/A/NBP/2026',
    dataKursuNbp: '2026-07-31',
    kwotaPln: 1660.43,
    rozliczonaWId: 'Wojciech Kozioł_2026-07',
    dataDodania: '2026-07-25T10:00:00Z',
  },
  {
    id: 'demo-18',
    nrFaktury: 'FW 2/26/013',
    prowadzacy: 'Wojciech Kozioł',
    projekt: 'P/722/48',
    netto: 1059.00,
    waluta: 'EUR',
    dataFaktury: '2026-07-26',
    miesiacRozliczeniowy: '2026-07',
    isBlocked: false,
    kursEurPln: 4.3128,
    nrTabeliNbp: '147/A/NBP/2026',
    dataKursuNbp: '2026-07-31',
    kwotaPln: 4567.26,
    rozliczonaWId: 'Wojciech Kozioł_2026-07',
    dataDodania: '2026-07-26T10:00:00Z',
  },
  {
    id: 'demo-19',
    nrFaktury: 'FW 2/26/014',
    prowadzacy: 'Wojciech Kozioł',
    projekt: 'P/1501/26',
    netto: 1718.00,
    waluta: 'EUR',
    dataFaktury: '2026-07-27',
    miesiacRozliczeniowy: '2026-07',
    isBlocked: false,
    kursEurPln: 4.3128,
    nrTabeliNbp: '147/A/NBP/2026',
    dataKursuNbp: '2026-07-31',
    kwotaPln: 7409.39,
    rozliczonaWId: 'Wojciech Kozioł_2026-07',
    dataDodania: '2026-07-27T10:00:00Z',
  },
  {
    id: 'demo-20',
    nrFaktury: 'FW/26/026',
    prowadzacy: 'Wojciech Kozioł',
    projekt: 'P/979/16',
    netto: 400.00,
    waluta: 'EUR',
    dataFaktury: '2026-07-28',
    miesiacRozliczeniowy: '2026-07',
    isBlocked: false,
    kursEurPln: 4.3128,
    nrTabeliNbp: '147/A/NBP/2026',
    dataKursuNbp: '2026-07-31',
    kwotaPln: 1725.12,
    rozliczonaWId: 'Wojciech Kozioł_2026-07',
    dataDodania: '2026-07-28T10:00:00Z',
  },
  {
    id: 'demo-21',
    nrFaktury: 'FW/26/027',
    prowadzacy: 'Wojciech Kozioł',
    projekt: 'P/722/38',
    netto: 850.00,
    waluta: 'EUR',
    dataFaktury: '2026-07-29',
    miesiacRozliczeniowy: '2026-07',
    isBlocked: false,
    kursEurPln: 4.3128,
    nrTabeliNbp: '147/A/NBP/2026',
    dataKursuNbp: '2026-07-31',
    kwotaPln: 3665.88,
    rozliczonaWId: 'Wojciech Kozioł_2026-07',
    dataDodania: '2026-07-29T10:00:00Z',
  },
  {
    id: 'demo-22',
    nrFaktury: 'FW/26/021',
    prowadzacy: 'Wojciech Kozioł',
    projekt: 'P/785/11',
    netto: 5228.00,
    waluta: 'EUR',
    dataFaktury: '2026-07-30',
    miesiacRozliczeniowy: '2026-07',
    isBlocked: false,
    kursEurPln: 4.3128,
    nrTabeliNbp: '147/A/NBP/2026',
    dataKursuNbp: '2026-07-31',
    kwotaPln: 22547.32,
    rozliczonaWId: 'Wojciech Kozioł_2026-07',
    dataDodania: '2026-07-30T10:00:00Z',
  },
  {
    id: 'demo-23',
    nrFaktury: 'FW/26/028',
    prowadzacy: 'Wojciech Kozioł',
    projekt: 'P/1007/24',
    netto: 2186.00,
    waluta: 'EUR',
    dataFaktury: '2026-07-31',
    miesiacRozliczeniowy: '2026-07',
    isBlocked: false,
    kursEurPln: 4.3128,
    nrTabeliNbp: '147/A/NBP/2026',
    dataKursuNbp: '2026-07-31',
    kwotaPln: 9427.78,
    rozliczonaWId: 'Wojciech Kozioł_2026-07',
    dataDodania: '2026-07-31T10:00:00Z',
  },
  // User's prompt sample data (czerwiec 2026)
  {
    id: 'demo-u1',
    nrFaktury: 'FW 2/26/042',
    prowadzacy: 'Wojciech Kozioł',
    projekt: 'P/757/31',
    netto: 5165.10,
    waluta: 'EUR',
    dataFaktury: '2026-06-20',
    miesiacRozliczeniowy: '2026-06',
    isBlocked: false,
    kursEurPln: 4.3128,
    nrTabeliNbp: '124/A/NBP/2026',
    dataKursuNbp: '2026-06-30',
    kwotaPln: 22276.04,
    dataDodania: '2026-06-20T10:00:00Z',
  },
  {
    id: 'demo-u2',
    nrFaktury: 'FW 2/26/043',
    prowadzacy: 'Wojciech Robak',
    projekt: 'P/979/12',
    netto: 21582.81,
    waluta: 'PLN',
    dataFaktury: '2026-06-25',
    miesiacRozliczeniowy: '2026-06',
    isBlocked: false,
    kursEurPln: 1.0,
    kwotaPln: 21582.81,
    dataDodania: '2026-06-25T10:00:00Z',
  },
  {
    id: 'demo-u3',
    nrFaktury: 'FW 2/26/044',
    prowadzacy: 'Mateusz Hluzow',
    projekt: 'P/1073/24',
    netto: 190657.36,
    waluta: 'EUR',
    dataFaktury: '2026-06-29',
    miesiacRozliczeniowy: '2026-06',
    isBlocked: false,
    kursEurPln: 4.3128,
    nrTabeliNbp: '124/A/NBP/2026',
    dataKursuNbp: '2026-06-30',
    kwotaPln: 822267.06,
    dataDodania: '2026-06-29T10:00:00Z',
  },
  {
    id: 'demo-u4',
    nrFaktury: 'FW 2/26/045',
    prowadzacy: 'Wojciech Kozioł',
    projekt: 'P/979/14',
    netto: 3320.88,
    waluta: 'PLN',
    dataFaktury: '2026-06-30',
    miesiacRozliczeniowy: '2026-06',
    isBlocked: false,
    kursEurPln: 1.0,
    kwotaPln: 3320.88,
    dataDodania: '2026-06-30T10:00:00Z',
  },
];

export function getStoredInvoices(): StoredInvoice[] {
  try {
    if (typeof localStorage === 'undefined') return INITIAL_DEMO_INVOICES;
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) {
      // Seed with initial demo data
      localStorage.setItem(DB_KEY, JSON.stringify(INITIAL_DEMO_INVOICES));
      return INITIAL_DEMO_INVOICES;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_DEMO_INVOICES;
  }
}

export function saveStoredInvoices(invoices: StoredInvoice[]): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(DB_KEY, JSON.stringify(invoices));
  } catch (err) {
    console.error('Failed to save invoices to localStorage', err);
  }
}

export function getAppSettings(): AppSettings {
  try {
    if (typeof localStorage === 'undefined') {
      return {
        useEndOfMonthRate: true,
        activeMonth: '2026-07',
        defaultBonusPercent: 1.0,
      };
    }
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      const def: AppSettings = {
        useEndOfMonthRate: true,
        activeMonth: '2026-07',
        defaultBonusPercent: 1.0,
      };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(def));
      return def;
    }
    return JSON.parse(raw);
  } catch {
    return {
      useEndOfMonthRate: true,
      activeMonth: '2026-07',
      defaultBonusPercent: 1.0,
    };
  }
}

export function saveAppSettings(settings: AppSettings): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save settings', err);
  }
}

/**
 * Deduplicate invoices against existing database.
 * Returns: { added: StoredInvoice[], duplicates: string[], skippedBlocked: number }
 */
export function importInvoicesToDb(
  rawInputs: RawInvoiceInput[],
  existingInvoices: StoredInvoice[],
  defaultEurRate: number = 4.3128
): {
  updatedList: StoredInvoice[];
  addedCount: number;
  duplicateCount: number;
  duplicateNumbers: string[];
  skippedBlockedCount: number;
} {
  const existingMap = new Map<string, StoredInvoice>();
  existingInvoices.forEach((inv) => {
    // Normalise invoice number key (case-insensitive, trimmed)
    const key = inv.nrFaktury.toLowerCase().trim();
    existingMap.set(key, inv);
  });

  const duplicateNumbers: string[] = [];
  let skippedBlockedCount = 0;
  const newInvoices: StoredInvoice[] = [];

  for (const item of rawInputs) {
    if (item.isBlocked) {
      skippedBlockedCount++;
      continue;
    }

    const key = item.nrFaktury.toLowerCase().trim();
    if (existingMap.has(key)) {
      duplicateNumbers.push(item.nrFaktury);
      continue;
    }

    const isoDate = normalizeDate(item.dataFaktury);
    const kwotaPln = item.waluta === 'EUR'
      ? Math.round(item.netto * defaultEurRate * 100) / 100
      : item.netto;

    const newInv: StoredInvoice = {
      id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      nrFaktury: item.nrFaktury.trim(),
      prowadzacy: item.prowadzacy.trim(),
      projekt: item.projekt.trim(),
      netto: item.netto,
      waluta: item.waluta,
      dataFaktury: isoDate,
      miesiacRozliczeniowy: item.miesiacRozliczeniowy,
      isBlocked: false,
      kursEurPln: item.waluta === 'EUR' ? defaultEurRate : 1.0,
      kwotaPln,
      dataDodania: new Date().toISOString(),
    };

    existingMap.set(key, newInv);
    newInvoices.push(newInv);
  }

  const updatedList = Array.from(existingMap.values());
  saveStoredInvoices(updatedList);

  return {
    updatedList,
    addedCount: newInvoices.length,
    duplicateCount: duplicateNumbers.length,
    duplicateNumbers,
    skippedBlockedCount,
  };
}

/**
 * Export full DB to JSON download
 */
export function exportDatabaseToJson(invoices: StoredInvoice[], settings: AppSettings) {
  const data = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    settings,
    invoices,
  };
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `baza_faktur_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Import full DB from JSON
 */
export function importDatabaseFromJson(jsonContent: string): {
  success: boolean;
  invoicesCount: number;
  message: string;
} {
  try {
    const data = JSON.parse(jsonContent);
    if (!data.invoices || !Array.isArray(data.invoices)) {
      return { success: false, invoicesCount: 0, message: 'Nieprawidłowy format pliku JSON (brak tablicy faktur).' };
    }
    saveStoredInvoices(data.invoices);
    if (data.settings) {
      saveAppSettings(data.settings);
    }
    return {
      success: true,
      invoicesCount: data.invoices.length,
      message: `Pomyślnie zaimportowano ${data.invoices.length} faktur z pliku JSON!`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, invoicesCount: 0, message: `Błąd parsowania JSON: ${msg}` };
  }
}
