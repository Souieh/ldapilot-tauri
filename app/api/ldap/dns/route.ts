import { configService } from '@/lib/server/config-service';
import { ldapService } from '@/lib/server/ldap/ldap-service';
import { getSession } from '@/lib/server/session-store';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profile = await configService.getActiveProfile();
  if (!profile) {
    return NextResponse.json({ error: 'No active profile' }, { status: 404 });
  }
  try {
    const body = await request.json();
    const id = body.id;

    const updated = await ldapService.createDnsRecord(
      profile.config,
      body,
      session.userDN,
      session.password
    );

    return NextResponse.json(updated);
  } catch (error) {
    console.error('DNS Update Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update DNS record' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profile = await configService.getActiveProfile();
  if (!profile) {
    return NextResponse.json({ error: 'No active profile' }, { status: 404 });
  }
  try {
    const body = await request.json();
    const id = body.id;

    const updated = await ldapService.updateDnsRecord(
      profile.config,
      id,
      body,
      session.userDN,
      session.password
    );

    return NextResponse.json(updated);
  } catch (error) {
    console.error('DNS Update Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update DNS record' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profile = await configService.getActiveProfile();
  if (!profile) {
    return NextResponse.json({ error: 'No active profile' }, { status: 404 });
  }
  try {
    const body = await request.json();
    const id = body.id;

    await ldapService.deleteDnsRecord(profile.config, id, session.userDN, session.password);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DNS Delete Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete DNS record' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profile = await configService.getActiveProfile();
  if (!profile) {
    return NextResponse.json({ error: 'No active profile' }, { status: 404 });
  }

  try {
    const records = await ldapService.getDnsRecords(
      profile.config,
      session.userDN,
      session.password
    );
    return NextResponse.json(records);
  } catch (error) {
    console.error('DNS Fetch Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch DNS records' },
      { status: 500 }
    );
  }
}
