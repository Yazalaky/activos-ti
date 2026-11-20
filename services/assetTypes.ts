import { collection, doc, onSnapshot, runTransaction } from 'firebase/firestore';
import { auth } from '../firebaseAuth';
import { db } from '../firebaseDb';
import { mergeAssetTypes, type AssetTypeOption } from '../utils/assetTypes';

export const observeAssetTypes = (onChange: (types: AssetTypeOption[]) => void, onError: () => void) =>
  onSnapshot(collection(db, 'assetTypes'), (snapshot) => {
    const records = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })) as AssetTypeOption[];
    onChange(mergeAssetTypes(records));
  }, onError);

export const saveAssetType = async (id: string | null, name: string, active: boolean) => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Debes iniciar sesión.');
  const label = name.trim();
  if (!label || label.length > 60) throw new Error('El nombre debe tener entre 1 y 60 caracteres.');
  const targetId = id || `custom_${doc(collection(db, 'assetTypes')).id.toLowerCase()}`;
  const reference = doc(db, 'assetTypes', targetId);
  await runTransaction(db, async (tx) => {
    const current = await tx.get(reference);
    const now = Date.now();
    if (current.exists()) {
      tx.update(reference, { name: label, active, updatedAt: now, updatedByUid: uid });
    } else {
      tx.set(reference, { name: label, active, createdAt: now, createdByUid: uid });
    }
  });
};
