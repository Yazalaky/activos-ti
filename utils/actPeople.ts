import type { SiteDirector } from '../types';

// Para un equipo compartido la tabla superior usa los datos del director;
// con una sola firma usa los del empleado. El director se guarda aparte.
export const actCollaborator = (director: SiteDirector, employee: SiteDirector, signatureCount: number): SiteDirector =>
  ({ ...(signatureCount > 1 ? director : employee) });
