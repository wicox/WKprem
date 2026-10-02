import jsPDF from 'jspdf';
import { StoredInvoice, Currency } from '../types/bonus';
import { formatCurrency, formatRate, formatMonthName } from '../utils/colors';

/**
 * Creates an image data URL from an HTML element using standard Canvas 2D rasterization
 * without relying on external CSS parsers that fail on Tailwind v4 oklch colors.
 */
export async function renderElementToCanvas(element: HTMLElement, scale: number = 2): Promise<HTMLCanvasElement> {
  const rect = element.getBoundingClientRect();
  const width = Math.ceil(rect.width || 800);
  const height = Math.ceil(rect.height || 1100);

  // Clone element to sanitize and inline styles
  const clone = element.cloneNode(true) as HTMLElement;

  // Remove preview-only elements (e.g. preview person column, reordering buttons)
  clone.querySelectorAll('.export-exclude, .print\\:hidden').forEach((el) => el.remove());

  // Inline basic colors so foreignObject renders reliably without external CSS
  clone.style.width = `${width}px`;
  clone.style.backgroundColor = '#ffffff';
  clone.style.color = '#000000';
  clone.style.fontFamily = 'Arial, Helvetica, sans-serif';
  clone.style.margin = '0';
  clone.style.boxSizing = 'border-box';

  const xmlSerializer = new XMLSerializer();
  const htmlContent = xmlSerializer.serializeToString(clone);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml" style="background:#ffffff; color:#000000; font-family: Arial, sans-serif; font-size: 12px; width: 100%;">
          <style>
            * { box-sizing: border-box; }
            table { border-collapse: collapse; width: 100%; border: 2px solid #000; }
            th, td { border: 1px solid #000; padding: 4px 6px; }
            th { background: #f8fafc; font-weight: bold; }
            .font-mono { font-family: monospace; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .font-bold { font-weight: bold; }
          </style>
          ${htmlContent}
        </div>
      </foreignObject>
    </svg>
  `;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas context not available'));
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };

    img.onerror = () => {
      // Fallback: draw directly on canvas if foreignObject SVG blocked
      URL.revokeObjectURL(url);
      tryDirectCanvasFallback(element, width, height, scale)
        .then(resolve)
        .catch(reject);
    };

    img.src = url;
  });
}

/**
 * Fallback direct canvas drawer in case SVG foreignObject has security limits in some environments
 */
function tryDirectCanvasFallback(
  element: HTMLElement,
  width: number,
  height: number,
  scale: number
): Promise<HTMLCanvasElement> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.fillStyle = '#000000';
      ctx.font = '16px Arial, sans-serif';
      ctx.fillText(element.innerText.substring(0, 50), 20, 40);
    }
    resolve(canvas);
  });
}

/**
 * Export to JPG file
 */
export async function downloadElementAsJpg(element: HTMLElement, filename: string): Promise<void> {
  const canvas = await renderElementToCanvas(element, 2);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
  const link = document.createElement('a');
  link.download = filename.endsWith('.jpg') ? filename : `${filename}.jpg`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Export to PDF file (scaled strictly for A4 portrait 1-page fit)
 */
export async function downloadElementAsPdf(element: HTMLElement, filename: string): Promise<void> {
  const canvas = await renderElementToCanvas(element, 2);
  const imgData = canvas.toDataURL('image/jpeg', 0.95);

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth(); // 210mm
  const pageHeight = pdf.internal.pageSize.getHeight(); // 297mm

  // Margins 8mm
  const margin = 8;
  const targetWidth = pageWidth - (margin * 2);
  let targetHeight = (canvas.height * targetWidth) / canvas.width;

  // If height exceeds single A4 page, scale down to fit strictly on 1 single page!
  const maxHeight = pageHeight - (margin * 2);
  if (targetHeight > maxHeight) {
    const scaleFactor = maxHeight / targetHeight;
    const scaledWidth = targetWidth * scaleFactor;
    const xOffset = (pageWidth - scaledWidth) / 2;
    pdf.addImage(imgData, 'JPEG', xOffset, margin, scaledWidth, maxHeight);
  } else {
    pdf.addImage(imgData, 'JPEG', margin, margin, targetWidth, targetHeight);
  }

  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}
