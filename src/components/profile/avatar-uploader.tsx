"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useUser } from "@/hooks/use-user";
import { uploadAvatar, deleteAvatar } from "@/lib/profile/actions";
import { Spinner } from "@/components/ui/spinner";
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
import { AVATAR_MAX_BYTES, AVATAR_ALLOWED_TYPES } from "@/lib/profile/schemas";

function getInitials(displayName: string | null, email: string | null): string {
  if (displayName?.trim()) return displayName.trim()[0].toUpperCase();
  if (email) return email[0].toUpperCase();
  return "U";
}

export function AvatarUploader({ initialPhotoUrl }: { initialPhotoUrl?: string | null }) {
  const user = useUser();
  const { update: updateSession } = useSession();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  if (!user) return null;

  const initials = getInitials(user.displayName, user.email);
  const savedPhoto = uploadedUrl ?? initialPhotoUrl ?? user.photoURL ?? null;
  const currentPhoto = preview ?? savedPhoto;

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

    const img = new window.Image();
    img.onload = () => {
      if (img.width < 200 || img.height < 200) {
        toast.error("La imagen debe ser al menos 200×200px");
        URL.revokeObjectURL(img.src);
        return;
      }
      if (preview) URL.revokeObjectURL(preview);
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
      if (result.url) setUploadedUrl(result.url);
      // Refresca el JWT de NextAuth para que el header muestre la foto nueva
      await updateSession({ image: result.url ?? null });
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
      setSelectedFile(null);
      toast.success("Foto actualizada");
      router.refresh();
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
      setUploadedUrl(null);
      await updateSession({ image: null });
      toast.success("Foto eliminada");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-end sm:gap-6">
      {/* Avatar */}
      <div className="relative h-32 w-32 flex-shrink-0 rounded-full overflow-hidden ring-4 ring-border">
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
            <Spinner size="lg" className="text-white" />
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
              className="text-muted-foreground hover:text-foreground"
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
            className="border-border bg-secondary/40 text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
          >
            Cambiar foto
          </Button>
        )}

        {savedPhoto && !selectedFile && (
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
            <AlertDialogContent className="border-border bg-background text-foreground">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-foreground">
                  ¿Eliminar foto de perfil?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-muted-foreground">
                  Se volverán a mostrar tus iniciales como avatar.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-border bg-secondary/50 text-foreground hover:bg-secondary">
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

        <p className="text-xs text-muted-foreground/70">JPG, PNG o WebP · máx 2MB · mín 200×200px</p>
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
