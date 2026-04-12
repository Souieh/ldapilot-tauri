import { configService } from '@/lib/server/config-service';
import { getSession } from '@/lib/server/session-store';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ authenticated: false });
  }

  const activeProfile = await configService.getActiveProfile();

  return NextResponse.json({
    authenticated: true,
    user: {
      username: session.username,
      dn: session.userDN,
    },
    profile: activeProfile
      ? {
          id: activeProfile.id,
          name: activeProfile.name,
        }
      : null,
  });
}
