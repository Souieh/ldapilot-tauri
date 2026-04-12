import { NextRequest, NextResponse } from 'next/server';
import { configService } from '@/lib/server/config-service';

export async function GET() {
  try {
    const profiles = await configService.getProfiles();
    return NextResponse.json(profiles);
  } catch (error) {
    console.error('Error getting profiles:', error);
    return NextResponse.json(
      { error: 'Failed to get profiles' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, config } = body;

    if (!name || !config) {
      return NextResponse.json(
        { error: 'Name and config are required' },
        { status: 400 }
      );
    }

    const newProfile = await configService.createProfile(name, config);
    return NextResponse.json(newProfile, { status: 201 });
  } catch (error) {
    console.error('Error creating profile:', error);
    return NextResponse.json(
      { error: 'Failed to create profile' },
      { status: 500 }
    );
  }
}
