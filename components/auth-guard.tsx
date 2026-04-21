'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/backend-api';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const check = async () => {
      const session = await getSession();
      if (!session?.authenticated) {
        router.push('/login');
      } else {
        setAuthorized(true);
      }
    };
    check();
  }, [router]);

  if (!authorized) return null;
  return <>{children}</>;
}
