/*
 * Script de importación personalizada para Firestore.
 * Uso:
 *   node -r ts-node/register scripts/importFirestore.ts --file data/seed.json --project <projectId> --serviceAccount path/a/serviceAccountKey.json [--merge] [--collection users]
 *
 * El JSON debe tener el formato:
 * {
 *   "users": {
 *     "uid1": { "displayName": "Test" },
 *     "uid2": { "displayName": "Otro" }
 *   },
 *   "services": {
 *     "svc1": { "title": "Servicio 1" }
 *   }
 * }
 */

import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import * as admin from 'firebase-admin';

interface ImportOptions {
  file: string;
  project?: string;
  serviceAccount: string;
  merge?: boolean;
  collection?: string; // si se usa, solo importa esa colección
}

const program = new Command();
program
  .requiredOption('--file <file>', 'Ruta al archivo JSON con los datos')
  .requiredOption('--serviceAccount <path>', 'Ruta al archivo de credenciales service account')
  .option('--project <id>', 'ID del proyecto (si no está en la key)')
  .option('--merge', 'Hacer merge en lugar de sobrescribir documento', false)
  .option('--collection <name>', 'Importar solo una colección del JSON')
  .parse(process.argv);

const opts = program.opts<ImportOptions>();

function log(msg: string) { console.log(`[import] ${msg}`); }
function error(msg: string) { console.error(`[import:error] ${msg}`); }

async function main() {
  const filePath = path.resolve(process.cwd(), opts.file);
  const saPath = path.resolve(process.cwd(), opts.serviceAccount);
  if (!fs.existsSync(filePath)) throw new Error('Archivo JSON no encontrado: ' + filePath);
  if (!fs.existsSync(saPath)) throw new Error('Service account JSON no encontrado: ' + saPath);

  const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf8'));

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as any),
      projectId: opts.project || serviceAccount.project_id,
    });
  }

  const db = admin.firestore();
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, any>;
  if (!raw || typeof raw !== 'object') throw new Error('JSON raíz inválido');

  const collections = opts.collection ? { [opts.collection]: raw[opts.collection] } : raw;
  const totalCollections = Object.keys(collections).length;
  log(`Colecciones a procesar: ${totalCollections}`);

  for (const [collectionName, docs] of Object.entries(collections)) {
    if (!docs) { log(`Colección ${collectionName} vacía, saltando`); continue; }
    if (typeof docs !== 'object') { error(`Colección ${collectionName} mal formada`); continue; }
    const entries = Object.entries(docs);
    log(`-> ${collectionName}: ${entries.length} documentos`);

    let idx = 0;
    for (const [docId, data] of entries) {
      idx++;
      if (!data || typeof data !== 'object') { error(`Documento ${docId} inválido`); continue; }
      // Sanitizar undefined
      const sanitized = JSON.parse(JSON.stringify(data));
      try {
        if (opts.merge) {
          await db.collection(collectionName).doc(docId).set(sanitized, { merge: true });
        } else {
          await db.collection(collectionName).doc(docId).set(sanitized);
        }
        log(`   (${idx}/${entries.length}) OK ${collectionName}/${docId}`);
      } catch (e: any) {
        error(`   (${idx}/${entries.length}) FALLÓ ${collectionName}/${docId}: ${e.message}`);
      }
    }
  }
  log('Importación terminada');
}

main().catch(e => { error(e.message); process.exit(1); });
