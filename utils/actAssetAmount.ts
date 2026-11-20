// Autocompletar solo valores exactos en pesos y centavos; no redondear el costo.
const numberFormatter = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const units = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
const teens = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
const twenties = ['veinte', 'veintiún', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
const tens = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const hundreds = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

const underThousand = (value: number): string => {
  if (value === 100) return 'cien';
  const parts: string[] = [];
  const hundred = Math.floor(value / 100);
  if (hundred) parts.push(hundreds[hundred]);
  const rest = value % 100;
  if (rest < 10) {
    if (rest) parts.push(units[rest]);
  } else if (rest < 20) {
    parts.push(teens[rest - 10]);
  } else if (rest < 30) {
    parts.push(twenties[rest - 20]);
  } else {
    const unit = rest % 10;
    parts.push(tens[Math.floor(rest / 10)] + (unit ? ` y ${units[unit]}` : ''));
  }
  return parts.join(' ');
};

const underMillion = (value: number): string => {
  const thousands = Math.floor(value / 1000);
  const rest = value % 1000;
  return [thousands ? (thousands === 1 ? 'mil' : `${underThousand(thousands)} mil`) : '', underThousand(rest)]
    .filter(Boolean).join(' ');
};

const integerWords = (value: number): string => {
  if (value === 0) return 'cero';
  const millions = Math.floor(value / 1_000_000);
  const rest = value % 1_000_000;
  return [millions ? (millions === 1 ? 'un millón' : `${underMillion(millions)} millones`) : '', underMillion(rest)]
    .filter(Boolean).join(' ');
};

export const actAssetAmount = (cost: unknown): { discountAmountWords: string; discountAmountValue: string } | null => {
  if (typeof cost !== 'number' || !Number.isFinite(cost) || cost <= 0) return null;
  const cents = Math.round(cost * 100);
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > 99_999_999_999_999
      || Math.abs(cost * 100 - cents) > 0.0001) return null;
  const pesos = Math.floor(cents / 100);
  const remainder = cents % 100;
  const connector = pesos >= 1_000_000 && pesos % 1_000_000 === 0 ? ' de' : '';
  const pesoWords = `${integerWords(pesos)}${connector} ${pesos === 1 ? 'peso' : 'pesos'}`;
  const words = remainder ? `${pesoWords} con ${integerWords(remainder)} ${remainder === 1 ? 'centavo' : 'centavos'}` : pesoWords;
  return {
    discountAmountWords: words.charAt(0).toUpperCase() + words.slice(1),
    discountAmountValue: numberFormatter.format(pesos) + (remainder ? `,${String(remainder).padStart(2, '0')}` : ''),
  };
};
