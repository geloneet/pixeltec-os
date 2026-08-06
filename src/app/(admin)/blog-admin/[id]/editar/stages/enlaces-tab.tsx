"use client";

import type { UseFormReturn } from "react-hook-form";
import type { BlogPostEditInput } from "@/lib/blog/schemas";
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { InternalLinksEditor } from "../internal-links-editor";

interface EnlacesTabProps {
  form: UseFormReturn<BlogPostEditInput>;
}

export function EnlacesTab({ form }: EnlacesTabProps) {
  return (
    <FormField
      control={form.control}
      name="internalLinks"
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <InternalLinksEditor value={field.value ?? []} onChange={field.onChange} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
