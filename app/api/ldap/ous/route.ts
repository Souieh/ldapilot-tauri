import { configService } from '@/lib/server/config-service';
import { ldapService } from '@/lib/server/ldap/ldap-service';
import { getSession } from '@/lib/server/session-store';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profiles = await configService.getProfiles();
    const profile = profiles.find((p) => p.id === session.profileId);

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 400 });
    }

    const ous = await ldapService.searchOUs(profile.config, session.userDN, session.password);

    return NextResponse.json(ous);
  } catch (error) {
    console.error('Search OUs error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to search OUs' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { parentDN, ouName } = await request.json();

    if (!ouName || typeof ouName !== 'string' || !ouName.trim()) {
      return NextResponse.json({ error: 'OU name is required' }, { status: 400 });
    }

    const sessionId = request.cookies.get('session_id')?.value;
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profiles = await configService.getProfiles();
    const profile = profiles.find((p) => p.id === session.profileId);

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 400 });
    }

    const newOu = await ldapService.createOU(
      profile.config,
      session.userDN,
      session.password,
      parentDN,
      ouName.trim()
    );
    return NextResponse.json(newOu, { status: 201 });
  } catch (error) {
    console.error('Create OU error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create OU' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { ouDN } = await request.json();

    if (!ouDN || typeof ouDN !== 'string') {
      return NextResponse.json({ error: 'OU DN is required' }, { status: 400 });
    }

    const profiles = await configService.getProfiles();
    const profile = profiles.find((p) => p.id === session.profileId);

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 400 });
    }

    await ldapService.deleteOU(profile.config, session.userDN, session.password, ouDN);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete OU error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete OU' },
      { status: 500 }
    );
  }
}
