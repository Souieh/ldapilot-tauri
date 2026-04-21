'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/backend-api';

export function GuestGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    const check = async () => {
      const session = await getSession();
      if (session?.authenticated) {
        router.push('/dashboard');
      } else {
        setIsGuest(true);
      }
    };
    check();
  }, [router]);

  if (!isGuest) return null;
  return <>{children}</>;
}
