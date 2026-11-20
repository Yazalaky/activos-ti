export type AssetTypeOption = { id: string; name: string; active: boolean };

export const DEFAULT_ASSET_TYPES: readonly AssetTypeOption[] = [
  { id: 'laptop', name: 'Laptop', active: true },
  { id: 'desktop', name: 'Desktop', active: true },
  { id: 'monitor', name: 'Monitor', active: true },
  { id: 'keyboard', name: 'Teclado', active: true },
  { id: 'mouse', name: 'Mouse', active: true },
  { id: 'printer', name: 'Impresora', active: true },
  { id: 'scanner', name: 'Scanner', active: true },
  { id: 'network', name: 'Red', active: true },
  { id: 'cellphone', name: 'Celular', active: true },
  { id: 'tablet', name: 'Tablet', active: true },
  { id: 'other', name: 'Otro', active: true },
];

export const mergeAssetTypes = (records: readonly AssetTypeOption[]): AssetTypeOption[] => {
  const byId = new Map(records.map((item) => [item.id, item]));
  const builtins = DEFAULT_ASSET_TYPES.map((item) => byId.get(item.id) || item);
  const builtinIds = new Set(DEFAULT_ASSET_TYPES.map((item) => item.id));
  const extras = records.filter((item) => !builtinIds.has(item.id))
    .slice().sort((a, b) => a.name.localeCompare(b.name, 'es-CO', { sensitivity: 'base' }));
  return [...builtins, ...extras];
};

export const assetTypeName = (id: string, types: readonly AssetTypeOption[]): string =>
  types.find((type) => type.id === id)?.name || id || 'Sin tipo';

export const supportsAssetHardware = (id: string | undefined): boolean =>
  id === 'laptop' || id === 'desktop' || id === 'cellphone' || id === 'tablet';

export const actDeviceType = (id: string, types: readonly AssetTypeOption[]) => {
  const known = ['desktop', 'laptop', 'printer', 'tablet', 'cellphone'];
  const other = !known.includes(id);
  return {
    deviceTypes: { desktop: id === 'desktop', laptop: id === 'laptop', printer: id === 'printer',
      tablet: id === 'tablet', cellphone: id === 'cellphone', other },
    otherDeviceType: other ? assetTypeName(id, types) : '',
  };
};
