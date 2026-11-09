const admin = require('firebase-admin');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineString } = require('firebase-functions/params');
const { randomUUID } = require('crypto');

admin.initializeApp();
const auth = getAuth();
const db = getFirestore();
const storage = getStorage();
const actRendererUrl = defineString('ACT_RENDERER_URL');
const actRendererCallerServiceAccount = `act-pdf-renderer-caller@${process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'gestion-ti-d18d1'}.iam.gserviceaccount.com`;

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

const resetBlockingCollections = [
  'acts',
  'activities',
  'maintenances',
  'reports',
  'inventoryReports',
];

const resetInformationalCollections = ['invoices', 'quotes'];

const resetCollectionLabels = {
  acts: 'Actas que se conservarán por no estar vinculadas a los activos actuales',
  activities: 'Actividades vinculadas a activos',
  maintenances: 'Mantenimientos',
  reports: 'Reportes vinculados a activos',
  inventoryReports: 'Reportes de inventario vinculados a activos',
  invoices: 'Facturas que se conservarán',
  quotes: 'Cotizaciones que se conservarán',
};

const getSiteResetConfirmation = (prefix) => `REINICIAR INVENTARIO ${String(prefix).trim().toUpperCase()}`;

const hasDirectAssetReference = (data, assetIds) => {
  if (typeof data?.assetId === 'string' && assetIds.has(data.assetId)) return true;
  if (!Array.isArray(data?.assetIds)) return false;
  return data.assetIds.some((assetId) => typeof assetId === 'string' && assetIds.has(assetId));
};

const getActsToRetire = (actSnapshot, assetIds) => actSnapshot.docs
  .filter((item) => {
    const act = item.data() || {};
    return act.isDeleted !== true
      && typeof act.assetId === 'string'
      && assetIds.has(act.assetId);
  });

const getResetItem = (snapshot, assetMap) => {
  const data = snapshot.data() || {};
  const assetId = typeof data.assetId === 'string' ? data.assetId : '';
  const asset = assetMap.get(assetId);
  return {
    id: snapshot.id,
    date: String(data.date || data.scheduledDate || data.createdAt || ''),
    assetLabel: String(data.fixedAssetIdSnapshot || asset?.fixedAssetId || assetId || ''),
    title: String(data.description || data.number || data.findings || data.type || 'Registro'),
    status: String(data.status || ''),
    isDeleted: data.isDeleted === true,
  };
};

const buildResetAnalysis = ({
  assetSnapshot,
  blockingSnapshots,
  blockingCollectionNames,
  informationalSnapshots = [],
  informationalCollectionNames = [],
}) => {
  const assetMap = new Map(assetSnapshot.docs.map((snapshot) => [snapshot.id, snapshot.data() || {}]));
  const assetIds = new Set(assetSnapshot.docs.map((snapshot) => snapshot.id));
  const blocking = [];
  const preserved = [];
  let actsToRetire = [];

  blockingSnapshots.forEach((snapshot, index) => {
    const collectionName = blockingCollectionNames[index];
    const docs = snapshot.docs;
    if (collectionName === 'acts') {
      actsToRetire = getActsToRetire(snapshot, assetIds);
    }
    const relatedDocs = collectionName === 'maintenances'
      ? docs
      : collectionName === 'acts'
        ? []
        : docs.filter((item) => hasDirectAssetReference(item.data(), assetIds));
    const actIdsToRetire = collectionName === 'acts'
      ? new Set(actsToRetire.map((item) => item.id))
      : new Set();
    const preservedDocs = docs.filter((item) => (
      !relatedDocs.some((related) => related.id === item.id)
      && !actIdsToRetire.has(item.id)
    ));

    if (relatedDocs.length > 0) {
      blocking.push({
        collection: collectionName,
        label: resetCollectionLabels[collectionName] || collectionName,
        count: relatedDocs.length,
        items: relatedDocs.slice(0, 8).map((item) => getResetItem(item, assetMap)),
      });
    }
    if (preservedDocs.length > 0) {
      preserved.push({
        collection: collectionName,
        label: `${resetCollectionLabels[collectionName] || collectionName} que se conservarán`,
        count: preservedDocs.length,
      });
    }
  });

  informationalSnapshots.forEach((snapshot, index) => {
    if (snapshot.size === 0) return;
    const collectionName = informationalCollectionNames[index];
    preserved.push({
      collection: collectionName,
      label: resetCollectionLabels[collectionName] || collectionName,
      count: snapshot.size,
    });
  });

  return {
    assetCount: assetSnapshot.size,
    blocking,
    preserved,
    actsToRetire: {
      count: actsToRetire.length,
      items: actsToRetire.slice(0, 8).map((item) => getResetItem(item, assetMap)),
      ids: actsToRetire.map((item) => item.id).sort(),
    },
  };
};

const getSiteResetSnapshots = async (siteId, collectionNames, transaction) => {
  const assetsQuery = db.collection('assets').where('siteId', '==', siteId);
  const queries = collectionNames.map((collectionName) => (
    db.collection(collectionName).where('siteId', '==', siteId)
  ));

  if (transaction) {
    const assetSnapshot = await transaction.get(assetsQuery);
    const snapshots = [];
    for (const queryRef of queries) snapshots.push(await transaction.get(queryRef));
    return { assetSnapshot, snapshots };
  }

  const [assetSnapshot, ...snapshots] = await Promise.all([
    assetsQuery.get(),
    ...queries.map((queryRef) => queryRef.get()),
  ]);
  return { assetSnapshot, snapshots };
};

const getSiteResetAnalysis = async (siteId) => {
  const collectionNames = [...resetBlockingCollections, ...resetInformationalCollections];
  const { assetSnapshot, snapshots } = await getSiteResetSnapshots(siteId, collectionNames);
  return buildResetAnalysis({
    assetSnapshot,
    blockingSnapshots: snapshots.slice(0, resetBlockingCollections.length),
    blockingCollectionNames: resetBlockingCollections,
    informationalSnapshots: snapshots.slice(resetBlockingCollections.length),
    informationalCollectionNames: resetInformationalCollections,
  });
};

exports.previewSiteInventoryReset = onCall(async (request) => {
  await getCallerProfile(request);

  const siteId = assertString(request.data.siteId, 'siteId');
  const siteSnapshot = await db.doc(`sites/${siteId}`).get();
  if (!siteSnapshot.exists || siteSnapshot.data()?.isDeleted === true) {
    throw new HttpsError('not-found', 'La sede seleccionada no existe.');
  }

  const siteData = siteSnapshot.data() || {};
  const analysis = await getSiteResetAnalysis(siteId);
  return {
    siteId,
    siteName: String(siteData.name || ''),
    prefix: String(siteData.prefix || ''),
    ...analysis,
    actsToRetire: {
      count: analysis.actsToRetire.count,
      items: analysis.actsToRetire.items,
    },
  };
});

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

  const analysis = await getSiteResetAnalysis(siteId);
  if (analysis.blocking.length > 0) {
    const dependencySummary = analysis.blocking.map((item) => `${item.label}: ${item.count}`).join(', ');
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
      const { assetSnapshot: currentAssetsSnapshot, snapshots: currentDependencySnapshots } = await getSiteResetSnapshots(
        siteId,
        resetBlockingCollections,
        transaction,
      );

      if (!currentSiteSnapshot.exists || currentSiteSnapshot.data()?.isDeleted === true) {
        throw new HttpsError('not-found', 'La sede seleccionada no existe.');
      }

      const currentSiteData = currentSiteSnapshot.data() || {};
      const currentPrefix = String(currentSiteData.prefix || '').trim();
      if (getSiteResetConfirmation(currentPrefix) !== expectedConfirmation) {
        throw new HttpsError('failed-precondition', 'El prefijo de la sede cambió. Vuelve a cargar la página e inténtalo de nuevo.');
      }

      const currentAnalysis = buildResetAnalysis({
        assetSnapshot: currentAssetsSnapshot,
        blockingSnapshots: currentDependencySnapshots,
        blockingCollectionNames: resetBlockingCollections,
      });
      if (currentAnalysis.blocking.length > 0) {
        const dependencySummary = currentAnalysis.blocking.map((item) => `${item.label}: ${item.count}`).join(', ');
        throw new HttpsError(
          'failed-precondition',
          `No se puede reiniciar la sede porque tiene información histórica relacionada (${dependencySummary}).`,
        );
      }

      if (currentAnalysis.assetCount !== analysis.assetCount
        || JSON.stringify(currentAnalysis.actsToRetire.ids) !== JSON.stringify(analysis.actsToRetire.ids)) {
        throw new HttpsError(
          'failed-precondition',
          'Los activos o las actas cambiaron después de la consulta. Vuelve a cargar el análisis antes de reiniciar.',
        );
      }

      // Cada activo genera dos escrituras (respaldo y eliminación), además de
      // cada acta que se retira (respaldo y actualización), la metadata del
      // reinicio y la actualización de la sede. Se limita el tamaño para
      // respetar el límite de escrituras de una transacción.
      if (currentAssetsSnapshot.size > 200) {
        throw new HttpsError(
          'failed-precondition',
          'La sede tiene más de 200 activos. Solicita un procedimiento de migración por lotes.',
        );
      }

      const assetIds = currentAssetsSnapshot.docs.map((assetSnapshot) => assetSnapshot.id);
      const assetIdSet = new Set(assetIds);
      const actsSnapshot = currentDependencySnapshots[resetBlockingCollections.indexOf('acts')];
      const actsToRetire = getActsToRetire(actsSnapshot, assetIdSet);
      const transactionWriteCount = currentAssetsSnapshot.size * 2 + actsToRetire.length * 2 + 2;
      if (transactionWriteCount > 450) {
        throw new HttpsError(
          'failed-precondition',
          'La sede tiene demasiados activos y actas vinculadas para un reinicio atómico. Solicita un procedimiento por lotes.',
        );
      }

      transaction.set(resetRef, {
        siteId,
        siteName: String(currentSiteData.name || ''),
        prefix: currentPrefix,
        status: 'firestore_completed',
        assetCount: currentAssetsSnapshot.size,
        assetIds,
        retiredActCount: actsToRetire.length,
        retiredActIds: actsToRetire.map((actSnapshot) => actSnapshot.id),
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

      actsToRetire.forEach((actSnapshot) => {
        transaction.set(resetRef.collection('actSnapshots').doc(actSnapshot.id), {
          actId: actSnapshot.id,
          snapshot: actSnapshot.data(),
          createdAt: startedAt,
        });
        transaction.update(actSnapshot.ref, {
          isDeleted: true,
          deletedAt: startedAt,
          deletedByUid: request.auth.uid,
          inventoryResetId: resetId,
          updatedAt: startedAt,
          updatedByUid: request.auth.uid,
        });
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

      return { assetIds, assetCount: currentAssetsSnapshot.size, retiredActCount: actsToRetire.length };
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
    retiredActs: resetResult.retiredActCount,
    deletedStorageFiles,
    storageCleanupPending: storageCleanupPendingAssetIds.length > 0,
  };
});

const actRendererCompanies = new Set([
  'aliados',
  'cmi',
  'gestionbienestar',
  'logros',
  'medicuc',
  'redinsalud',
  'rehabilitdemos',
  'saludfamilia',
]);

const getRendererIdentityToken = async (audience) => {
  const metadataUrl = new URL('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity');
  metadataUrl.searchParams.set('audience', audience);
  metadataUrl.searchParams.set('format', 'full');
  const response = await fetch(metadataUrl, {
    headers: { 'Metadata-Flavor': 'Google' },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new HttpsError('unavailable', 'No se pudo autenticar el servicio de impresión.');
  }
  return response.text();
};

const timestampMillis = (value) => {
  if (value && typeof value.toMillis === 'function') return value.toMillis();
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};

exports.generateActPdf = onCall({
  region: 'us-central1',
  timeoutSeconds: 180,
  memory: '512MiB',
  maxInstances: 2,
  serviceAccount: actRendererCallerServiceAccount,
}, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');

  const callerSnapshot = await db.doc(`users/${request.auth.uid}`).get();
  const caller = callerSnapshot.exists ? callerSnapshot.data() || {} : null;
  if (!caller || caller.active === false || !['admin', 'tech'].includes(caller.role)) {
    throw new HttpsError('permission-denied', 'No tienes permiso para imprimir actas.');
  }

  const actId = assertString(request.data?.actId, 'actId');
  const actRef = db.doc(`acts/${actId}`);
  const actSnapshot = await actRef.get();
  if (!actSnapshot.exists || actSnapshot.data()?.isDeleted === true) {
    throw new HttpsError('not-found', 'No se encontró el acta.');
  }
  const act = actSnapshot.data() || {};
  if (!['draft', 'issued'].includes(act.status)) {
    throw new HttpsError('failed-precondition', 'Solo se pueden imprimir actas en borrador o emitidas.');
  }
  const legacyPending = Boolean(
    act.pdfUrl
      && !act.generatedPdf
      && !act.signedPdf
      && !act.signatureMethod
      && !['issued', 'signed_uploaded'].includes(act.legacyClassification),
  );
  if (legacyPending) {
    throw new HttpsError('failed-precondition', 'Un administrador debe clasificar el PDF antiguo antes de imprimir el acta.');
  }
  if (!actRendererCompanies.has(act.companyId)) {
    throw new HttpsError('failed-precondition', 'No hay una plantilla original configurada para esta empresa.');
  }

  const scope = caller.accessScope || 'global';
  const hasSiteAccess = scope === 'global'
    || (scope === 'sites' && Array.isArray(caller.siteIds) && caller.siteIds.includes(act.siteId));
  if (!hasSiteAccess) {
    throw new HttpsError('permission-denied', 'No tienes acceso a la sede de esta acta.');
  }

  const [siteSnapshot, templateSnapshot] = await Promise.all([
    db.doc(`sites/${act.siteId}`).get(),
    db.doc(`actTemplates/${act.companyId}`).get(),
  ]);
  if (!siteSnapshot.exists || siteSnapshot.data()?.isDeleted === true) {
    throw new HttpsError('failed-precondition', 'La sede asociada al acta ya no está disponible.');
  }
  const site = siteSnapshot.data() || {};
  if (site.companyId !== act.companyId) {
    throw new HttpsError('failed-precondition', 'La empresa de la sede no coincide con la del acta.');
  }
  if (!templateSnapshot.exists || templateSnapshot.data()?.active === false) {
    throw new HttpsError('failed-precondition', 'No hay una plantilla activa configurada para esta empresa.');
  }
  const template = templateSnapshot.data() || {};
  const nit = String(act.companyNitSnapshot || template.nit || '').trim();
  if (!nit) {
    throw new HttpsError('failed-precondition', 'La empresa no tiene un NIT configurado para el acta.');
  }

  let rendererBase;
  try {
    const parsedUrl = new URL(actRendererUrl.value().trim());
    if (parsedUrl.protocol !== 'https:'
      || !parsedUrl.hostname.endsWith('.run.app')
      || parsedUrl.pathname !== '/'
      || parsedUrl.search
      || parsedUrl.hash) {
      throw new Error('URL no válida');
    }
    rendererBase = parsedUrl.origin;
  } catch (error) {
    console.error('ACT_RENDERER_URL no es una URL base válida de Cloud Run.');
    throw new HttpsError('failed-precondition', 'El servicio de impresión no está configurado correctamente.');
  }

  const generationTime = timestampMillis(act.issuedAt) || Date.now();
  const issueDate = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(generationTime));
  const renderAct = {
    companyId: act.companyId,
    fixedAssetIdSnapshot: act.fixedAssetIdSnapshot,
    companyNitSnapshot: nit,
    recipient: act.recipient || {},
    assetSnapshot: act.assetSnapshot || {},
    documentDetails: act.documentDetails || {},
    observations: act.observations || '',
  };

  let renderResponse;
  try {
    const identityToken = await getRendererIdentityToken(rendererBase);
    const response = await fetch(`${rendererBase}/render`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${identityToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        act: renderAct,
        template: { companyName: template.companyName || act.companyId, nit },
        delivererName: act.documentDetails?.deliveredByName || caller.name || '',
        issueDate,
      }),
      signal: AbortSignal.timeout(130000),
    });
    const responseBody = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('El renderizador rechazó la generación del PDF:', response.status);
      if (response.status === 400 || response.status === 422) {
        throw new HttpsError('failed-precondition', responseBody.error || 'Los datos del acta no se pudieron colocar en su plantilla.');
      }
      throw new HttpsError('unavailable', 'El servicio de impresión no pudo generar el PDF. Inténtalo de nuevo.');
    }
    renderResponse = responseBody;
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('Error invocando el renderizador privado de actas:', error);
    throw new HttpsError('unavailable', 'No se pudo conectar con el servicio de impresión. Inténtalo de nuevo.');
  }

  if (typeof renderResponse.pdfBase64 !== 'string' || renderResponse.pdfBase64.length > 8 * 1024 * 1024) {
    throw new HttpsError('internal', 'El servicio de impresión devolvió un archivo no válido.');
  }
  const pdfBytes = Buffer.from(renderResponse.pdfBase64, 'base64');
  if (pdfBytes.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new HttpsError('internal', 'El servicio de impresión devolvió un PDF no válido.');
  }

  let issuedAt;
  try {
    issuedAt = await db.runTransaction(async (transaction) => {
      const [currentSnapshot, currentCallerSnapshot, currentSiteSnapshot] = await Promise.all([
        transaction.get(actRef),
        transaction.get(db.doc(`users/${request.auth.uid}`)),
        transaction.get(db.doc(`sites/${act.siteId}`)),
      ]);
      if (!currentSnapshot.exists) throw new HttpsError('not-found', 'El acta ya no existe.');
      const current = currentSnapshot.data() || {};
      const currentCaller = currentCallerSnapshot.exists ? currentCallerSnapshot.data() || {} : null;
      const currentSite = currentSiteSnapshot.exists ? currentSiteSnapshot.data() || {} : null;
      if (!currentCaller || currentCaller.active === false || !['admin', 'tech'].includes(currentCaller.role)) {
        throw new HttpsError('permission-denied', 'Tu usuario ya no tiene permiso para imprimir actas.');
      }
      const currentScope = currentCaller.accessScope || 'global';
      const currentHasSiteAccess = currentScope === 'global'
        || (currentScope === 'sites' && Array.isArray(currentCaller.siteIds) && currentCaller.siteIds.includes(act.siteId));
      if (!currentHasSiteAccess) {
        throw new HttpsError('permission-denied', 'Ya no tienes acceso a la sede de esta acta.');
      }
      if (!currentSite || currentSite.isDeleted === true || currentSite.companyId !== act.companyId) {
        throw new HttpsError('failed-precondition', 'La sede o empresa asociada al acta cambió mientras se generaba el PDF.');
      }
      if (current.isDeleted === true
        || current.status !== act.status
        || !['draft', 'issued'].includes(current.status)
        || current.siteId !== act.siteId
        || current.companyId !== act.companyId
        || current.fixedAssetIdSnapshot !== act.fixedAssetIdSnapshot
        || timestampMillis(current.updatedAt) !== timestampMillis(act.updatedAt)) {
        throw new HttpsError('failed-precondition', 'El estado del acta cambió mientras se preparaba el PDF. Vuelve a abrirla e inténtalo de nuevo.');
      }

      const stableIssueDate = timestampMillis(current.issuedAt) || generationTime;
      if (current.status === 'draft' || !timestampMillis(current.issuedAt)) {
        transaction.update(actRef, {
          status: 'issued',
          issuedAt: stableIssueDate,
          updatedAt: Date.now(),
          updatedByUid: request.auth.uid,
        });
      }
      return stableIssueDate;
    });
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('No se pudo registrar el acta como emitida después de generar el PDF:', error);
    throw new HttpsError('internal', 'Se generó el documento, pero no se pudo actualizar el estado del acta.');
  }

  const expectedName = `acta-${String(act.fixedAssetIdSnapshot || 'acta').replace(/[^a-zA-Z0-9-]/g, '-')}.pdf`;
  return {
    fileName: typeof renderResponse.fileName === 'string' && /^acta-[a-zA-Z0-9-]+\.pdf$/.test(renderResponse.fileName)
      ? renderResponse.fileName
      : expectedName,
    pdfBase64: renderResponse.pdfBase64,
    issuedAt,
  };
});

const assertActWriteSiteAccess = (profile, siteId) => {
  if (!profile || profile.active === false || !['admin', 'tech'].includes(profile.role)) {
    throw new HttpsError('permission-denied', 'No tienes permiso para cargar PDFs de actas.');
  }
  const scope = profile.accessScope || 'global';
  const hasAccess = scope === 'global'
    || (scope === 'sites' && Array.isArray(profile.siteIds) && profile.siteIds.includes(siteId));
  if (!hasAccess) {
    throw new HttpsError('permission-denied', 'No tienes acceso a la sede de esta acta.');
  }
};

const isPendingLegacyAct = (act) => Boolean(
  act.pdfUrl
    && !act.generatedPdf
    && !act.signedPdf
    && !act.signatureMethod
    && !['issued', 'signed_uploaded'].includes(act.legacyClassification),
);

exports.confirmSignedActPdf = onCall({
  region: 'us-central1',
  timeoutSeconds: 60,
  maxInstances: 20,
}, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');

  const actId = assertString(request.data?.actId, 'actId');
  const storagePath = assertString(request.data?.storagePath, 'storagePath');
  const mode = request.data?.mode;
  const replacementReason = typeof request.data?.replacementReason === 'string'
    ? request.data.replacementReason.trim()
    : '';
  const pathParts = storagePath.split('/');
  if (pathParts.length !== 4
    || pathParts[0] !== 'acts'
    || pathParts[1] !== actId
    || pathParts[2] !== 'signed'
    || !pathParts[3]) {
    throw new HttpsError('invalid-argument', 'La ruta del PDF no corresponde a esta acta.');
  }
  if (!['signed', 'replace_signed'].includes(mode)) {
    throw new HttpsError('invalid-argument', 'El tipo de carga del PDF no es válido.');
  }
  if (mode === 'replace_signed' && replacementReason.length < 5) {
    throw new HttpsError('invalid-argument', 'Indica un motivo de al menos 5 caracteres para reemplazar el PDF firmado.');
  }

  const uid = request.auth.uid;
  const actRef = db.doc(`acts/${actId}`);
  const userRef = db.doc(`users/${uid}`);
  const file = storage.bucket().file(storagePath);
  let callerCanAccessAct = false;
  let fileUploadedByCaller = false;
  let actWriteCompleted = false;

  try {
    const [initialActSnapshot, initialUserSnapshot] = await Promise.all([actRef.get(), userRef.get()]);
    if (!initialActSnapshot.exists) throw new HttpsError('not-found', 'No se encontró el acta.');
    const initialAct = initialActSnapshot.data() || {};
    const initialProfile = initialUserSnapshot.exists ? initialUserSnapshot.data() : null;
    assertActWriteSiteAccess(initialProfile, initialAct.siteId);
    callerCanAccessAct = true;
    if (initialAct.isDeleted === true) {
      throw new HttpsError('failed-precondition', 'No se puede cargar un PDF en un acta eliminada.');
    }

    const [fileMetadata] = await file.getMetadata();
    if (fileMetadata.metadata?.uploadedByUid !== uid) {
      throw new HttpsError('permission-denied', 'El PDF no fue cargado por tu usuario. Vuelve a cargarlo e inténtalo de nuevo.');
    }
    fileUploadedByCaller = true;
    const size = Number(fileMetadata.size || 0);
    if (fileMetadata.contentType !== 'application/pdf' || size <= 0 || size >= 10 * 1024 * 1024) {
      throw new HttpsError('invalid-argument', 'El archivo debe ser un PDF válido de menos de 10 MB.');
    }

    const [fileContents] = await file.download();
    if (!fileContents.subarray(0, 1024).toString('latin1').includes('%PDF-')) {
      throw new HttpsError('invalid-argument', 'El archivo cargado no contiene un documento PDF válido.');
    }

    let downloadToken = String(fileMetadata.metadata?.firebaseStorageDownloadTokens || '').split(',')[0].trim();
    if (!downloadToken) {
      downloadToken = randomUUID();
      await file.setMetadata({
        metadata: {
          ...(fileMetadata.metadata || {}),
          firebaseStorageDownloadTokens: downloadToken,
        },
      });
    }
    const pdfFile = {
      url: `https://firebasestorage.googleapis.com/v0/b/${storage.bucket().name}/o/${encodeURIComponent(storagePath)}?alt=media&token=${encodeURIComponent(downloadToken)}`,
      path: storagePath,
      name: String(fileMetadata.metadata?.originalName || pathParts[3]).slice(0, 256),
      contentType: 'application/pdf',
      size,
      createdAt: Date.now(),
      createdByUid: uid,
    };

    await db.runTransaction(async (transaction) => {
      const [currentActSnapshot, currentUserSnapshot] = await Promise.all([
        transaction.get(actRef),
        transaction.get(userRef),
      ]);
      if (!currentActSnapshot.exists) throw new HttpsError('not-found', 'El acta ya no existe.');
      const currentAct = currentActSnapshot.data() || {};
      const currentProfile = currentUserSnapshot.exists ? currentUserSnapshot.data() : null;
      assertActWriteSiteAccess(currentProfile, currentAct.siteId);
      if (currentAct.isDeleted === true) {
        throw new HttpsError('failed-precondition', 'No se puede cargar un PDF en un acta eliminada.');
      }
      if (currentAct.siteId !== initialAct.siteId
        || timestampMillis(currentAct.updatedAt) !== timestampMillis(initialAct.updatedAt)) {
        throw new HttpsError('failed-precondition', 'El acta cambió durante la carga. Vuelve a abrirla e inténtalo de nuevo.');
      }

      let update;
      if (mode === 'signed') {
        if (!['draft', 'issued'].includes(currentAct.status) || currentAct.signedPdf) {
          throw new HttpsError('failed-precondition', 'El acta ya no está disponible para adjuntar un PDF firmado.');
        }
        if (isPendingLegacyAct(currentAct)) {
          throw new HttpsError('failed-precondition', 'Un administrador debe clasificar el acta antigua antes de cargar el PDF firmado.');
        }
        update = {
          signedPdf: pdfFile,
          signatureMethod: 'uploaded_pdf',
          signedAt: Date.now(),
          signedByUid: uid,
          status: 'signed',
          pdfUrl: pdfFile.url,
          pdfPath: pdfFile.path,
          pdfName: pdfFile.name,
          pdfContentType: pdfFile.contentType,
          pdfSize: pdfFile.size,
          updatedAt: Date.now(),
          updatedByUid: uid,
        };
      } else {
        if (currentAct.status !== 'signed' || !currentAct.signedPdf) {
          throw new HttpsError('failed-precondition', 'No se encontró un PDF firmado que pueda reemplazarse.');
        }
        const history = Array.isArray(currentAct.signedPdfHistory) ? currentAct.signedPdfHistory : [];
        update = {
          signedPdf: pdfFile,
          signedPdfHistory: [
            ...history,
            {
              ...currentAct.signedPdf,
              replacedAt: Date.now(),
              replacedByUid: uid,
              replacementReason,
            },
          ].slice(-10),
          signatureMethod: 'uploaded_pdf',
          signedAt: Date.now(),
          status: 'signed',
          pdfUrl: pdfFile.url,
          pdfPath: pdfFile.path,
          pdfName: pdfFile.name,
          pdfContentType: pdfFile.contentType,
          pdfSize: pdfFile.size,
          updatedAt: Date.now(),
          updatedByUid: uid,
        };
      }
      transaction.update(actRef, update);
    });
    actWriteCompleted = true;

    return { signedPdf: pdfFile };
  } catch (error) {
    if (callerCanAccessAct && fileUploadedByCaller && !actWriteCompleted) {
      try {
        const latestActSnapshot = await actRef.get();
        if (latestActSnapshot.data()?.signedPdf?.path === storagePath) {
          return { signedPdf: latestActSnapshot.data().signedPdf };
        }
        await file.delete().catch(() => undefined);
      } catch (cleanupError) {
        console.warn('No se pudo confirmar o limpiar el PDF firmado:', actId, cleanupError);
      }
    }
    if (error instanceof HttpsError) throw error;
    console.error('Error al registrar el PDF firmado del acta:', actId, error);
    throw new HttpsError('internal', 'No se pudo guardar el PDF firmado del acta.');
  }
});

const assertInvoicePaymentSiteAccess = (profile, siteId) => {
  if (!profile || profile.active === false || !['admin', 'tech'].includes(profile.role)) {
    throw new HttpsError('permission-denied', 'No tienes permiso para registrar pagos de facturas.');
  }

  const scope = profile.accessScope || 'global';
  const hasAccess = scope === 'global'
    || (scope === 'sites' && Array.isArray(profile.siteIds) && profile.siteIds.includes(siteId));
  if (!hasAccess) {
    throw new HttpsError('permission-denied', 'No tienes acceso a la sede asociada a esta factura.');
  }
};

const getInvoicePaymentReceipts = (invoice) => {
  const receipts = Array.isArray(invoice.paymentReceipts) ? invoice.paymentReceipts : [];
  const result = [];
  for (const receipt of [...receipts, invoice.paymentReceipt]) {
    if (typeof receipt?.path === 'string' && receipt.path
      && !result.some((item) => item.path === receipt.path)) result.push(receipt);
  }
  return result;
};

exports.confirmInvoicePaymentReceipt = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
  }
  if (request.data?.action === 'capabilities') {
    return { supportsMultipleReceipts: true };
  }

  const invoiceId = assertString(request.data?.invoiceId, 'invoiceId');
  const storagePath = assertString(request.data?.storagePath, 'storagePath');
  const action = request.data?.action;
  const replacePath = request.data?.replacePath == null ? '' : assertString(request.data.replacePath, 'replacePath');
  if ((action != null && !['add', 'replace'].includes(action))
    || (action === 'replace' && !replacePath)
    || (action === 'add' && replacePath)) {
    throw new HttpsError('invalid-argument', 'La operación sobre el soporte no es válida.');
  }
  const pathParts = storagePath.split('/');
  if (pathParts.length !== 4
    || pathParts[0] !== 'invoices'
    || pathParts[1] !== invoiceId
    || pathParts[2] !== 'payment-receipts'
    || !pathParts[3]) {
    throw new HttpsError('invalid-argument', 'La ruta del comprobante no corresponde a esta factura.');
  }

  const uid = request.auth.uid;
  const userRef = db.doc(`users/${uid}`);
  const invoiceRef = db.doc(`invoices/${invoiceId}`);
  const bucket = storage.bucket();
  const file = bucket.file(storagePath);
  let callerCanAccessInvoice = false;
  let fileUploadedByCaller = false;
  let invoiceWriteCompleted = false;
  let replacedStoragePath = '';

  try {
    const [initialInvoiceSnapshot, initialUserSnapshot] = await Promise.all([
      invoiceRef.get(),
      userRef.get(),
    ]);
    if (!initialInvoiceSnapshot.exists) {
      throw new HttpsError('not-found', 'La factura ya no existe.');
    }
    const initialInvoice = initialInvoiceSnapshot.data() || {};
    const initialProfile = initialUserSnapshot.exists ? initialUserSnapshot.data() : null;
    assertInvoicePaymentSiteAccess(initialProfile, initialInvoice.siteId);
    callerCanAccessInvoice = true;
    if (initialInvoice.isDeleted === true) {
      throw new HttpsError('failed-precondition', 'No se puede registrar un pago para una factura eliminada.');
    }

    const [fileMetadata] = await file.getMetadata();
    if (fileMetadata.metadata?.uploadedByUid !== uid) {
      throw new HttpsError('permission-denied', 'El comprobante no fue cargado por tu usuario. Vuelve a cargarlo e inténtalo de nuevo.');
    }
    fileUploadedByCaller = true;
    const size = Number(fileMetadata.size || 0);
    if (fileMetadata.contentType !== 'application/pdf' || size <= 0 || size >= 10 * 1024 * 1024) {
      throw new HttpsError('invalid-argument', 'El soporte debe ser un PDF válido de menos de 10 MB.');
    }

    const [fileContents] = await file.download();
    if (!fileContents.subarray(0, 1024).toString('latin1').includes('%PDF-')) {
      throw new HttpsError('invalid-argument', 'El archivo cargado no contiene un documento PDF válido.');
    }

    let downloadToken = String(fileMetadata.metadata?.firebaseStorageDownloadTokens || '').split(',')[0].trim();
    if (!downloadToken) {
      downloadToken = randomUUID();
      await file.setMetadata({
        metadata: {
          ...(fileMetadata.metadata || {}),
          firebaseStorageDownloadTokens: downloadToken,
        },
      });
    }

    const paymentReceipt = {
      url: `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media&token=${encodeURIComponent(downloadToken)}`,
      path: storagePath,
      name: String(fileMetadata.metadata?.originalName || pathParts[3]).slice(0, 256),
      contentType: 'application/pdf',
      size,
      uploadedAt: Date.now(),
      uploadedByUid: uid,
    };

    const confirmedReceipts = await db.runTransaction(async (transaction) => {
      replacedStoragePath = '';
      const [currentInvoiceSnapshot, currentUserSnapshot] = await Promise.all([
        transaction.get(invoiceRef),
        transaction.get(userRef),
      ]);
      if (!currentInvoiceSnapshot.exists) {
        throw new HttpsError('not-found', 'La factura ya no existe.');
      }

      const currentInvoice = currentInvoiceSnapshot.data() || {};
      const currentProfile = currentUserSnapshot.exists ? currentUserSnapshot.data() : null;
      assertInvoicePaymentSiteAccess(currentProfile, currentInvoice.siteId);
      if (currentInvoice.isDeleted === true) {
        throw new HttpsError('failed-precondition', 'No se puede registrar un pago para una factura eliminada.');
      }

      const receipts = getInvoicePaymentReceipts(currentInvoice);
      const existingReceipt = receipts.find((receipt) => receipt.path === storagePath);
      if (existingReceipt) return receipts;

      // Los clientes anteriores no envían action y esperan reemplazar el soporte principal.
      const targetPath = replacePath || (action == null ? receipts[0]?.path : '');
      if (targetPath) {
        const replaceIndex = receipts.findIndex((receipt) => receipt.path === targetPath);
        if (replaceIndex < 0) {
          throw new HttpsError('failed-precondition', 'El soporte que deseas reemplazar ya cambió. Actualiza la página e inténtalo de nuevo.');
        }
        receipts[replaceIndex] = paymentReceipt;
        replacedStoragePath = targetPath;
      } else {
        receipts.push(paymentReceipt);
      }
      transaction.update(invoiceRef, {
        paymentReceipt: receipts[0],
        paymentReceipts: receipts,
        status: 'paid',
        updatedAt: Date.now(),
        updatedByUid: uid,
      });
      return receipts;
    });
    invoiceWriteCompleted = true;

    if (replacedStoragePath && replacedStoragePath !== storagePath
      && replacedStoragePath.startsWith(`invoices/${invoiceId}/payment-receipts/`)) {
      await bucket.file(replacedStoragePath).delete().catch((error) => {
        console.warn('No se pudo limpiar el comprobante reemplazado:', invoiceId, error);
      });
    }

    return { paymentReceipt: confirmedReceipts[0], paymentReceipts: confirmedReceipts };
  } catch (error) {
    if (callerCanAccessInvoice && fileUploadedByCaller && !invoiceWriteCompleted) {
      try {
        // Una respuesta de commit puede perderse aunque Firestore haya aplicado
        // la transacción. No borres un archivo que ya quedó enlazado a la factura.
        const latestInvoiceSnapshot = await invoiceRef.get();
        const latestReceipts = getInvoicePaymentReceipts(latestInvoiceSnapshot.data() || {});
        if (latestReceipts.some((receipt) => receipt.path === storagePath)) {
          return { paymentReceipt: latestReceipts[0], paymentReceipts: latestReceipts };
        }
        await file.delete().catch(() => undefined);
      } catch (cleanupError) {
        // Ante una lectura ambigua es más seguro conservar el PDF que borrar
        // un comprobante que quizá ya quedó registrado.
        console.warn('No se pudo confirmar o limpiar el soporte de pago:', invoiceId, cleanupError);
      }
    }
    if (error instanceof HttpsError) throw error;
    console.error('Error al verificar el soporte de pago de factura:', invoiceId, error);
    throw new HttpsError('internal', 'No se pudo verificar y registrar el soporte de pago.');
  }
});
