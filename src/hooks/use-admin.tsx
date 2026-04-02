'use client';

import { useUserProfile } from '@/firebase/auth/use-user-profile';

/**
 * A hook to determine if the currently logged-in user has the 'admin' role.
 * @returns An object containing `isAdmin` (boolean) and `loading` (boolean).
 */
export function useAdmin() {
    const { userProfile, loading } = useUserProfile();

    const isAdmin = !!userProfile && userProfile.role === 'admin';

    return { isAdmin, loading };
}
