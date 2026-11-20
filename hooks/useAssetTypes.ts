import { useEffect, useState } from 'react';
import { observeAssetTypes } from '../services/assetTypes';
import { DEFAULT_ASSET_TYPES, type AssetTypeOption } from '../utils/assetTypes';

export const useAssetTypes = () => {
  const [types, setTypes] = useState<AssetTypeOption[]>(() => [...DEFAULT_ASSET_TYPES]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => observeAssetTypes((next) => { setTypes(next); setReady(true); setError(false); },
    () => { setReady(false); setError(true); }), []);
  return { types, ready, error };
};
