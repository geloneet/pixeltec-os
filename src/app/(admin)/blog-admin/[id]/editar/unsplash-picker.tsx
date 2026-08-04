"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { CircleAlert, ImageIcon, Search } from "lucide-react";
import { searchCoverImages } from "@/lib/blog/actions/images";
import type { UnsplashPhoto } from "@/lib/unsplash-egress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Unsplash clampa la búsqueda a 5 páginas en el backend (unsplash-egress). */
const MAX_PAGE = 5;
/** per_page fijado en el backend: si llegan menos, no hay más resultados. */
const PAGE_SIZE = 12;

interface UnsplashPickerProps {
  /** Foto elegida + query usada (candidata a alt si la foto no trae descripción). */
  onSelect: (photo: UnsplashPhoto, query: string) => void;
}

/** Botón "Buscar en Unsplash" + Dialog con búsqueda, grid de miniaturas y
 *  paginación por append. El backend (`searchCoverImages`) valida sesión y
 *  canal de egress; sus errores se muestran tal cual dentro del dialog. */
export function UnsplashPicker({ onSelect }: UnsplashPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [photos, setPhotos] = useState<UnsplashPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasSearched, setHasSearched] = useState(false);
  const [lastQuery, setLastQuery] = useState("");
  const [lastBatchCount, setLastBatchCount] = useState(0);
  const [isSearching, startSearch] = useTransition();

  const runSearch = (nextPage: number, append: boolean) => {
    const q = (append ? lastQuery : query).trim();
    if (!q) return;
    startSearch(async () => {
      setError(null);
      const result = await searchCoverImages(q, nextPage);
      if (result.ok) {
        const batch = result.data ?? [];
        setPhotos((prev) => (append ? [...prev, ...batch] : batch));
        setPage(nextPage);
        setLastQuery(q);
        setLastBatchCount(batch.length);
        setHasSearched(true);
      } else {
        setError(result.error ?? "Error buscando imágenes");
      }
    });
  };

  const handleSelect = (photo: UnsplashPhoto) => {
    onSelect(photo, lastQuery);
    setOpen(false);
  };

  const canLoadMore =
    photos.length > 0 && page < MAX_PAGE && lastBatchCount === PAGE_SIZE;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-border bg-secondary/50 text-foreground hover:bg-secondary"
        >
          <ImageIcon className="mr-2 h-4 w-4" />
          Buscar en Unsplash
        </Button>
      </DialogTrigger>
      <DialogContent className="border-border bg-background text-foreground sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-foreground">Buscar portada en Unsplash</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Elige una foto para usarla como imagen de portada del post.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                runSearch(1, false);
              }
            }}
            className="bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500/50"
            placeholder="p. ej. arquitectura de software, oficina, datos…"
            autoFocus
          />
          <Button
            type="button"
            onClick={() => runSearch(1, false)}
            disabled={isSearching || query.trim().length < 2}
          >
            {isSearching ? <Spinner size="sm" className="mr-2" /> : <Search className="mr-2 h-4 w-4" />}
            Buscar
          </Button>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="max-h-[55vh] overflow-y-auto">
          {isSearching && photos.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="md" />
            </div>
          ) : photos.length > 0 ? (
            <div className="grid grid-cols-3 gap-3">
              {photos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => handleSelect(photo)}
                  className="group text-left"
                >
                  <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border transition group-hover:border-blue-500/50 group-hover:opacity-90">
                    <Image
                      src={photo.thumbUrl}
                      alt={photo.altDescription || `Foto de ${photo.authorName} en Unsplash`}
                      fill
                      sizes="(max-width: 640px) 33vw, 210px"
                      className="object-cover"
                    />
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    Foto: {photo.authorName}
                  </p>
                </button>
              ))}
            </div>
          ) : hasSearched && !error ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Sin resultados para «{lastQuery}». Prueba otra búsqueda.
            </p>
          ) : null}

          {canLoadMore && (
            <div className="mt-3 flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => runSearch(page + 1, true)}
                disabled={isSearching}
                className="border-border bg-secondary/50 text-foreground hover:bg-secondary"
              >
                {isSearching && <Spinner size="sm" className="mr-2" />}
                Más resultados
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
