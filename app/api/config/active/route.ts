import { NextRequest, NextResponse } from 'next/server';
import { configService } from '@/lib/server/config-service';

export async function GET() {
  try {
    const profile = await configService.getActiveProfile();
    return NextResponse.json(profile);
  } catch (error) {
    console.error('Error getting active profile:', error);
    return NextResponse.json(
      { error: 'Failed to get active profile' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { profileId } = body;

    if (!profileId) {
      return NextResponse.json(
        { error: 'Profile ID is required' },
        { status: 400 }
      );
    }

    const success = await configService.setActiveProfile(profileId);
    if (!success) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    const profile = await configService.getActiveProfile();
    return NextResponse.json(profile);
  } catch (error) {
    console.error('Error setting active profile:', error);
    return NextResponse.json(
      { error: 'Failed to set active profile' },
      { status: 500 }
    );
  }
}
