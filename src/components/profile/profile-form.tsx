"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
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
    jobTitle: string;
  };
}

export function ProfileForm({ initialValues }: ProfileFormProps) {
  const router = useRouter();
  const { update: updateSession } = useSession();
  const [isPending, startTransition] = useTransition();

  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(UpdateProfileSchema),
    defaultValues: {
      displayName: initialValues.displayName,
      phone: initialValues.phone,
      jobTitle: initialValues.jobTitle,
    },
  });

  const onSubmit = (data: UpdateProfileInput) => {
    startTransition(async () => {
      const result = await updateProfile(data);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      form.reset(data);
      toast.success("Perfil actualizado");
      // Refresca el JWT para que el header muestre el nombre nuevo
      await updateSession({ name: data.displayName });
      router.refresh();
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
              <FormLabel className="text-muted-foreground">Nombre completo</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  className="bg-secondary border-border text-foreground focus:border-sky-500/50"
                  placeholder="Tu nombre"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-muted-foreground">Email</label>
            <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              Acceso con contraseña
            </span>
          </div>
          <Input
            value={initialValues.email}
            readOnly
            className="bg-secondary border-border text-muted-foreground cursor-not-allowed opacity-60"
          />
          <p className="text-xs text-muted-foreground">
            Correo utilizado para iniciar sesión. Solo un administrador puede modificarlo.
          </p>
        </div>

        <FormField
          control={form.control}
          name="jobTitle"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-muted-foreground">Cargo o puesto</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  className="bg-secondary border-border text-foreground focus:border-sky-500/50"
                  placeholder="Dirección, Desarrollo, Marketing…"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-muted-foreground">Teléfono</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  className="bg-secondary border-border text-foreground focus:border-sky-500/50"
                  placeholder="+52 55 0000 0000"
                />
              </FormControl>
              <p className="text-xs text-muted-foreground">
                Opcional — contacto interno del equipo; no se usa para verificación.
              </p>
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
