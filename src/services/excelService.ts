import * as XLSX from 'xlsx';
import { RawInvoiceInput, StoredInvoice, Currency } from '../types/bonus';
import { normalizeDate } from './nbpService';
import { formatCurrency, formatRate, formatMonthName } from '../utils/colors';

/**
 * Clean and parse numeric strings like "5165,1", "21 582,81", "190657,36"
 */
export function parsePolishAmount(val: string | number): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const cleaned = val
    .toString()
    .replace(/\s+/g, '')
    .replace(/[€$złPLNEUR]/gi, '')
    .replace(',', '.')
    .trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

export function parseCurrency(val: string): Currency {
  if (!val) return 'PLN';
  const upper = val.toUpperCase().trim();
  if (upper.includes('EUR') || upper.includes('€')) return 'EUR';
  return 'PLN';
}

export function extractMonthFromDate(dateStr: string): string {
  const iso = normalizeDate(dateStr);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return iso.substring(0, 7);
  }
  return '';
}

export function parseExcelPaste(
  rawText: string
): { invoices: RawInvoiceInput[]; skippedHeaders: boolean } {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { invoices: [], skippedHeaders: false };
  }

  const invoices: RawInvoiceInput[] = [];
  let skippedHeaders = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let cols = line.split('\t');
    if (cols.length < 3 && line.includes(';')) {
      cols = line.split(';');
    }
    cols = cols.map((c) => c.trim());

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

    if (cols.length >= 4) {
      const nrFaktury = cols[0] || `FAK-${Date.now()}-${i}`;
      const prowadzacy = cols[1] || 'Jan Kowalski';
      const projekt = cols[2] || '-';
      const netto = parsePolishAmount(cols[3]);
      const waluta = cols.length >= 5 ? parseCurrency(cols[4]) : 'PLN';
      const dataFaktury = cols.length >= 6 ? cols[5] : new Date().toISOString().split('T')[0];

      invoices.push({
        id: `raw-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`,
        nrFaktury,
        prowadzacy,
        projekt,
        netto,
        waluta,
        dataFaktury,
        miesiacRozliczeniowy: '',
        isBlocked: false,
      });
    }
  }

  return {
    invoices,
    skippedHeaders,
  };
}

/**
 * Builds clean HTML representation matching 01.jpg layout with full CSS formatting
 */
export function buildSettlementHtml(
  personName: string,
  monthName: string,
  invoices: StoredInvoice[],
  sumNettoEur: number,
  exchangeRate: number,
  sumConvertedPln: number,
  bonus1Percent: number,
  rateSourceText: string
): string {
  const invoiceRows = invoices
    .map((inv, idx) => {
      const rowRate = inv.waluta === 'EUR' ? formatRate(inv.kursEurPln || exchangeRate) : '1,0000';
      const rowPln = inv.waluta === 'EUR' ? inv.netto * (inv.kursEurPln || exchangeRate) : inv.netto;
      return `
        <tr>
          <td style="border: 1px solid #000; text-align: center; padding: 4px;">${idx + 1}</td>
          <td style="border: 1px solid #000; padding: 4px 8px;">${inv.projekt}</td>
          <td style="border: 1px solid #000; text-align: center; padding: 4px; color: #555;">Faktura</td>
          <td style="border: 1px solid #000; padding: 4px 8px; font-family: monospace;">${inv.nrFaktury}</td>
          <td style="border: 1px solid #000; text-align: right; padding: 4px 8px; font-family: monospace;">${formatCurrency(inv.netto, inv.waluta)}</td>
          <td style="border: 1px solid #000; text-align: center; padding: 4px; font-family: monospace;">${rowRate}</td>
          <td style="border: 1px solid #000; text-align: right; padding: 4px 8px; font-family: monospace; font-weight: bold;">${formatCurrency(rowPln, 'PLN')}</td>
        </tr>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <title>Premia ${personName} - ${monthName}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 20px;
      color: #000;
      background: #fff;
    }
    .sheet {
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      box-sizing: border-box;
    }
    h2 {
      text-align: center;
      margin-bottom: 20px;
      font-size: 22px;
      font-weight: bold;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      border: 2px solid #000;
      font-size: 12px;
    }
    th {
      border: 1px solid #000;
      background-color: #f1f5f9;
      padding: 6px;
      font-weight: bold;
    }
    .summary-table {
      margin-top: 20px;
      width: 100%;
      border-collapse: collapse;
      border: 2px solid #000;
      font-size: 13px;
    }
    .summary-table td {
      border: 1px solid #000;
      padding: 8px 12px;
    }
    .footer-section {
      margin-top: 25px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      font-size: 12px;
    }
    .signature-box {
      text-align: right;
    }
    .signature-line {
      width: 200px;
      border-bottom: 1px dotted #000;
      display: inline-block;
      height: 10px;
    }
    @media print {
      @page { size: A4 portrait; margin: 8mm; }
      body { margin: 0; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <h2>Premia ${personName} - ${monthName}</h2>
    
    <table>
      <thead>
        <tr>
          <th style="width: 35px;">Lp.</th>
          <th>Projekt</th>
          <th colspan="2">Numer Faktury</th>
          <th>Kwota</th>
          <th style="width: 75px;">Kurs EUR</th>
          <th>Kwota w PLN</th>
        </tr>
      </thead>
      <tbody>
        ${invoiceRows}
        <tr style="border-top: 2px solid #000; font-weight: bold; background-color: #f8fafc;">
          <td colspan="4"></td>
          <td style="border: 1px solid #000; text-align: right; padding: 6px 8px; font-family: monospace;">${formatCurrency(sumNettoEur, 'EUR')}</td>
          <td style="border: 1px solid #000;"></td>
          <td style="border: 1px solid #000; text-align: right; padding: 6px 8px; font-family: monospace;">${formatCurrency(sumConvertedPln, 'PLN')}</td>
        </tr>
      </tbody>
    </table>

    <table class="summary-table">
      <tbody>
        <tr>
          <td style="background-color: #f8fafc; font-weight: bold; width: 30%;">Premia 1% (Brutto)</td>
          <td style="text-align: right; font-family: monospace; font-weight: bold; width: 35%;">${formatCurrency(sumConvertedPln, 'PLN')}</td>
          <td style="text-align: center; font-weight: bold; width: 10%;">1%</td>
          <td style="text-align: right; font-family: monospace; font-weight: bold; background-color: #f1f5f9; width: 25%; font-size: 14px;">${formatCurrency(bonus1Percent, 'PLN')}</td>
        </tr>
      </tbody>
    </table>

    <div class="footer-section">
      <div>
        <p style="text-decoration: underline; margin: 0 0 4px 0; font-weight: bold;">${rateSourceText}</p>
        <p style="margin: 0 0 4px 0; color: #444;">Tabela A kursów średnich</p>
        <p style="margin: 0; font-weight: bold; font-size: 13px;">1 EUR = ${formatRate(exchangeRate)} zł</p>
      </div>
      <div class="signature-box">
        <p style="margin: 0 0 8px 0; color: #555;">Podpis</p>
        <span class="signature-line"></span>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Export settlement to standalone HTML file
 */
export function exportSettlementToHtmlFile(
  personName: string,
  monthName: string,
  invoices: StoredInvoice[],
  sumNettoEur: number,
  exchangeRate: number,
  sumConvertedPln: number,
  bonus1Percent: number,
  rateSourceText: string
) {
  const htmlContent = buildSettlementHtml(
    personName,
    monthName,
    invoices,
    sumNettoEur,
    exchangeRate,
    sumConvertedPln,
    bonus1Percent,
    rateSourceText
  );

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Premia_${personName.replace(/\s+/g, '_')}_${monthName.replace(/\s+/g, '_')}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export settlement workbook to Excel (.xlsx) styled faithfully to 01.jpg layout
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
  // Generate HTML Excel Spreadsheet format that Microsoft Excel opens with full CSS styles,
  // borders, colors, column widths and formatting matching 01.jpg!
  const htmlTable = buildSettlementHtml(
    personName,
    monthName,
    invoices,
    sumNettoEur,
    exchangeRate,
    sumConvertedPln,
    bonus1Percent,
    rateSourceText
  );

  const excelBlob = new Blob(['\ufeff' + htmlTable], {
    type: 'application/vnd.ms-excel;charset=utf-8',
  });

  const url = URL.createObjectURL(excelBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Premia_${personName.replace(/\s+/g, '_')}_${monthName.replace(/\s+/g, '_')}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
