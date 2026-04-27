# Profile & Avatar Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que el admin suba una foto de perfil a Firebase Storage, actualice su displayName/teléfono/bio, y que el avatar aparezca en todo el dashboard inmediatamente.

**Architecture:** Upload vía Server Action (no Client SDK de Storage) — el action recibe el FormData, valida server-side, sube a `users/{uid}/avatar.{ext}` con Admin SDK, hace `makePublic()`, y luego llama a `auth.updateUser(uid, { photoURL })`. El cliente recarga el user con `currentUser.reload()` + `router.refresh()` para forzar el nuevo avatar. La información del perfil (teléfono, bio) se guarda en Firestore `users/{uid}`. El `displayName` se actualiza en Firebase Auth vía Admin SDK.

**Tech Stack:** Next.js 15 Server Actions, firebase-admin/storage, firebase-admin/auth, react-hook-form + zod, shadcn/ui (Form, Dialog, AlertDialog), Tailwind.

---

## Diagnóstico previo (completado)

- **Bucket**: `studio-1487114664-78b63.firebasestorage.app`
- **`NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`**: ya en `.env.production`
- **`getSessionUid`**: `@/lib/crypto-intel/auth` — lee cookie `__session`
- **shadcn/ui**: dialog, form, input, label, alert-dialog — todos presentes
- **react-hook-form + @hookform/resolvers**: instalados
- **storage.rules**: no existe — crear
- **firebase.json**: solo tiene `firestore` — agregar sección `storage`
- **next.config.ts**: falta `storage.googleapis.com` en remotePatterns
- **Admin SDK**: `getAdminApp()` existe pero no exporta Storage — agregar `getAdminStorage`

---

## Estructura de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `storage.rules` | CREATE | Reglas de seguridad para Firebase Storage |
| `firebase.json` | MODIFY | Apuntar a `storage.rules` |
| `next.config.ts` | MODIFY | remotePattern para storage.googleapis.com |
| `src/lib/firebase-admin.ts` | MODIFY | Exportar `getAdminStorage()` |
| `src/lib/profile/schemas.ts` | CREATE | Zod schemas para UpdateProfileInput |
| `src/lib/profile/actions.ts` | CREATE | uploadAvatar, deleteAvatar, updateProfile |
| `src/components/profile/avatar-uploader.tsx` | CREATE | UI de upload de foto + preview |
| `src/components/profile/profile-form.tsx` | CREATE | Form de nombre/teléfono/bio |
| `src/app/(admin)/perfil/page.tsx` | REWRITE | Página completa con 3 secciones |

---

## Task 1: storage.rules + firebase.json

**Files:**
- Create: `storage.rules`
- Modify: `firebase.json`

- [ ] **Step 1: Crear storage.rules**

Crear `/home/ubuntu/pixeltec-os/storage.rules` con:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    // Fotos de perfil: sólo el dueño puede escribir, cualquier auth puede leer
    match /users/{uid}/avatar.{ext} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && request.auth.uid == uid
        && request.resource.size < 2 * 1024 * 1024
        && request.resource.contentType.matches('image/(jpeg|png|webp)');
    }

    // Otros archivos del user (futuro)
    match /users/{uid}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && request.auth.uid == uid
        && request.resource.size < 10 * 1024 * 1024;
    }

    // Default deny
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 2: Actualizar firebase.json**

Reemplazar el contenido de `firebase.json` con:

```json
{
  "firestore": {
    "rules": "firestore.rules"
  },
  "storage": {
    "rules": "storage.rules"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add storage.rules firebase.json
git commit -m "feat: add Firebase Storage security rules for user avatars"
```

---

## Task 2: Deploy Storage rules

- [ ] **Step 1: Reconstruir SA temporal**

```python
python3 <<'PYEOF'
import json, os
env = {}
with open('.env.production', 'r') as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        k, _, v = line.partition('=')
        if v and len(v) >= 2 and v[0] == v[-1] and v[0] in '"\'':
            v = v[1:-1]
        env[k.strip()] = v.strip()
pk = env.get('FIREBASE_ADMIN_PRIVATE_KEY', '').replace('\\n', '\n')
assert pk.startswith('-----BEGIN PRIVATE KEY-----'), 'PK malformada'
sa = {
    'type': 'service_account',
    'project_id': env['FIREBASE_ADMIN_PROJECT_ID'],
    'private_key': pk,
    'client_email': env['FIREBASE_ADMIN_CLIENT_EMAIL'],
    'token_uri': 'https://oauth2.googleapis.com/token',
}
with open('/tmp/firebase-sa-temp.json', 'w') as f:
    json.dump(sa, f)
os.chmod('/tmp/firebase-sa-temp.json', 0o600)
print('SA listo')
PYEOF
```

- [ ] **Step 2: Deploy**

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/tmp/firebase-sa-temp.json
firebase deploy --only storage --project studio-1487114664-78b63
```

Output esperado:
```
✔  storage: rules file storage.rules compiled successfully
✔  storage: released rules storage.rules to firebase.storage
✔  Deploy complete!
```

- [ ] **Step 3: Cleanup obligatorio**

```bash
shred -u /tmp/firebase-sa-temp.json 2>/dev/null || rm -f /tmp/firebase-sa-temp.json
ls /tmp/firebase-sa-temp.json 2>&1  # debe dar "No such file"
unset GOOGLE_APPLICATION_CREDENTIALS
```

---

## Task 3: next.config.ts + Admin SDK storage export

**Files:**
- Modify: `next.config.ts`
- Modify: `src/lib/firebase-admin.ts`

- [ ] **Step 1: Agregar remotePattern en next.config.ts**

En el array `remotePatterns`, agregar después del último entry existente (`lh3.googleusercontent.com`):

```typescript
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        pathname: '/studio-1487114664-78b63.firebasestorage.app/**',
      },
```

- [ ] **Step 2: Exportar getAdminStorage en src/lib/firebase-admin.ts**

Agregar al final del archivo `src/lib/firebase-admin.ts` (después de `getAdminAuth`):

```typescript
import { getStorage, type Storage } from 'firebase-admin/storage';

export function getAdminStorage(): Storage {
  return getStorage(getAdminApp());
}
```

Y agregar el import al principio del archivo. El archivo completo queda:

```typescript
/**
 * Firebase Admin SDK — server-side only.
 *
 * Required env vars:
 *   FIREBASE_ADMIN_PROJECT_ID
 *   FIREBASE_ADMIN_CLIENT_EMAIL
 *   FIREBASE_ADMIN_PRIVATE_KEY  (PEM string, newlines as \n)
 */

import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getStorage, type Storage } from 'firebase-admin/storage';

let adminApp: App | undefined;

function getAdminApp(): App {
  if (adminApp) return adminApp;

  const existing = getApps();
  if (existing.length > 0) {
    adminApp = existing[0];
    return adminApp;
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Firebase Admin SDK is not configured. Set FIREBASE_ADMIN_PROJECT_ID, ' +
      'FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY env vars.'
    );
  }

  adminApp = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });

  return adminApp;
}

export { getAdminApp };

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminStorage(): Storage {
  return getStorage(getAdminApp());
}
```

- [ ] **Step 3: Commit**

```bash
git add next.config.ts src/lib/firebase-admin.ts
git commit -m "feat: add storage.googleapis.com remotePattern and getAdminStorage export"
```

---

## Task 4: Profile Zod schemas

**Files:**
- Create: `src/lib/profile/schemas.ts`

- [ ] **Step 1: Crear schemas**

```typescript
import { z } from "zod";

export const UpdateProfileSchema = z.object({
  displayName: z.string().min(1, "Nombre requerido").max(100),
  phone: z.string().max(20).optional(),
  bio: z.string().max(300).optional(),
});
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2MB
export const AVATAR_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AvatarMimeType = (typeof AVATAR_ALLOWED_TYPES)[number];
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/profile/schemas.ts
git commit -m "feat: zod schemas for profile update"
```

---

## Task 5: Server Actions — uploadAvatar, deleteAvatar, updateProfile

**Files:**
- Create: `src/lib/profile/actions.ts`

- [ ] **Step 1: Crear el archivo**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { getFirestore } from "firebase-admin/firestore";
import { getAdminApp, getAdminAuth, getAdminStorage } from "@/lib/firebase-admin";
import { getSessionUid } from "@/lib/crypto-intel/auth";
import {
  AVATAR_MAX_BYTES,
  AVATAR_ALLOWED_TYPES,
  UpdateProfileSchema,
  type UpdateProfileInput,
} from "./schemas";

const BUCKET_NAME = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!;

type ActionResult = { ok: true; url?: string } | { ok: false; error: string };

export async function uploadAvatar(formData: FormData): Promise<ActionResult> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: "No autenticado" };

  const file = formData.get("file") as File | null;
  if (!file) return { ok: false, error: "Sin archivo" };

  if (file.size > AVATAR_MAX_BYTES) {
    return { ok: false, error: "El archivo supera 2MB" };
  }

  const mimeType = file.type as string;
  if (!(AVATAR_ALLOWED_TYPES as readonly string[]).includes(mimeType)) {
    return { ok: false, error: "Tipo no permitido. Usa JPG, PNG o WebP." };
  }

  try {
    const storage = getAdminStorage();
    const bucket = storage.bucket(BUCKET_NAME);
    const ext = mimeType === "image/jpeg" ? "jpg" : mimeType === "image/png" ? "png" : "webp";
    const path = `users/${uid}/avatar.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await bucket.file(path).save(buffer, {
      contentType: mimeType,
      metadata: { cacheControl: "public, max-age=3600" },
    });

    await bucket.file(path).makePublic();
    const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${path}`;

    await getAdminAuth().updateUser(uid, { photoURL: publicUrl });

    revalidatePath("/", "layout");
    return { ok: true, url: publicUrl };
  } catch (err) {
    console.error("[uploadAvatar]", err);
    return { ok: false, error: "Error al subir la imagen" };
  }
}

export async function deleteAvatar(): Promise<ActionResult> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: "No autenticado" };

  try {
    const storage = getAdminStorage();
    const bucket = storage.bucket(BUCKET_NAME);

    // Intentar borrar todas las extensiones posibles
    for (const ext of ["jpg", "png", "webp"]) {
      const file = bucket.file(`users/${uid}/avatar.${ext}`);
      const [exists] = await file.exists();
      if (exists) await file.delete();
    }

    await getAdminAuth().updateUser(uid, { photoURL: "" });

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    console.error("[deleteAvatar]", err);
    return { ok: false, error: "Error al eliminar la foto" };
  }
}

export async function updateProfile(input: UpdateProfileInput): Promise<ActionResult> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: "No autenticado" };

  const parsed = UpdateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0].message };
  }

  const { displayName, phone, bio } = parsed.data;

  try {
    await getAdminAuth().updateUser(uid, { displayName });

    const db = getFirestore(getAdminApp());
    await db
      .collection("users")
      .doc(uid)
      .set({ phone: phone ?? null, bio: bio ?? null }, { merge: true });

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    console.error("[updateProfile]", err);
    return { ok: false, error: "Error al guardar los cambios" };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/profile/actions.ts
git commit -m "feat: Server Actions for avatar upload/delete and profile update"
```

---

## Task 6: AvatarUploader Client Component

**Files:**
- Create: `src/components/profile/avatar-uploader.tsx`

- [ ] **Step 1: Crear el componente**

```typescript
"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth, useUser } from "@/firebase";
import { uploadAvatar, deleteAvatar } from "@/lib/profile/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AVATAR_MAX_BYTES, AVATAR_ALLOWED_TYPES, type AvatarMimeType } from "@/lib/profile/schemas";

function getInitials(displayName: string | null, email: string | null): string {
  if (displayName?.trim()) return displayName.trim()[0].toUpperCase();
  if (email) return email[0].toUpperCase();
  return "U";
}

export function AvatarUploader() {
  const user = useUser();
  const auth = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!user) return null;

  const initials = getInitials(user.displayName, user.email);
  const currentPhoto = preview ?? user.photoURL ?? null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > AVATAR_MAX_BYTES) {
      toast.error("El archivo supera 2MB");
      return;
    }
    if (!(AVATAR_ALLOWED_TYPES as readonly string[]).includes(file.type)) {
      toast.error("Tipo no permitido. Usa JPG, PNG o WebP.");
      return;
    }

    // Validate minimum dimensions
    const img = new window.Image();
    img.onload = () => {
      if (img.width < 200 || img.height < 200) {
        toast.error("La imagen debe ser al menos 200×200px");
        URL.revokeObjectURL(img.src);
        return;
      }
      setPreview(img.src);
      setSelectedFile(file);
    };
    img.onerror = () => {
      toast.error("No se pudo leer la imagen");
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  };

  const handleUpload = () => {
    if (!selectedFile) return;
    const formData = new FormData();
    formData.append("file", selectedFile);

    startTransition(async () => {
      const result = await uploadAvatar(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      // Force Firebase Auth to refresh photoURL client-side
      if (auth?.currentUser) {
        await auth.currentUser.reload();
      }
      setPreview(null);
      setSelectedFile(null);
      router.refresh();
      toast.success("Foto actualizada");
    });
  };

  const handleCancel = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteAvatar();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (auth?.currentUser) {
        await auth.currentUser.reload();
      }
      router.refresh();
      toast.success("Foto eliminada");
    });
  };

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-end sm:gap-6">
      {/* Avatar */}
      <div className="relative h-32 w-32 flex-shrink-0 rounded-full overflow-hidden ring-4 ring-white/10">
        {currentPhoto ? (
          <Image
            src={currentPhoto}
            alt={user.displayName ?? "Avatar"}
            fill
            className="object-cover"
            sizes="128px"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-sky-500 to-indigo-600">
            <span className="text-white text-4xl font-semibold uppercase select-none">
              {initials}
            </span>
          </div>
        )}
        {isPending && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2">
        {selectedFile ? (
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleUpload}
              disabled={isPending}
              className="bg-sky-600 hover:bg-sky-500 text-white"
            >
              {isPending ? "Subiendo..." : "Subir foto"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancel}
              disabled={isPending}
              className="text-zinc-400 hover:text-white"
            >
              Cancelar
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isPending}
            className="border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white"
          >
            Cambiar foto
          </Button>
        )}

        {user.photoURL && !selectedFile && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                disabled={isPending}
                className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 justify-start px-2"
              >
                Eliminar foto
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-zinc-950 border border-white/10">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-zinc-100">
                  ¿Eliminar foto de perfil?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-zinc-400">
                  Se volverán a mostrar tus iniciales como avatar.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10">
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-rose-600 hover:bg-rose-500 text-white"
                >
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        <p className="text-xs text-zinc-600">JPG, PNG o WebP · máx 2MB · mín 200×200px</p>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={handleFileChange}
        aria-hidden
      />
    </div>
  );
}
```

- [ ] **Step 2: Crear directorio src/components/profile/**

```bash
mkdir -p src/components/profile
```

- [ ] **Step 3: Commit**

```bash
git add src/components/profile/avatar-uploader.tsx
git commit -m "feat: AvatarUploader component with preview, validation, and delete confirm"
```

---

## Task 7: ProfileForm Client Component

**Files:**
- Create: `src/components/profile/profile-form.tsx`

- [ ] **Step 1: Crear el componente**

Este componente necesita leer los datos actuales (displayName de Firebase Auth, phone/bio de Firestore). Como es un Client Component dentro de `/perfil` (que es Server Component), recibe los datos como props del Server Component padre.

```typescript
"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/lib/profile/actions";
import { UpdateProfileSchema, type UpdateProfileInput } from "@/lib/profile/schemas";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ProfileFormProps {
  initialValues: {
    displayName: string;
    email: string;
    phone: string;
    bio: string;
  };
}

export function ProfileForm({ initialValues }: ProfileFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(UpdateProfileSchema),
    defaultValues: {
      displayName: initialValues.displayName,
      phone: initialValues.phone,
      bio: initialValues.bio,
    },
  });

  const onSubmit = (data: UpdateProfileInput) => {
    startTransition(async () => {
      const result = await updateProfile(data);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
      toast.success("Perfil actualizado");
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-md">
        <FormField
          control={form.control}
          name="displayName"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-zinc-300">Nombre completo</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  className="bg-white/5 border-white/10 text-zinc-100 focus:border-sky-500/50"
                  placeholder="Tu nombre"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Email — readonly */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-300">Email</label>
          <Input
            value={initialValues.email}
            readOnly
            className="bg-white/5 border-white/10 text-zinc-500 cursor-not-allowed opacity-60"
          />
        </div>

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-zinc-300">Teléfono</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  className="bg-white/5 border-white/10 text-zinc-100 focus:border-sky-500/50"
                  placeholder="+52 55 0000 0000"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-zinc-300">Bio corta</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  className="bg-white/5 border-white/10 text-zinc-100 focus:border-sky-500/50"
                  placeholder="Describe tu rol en pocas palabras"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          disabled={isPending || !form.formState.isDirty}
          className="bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-50"
        >
          {isPending ? "Guardando..." : "Guardar cambios"}
        </Button>
      </form>
    </Form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/profile/profile-form.tsx
git commit -m "feat: ProfileForm with react-hook-form for name/phone/bio"
```

---

## Task 8: Página /perfil (reescritura completa)

**Files:**
- Rewrite: `src/app/(admin)/perfil/page.tsx`

El `/perfil` route es un **Server Component** — puede leer cookies y Firestore directamente. Pasa datos iniciales a los Client Components.

- [ ] **Step 1: Reescribir la página**

```typescript
import { redirect } from "next/navigation";
import { getAdminAuth, getAdminApp } from "@/lib/firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { getSessionUid } from "@/lib/crypto-intel/auth";
import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { ProfileForm } from "@/components/profile/profile-form";
import { Separator } from "@/components/ui/separator";

export default async function PerfilPage() {
  const uid = await getSessionUid();
  if (!uid) redirect("/login?redirect=/perfil");

  const [authUser, userDoc] = await Promise.all([
    getAdminAuth().getUser(uid),
    getFirestore(getAdminApp()).collection("users").doc(uid).get(),
  ]);

  const docData = userDoc.data() ?? {};

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Mi perfil</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Gestiona tu foto, información personal y seguridad.
        </p>
      </div>

      {/* Sección: Foto de perfil */}
      <section className="rounded-xl bg-white/3 border border-white/5 p-6 flex flex-col gap-4">
        <h2 className="text-base font-semibold text-zinc-100">Foto de perfil</h2>
        <AvatarUploader />
      </section>

      <Separator className="bg-white/5" />

      {/* Sección: Información personal */}
      <section className="rounded-xl bg-white/3 border border-white/5 p-6 flex flex-col gap-4">
        <h2 className="text-base font-semibold text-zinc-100">Información personal</h2>
        <ProfileForm
          initialValues={{
            displayName: authUser.displayName ?? "",
            email: authUser.email ?? "",
            phone: (docData.phone as string) ?? "",
            bio: (docData.bio as string) ?? "",
          }}
        />
      </section>

      <Separator className="bg-white/5" />

      {/* Sección: Seguridad — stub */}
      <section className="rounded-xl bg-white/3 border border-white/5 p-6 flex flex-col gap-4">
        <h2 className="text-base font-semibold text-zinc-100">Seguridad</h2>
        <p className="text-zinc-500 text-sm">
          Cambio de contraseña y gestión de sesiones — próximamente.
        </p>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/(admin)/perfil/page.tsx"
git commit -m "feat: full /perfil page with avatar uploader and profile form"
```

---

## Task 9: Build + deploy

- [ ] **Step 1: Build local**

```bash
npm run build 2>&1 | tail -30
```

Expected: build limpio, sin errores de TypeScript.

Si TypeScript falla con `cannot find name 'window'` en `avatar-uploader.tsx`: el `new window.Image()` en un Server Component causaría error, pero el componente tiene `"use client"` — verificar que esté presente.

- [ ] **Step 2: Docker build + up**

```bash
docker compose build app && docker compose up -d app
docker compose logs app --tail=5
```

Expected: `✓ Ready in ...ms`

- [ ] **Step 3: Verificar BUILD_ID en contenedor**

```bash
docker compose exec app cat /app/.next/BUILD_ID
```

---

## Checklist de validación manual

### Avatar upload
- [ ] Abrir https://pixeltec.mx/perfil
- [ ] Avatar actual (iniciales) visible en sección grande
- [ ] Clic en "Cambiar foto" → abre file picker
- [ ] Seleccionar JPG ≤2MB ≥200×200 → preview inmediato visible
- [ ] Clic "Subir foto" → loading spinner → toast "Foto actualizada"
- [ ] Avatar en header (user-menu) también actualizado
- [ ] Reload de página → avatar persiste

### Validaciones
- [ ] Archivo >2MB → toast de error, sin upload
- [ ] PDF → rechazado por tipo
- [ ] JPG 100×100 → rechazado por dimensiones (error toast)

### Eliminar
- [ ] "Eliminar foto" → AlertDialog → confirmar → iniciales vuelven
- [ ] Header también muestra iniciales
- [ ] Reload → iniciales persisten

### Información personal
- [ ] displayName visible pre-poblado
- [ ] Guardar cambios → toast éxito → header actualiza nombre
- [ ] Teléfono y bio persisten tras reload

### No-regresión
- [ ] Command Palette ⌘K funciona
- [ ] Notificaciones bell funciona
- [ ] Sidebar icon-only intacto
- [ ] /crypto-intel intacto
