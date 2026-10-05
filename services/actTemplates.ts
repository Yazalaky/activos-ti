import type { ActTemplate } from '../types';

export const ACT_COMPANIES = [
  { id: 'medicuc', label: 'Medicuc', sourceName: 'Acta Medicuc.docx' },
  { id: 'redinsalud', label: 'Redinsalud', sourceName: 'Acta Redinsalud.docx' },
  { id: 'saludfamilia', label: 'Salud Familia', sourceName: 'Acta Salud Familia.docx' },
  { id: 'gestionbienestar', label: 'Gestionar Bienestar', sourceName: 'Acta Gestionar.docx' },
  { id: 'aliados', label: 'Aliados', sourceName: 'Acta Aliados.docx' },
  { id: 'rehabilitdemos', label: 'Rehabilitdemos', sourceName: 'Acta Rehabilitdemos.docx' },
  { id: 'logros', label: 'Logros', sourceName: 'Acta Logros.docx' },
  { id: 'cmi', label: 'CMI', sourceName: 'Acta CMI.docx' },
] as const;

export const companyLabel = (companyId?: string) => {
  const company = ACT_COMPANIES.find((item) => item.id === companyId);
  return company?.label || (companyId ? companyId : 'Sin asignar');
};

export const defaultSignaturePlacement = {
  page: 1,
  x: 70,
  y: 120,
  width: 170,
  height: 58,
};

export const defaultTemplateForCompany = (companyId: string): Partial<ActTemplate> => {
  const company = ACT_COMPANIES.find((item) => item.id === companyId);
  return {
    id: companyId,
    companyId,
    companyName: company?.label || companyId,
    version: 1,
    active: false,
    signaturePlacement: defaultSignaturePlacement,
  };
};
