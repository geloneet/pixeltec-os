import { redirect } from 'next/navigation';

// Ruta vieja del portal legado de clientes — el login unificado vive ahora en
// /login (selector "Acceso Clientes" / "Acceso Dev"). Se mantiene este
// redirect para no romper bookmarks/links existentes.
export default function LegacyPortalLoginRedirect() {
  redirect('/login?modo=cliente');
}
