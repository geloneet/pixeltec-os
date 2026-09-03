import Link from "next/link";

/**
 * Barra lateral del blog público (visible en desktop): Entradas recientes,
 * Categorías y Etiquetas — adaptada de la barra lateral de Muebles Encino
 * (`src/components/site/blog-sidebar.tsx`, WO-2026-00212) al tema oscuro de
 * Pixeltec.mx. Categorías y etiquetas enlazan a los filtros ya existentes de
 * `/blog` (`?categoria=…` / `?etiqueta=…`, paridad Encino WO-2026-00088); la
 * activa se resalta. Se omite la ficha de Google Maps de Encino (no aplica:
 * Pixeltec.mx no es un negocio con ficha GMB de blog).
 */
export function BlogSidebar({
  recentPosts,
  categories,
  tags,
  activeCategory = null,
  activeTag = null,
}: {
  recentPosts: { slug: string; title: string }[];
  categories: string[];
  tags: string[];
  activeCategory?: string | null;
  activeTag?: string | null;
}) {
  if (recentPosts.length === 0 && categories.length === 0 && tags.length === 0) return null;

  return (
    <aside className="space-y-8 rounded-xl border border-white/10 bg-white/[0.03] p-6">
      {recentPosts.length > 0 && (
        <section>
          <h2 className="text-xs font-bold tracking-[0.2em] text-zinc-400 uppercase">
            Entradas recientes
          </h2>
          <ul className="mt-3 space-y-2.5">
            {recentPosts.map((post) => (
              <li key={post.slug}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="text-sm text-zinc-300 transition-colors hover:text-brand-blue"
                >
                  {post.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {categories.length > 0 && (
        <section>
          <h2 className="text-xs font-bold tracking-[0.2em] text-zinc-400 uppercase">
            Categorías
          </h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            {categories.map((cat) => {
              const active = cat === activeCategory;
              return (
                <li key={cat}>
                  <Link
                    href={`/blog?categoria=${encodeURIComponent(cat)}`}
                    className={
                      active
                        ? "font-semibold text-brand-blue"
                        : "text-zinc-400 transition-colors hover:text-white"
                    }
                  >
                    {cat}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {tags.length > 0 && (
        <section>
          <h2 className="text-xs font-bold tracking-[0.2em] text-zinc-400 uppercase">
            Etiquetas
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {tags.map((tag) => {
              const active = tag === activeTag;
              return (
                <Link
                  key={tag}
                  href={`/blog?etiqueta=${encodeURIComponent(tag)}`}
                  className={
                    active
                      ? "rounded-full bg-white text-black px-2.5 py-1 text-xs font-semibold"
                      : "rounded-full border border-white/10 px-2.5 py-1 text-xs text-zinc-400 transition-colors hover:border-brand-blue/50 hover:text-white"
                  }
                >
                  #{tag}
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </aside>
  );
}
