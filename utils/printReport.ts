export type ReportColumn = {
  key: string;
  label: string;
};

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const printReport = (
  title: string,
  columns: readonly ReportColumn[],
  rows: Record<string, unknown>[],
) => {
  if (!rows.length) return false;

  const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=800');
  if (!printWindow) return false;

  const header = columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('');
  const body = rows
    .map(
      (row) =>
        `<tr>${columns.map((column) => `<td>${escapeHtml(row[column.key])}</td>`).join('')}</tr>`,
    )
    .join('');

  printWindow.document.open();
  printWindow.document.write(`
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          @page { size: landscape; margin: 12mm; }
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; color: #17202a; margin: 0; }
          h1 { font-size: 18px; margin: 0 0 4px; }
          p { color: #566573; font-size: 11px; margin: 0 0 14px; }
          table { border-collapse: collapse; width: 100%; font-size: 10px; }
          th, td { border: 1px solid #d5d8dc; padding: 5px 6px; text-align: left; vertical-align: top; }
          th { background: #f2f4f4; font-weight: 700; }
          tr { break-inside: avoid; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <p>Generado el ${formatLocalDate(new Date())}</p>
        <table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.onafterprint = () => printWindow.close();
  printWindow.setTimeout(() => printWindow.print(), 250);

  return true;
};
