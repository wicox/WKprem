export type Currency = 'EUR' | 'PLN';

export type InvoiceStatus = 'WOLNA' | 'ZAREZERWOWANA' | 'ROZLICZONA';

export interface RawInvoiceInput {
  id?: string;
  nrFaktury: string;
  prowadzacy: string;
  projekt: string;
  netto: number;
  waluta: Currency;
  dataFaktury: string; // ISO format YYYY-MM-DD or DD.MM.YYYY
  miesiacRozliczeniowy?: string; // Optional settlement month
  isBlocked: boolean;
}

export interface StoredInvoice {
  id: string;
  nrFaktury: string;
  prowadzacy: string;
  projekt: string;
  netto: number;
  waluta: Currency;
  dataFaktury: string; // YYYY-MM-DD
  miesiacRozliczeniowy: string; // e.g. "2026-07" or "" if WOLNA
  status: InvoiceStatus; // 'WOLNA' | 'ZAREZERWOWANA' | 'ROZLICZONA'
  isBlocked: boolean;
  kursEurPln?: number; // Kurs NBP
  nrTabeliNbp?: string; // e.g. "Tabela nr 147/A/NBP/2026"
  dataKursuNbp?: string; // publication date
  kwotaPln: number; // PLN equivalent
  rozliczonaWId?: string; // e.g. "2026-07"
  dataDodania: string; // ISO timestamp
}

export interface ExchangeRateResult {
  currency: 'EUR';
  rate: number;
  tableNo: string;
  effectiveDate: string;
  source: 'NBP' | 'CACHE' | 'MANUAL' | 'DEFAULT';
}

export interface AppSettings {
  useEndOfMonthRate: boolean;
  activeMonth: string; // e.g. "2026-07"
  defaultBonusPercent: number; // e.g. 1.0
  beneficiaryName: string; // e.g. "Jan Kowalski"
  customMonths: string[]; // List of available settlement months
}

export interface ProjectAllocationRow {
  lp: number;
  projekt: string;
  nrFaktury?: string;
  kwotaWaluta: number;
  waluta: Currency;
  kwotaPln: number;
  chargePln: number; // 1% z kwoty w PLN
}
