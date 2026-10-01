import * as XLSX from 'xlsx';
import { RawInvoiceInput, StoredInvoice, Currency } from '../types/bonus';
import { normalizeDate } from './nbpService';

/**
 * Clean and parse numeric strings like "5165,1", "21 582,81", "190657,36", "5 021,47 €"
 */
export function parsePolishAmount(val: string | number): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  // Remove non-breaking spaces, spaces, currency symbols
  const cleaned = val
    .toString()
    .replace(/\s+/g, '')
    .replace(/[€$złPLNEUR]/gi, '')
    .replace(',', '.')
    .trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

/**
 * Standardize currency string to 'EUR' or 'PLN'
 */
export function parseCurrency(val: string): Currency {
  if (!val) return 'PLN';
  const upper = val.toUpperCase().trim();
  if (upper.includes('EUR') || upper.includes('€')) return 'EUR';
  return 'PLN';
}

/**
 * Extracts month in format "YYYY-MM" from date string
 */
export function extractMonthFromDate(dateStr: string): string {
  const iso = normalizeDate(dateStr);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return iso.substring(0, 7);
  }
  return '';
}

/**
 * Parses raw text copied directly from Excel (TSV/CSV/table)
 */
export function parseExcelPaste(
  rawText: string,
  overrideMonth?: string
): { invoices: RawInvoiceInput[]; skippedHeaders: boolean; detectedMonth: string } {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { invoices: [], skippedHeaders: false, detectedMonth: '' };
  }

  const invoices: RawInvoiceInput[] = [];
  let skippedHeaders = false;
  let firstDetectedMonth = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Split by tab (standard for Excel clipboard) or semicolon or comma
    let cols = line.split('\t');
    if (cols.length < 3 && line.includes(';')) {
      cols = line.split(';');
    }

    cols = cols.map((c) => c.trim());

    // Check if this line is header row:
    const lineLower = line.toLowerCase();
    if (
      lineLower.includes('nr faktury') ||
      lineLower.includes('prowadzący') ||
      lineLower.includes('projekt') ||
      lineLower.includes('netto') ||
      lineLower.includes('numer faktury')
    ) {
      skippedHeaders = true;
      continue;
    }

    // Expected columns:
    // 0: Nr faktury (e.g. "FW 2/26/042")
    // 1: Prowadzący (e.g. "Wojciech Kozioł")
    // 2: Projekt (e.g. "P/757/31")
    // 3: Netto (e.g. "5165,1")
    // 4: Waluta (e.g. "EUR" or "PLN")
    // 5: Data Faktury (e.g. "20.06.2026")
    if (cols.length >= 4) {
      const nrFaktury = cols[0] || `FAK-${Date.now()}-${i}`;
      const prowadzacy = cols[1] || 'Nieznany';
      const projekt = cols[2] || '-';
      const netto = parsePolishAmount(cols[3]);
      const waluta = cols.length >= 5 ? parseCurrency(cols[4]) : 'PLN';
      const dataFaktury = cols.length >= 6 ? cols[5] : new Date().toISOString().split('T')[0];

      const detected = extractMonthFromDate(dataFaktury);
      if (!firstDetectedMonth && detected) {
        firstDetectedMonth = detected;
      }

      invoices.push({
        id: `raw-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`,
        nrFaktury,
        prowadzacy,
        projekt,
        netto,
        waluta,
        dataFaktury,
        miesiacRozliczeniowy: overrideMonth || detected || new Date().toISOString().substring(0, 7),
        isBlocked: false,
      });
    }
  }

  return {
    invoices,
    skippedHeaders,
    detectedMonth: overrideMonth || firstDetectedMonth,
  };
}

/**
 * Export settlement workbook to Excel (.xlsx)
 */
export function exportSettlementToExcel(
  title: string,
  personName: string,
  monthName: string,
  invoices: StoredInvoice[],
  sumNettoEur: number,
  sumNettoPln: number,
  exchangeRate: number,
  sumConvertedPln: number,
  bonus1Percent: number,
  rateSourceText: string,
  useEndOfMonthRate: boolean
) {
  const wb = XLSX.utils.book_new();

  // --- SHEET 1: Rozliczenie Premii (01.jpg) ---
  const sheet1Data: (string | number)[][] = [
    [`Premia ${personName} - ${monthName}`],
    [],
    useEndOfMonthRate
      ? ['Lp.', 'Projekt', 'Typ', 'Numer Faktury', 'Kwota']
      : ['Lp.', 'Projekt', 'Typ', 'Numer Faktury', 'Kwota', 'Kurs EUR', 'Wartość PLN'],
  ];

  invoices.forEach((inv, idx) => {
    const kwotaFormatted = `${inv.netto.toFixed(2)} ${inv.waluta === 'EUR' ? '€' : 'zł'}`;
    if (useEndOfMonthRate) {
      sheet1Data.push([
        idx + 1,
        inv.projekt,
        'Faktura',
        inv.nrFaktury,
        kwotaFormatted,
      ]);
    } else {
      const rateVal = inv.waluta === 'EUR' ? (inv.kursEurPln || exchangeRate).toFixed(4) : '-';
      sheet1Data.push([
        idx + 1,
        inv.projekt,
        'Faktura',
        inv.nrFaktury,
        kwotaFormatted,
        rateVal,
        inv.kwotaPln.toFixed(2) + ' PLN',
      ]);
    }
  });

  sheet1Data.push([]);
  sheet1Data.push(['Suma walutowa:', `${sumNettoEur.toFixed(2)} € ${sumNettoPln > 0 ? '+ ' + sumNettoPln.toFixed(2) + ' zł' : ''}`]);
  sheet1Data.push(['Kurs bazowy EUR:', exchangeRate.toFixed(4) + ' PLN']);
  sheet1Data.push(['Suma PLN:', sumConvertedPln.toFixed(2) + ' PLN']);
  sheet1Data.push(['Premia 1% (Brutto):', bonus1Percent.toFixed(2) + ' PLN']);
  sheet1Data.push([]);
  sheet1Data.push([rateSourceText]);
  sheet1Data.push(['Tabela A kursów średnich NBP']);
  sheet1Data.push([`1 EUR = ${exchangeRate.toFixed(4)} zł`]);
  sheet1Data.push([]);
  sheet1Data.push(['Podpis:', '................................................']);

  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
  XLSX.utils.book_append_sheet(wb, ws1, 'Karta Premii');

  // --- SHEET 2: Obciążenie Projektów (02.jpg) ---
  const sheet2Data: (string | number)[][] = [
    [`Premia ${personName} - ${monthName}`],
    ['Premia - kwoty z podziałem na projekty.'],
    [],
    ['Lp.', 'Projekt', 'Kwota EUR - Projekt-Serwis', 'Kwota obciążenia - Projekt-Serwis (1% PLN)'],
  ];

  // Group by project
  const projectMap = new Map<string, { eur: number; pln: number }>();
  invoices.forEach((inv) => {
    const cur = projectMap.get(inv.projekt) || { eur: 0, pln: 0 };
    if (inv.waluta === 'EUR') {
      cur.eur += inv.netto;
    } else {
      cur.pln += inv.netto;
    }
    projectMap.set(inv.projekt, cur);
  });

  let pIdx = 1;
  let totalCostPln = 0;
  projectMap.forEach((val, prj) => {
    // Project cost is 1% of its PLN equivalent
    const prjPlnEquivalent = (val.eur * exchangeRate) + val.pln;
    const costPln = Math.round(prjPlnEquivalent * 0.01 * 100) / 100;
    totalCostPln += costPln;

    const eurLabel = val.eur > 0 ? `${val.eur.toFixed(2)} €` : `${val.pln.toFixed(2)} zł`;
    sheet2Data.push([
      pIdx++,
      prj,
      eurLabel,
      `${costPln.toFixed(2)} zł`,
    ]);
  });

  sheet2Data.push([]);
  sheet2Data.push(['', '', 'SUMA OBCIĄŻEŃ:', `${totalCostPln.toFixed(2)} zł`]);

  const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);
  XLSX.utils.book_append_sheet(wb, ws2, 'Podział na Projekty');

  // Trigger download
  const filename = `Premia_${personName.replace(/\s+/g, '_')}_${monthName.replace(/\s+/g, '_')}.xlsx`;
  XLSX.writeFile(wb, filename);
}
