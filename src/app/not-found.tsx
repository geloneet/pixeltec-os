import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#030303] text-white flex flex-col items-center justify-center px-4 text-center">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.06),transparent_50%)]"
      />

      <p className="text-xs font-bold tracking-[0.3em] uppercase text-sky-500 mb-4">
        Error 404
      </p>

      <h1 className="text-[clamp(6rem,20vw,14rem)] font-extrabold leading-none text-transparent bg-clip-text bg-gradient-to-b from-white/20 to-white/5 select-none">
        404
      </h1>

      <p className="mt-6 text-xl md:text-2xl font-semibold text-zinc-100 max-w-lg">
        Esta página se fue al futuro sin nosotros.
      </p>
      <p className="mt-3 text-sm text-zinc-500 max-w-sm">
        La URL que buscas no existe o fue movida. Usa los accesos directos para retomar el camino.
      </p>

      <div className="mt-10 flex flex-col sm:flex-row gap-3 items-center justify-center">
        <Link
          href="/"
          className="rounded-full h-12 px-7 bg-white text-[#030303] text-sm font-semibold transition-all duration-200 hover:bg-zinc-200 hover:-translate-y-0.5 flex items-center"
        >
          Volver al inicio
        </Link>
        <Link
          href="/services"
          className="rounded-full h-12 px-7 border border-white/10 bg-white/5 text-zinc-300 text-sm font-semibold transition-all duration-200 hover:bg-white/10 hover:text-white hover:-translate-y-0.5 flex items-center"
        >
          Ver servicios
        </Link>
        <Link
          href="/contact"
          className="rounded-full h-12 px-7 border border-sky-500/30 bg-sky-500/10 text-sky-400 text-sm font-semibold transition-all duration-200 hover:bg-sky-500/20 hover:text-sky-300 hover:-translate-y-0.5 flex items-center"
        >
          Agendar diagnóstico
        </Link>
      </div>

      <p className="mt-16 text-xs text-zinc-700 tracking-widest uppercase">
        PIXELTEC · Ecosistemas Digitales
      </p>
    </main>
  );
}
