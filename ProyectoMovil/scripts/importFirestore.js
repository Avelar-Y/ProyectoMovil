#!/usr/bin/env node
/**
 * Script de importación Firestore (versión JavaScript).
 * Uso:
 *  node scripts/importFirestore.js --file data/seed-services.json --serviceAccount serviceAccount.json --merge
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.replace(/^--/, '');
      const next = args[i + 1];
      if (!next || next.startsWith('--')) {
        out[key] = true; // flag booleana
      } else {
        out[key] = next;
        i++;
      }
    }
  }
  return out;
}

function log(msg) { console.log(`[import] ${msg}`); }
function error(msg) { console.error(`[import:error] ${msg}`); }

(async () => {
  try {
    const opts = parseArgs();
    if (!opts.file) throw new Error('Falta --file');
    if (!opts.serviceAccount) throw new Error('Falta --serviceAccount');

    const filePath = path.resolve(process.cwd(), opts.file);
    const saPath = path.resolve(process.cwd(), opts.serviceAccount);
    if (!fs.existsSync(filePath)) throw new Error('Archivo JSON no encontrado: ' + filePath);
    if (!fs.existsExists && !fs.existsSync(saPath)) throw new Error('Service account JSON no encontrado: ' + saPath);

    const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf8'));
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: opts.project || serviceAccount.project_id,
      });
    }

    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('JSON raíz inválido');

    const collections = opts.collection ? { [opts.collection]: raw[opts.collection] } : raw;
    const names = Object.keys(collections);
    log(`Colecciones a procesar: ${names.length}`);

    const db = admin.firestore();

    for (const collectionName of names) {
      const docs = collections[collectionName];
      if (!docs || typeof docs !== 'object') { log(`Colección ${collectionName} vacía o inválida`); continue; }
      const entries = Object.entries(docs);
      log(`-> ${collectionName}: ${entries.length} documentos`);
      let idx = 0;
      for (const [docId, data] of entries) {
        idx++;
        if (!data || typeof data !== 'object') { error(`Documento ${docId} inválido`); continue; }
        const sanitized = JSON.parse(JSON.stringify(data));
        try {
          if (opts.merge) {
            await db.collection(collectionName).doc(docId).set(sanitized, { merge: true });
          } else {
            await db.collection(collectionName).doc(docId).set(sanitized);
          }
          log(`   (${idx}/${entries.length}) OK ${collectionName}/${docId}`);
        } catch (e) {
          error(`   (${idx}/${entries.length}) FAIL ${collectionName}/${docId}: ${e.message}`);
        }
      }
    }

    log('Importación terminada');
    process.exit(0);
  } catch (e) {
    error(e.message);
    process.exit(1);
  }
})();
