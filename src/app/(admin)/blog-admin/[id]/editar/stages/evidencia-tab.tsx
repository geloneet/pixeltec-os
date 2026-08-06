"use client";

import type { UseFormReturn } from "react-hook-form";
import type { BlogPostEditInput } from "@/lib/blog/schemas";
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { SourcesEditor } from "../sources-editor";

interface EvidenciaTabProps {
  form: UseFormReturn<BlogPostEditInput>;
}

export function EvidenciaTab({ form }: EvidenciaTabProps) {
  return (
    <FormField
      control={form.control}
      name="sources"
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <SourcesEditor value={field.value ?? []} onChange={field.onChange} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
