import type { Metadata } from 'next';

// Página funcional privada: sin valor de búsqueda y con título propio para no
// duplicar el del home (antes heredaba el default del root y era indexable).
export const metadata: Metadata = {
  title: 'Restablecer contraseña',
  description: 'Restablece la contraseña de tu cuenta de Pixeltec.mx.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
