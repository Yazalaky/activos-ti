// Orden compartido para las opciones de sede, independiente del idioma del navegador.
const siteNameCollator = new Intl.Collator('es-CO', { sensitivity: 'base' });

export const compareSiteNames = (a: { name: string }, b: { name: string }): number =>
  siteNameCollator.compare((a.name ?? '').trim(), (b.name ?? '').trim());
