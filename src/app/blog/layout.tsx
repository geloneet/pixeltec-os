// Sin export de metadata a propósito: un `title` string plano aquí reseteaba
// el template `%s | PixelTEC` del root layout para todo el subárbol — los
// artículos salían sin marca en el <title>. El listado define su propio título
// vía buildMetadata en page.tsx.
export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
