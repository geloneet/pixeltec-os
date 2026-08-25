import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";

/**
 * Sistema → Usuarios y acceso (C-PR5). Cobertura obligatoria:
 * - Guardas anti-lockout: prohibido degradarse/auto-suspenderse; prohibido
 *   dejar el sistema con 0 admins activos.
 * - Invitación: el token crudo solo viaja en el enlace del correo; a la base
 *   llega su sha256 con TTL de 7 días; reenviar quema los tokens previos.
 * - Suspender revoca sesiones e invalida invitaciones/resets pendientes.
 */

const mocks = vi.hoisted(() => {
  const state = {
    selectQueue: [] as unknown[][],
    updates: [] as Array<{ table: unknown; values: Record<string, unknown> }>,
    updateReturningQueue: [] as unknown[][],
    txInserts: [] as Array<{ table: unknown; values: Record<string, unknown> }>,
    txUpdates: [] as Array<{ table: unknown; values: Record<string, unknown> }>,
    txDeletes: [] as unknown[],
  };

  function chain(rows: unknown[]): Record<string, unknown> {
    const p = Promise.resolve(rows) as Promise<unknown[]> & Record<string, unknown>;
    p.from = () => chain(rows);
    p.where = () => chain(rows);
    p.orderBy = () => chain(rows);
    p.innerJoin = () => chain(rows);
    p.limit = () => Promise.resolve(rows);
    return p;
  }

  const db = {
    select: vi.fn(() => chain(state.selectQueue.shift() ?? [])),
    update: vi.fn((table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: () => {
          state.updates.push({ table, values });
          const rows = state.updateReturningQueue.shift() ?? [];
          return Object.assign(Promise.resolve(undefined), {
            returning: () => Promise.resolve(rows),
          });
        },
      }),
    })),
    transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        insert: (table: unknown) => ({
          values: (values: Record<string, unknown>) => {
            state.txInserts.push({ table, values });
            return Object.assign(Promise.resolve(undefined), {
              returning: () => Promise.resolve([{ id: "new-user-id" }]),
            });
          },
        }),
        update: (table: unknown) => ({
          set: (values: Record<string, unknown>) => ({
            where: () => {
              state.txUpdates.push({ table, values });
              return Promise.resolve(undefined);
            },
          }),
        }),
        delete: (table: unknown) => ({
          where: () => {
            state.txDeletes.push(table);
            return Promise.resolve(undefined);
          },
        }),
      };
      return fn(tx);
    }),
  };

  return {
    state,
    db,
    requireAdmin: vi.fn(),
    revokeCredentialsFor: vi.fn(),
    recordSecurityEvent: vi.fn(),
    sendUserInvitationEmail: vi.fn(),
    logSystemAlert: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/auth-guards", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/auth/authority", () => ({ revokeCredentialsFor: mocks.revokeCredentialsFor }));
vi.mock("@/lib/security/events", () => ({
  recordSecurityEvent: mocks.recordSecurityEvent,
}));
vi.mock("@/lib/email", () => ({
  sendUserInvitationEmail: mocks.sendUserInvitationEmail,
}));
vi.mock("@/lib/system-alerts", () => ({ logSystemAlert: mocks.logSystemAlert }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-real-ip": "203.0.113.7", "user-agent": "vitest" }),
}));

const {
  inviteUserAction,
  resendInvitationAction,
  setUserRoleAction,
  suspendUserAction,
  reactivateUserAction,
  revokeUserSessionsAction,
} = await import("./actions");
const { hashInvitationToken, INVITATION_TTL_MS } = await import("./tokens");
const schema = await import("@/lib/db/schema");

const ADMIN_UID = "aaaaaaaa-0000-4000-8000-000000000001";
const TARGET_UID = "bbbbbbbb-0000-4000-8000-000000000002";

function targetUser(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: TARGET_UID,
    email: "target@pixeltec.mx",
    name: "Target",
    role: "admin",
    status: "active",
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.selectQueue.length = 0;
  mocks.state.updates.length = 0;
  mocks.state.updateReturningQueue.length = 0;
  mocks.state.txInserts.length = 0;
  mocks.state.txUpdates.length = 0;
  mocks.state.txDeletes.length = 0;
  mocks.requireAdmin.mockResolvedValue({ ok: true, uid: ADMIN_UID, isAdmin: true });
  mocks.revokeCredentialsFor.mockReset().mockResolvedValue(undefined);
  mocks.recordSecurityEvent.mockResolvedValue(undefined);
  mocks.sendUserInvitationEmail.mockResolvedValue({ success: true, id: "email-1" });
});

describe("guard admin", () => {
  it("sin rol admin → forbidden, sin tocar la base", async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: false, error: "forbidden", status: 403 });
    await expect(setUserRoleAction(TARGET_UID, "staff")).resolves.toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(mocks.db.select).not.toHaveBeenCalled();
    expect(mocks.db.update).not.toHaveBeenCalled();
  });
});

describe("setUserRoleAction — guardas anti-lockout", () => {
  it("prohibido degradarse a sí mismo", async () => {
    await expect(setUserRoleAction(ADMIN_UID, "staff")).resolves.toEqual({
      ok: false,
      error: "self-demotion",
    });
    expect(mocks.db.update).not.toHaveBeenCalled();
  });

  it("prohibido dejar 0 admins activos al degradar", async () => {
    mocks.state.selectQueue.push([targetUser()], []); // target admin, 0 otros admins activos
    await expect(setUserRoleAction(TARGET_UID, "staff")).resolves.toEqual({
      ok: false,
      error: "last-admin",
    });
    expect(mocks.db.update).not.toHaveBeenCalled();
  });

  it("degrada cuando queda otro admin activo + evento role_changed con actor", async () => {
    mocks.state.selectQueue.push([targetUser()], [{ id: ADMIN_UID }]);
    await expect(setUserRoleAction(TARGET_UID, "staff")).resolves.toEqual({ ok: true });
    expect(mocks.state.updates).toHaveLength(1);
    expect(mocks.state.updates[0].table).toBe(schema.users);
    expect(mocks.state.updates[0].values.role).toBe("staff");
    expect(mocks.recordSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: TARGET_UID,
        actorUserId: ADMIN_UID,
        type: "role_changed",
        metadata: { from: "admin", to: "staff" },
      })
    );
  });

  it("promover staff→admin no exige contar admins", async () => {
    mocks.state.selectQueue.push([targetUser({ role: "staff" })]);
    await expect(setUserRoleAction(TARGET_UID, "admin")).resolves.toEqual({ ok: true });
    expect(mocks.state.updates[0].values.role).toBe("admin");
    expect(mocks.revokeCredentialsFor).not.toHaveBeenCalled();
  });

  it("admin→staff NO estampa corte de credenciales (comportamiento previo intacto)", async () => {
    mocks.state.selectQueue.push([targetUser()], [{ id: ADMIN_UID }]);
    await expect(setUserRoleAction(TARGET_UID, "staff")).resolves.toEqual({ ok: true });
    expect(mocks.revokeCredentialsFor).not.toHaveBeenCalled();
  });
});

describe("setUserRoleAction — rol reviewer (WO-2026-00051)", () => {
  it("rol desconocido → invalid-role, sin tocar la base", async () => {
    await expect(setUserRoleAction(TARGET_UID, "superadmin" as never)).resolves.toEqual({
      ok: false,
      error: "invalid-role",
    });
    expect(mocks.db.update).not.toHaveBeenCalled();
  });

  it("prohibido degradarse a sí mismo a reviewer", async () => {
    await expect(setUserRoleAction(ADMIN_UID, "reviewer")).resolves.toEqual({
      ok: false,
      error: "self-demotion",
    });
    expect(mocks.db.update).not.toHaveBeenCalled();
  });

  it("prohibido dejar 0 admins activos al pasar un admin a reviewer", async () => {
    mocks.state.selectQueue.push([targetUser()], []);
    await expect(setUserRoleAction(TARGET_UID, "reviewer")).resolves.toEqual({
      ok: false,
      error: "last-admin",
    });
    expect(mocks.db.update).not.toHaveBeenCalled();
  });

  it("staff→reviewer: actualiza el rol, estampa el corte de credenciales y audita", async () => {
    mocks.state.selectQueue.push([targetUser({ role: "staff" })]);
    await expect(setUserRoleAction(TARGET_UID, "reviewer")).resolves.toEqual({ ok: true });
    expect(mocks.state.updates).toHaveLength(1);
    expect(mocks.state.updates[0].values.role).toBe("reviewer");
    expect(mocks.revokeCredentialsFor).toHaveBeenCalledWith(TARGET_UID);
    expect(mocks.recordSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "role_changed",
        metadata: { from: "staff", to: "reviewer" },
      })
    );
  });

  it("reviewer→staff: también estampa el corte (los tokens de reviewer no heredan acceso staff)", async () => {
    mocks.state.selectQueue.push([targetUser({ role: "reviewer" })]);
    await expect(setUserRoleAction(TARGET_UID, "staff")).resolves.toEqual({ ok: true });
    expect(mocks.revokeCredentialsFor).toHaveBeenCalledWith(TARGET_UID);
  });

  it("si el corte falla, el cambio de rol ya aplicado NO se revierte ni se reporta error", async () => {
    mocks.state.selectQueue.push([targetUser({ role: "staff" })]);
    mocks.revokeCredentialsFor.mockRejectedValue(new Error("db down"));
    await expect(setUserRoleAction(TARGET_UID, "reviewer")).resolves.toEqual({ ok: true });
    expect(mocks.state.updates[0].values.role).toBe("reviewer");
  });
});

describe("inviteUserAction — rol reviewer (WO-2026-00051)", () => {
  it("invita con rol reviewer (status invited, evento con role)", async () => {
    mocks.state.selectQueue.push([]); // email libre
    const res = await inviteUserAction({ email: "meta-review@example.test", name: "Meta", role: "reviewer" });
    expect(res).toEqual({ ok: true, emailSent: true });
    const inserted = mocks.state.txInserts.find((i) => i.table === schema.users);
    expect(inserted?.values).toMatchObject({ role: "reviewer", status: "invited" });
    expect(mocks.recordSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "user_invited", metadata: { role: "reviewer" } })
    );
  });

  it("rol desconocido → invalid-role", async () => {
    const res = await inviteUserAction({
      email: "x@example.test",
      name: "X",
      role: "owner" as never,
    });
    expect(res).toEqual({ ok: false, error: "invalid-role" });
    expect(mocks.db.transaction).not.toHaveBeenCalled();
  });
});

describe("suspendUserAction — guardas anti-lockout y efectos", () => {
  it("prohibida la auto-suspensión", async () => {
    await expect(suspendUserAction(ADMIN_UID)).resolves.toEqual({
      ok: false,
      error: "self-suspend",
    });
    expect(mocks.db.transaction).not.toHaveBeenCalled();
  });

  it("prohibido suspender al último admin activo", async () => {
    mocks.state.selectQueue.push([targetUser()], []);
    await expect(suspendUserAction(TARGET_UID)).resolves.toEqual({
      ok: false,
      error: "last-admin",
    });
    expect(mocks.db.transaction).not.toHaveBeenCalled();
  });

  it("suspende: status, invitaciones y resets en transacción + revoca sesiones + evento", async () => {
    mocks.state.selectQueue.push([targetUser()], [{ id: ADMIN_UID }]);
    mocks.state.updateReturningQueue.push([{ id: "s1" }, { id: "s2" }]); // sesiones revocadas
    await expect(suspendUserAction(TARGET_UID)).resolves.toEqual({
      ok: true,
      revokedSessions: 2,
    });

    const touched = mocks.state.txUpdates.map((u) => u.table);
    expect(touched).toContain(schema.users);
    expect(touched).toContain(schema.userInvitations);
    expect(touched).toContain(schema.passwordResetTokens);
    const usersUpdate = mocks.state.txUpdates.find((u) => u.table === schema.users);
    expect(usersUpdate?.values.status).toBe("suspended");

    // Revocación de sesiones fuera de la transacción (fire-safe documentado).
    expect(mocks.state.updates.some((u) => u.table === schema.userSessions)).toBe(true);

    expect(mocks.recordSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: TARGET_UID,
        actorUserId: ADMIN_UID,
        type: "user_suspended",
        metadata: { revokedSessions: 2 },
      })
    );
  });

  it("suspender a staff no consulta el conteo de admins", async () => {
    mocks.state.selectQueue.push([targetUser({ role: "staff" })]);
    mocks.state.updateReturningQueue.push([]);
    await expect(suspendUserAction(TARGET_UID)).resolves.toEqual({
      ok: true,
      revokedSessions: 0,
    });
  });
});

describe("reactivateUserAction", () => {
  it("solo reactiva cuentas suspendidas", async () => {
    mocks.state.selectQueue.push([targetUser({ status: "active" })]);
    await expect(reactivateUserAction(TARGET_UID)).resolves.toEqual({
      ok: false,
      error: "not-suspended",
    });
  });

  it("reactiva y registra evento", async () => {
    mocks.state.selectQueue.push([targetUser({ status: "suspended" })]);
    await expect(reactivateUserAction(TARGET_UID)).resolves.toEqual({ ok: true });
    expect(mocks.state.updates[0].values.status).toBe("active");
    expect(mocks.recordSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "user_reactivated", actorUserId: ADMIN_UID })
    );
  });
});

describe("inviteUserAction — token de invitación", () => {
  it("correo duplicado → email-exists", async () => {
    mocks.state.selectQueue.push([{ id: TARGET_UID }]);
    await expect(
      inviteUserAction({ email: "target@pixeltec.mx", name: "X", role: "staff" })
    ).resolves.toEqual({ ok: false, error: "email-exists" });
    expect(mocks.db.transaction).not.toHaveBeenCalled();
  });

  it("crea usuario 'invited' con hash inusable + token sha256 con TTL 7 días; el crudo solo va al correo", async () => {
    mocks.state.selectQueue.push([]); // email libre
    const before = Date.now();
    await expect(
      inviteUserAction({ email: "Nueva@PixelTEC.mx", name: "Nueva", role: "staff" })
    ).resolves.toEqual({ ok: true, emailSent: true });

    const userInsert = mocks.state.txInserts.find((i) => i.table === schema.users);
    expect(userInsert?.values.status).toBe("invited");
    expect(userInsert?.values.email).toBe("nueva@pixeltec.mx");
    expect(String(userInsert?.values.passwordHash)).toMatch(/^\$2[aby]\$/);

    const invInsert = mocks.state.txInserts.find((i) => i.table === schema.userInvitations);
    const storedHash = String(invInsert?.values.tokenHash);
    expect(storedHash).toMatch(/^[0-9a-f]{64}$/);

    // TTL 7 días
    const expiresAt = invInsert?.values.expiresAt as Date;
    expect(expiresAt.getTime() - before).toBeGreaterThanOrEqual(INVITATION_TTL_MS - 5000);
    expect(expiresAt.getTime() - before).toBeLessThanOrEqual(INVITATION_TTL_MS + 5000);

    // El enlace lleva el token CRUDO y su sha256 es exactamente lo almacenado.
    const emailArgs = mocks.sendUserInvitationEmail.mock.calls[0][0];
    const rawToken = String(emailArgs.inviteUrl).split("/invitacion/")[1];
    expect(rawToken).toMatch(/^[0-9a-f]{64}$/);
    expect(hashInvitationToken(rawToken)).toBe(storedHash);
    expect(storedHash).not.toBe(rawToken);
    expect(crypto.createHash("sha256").update(rawToken).digest("hex")).toBe(storedHash);

    expect(mocks.recordSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "user_invited", actorUserId: ADMIN_UID })
    );
  });

  it("si el correo falla, la cuenta queda creada y se reporta emailSent:false", async () => {
    mocks.state.selectQueue.push([]);
    mocks.sendUserInvitationEmail.mockResolvedValue({ success: false, error: "email_egress_blocked" });
    await expect(
      inviteUserAction({ email: "n@p.mx", name: "N", role: "staff" })
    ).resolves.toEqual({ ok: true, emailSent: false });
    expect(mocks.logSystemAlert).toHaveBeenCalledOnce();
  });
});

describe("resendInvitationAction — quema los tokens previos", () => {
  it("solo aplica a cuentas 'invited'", async () => {
    mocks.state.selectQueue.push([targetUser({ status: "active" })]);
    await expect(resendInvitationAction(TARGET_UID)).resolves.toEqual({
      ok: false,
      error: "not-invited",
    });
  });

  it("quema los pendientes (used_at) y emite token nuevo en la misma transacción", async () => {
    mocks.state.selectQueue.push([targetUser({ status: "invited", role: "staff" })]);
    await expect(resendInvitationAction(TARGET_UID)).resolves.toEqual({
      ok: true,
      emailSent: true,
    });

    const burn = mocks.state.txUpdates.find((u) => u.table === schema.userInvitations);
    expect(burn?.values.usedAt).toBeInstanceOf(Date);

    const fresh = mocks.state.txInserts.find((i) => i.table === schema.userInvitations);
    expect(String(fresh?.values.tokenHash)).toMatch(/^[0-9a-f]{64}$/);

    expect(mocks.recordSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "invitation_resent", actorUserId: ADMIN_UID })
    );
  });
});

describe("revokeUserSessionsAction", () => {
  it("revoca y registra sessions_revoked con actor", async () => {
    mocks.state.updateReturningQueue.push([{ id: "s1" }]);
    await expect(revokeUserSessionsAction(TARGET_UID)).resolves.toEqual({
      ok: true,
      revoked: 1,
    });
    expect(mocks.state.updates[0].table).toBe(schema.userSessions);
    expect(mocks.recordSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: TARGET_UID,
        actorUserId: ADMIN_UID,
        type: "sessions_revoked",
        metadata: { revoked: 1, byAdmin: true },
      })
    );
  });
});
