/* JS build of seedServices (sin TypeScript) para ejecución directa con node.
 * Uso:
 *   node scripts/seedServices.js --serviceAccount serviceAccount.json [--file data/seed-services.json] [--collection services] [--skipUnchanged]
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Command } = require('commander');
const admin = require('firebase-admin');

const program = new Command();
program
  .option('--file <file>', 'Ruta al JSON seed', 'data/seed-services.json')
  .requiredOption('--serviceAccount <path>', 'Ruta al serviceAccount JSON')
  .option('--project <id>', 'ID de proyecto (override)')
  .option('--collection <name>', 'Nombre de colección destino', 'services')
  .option('--skipUnchanged', 'No escribir docs sin cambios', false)
  .parse(process.argv);

const opts = program.opts();
function log(m){ console.log(`[seed] ${m}`);} 
function warn(m){ console.warn(`[seed:warn] ${m}`);} 
function err(m){ console.error(`[seed:error] ${m}`);} 

function stableStringify(obj){ return JSON.stringify(sortObj(obj)); }
function sortObj(v){
  if(Array.isArray(v)) return v.map(sortObj);
  if(v && typeof v === 'object' && !(v instanceof Date)){
    return Object.keys(v).sort().reduce((acc,k)=>{ acc[k]=sortObj(v[k]); return acc; },{});
  }
  return v;
}

(async function main(){
  const filePath = path.resolve(process.cwd(), opts.file);
  const saPath = path.resolve(process.cwd(), opts.serviceAccount);
  if(!fs.existsSync(filePath)) throw new Error('No existe seed file: '+filePath);
  if(!fs.existsSync(saPath)) throw new Error('No existe service account: '+saPath);

  const sa = JSON.parse(fs.readFileSync(saPath,'utf8'));
  if(!admin.apps.length){
    admin.initializeApp({ credential: admin.credential.cert(sa), projectId: opts.project || sa.project_id });
  }
  const db = admin.firestore();

  const raw = JSON.parse(fs.readFileSync(filePath,'utf8'));
  if(!raw.services || typeof raw.services !== 'object') throw new Error('JSON inválido: falta services');

  const entries = Object.entries(raw.services);
  log(`Procesando ${entries.length} servicios -> '${opts.collection}'`);
  let writes=0, created=0, updated=0, skips=0;
  for(const [id, data] of entries){
    if(!data || typeof data !== 'object'){ warn(`Servicio ${id} inválido`); continue; }
    const { createdAt:_cA, updatedAt:_uA, ...rest } = data;
    const payload = { ...rest };
    const docRef = db.collection(opts.collection).doc(id);
    const snap = await docRef.get();
    let writeNeeded = true;
    if(snap.exists && opts.skipUnchanged){
      const existing = snap.data() || {};
      const comp = { ...existing }; delete comp.createdAt; delete comp.updatedAt;
      const oldHash = crypto.createHash('sha1').update(stableStringify(comp)).digest('hex');
      const newHash = crypto.createHash('sha1').update(stableStringify(payload)).digest('hex');
      if(oldHash === newHash){ writeNeeded = false; skips++; log(`= ${id} sin cambios (${newHash})`); }
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
})().catch(e=>{ err(e.message); process.exit(1); });
