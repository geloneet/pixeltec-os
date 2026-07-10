'use client';

import { Button } from '@/components/ui/button';
import { logoutClientPortalAction } from '@/lib/client-portal/auth-actions';

export function LogoutButton() {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={async () => {
        await logoutClientPortalAction();
        window.location.assign('/portal');
      }}
      className="border-white/10 text-zinc-400 hover:text-white"
    >
      Cerrar sesión
    </Button>
  );
}
