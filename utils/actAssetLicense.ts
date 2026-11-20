// No inferir una licencia cuando el inventario no contiene un sistema operativo.
export const actAssetLicense = (operatingSystem: unknown): string =>
  typeof operatingSystem === 'string' ? operatingSystem.trim() : '';
