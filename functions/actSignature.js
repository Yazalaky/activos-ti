'use strict';

const { createHash } = require('crypto');

const normalizeName = (value) => typeof value === 'string'
  ? value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es-CO') : '';

const validCreatorUid = (uid) => typeof uid === 'string' && uid.length > 0 && uid.length <= 128
  && !uid.includes('/') && uid !== '.' && uid !== '..';

const creatorCanSign = (act, creator) => {
  const uid = act?.createdByUid;
  const name = normalizeName(act?.documentDetails?.deliveredByName);
  return validCreatorUid(uid)
    && creator && creator.active !== false && ['admin', 'tech'].includes(creator.role)
    && Boolean(name) && name === normalizeName(creator.name);
};

const signatureBytes = (signature, ownerUid) => {
  if (!signature || signature.authorized !== true || signature.contentType !== 'image/png'
      || typeof ownerUid !== 'string' || signature.updatedByUid !== ownerUid) return null;
  const bytes = signature.image;
  if (!Buffer.isBuffer(bytes) && !(bytes instanceof Uint8Array)) return null;
  const image = Buffer.from(bytes);
  if (image.length < 33 || image.length > 250000
      || !image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      || image.subarray(12, 16).toString('ascii') !== 'IHDR') return null;
  const width = image.readUInt32BE(16);
  const height = image.readUInt32BE(20);
  return width > 0 && width <= 1200 && height > 0 && height <= 500 ? image : null;
};

const signatureDigest = (bytes) => createHash('sha256').update(bytes).digest('hex');

module.exports = { creatorCanSign, signatureBytes, signatureDigest, validCreatorUid };
