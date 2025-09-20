/*
 * Seed / Upsert idempotente de servicios desde data/seed-services.json
 * Uso:
 *   npx ts-node scripts/seedServices.ts --serviceAccount serviceAccount.json [--file data/seed-services.json] [--collection services]
 * O (si se añade script npm):
 *   npm run seed:services
 *
 * Estrategia idempotente:
 *  - Para cada servicio del JSON: si existe el documento, preserva createdAt existente.
 *  - Actualiza/establece todos los demás campos y marca updatedAt = serverTimestamp.
 *  - Si no existe, crea createdAt y updatedAt ambos con serverTimestamp.
 *  - Compara un hash (sha1) del payload normalizado para evitar escrituras innecesarias (--skipUnchanged).
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Command } from 'commander';
import * as admin from 'firebase-admin';

interface SeedFileShape { services: Record<string, any>; }

const program = new Command();
program
  .option('--file <file>', 'Ruta al JSON seed', 'data/seed-services.json')
  .requiredOption('--serviceAccount <path>', 'Ruta al serviceAccount JSON')
  .option('--project <id>', 'ID de proyecto (override)')
  .option('--collection <name>', 'Nombre de colección destino', 'services')
  .option('--skipUnchanged', 'No escribir documentos cuyo hash no cambió', false)
  .parse(process.argv);

const opts = program.opts<{
  file: string; serviceAccount: string; project?: string; collection: string; skipUnchanged: boolean;
}>();

function log(msg: string){ console.log(`[seed] ${msg}`); }
function warn(msg: string){ console.warn(`[seed:warn] ${msg}`); }
function err(msg: string){ console.error(`[seed:error] ${msg}`); }

function stableStringify(obj: any){
  return JSON.stringify(sortObj(obj));
}
function sortObj(v: any): any {
  if (Array.isArray(v)) return v.map(sortObj);
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    return Object.keys(v).sort().reduce((acc,k)=>{ acc[k] = sortObj(v[k]); return acc; },{} as any);
  }
  return v;
}

async function main(){
  const filePath = path.resolve(process.cwd(), opts.file);
  const saPath = path.resolve(process.cwd(), opts.serviceAccount);
  if(!fs.existsSync(filePath)) throw new Error('No existe seed file: '+filePath);
  if(!fs.existsSync(saPath)) throw new Error('No existe service account: '+saPath);

  const sa = JSON.parse(fs.readFileSync(saPath,'utf8'));
  if(!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa as any), projectId: opts.project || sa.project_id });
  }
  const db = admin.firestore();

  const raw = JSON.parse(fs.readFileSync(filePath,'utf8')) as SeedFileShape;
  if(!raw.services || typeof raw.services !== 'object') throw new Error('JSON inválido: falta services');

  const colName = opts.collection;
  const entries = Object.entries(raw.services);
  log(`Procesando ${entries.length} servicios hacia colección '${colName}'`);

  let writes = 0, skips = 0, created = 0, updated = 0;
  for(const [id, data] of entries){
    if(!data || typeof data !== 'object'){ warn(`Servicio ${id} inválido, skip`); continue; }

    // Remover campos que serán gestionados automáticamente
    const { createdAt: _cA, updatedAt: _uA, ...rest } = data;
    const payload = { ...rest }; // lo que escribiremos

    const docRef = db.collection(colName).doc(id);
    const snap = await docRef.get();

    let writeNeeded = true;
    if (snap.exists && opts.skipUnchanged){
      const existing = snap.data() || {};
      const existingComparable = { ...existing };
      delete (existingComparable as any).createdAt;
      delete (existingComparable as any).updatedAt;
      const oldHash = crypto.createHash('sha1').update(stableStringify(existingComparable)).digest('hex');
      const newHash = crypto.createHash('sha1').update(stableStringify(payload)).digest('hex');
      if(oldHash === newHash){
        writeNeeded = false; skips++; log(`= ${id} sin cambios (hash ${newHash})`);
      }
    }

    if(!writeNeeded) continue;

    if(!snap.exists){
      await docRef.set({ ...payload, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      created++; writes++; log(`+ creado ${id}`);
    } else {
      await docRef.set({ ...payload, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      updated++; writes++; log(`~ actualizado ${id}`);
    }
  }
  log(`Resumen: writes=${writes} created=${created} updated=${updated} skips=${skips}`);
}

main().catch(e=>{ err(e.message); process.exit(1); });
