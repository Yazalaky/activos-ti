// Orden natural: el consecutivo 2 va antes de 10, incluso si no tiene ceros.
const assetCodeCollator = new Intl.Collator('es-CO', { numeric: true, sensitivity: 'base' });

export const compareAssetCodes = (
  a: { fixedAssetId?: string | null },
  b: { fixedAssetId?: string | null },
): number => {
  const left = (a.fixedAssetId ?? '').trim();
  const right = (b.fixedAssetId ?? '').trim();
  if (!left || !right) return left ? -1 : right ? 1 : 0;
  return assetCodeCollator.compare(left, right);
};
