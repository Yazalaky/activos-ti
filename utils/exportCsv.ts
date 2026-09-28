const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const escapeCsvValue = (value: unknown) => {
  if (value === null || value === undefined) return '""';

  let text = String(value);

  // Evita que Excel interprete valores controlados por usuarios como fórmulas.
  if (typeof value === 'string' && /^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
};

export const exportToCsv = (filename: string, rows: Record<string, unknown>[]) => {
  if (!rows?.length) return;

  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.map(escapeCsvValue).join(','),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(',')),
  ].join('\r\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const safeFilename = filename.replace(/[^a-zA-Z0-9_-]+/g, '_') || 'reporte';
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = `${safeFilename}_${formatLocalDate(new Date())}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};
