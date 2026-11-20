import type { Act, Asset } from '../types';

// Coincide con la comprobación existente al guardar: solo las actas anuladas no bloquean.
export const assetIdsWithActiveActs = (acts: readonly Act[]): Set<string> =>
  new Set(acts.filter((act) => !act.isDeleted && act.status !== 'void' && Boolean(act.assetId))
    .map((act) => act.assetId));

export const assetAvailableForAct = (asset: Asset, occupiedIds: ReadonlySet<string>): boolean =>
  !occupiedIds.has(asset.id) && asset.status === 'asignado'
  && Boolean(asset.currentAssignment?.assignedToName && asset.currentAssignment?.assignedToPosition
    && asset.currentAssignment?.assignedToResponsible);

export const assetsForActSite = (
  assets: readonly Asset[], occupiedIds: ReadonlySet<string>, siteId: string, editingAssetId?: string,
): Asset[] => assets.filter((asset) => (!siteId || asset.siteId === siteId)
  && (asset.id === editingAssetId || assetAvailableForAct(asset, occupiedIds)));
