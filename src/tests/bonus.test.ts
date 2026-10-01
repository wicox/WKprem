import { describe, it, expect } from 'vitest';
import { parseExcelPaste, parsePolishAmount } from '../services/excelService';
import { importInvoicesToDb } from '../services/storageService';
import { StoredInvoice } from '../types/bonus';

describe('Excel Parser Tests', () => {
  it('parses Polish comma decimal numbers correctly', () => {
    expect(parsePolishAmount('5165,1')).toBe(5165.1);
    expect(parsePolishAmount('21582,81')).toBe(21582.81);
    expect(parsePolishAmount('190657,36')).toBe(190657.36);
    expect(parsePolishAmount('5 021,47 €')).toBe(5021.47);
    expect(parsePolishAmount('2 282,54 zł')).toBe(2282.54);
  });

  it('parses raw user pasted tab-delimited Excel data with headers', () => {
    const rawData = `Nr faktury\tProwadzący\tProjekt\tNetto\tWaluta\tData Faktury
FW 2/26/042\tJan Kowalski\tP/757/31\t5165,1\tEUR\t20.06.2026
FW 2/26/043\tAdam Nowak\tP/979/12\t21582,81\tPLN\t25.06.2026
FW 2/26/044\tJan Kowalski\tP/1073/24\t190657,36\tEUR\t29.06.2026
FW 2/26/045\tAdam Nowak\tP/979/14\t3320,88\tPLN\t30.06.2026`;

    const parsed = parseExcelPaste(rawData);
    expect(parsed.skippedHeaders).toBe(true);
    expect(parsed.invoices.length).toBe(4);
    expect(parsed.invoices[0].nrFaktury).toBe('FW 2/26/042');
    expect(parsed.invoices[0].prowadzacy).toBe('Jan Kowalski');
    expect(parsed.invoices[0].waluta).toBe('EUR');
    expect(parsed.invoices[0].netto).toBe(5165.1);
    expect(parsed.invoices[1].waluta).toBe('PLN');
    expect(parsed.invoices[1].netto).toBe(21582.81);
  });
});

describe('Database Deduplication & Import Tests', () => {
  it('prevents duplicate invoice numbers and skips blocked items', () => {
    const existing: StoredInvoice[] = [
      {
        id: 'exist-1',
        nrFaktury: 'FW 2/26/042',
        prowadzacy: 'Jan Kowalski',
        projekt: 'P/757/31',
        netto: 5165.1,
        waluta: 'EUR',
        dataFaktury: '2026-06-20',
        miesiacRozliczeniowy: '2026-06',
        status: 'ROZLICZONA',
        isBlocked: false,
        kwotaPln: 22276.04,
        dataDodania: new Date().toISOString(),
      },
    ];

    const rawInputs = [
      {
        nrFaktury: 'FW 2/26/042', // Duplicate!
        prowadzacy: 'Jan Kowalski',
        projekt: 'P/757/31',
        netto: 5165.1,
        waluta: 'EUR' as const,
        dataFaktury: '2026-06-20',
        isBlocked: false,
      },
      {
        nrFaktury: 'FW 2/26/043', // Valid new
        prowadzacy: 'Adam Nowak',
        projekt: 'P/979/12',
        netto: 21582.81,
        waluta: 'PLN' as const,
        dataFaktury: '2026-06-25',
        isBlocked: false,
      },
      {
        nrFaktury: 'FW 2/26/044', // Blocked
        prowadzacy: 'Adam Nowak',
        projekt: 'P/1073/24',
        netto: 190657.36,
        waluta: 'EUR' as const,
        dataFaktury: '2026-06-29',
        isBlocked: true,
      },
    ];

    const result = importInvoicesToDb(rawInputs, existing);
    expect(result.addedCount).toBe(1);
    expect(result.duplicateCount).toBe(1);
    expect(result.skippedBlockedCount).toBe(1);
    expect(result.updatedList.length).toBe(2);
    expect(result.updatedList[1].status).toBe('WOLNA');
  });
});

describe('Bonus & Project Allocation Math Tests', () => {
  it('calculates exact 01.jpg settlement totals and 1% bonus', () => {
    // 01.jpg total EUR = 52924.77, rate = 4.3128
    const sumEur = 52924.77;
    const rate = 4.3128;
    const expectedPln = Math.round(sumEur * rate * 100) / 100;
    expect(expectedPln).toBe(228253.95);

    const bonus1Percent = Math.round(expectedPln * 0.01 * 100) / 100;
    expect(bonus1Percent).toBe(2282.54);
  });

  it('calculates project allocation 1% matching 02.jpg row 1', () => {
    // Row 1: P/1223/93/03: 5021.47 € * 4.3128 = 21656.60 PLN -> 1% = 216.57 zł
    const nettoEur = 5021.47;
    const rate = 4.3128;
    const rowPln = nettoEur * rate;
    const rowCharge = Math.round(rowPln * 0.01 * 100) / 100;
    expect(rowCharge).toBe(216.57);
  });
});
