import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

function buildHeaderHTML(title, subtitle) {
  const now = new Date().toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' });
  return `
    <div style="text-align:center; margin-bottom:16px; padding-bottom:12px; border-bottom:2px solid #16A34A;">
      <div style="font-size:18px; font-weight:700; color:#16A34A;">AcorCloud Green-Sync</div>
      <div style="font-size:14px; font-weight:600; color:#1e293b; margin-top:4px;">${title}</div>
      ${subtitle ? `<div style="font-size:11px; color:#64748b; margin-top:2px;">${subtitle}</div>` : ''}
      <div style="font-size:10px; color:#94a3b8; margin-top:4px;">Generated ${now}</div>
    </div>
  `;
}

async function captureElement(element) {
  return html2canvas(element, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    windowWidth: element.scrollWidth,
  });
}

export async function exportElementAsPDF(element, filename, title, subtitle) {
  const canvas = await captureElement(element);
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 8;
  const usableWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * usableWidth) / canvas.width;

  // Add header on first page
  pdf.setFontSize(16);
    let heightLeft = imgHeight;
  let position = margin + 18;

  pdf.addImage(imgData, 'PNG', margin, position, usableWidth, imgHeight);
  heightLeft -= (pageHeight - position - margin);

  while (heightLeft > 0) {
    pdf.addPage();
    position = margin;
    pdf.addImage(imgData, 'PNG', margin, position - imgHeight + heightLeft + (pageHeight - margin * 2 - imgHeight), usableWidth, imgHeight);
    heightLeft -= (pageHeight - margin * 2);
  }

  pdf.save(filename);
}

export function printSlip(htmlContent, title) {
  const printWindow = window.open('', '_blank', 'width=380,height=700');
  if (!printWindow) {
    alert('Please allow pop-ups to print the slip.');
    return;
  }
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        @page { margin: 4mm; size: 80mm auto; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Courier New', 'Courier', monospace; font-size: 11px; color: #000; }
        .slip { width: 72mm; margin: 0 auto; padding: 4mm 0; }
        @media print { body { width: 80mm; } }
      </style>
    </head>
    <body>
      <div class="slip">${htmlContent}</div>
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      setTimeout(() => printWindow.close(), 300);
    }, 250);
  };
}

export async function printElement(element, title, subtitle) {
  const canvas = await captureElement(element);
  const imgData = canvas.toDataURL('image/png');
  const printWindow = window.open('', '_blank', 'width=900,height=700');

  if (!printWindow) {
    alert('Please allow pop-ups to print reports.');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        @page { margin: 12mm; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; padding: 20px; color: #1e293b; }
        ${buildHeaderHTML(title, subtitle).replace(/<div/g, '<div').replace(/<\/div>/g, '</div>')}
        img { max-width: 100%; height: auto; display: block; margin: 0 auto; }
        @media print {
          body { padding: 0; }
        }
      </style>
    </head>
    <body>
      ${buildHeaderHTML(title, subtitle)}
      <img src="${imgData}" alt="${title}" />
    </body>
    </html>
  `);
  printWindow.document.close();

  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      setTimeout(() => printWindow.close(), 300);
    }, 250);
  };
}