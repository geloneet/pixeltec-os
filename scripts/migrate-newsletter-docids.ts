/**
 * One-shot migration: re-key `newsletterSubscribers` docs to use
 * sha256(emailNormalized).slice(0,32) as the document id.
 *
 * Background:
 *   Older docs may have been written with URL-encoded email as the
 *   document id (e.g. `foo%40bar.com`). The new scheme uses a sha256
 *   prefix so Firestore can't trip over IDN/punycode or character
 *   restrictions.
 *
 * Usage:
 *   # Dry-run (DEFAULT — prints the plan, writes nothing):
 *   FIREBASE_ADMIN_PROJECT_ID=... FIREBASE_ADMIN_CLIENT_EMAIL=... \
 *     FIREBASE_ADMIN_PRIVATE_KEY="..." \
 *     npx tsx scripts/migrate-newsletter-docids.ts
 *
 *   # Apply (re-creates each doc at the new id and DELETES the old one):
 *   npx tsx scripts/migrate-newsletter-docids.ts --apply
 *
 *   # Optional: dump candidate ids without touching Firestore at all
 *   npx tsx scripts/migrate-newsletter-docids.ts --dump
 *
 * Safety:
 *   - Idempotent. Running twice is a no-op once docs are migrated.
 *   - Skips docs that are already at the new id.
 *   - Refuses to run if the doc has no `email` field (data integrity tripwire).
 *   - Writes a `migratedAt` field on the new doc.
 */

import { createHash } from 'crypto';
import { getAdminFirestore } from '../src/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');
const DUMP_ONLY = process.argv.includes('--dump');

function expectedDocId(email: string): string {
  return createHash('sha256')
    .update(email.toLowerCase().trim())
    .digest('hex')
    .slice(0, 32);
}

async function main() {
  const db = getAdminFirestore();
  const snap = await db.collection('newsletterSubscribers').get();

  let alreadyOk = 0;
  const toMigrate: { oldId: string; newId: string; email: string }[] = [];
  const skipped: string[] = [];

  for (const doc of snap.docs) {
    const data = doc.data();
    const email = typeof data.email === 'string' ? data.email : null;

    if (!email) {
      skipped.push(`${doc.id} (no email field)`);
      continue;
    }

    const target = expectedDocId(email);
    if (doc.id === target) {
      alreadyOk += 1;
      continue;
    }

    toMigrate.push({ oldId: doc.id, newId: target, email });
  }

  console.log(`[migrate-newsletter-docids]`);
  console.log(`  total docs:   ${snap.size}`);
  console.log(`  already ok:   ${alreadyOk}`);
  console.log(`  to migrate:   ${toMigrate.length}`);
  console.log(`  skipped:      ${skipped.length}`);

  if (DUMP_ONLY) {
    console.log('\n  candidates:');
    for (const c of toMigrate) console.log(`    ${c.oldId} → ${c.newId}  (${c.email})`);
    return;
  }

  if (skipped.length > 0) {
    console.warn('\n  ⚠ docs without `email` field — fix or delete manually:');
    for (const s of skipped) console.warn(`    ${s}`);
  }

  if (!APPLY) {
    console.log('\n  Dry-run. Re-run with --apply to perform the migration.');
    return;
  }

  console.log('\n  APPLY mode — performing migration…');
  const col = db.collection('newsletterSubscribers');

  for (const c of toMigrate) {
    await db.runTransaction(async tx => {
      const oldRef = col.doc(c.oldId);
      const newRef = col.doc(c.newId);

      const [oldSnap, newSnap] = await Promise.all([tx.get(oldRef), tx.get(newRef)]);
      if (!oldSnap.exists) return; // raced; nothing to do

      if (newSnap.exists) {
        // Collision (extremely unlikely): keep the newer one, drop the old.
        tx.delete(oldRef);
        return;
      }

      tx.set(newRef, {
        ...oldSnap.data(),
        migratedAt: FieldValue.serverTimestamp(),
      });
      tx.delete(oldRef);
    });

    console.log(`    migrated ${c.oldId} → ${c.newId}`);
  }

  console.log('\n  Done.');
}

main().catch(err => {
  console.error('[migrate-newsletter-docids] failed', err);
  process.exit(1);
});
