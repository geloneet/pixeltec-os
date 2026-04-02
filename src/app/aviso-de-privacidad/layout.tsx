import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Aviso de Privacidad',
  description: 'Consulta nuestro aviso de privacidad sobre el tratamiento de tus datos personales, conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares.',
};

export default function AvisoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
