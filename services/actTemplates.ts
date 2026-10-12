import type { ActTemplate } from '../types';

export const ACT_COMPANIES = [
  { id: 'medicuc', label: 'Medicuc' },
  { id: 'redinsalud', label: 'Redinsalud' },
  { id: 'saludfamilia', label: 'Salud Familia' },
  { id: 'gestionbienestar', label: 'Gestionar Bienestar' },
  { id: 'aliados', label: 'Aliados' },
  { id: 'rehabilitdemos', label: 'Rehabilitdemos' },
  { id: 'logros', label: 'Logros' },
  { id: 'cmi', label: 'CMI' },
] as const;

export const companyLabel = (companyId?: string) => {
  const company = ACT_COMPANIES.find((item) => item.id === companyId);
  return company?.label || (companyId ? companyId : 'Sin asignar');
};

export const defaultTemplateForCompany = (companyId: string): Partial<ActTemplate> => {
  const company = ACT_COMPANIES.find((item) => item.id === companyId);
  return {
    id: companyId,
    companyId,
    companyName: company?.label || companyId,
    version: 1,
    active: true,
  };
};
