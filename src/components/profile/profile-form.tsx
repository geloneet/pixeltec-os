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
import { Textarea } from "@/components/ui/textarea";
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
      form.reset(data);
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
                <Textarea
                  {...field}
                  value={field.value ?? ""}
                  rows={3}
                  className="bg-white/5 border-white/10 text-zinc-100 focus:border-sky-500/50 resize-none"
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
