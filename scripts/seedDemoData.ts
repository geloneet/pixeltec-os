/**
 * @fileoverview PixelTEC OS — CLI Demo Data Seeder
 *
 * Usage:
 *   npx tsx scripts/seedDemoData.ts           # prompts if data exists
 *   npx tsx scripts/seedDemoData.ts --force   # clears existing data without prompting
 *
 * Reads Firebase config from .env.local (or .env as fallback).
 */

import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';
import * as readline from 'readline';

// Load .env.local first (Next.js convention), fall back to .env
dotenvConfig({ path: resolve(process.cwd(), '.env.local') });
dotenvConfig({ path: resolve(process.cwd(), '.env') });

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { seedDemoData } from '../src/lib/seed/demo-data';

// ── Firebase config ────────────────────────────────────────────────────────────

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const missing = Object.entries(firebaseConfig)
  .filter(([, v]) => !v)
  .map(([k]) => k);

if (missing.length > 0) {
  console.error('\n❌  Faltan variables de entorno:\n');
  missing.forEach((k) => console.error(`   - ${k}`));
  console.error('\n   Asegúrate de tener un archivo .env.local en la raíz del proyecto.\n');
  process.exit(1);
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function ask(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 's');
    });
  });
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const forceFlag = process.argv.includes('--force');

  console.log('\n🌱  PixelTEC OS — Demo Data Seeder');
  console.log('─'.repeat(44));
  console.log(`   Proyecto: ${firebaseConfig.projectId}`);
  console.log('─'.repeat(44));

  const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
  const db = getFirestore(app);

  // First attempt (no force) to detect whether data already exists
  let force = forceFlag;

  if (!force) {
    const probe = await seedDemoData(db, undefined, { force: false });
    if (!probe.success && probe.message.includes('ya tiene datos')) {
      console.log('\n⚠️   La base de datos ya contiene registros.');
      const overwrite = await ask('   ¿Deseas borrar todo e insertar datos de demostración? [s/N]: ');
      if (!overwrite) {
        console.log('\n   Operación cancelada.\n');
        process.exit(0);
      }
      force = true;
    } else if (probe.success) {
      // Data was already inserted on the probe run (empty db case)
      printResult(probe.counts);
      process.exit(0);
    } else {
      // Some other error
      console.warn(`\n⚠️   ${probe.message}\n`);
      process.exit(1);
    }
  }

  // Run with force=true (either via --force flag or user confirmed)
  if (forceFlag) console.log('   Modo: --force — limpiando datos existentes...\n');

  let lastStep = '';

  const result = await seedDemoData(db, ({ step, done, total }) => {
    if (step !== lastStep) {
      if (lastStep) process.stdout.write(' ✓\n');
      process.stdout.write(`   ${step}`);
      lastStep = step;
    }
    if (done === total && total > 0) {
      process.stdout.write(` [${total}/${total}]`);
    }
  }, { force: true });

  if (lastStep) process.stdout.write(' ✓\n');
  console.log('─'.repeat(44));

  if (result.success) {
    printResult(result.counts);
  } else {
    console.warn(`\n⚠️   ${result.message}\n`);
    process.exit(1);
  }

  process.exit(0);
}

function printResult(counts: Record<string, number>) {
  console.log('\n✅  Seeding completado!\n');
  console.log('   Registros insertados:');
  console.log(`     • Clientes:           ${counts.clients ?? 0}`);
  console.log(`     • Tareas globales:    ${counts.globalTasks ?? 0}`);
  console.log(`     • Leads (pipeline):   ${counts.leads ?? 0}`);
  console.log(`     • Transacciones:      ${counts.finances ?? 0}`);
  console.log(`     • Tickets de soporte: ${counts.tickets ?? 0}`);
  console.log(`     • Actividad:          ${counts.activity ?? 0}`);
  console.log('');
}

main().catch((err) => {
  console.error('\n❌  Error inesperado:', err);
  process.exit(1);
});
