/**
 * Seed inicial — Fase 0+1 de la migración a Postgres+Drizzle+NextAuth.
 * Patrón idéntico a `dalk/scripts/seed.ts`: crea el primer usuario admin
 * desde SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD, idempotente.
 *
 * Uso: npm run seed  (o `docker compose --profile tools run --rm seed`)
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { users } from "../src/lib/db/schema";

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  // Bridge de identidad (Fase 2): mientras los datos sigan en Firestore
  // (Fase 3 no ha corrido), la sesión de NextAuth debe seguir resolviendo
  // al MISMO uid que usan hoy las queries de Firestore/crm_data. Se guarda
  // el Firebase UID del admin para que los guards de servidor lo devuelvan
  // como "uid" en vez del id de Postgres.
  const firebaseUid = process.env.ADMIN_UIDS?.split(",")[0]?.trim();

  if (!adminEmail || !adminPassword) {
    throw new Error("SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD deben estar configurados");
  }

  const existingAdmin = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, adminEmail))
    .limit(1);

  if (existingAdmin.length > 0) {
    if (firebaseUid) {
      await db.update(users).set({ firebaseUid }).where(eq(users.email, adminEmail));
      console.log(`✓ Admin ${adminEmail} ya existe — firebaseUid actualizado`);
    } else {
      console.log(`✓ Admin ${adminEmail} ya existe — omitiendo`);
    }
  } else {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await db.insert(users).values({
      email: adminEmail,
      passwordHash,
      name: "Administrador",
      role: "admin",
      firebaseUid,
    });
    console.log(`✓ Admin ${adminEmail} creado${firebaseUid ? " con firebaseUid bridge" : ""}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error en seed:", err);
  process.exit(1);
});
