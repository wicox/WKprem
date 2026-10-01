export type Currency = 'EUR' | 'PLN';

export interface RawInvoiceInput {
  id?: string;
  nrFaktury: string;
  prowadzacy: string;
  projekt: string;
  netto: number;
  waluta: Currency;
  dataFaktury: string; // ISO format YYYY-MM-DD or DD.MM.YYYY
  miesiacRozliczeniowy: string; // e.g. "2026-06", "2026-07"
  isBlocked: boolean;
}

export interface StoredInvoice {
  id: string; // generated unique id or hash
  nrFaktury: string;
  prowadzacy: string;
  projekt: string;
  netto: number;
  waluta: Currency;
  dataFaktury: string; // YYYY-MM-DD
  miesiacRozliczeniowy: string; // YYYY-MM
  isBlocked: boolean;
  kursEurPln?: number; // Kurs NBP
  nrTabeliNbp?: string; // e.g. "Tabela nr 147/A/NBP/2026"
  dataKursuNbp?: string; // data publikacji kursu
  kwotaPln: number; // Przeliczona na PLN (1:1 dla PLN, netto * kurs dla EUR)
  rozliczonaWId?: string; // Identyfikator rozliczenia premii np. "Wojciech Kozioł_2026-07"
  dataDodania: string; // ISO timestamp
}

export interface ExchangeRateResult {
  currency: 'EUR';
  rate: number;
  tableNo: string;
  effectiveDate: string;
  source: 'NBP' | 'CACHE' | 'MANUAL' | 'DEFAULT';
}

export interface PersonSettlement {
  id: string; // e.g. "Wojciech Kozioł_2026-07"
  prowadzacy: string;
  miesiacRok: string; // YYYY-MM
  miesiacNazwa: string; // e.g. "lipiec 2026"
  useEndOfMonthRate: boolean;
  endOfMonthRate?: number;
  endOfMonthTableNo?: string;
  endOfMonthDate?: string;
  invoices: StoredInvoice[];
  totalNettoEur: number;
  totalNettoPln: number;
  totalConvertedPln: number;
  premiaBrutto1Percent: number;
  dataUtworzenia: string;
}

export interface ProjectAllocationRow {
  lp: number;
  projekt: string;
  faktury: string[];
  kwotaOryginalna: number;
  waluta: Currency;
  kwotaPln: number;
  kwotaObciazeniaPln: number; // 1% z kwoty w PLN
}
