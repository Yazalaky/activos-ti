const admin = require('firebase-admin');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

admin.initializeApp();
const auth = getAuth();
const db = getFirestore();
const storage = getStorage();

const assertString = (value, field) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HttpsError('invalid-argument', `Campo inválido: ${field}`);
  }
  return value.trim();
};

const allowedRoles = new Set(['admin', 'tech', 'auditor', 'management']);
const allowedCreateRoles = new Set(['tech', 'management']);
const allowedAccessScopes = new Set(['global', 'sites']);

const getCallerProfile = async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
  }

  const callerSnap = await db.doc(`users/${request.auth.uid}`).get();
  const callerData = callerSnap.exists ? callerSnap.data() : null;
  const callerRole = callerData?.role || null;
  const callerActive = callerData?.active !== false;
  if (callerRole !== 'admin' || !callerActive) {
    throw new HttpsError('permission-denied', 'Solo administradores pueden realizar esta acción.');
  }

  return callerData;
};

const assertEmail = (value) => {
  const email = assertString(value, 'email').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new HttpsError('invalid-argument', 'El correo electrónico no es válido.');
  }
  return email;
};

const assertPassword = (value) => {
  const password = assertString(value, 'password');
  if (password.length < 8 || password.length > 128) {
    throw new HttpsError('invalid-argument', 'La contraseña debe tener entre 8 y 128 caracteres.');
  }
  return password;
};

const normalizeAccess = async (data) => {
  const accessScope = data.accessScope || 'global';
  if (!allowedAccessScopes.has(accessScope)) {
    throw new HttpsError('invalid-argument', 'Alcance de acceso inválido.');
  }

  const rawSiteIds = Array.isArray(data.siteIds) ? data.siteIds : [];
  const siteIds = [...new Set(rawSiteIds.map((id) => assertString(id, 'siteIds')))].filter(Boolean);
  if (siteIds.length > 30) {
    throw new HttpsError('invalid-argument', 'No se pueden asignar más de 30 sedes a un usuario.');
  }
  if (accessScope === 'sites' && siteIds.length === 0) {
    throw new HttpsError('invalid-argument', 'Selecciona al menos una sede para el alcance restringido.');
  }

  if (siteIds.length > 0) {
    const siteRefs = siteIds.map((siteId) => db.doc(`sites/${siteId}`));
    const siteSnapshots = await db.getAll(...siteRefs);
    if (siteSnapshots.some((snapshot) => !snapshot.exists)) {
      throw new HttpsError('invalid-argument', 'Una o más sedes no existen.');
    }
  }

  return {
    accessScope,
    siteIds: accessScope === 'sites' ? siteIds : [],
  };
};

exports.createUser = onCall(async (request) => {
  await getCallerProfile(request);

  const callerUid = request.auth.uid;
  const email = assertEmail(request.data.email);
  const password = assertPassword(request.data.password);
  const name = assertString(request.data.name, 'name');
  const role = assertString(request.data.role, 'role');

  if (!allowedRoles.has(role)) {
    throw new HttpsError('invalid-argument', 'Rol inválido.');
  }
  if (!allowedCreateRoles.has(role)) {
    throw new HttpsError('invalid-argument', 'Este rol no se puede crear desde la app.');
  }

  const access = await normalizeAccess(request.data);
  let userRecord;

  try {
    userRecord = await auth.createUser({
      email,
      password,
      displayName: name,
    });

    await db.doc(`users/${userRecord.uid}`).set({
      email,
      name,
      role,
      active: true,
      ...access,
      createdAt: Date.now(),
      createdByUid: callerUid,
    });

    return { uid: userRecord.uid };
  } catch (error) {
    if (userRecord?.uid) {
      try {
        await auth.deleteUser(userRecord.uid);
      } catch (rollbackError) {
        console.error('No se pudo revertir el usuario creado:', rollbackError);
      }
    }
    console.error('Error creando usuario:', error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', 'No se pudo crear el usuario.');
  }
});

exports.setUserStatus = onCall(async (request) => {
  await getCallerProfile(request);

  const uid = assertString(request.data.uid, 'uid');
  const disabled = request.data.disabled === true;
  const callerUid = request.auth.uid;

  if (uid === callerUid) {
    throw new HttpsError('failed-precondition', 'No puedes inactivar tu propio usuario.');
  }

  try {
    await auth.updateUser(uid, { disabled });
    await db.doc(`users/${uid}`).set({
      active: !disabled,
      updatedAt: Date.now(),
      updatedByUid: callerUid,
    }, { merge: true });

    return { uid, disabled };
  } catch (error) {
    console.error('Error actualizando estado de usuario:', error);
    throw new HttpsError('internal', 'No se pudo actualizar el estado del usuario.');
  }
});

const resetDependencyCollections = [
  'acts',
  'activities',
  'maintenances',
  'invoices',
  'quotes',
  'reports',
  'inventoryReports',
];

const getSiteResetConfirmation = (prefix) => `REINICIAR INVENTARIO ${String(prefix).trim().toUpperCase()}`;

exports.resetSiteInventory = onCall(async (request) => {
  await getCallerProfile(request);

  const siteId = assertString(request.data.siteId, 'siteId');
  const confirmation = assertString(request.data.confirmation, 'confirmation');
  const siteRef = db.doc(`sites/${siteId}`);
  const siteSnapshot = await siteRef.get();

  if (!siteSnapshot.exists || siteSnapshot.data()?.isDeleted === true) {
    throw new HttpsError('not-found', 'La sede seleccionada no existe.');
  }

  const siteData = siteSnapshot.data() || {};
  const prefix = String(siteData.prefix || '').trim();
  if (!prefix) {
    throw new HttpsError('failed-precondition', 'La sede no tiene un prefijo configurado.');
  }

  const expectedConfirmation = getSiteResetConfirmation(prefix);
  if (confirmation.toUpperCase() !== expectedConfirmation) {
    throw new HttpsError('failed-precondition', 'La frase de confirmación no coincide.');
  }

  const assetsQuery = db.collection('assets').where('siteId', '==', siteId);
  const dependencySnapshots = await Promise.all(
    resetDependencyCollections.map((collectionName) => (
      db.collection(collectionName).where('siteId', '==', siteId).get()
    )),
  );
  const dependencies = dependencySnapshots
    .map((snapshot, index) => ({ collection: resetDependencyCollections[index], count: snapshot.size }))
    .filter((item) => item.count > 0);

  if (dependencies.length > 0) {
    const dependencySummary = dependencies.map((item) => `${item.collection}: ${item.count}`).join(', ');
    throw new HttpsError(
      'failed-precondition',
      `No se puede reiniciar la sede porque tiene información histórica relacionada (${dependencySummary}).`,
    );
  }

  const resetRef = db.collection('inventoryResets').doc();
  const resetId = resetRef.id;
  const startedAt = Date.now();
  let resetResult;

  try {
    resetResult = await db.runTransaction(async (transaction) => {
      // Todas las lecturas se realizan antes de cualquier escritura para que el
      // respaldo, la eliminación y el reinicio del consecutivo sean atómicos.
      const currentSiteSnapshot = await transaction.get(siteRef);
      const currentAssetsSnapshot = await transaction.get(assetsQuery);
      const currentDependencySnapshots = [];

      for (const collectionName of resetDependencyCollections) {
        currentDependencySnapshots.push(
          await transaction.get(db.collection(collectionName).where('siteId', '==', siteId)),
        );
      }

      if (!currentSiteSnapshot.exists || currentSiteSnapshot.data()?.isDeleted === true) {
        throw new HttpsError('not-found', 'La sede seleccionada no existe.');
      }

      const currentSiteData = currentSiteSnapshot.data() || {};
      const currentPrefix = String(currentSiteData.prefix || '').trim();
      if (getSiteResetConfirmation(currentPrefix) !== expectedConfirmation) {
        throw new HttpsError('failed-precondition', 'El prefijo de la sede cambió. Vuelve a cargar la página e inténtalo de nuevo.');
      }

      const currentDependencies = currentDependencySnapshots
        .map((snapshot, index) => ({ collection: resetDependencyCollections[index], count: snapshot.size }))
        .filter((item) => item.count > 0);
      if (currentDependencies.length > 0) {
        const dependencySummary = currentDependencies.map((item) => `${item.collection}: ${item.count}`).join(', ');
        throw new HttpsError(
          'failed-precondition',
          `No se puede reiniciar la sede porque tiene información histórica relacionada (${dependencySummary}).`,
        );
      }

      // Cada activo genera dos escrituras (respaldo y eliminación), además de
      // la metadata del reinicio y la actualización de la sede. Se limita el
      // tamaño para respetar el límite de escrituras de una transacción.
      if (currentAssetsSnapshot.size > 200) {
        throw new HttpsError(
          'failed-precondition',
          'La sede tiene más de 200 activos. Solicita un procedimiento de migración por lotes.',
        );
      }

      const assetIds = currentAssetsSnapshot.docs.map((assetSnapshot) => assetSnapshot.id);
      transaction.set(resetRef, {
        siteId,
        siteName: String(currentSiteData.name || ''),
        prefix: currentPrefix,
        status: 'firestore_completed',
        assetCount: currentAssetsSnapshot.size,
        assetIds,
        startedAt,
        createdAt: startedAt,
        createdByUid: request.auth.uid,
      });

      currentAssetsSnapshot.docs.forEach((assetSnapshot) => {
        transaction.set(resetRef.collection('assetSnapshots').doc(assetSnapshot.id), {
          assetId: assetSnapshot.id,
          snapshot: assetSnapshot.data(),
          createdAt: startedAt,
        });
        transaction.delete(assetSnapshot.ref);
      });

      transaction.update(siteRef, {
        assetSeq: 0,
        releasedAssetSeqs: [],
        lastInventoryResetAt: startedAt,
        lastInventoryResetByUid: request.auth.uid,
        lastInventoryResetId: resetId,
        updatedAt: startedAt,
        updatedByUid: request.auth.uid,
      });

      return { assetIds, assetCount: currentAssetsSnapshot.size };
    });
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('Error reiniciando inventario de sede:', error);
    throw new HttpsError('internal', 'No se pudo reiniciar el inventario de la sede. No se aplicaron cambios.');
  }

  const storageCleanupPendingAssetIds = [];
  let deletedStorageFiles = 0;

  try {
    const bucket = storage.bucket();
    for (const assetId of resetResult.assetIds) {
      const prefixPath = `assets/${assetId}/photos/`;
      try {
        const [files] = await bucket.getFiles({ prefix: prefixPath });
        for (const file of files) {
          await file.delete();
          deletedStorageFiles += 1;
        }
      } catch (error) {
        console.error(`No se pudieron eliminar las fotos del activo ${assetId}:`, error);
        storageCleanupPendingAssetIds.push(assetId);
      }
    }
  } catch (error) {
    console.error('No se pudo acceder al almacenamiento para limpiar las fotos:', error);
    storageCleanupPendingAssetIds.push(...resetResult.assetIds);
  }

  const completedAt = Date.now();
  try {
    await resetRef.update({
      status: storageCleanupPendingAssetIds.length > 0 ? 'storage_cleanup_pending' : 'completed',
      completedAt,
      deletedStorageFiles,
      storageCleanupPendingAssetIds,
    });
  } catch (error) {
    console.error('No se pudo actualizar el resultado del reinicio:', error);
  }

  return {
    resetId,
    siteId,
    deletedAssets: resetResult.assetCount,
    deletedStorageFiles,
    storageCleanupPending: storageCleanupPendingAssetIds.length > 0,
  };
});
