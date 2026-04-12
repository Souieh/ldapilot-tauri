import fs from 'fs/promises';
import path from 'path';
import { LDAPConfig, ConfigProfile } from '@/lib/types/config';

const CONFIG_DIR = process.env.CONFIG_DIR || './config';
const PROFILES_FILE = path.join(CONFIG_DIR, 'profiles.json');

export class ConfigService {
  async ensureConfigDir(): Promise<void> {
    try {
      await fs.mkdir(CONFIG_DIR, { recursive: true });
    } catch (error) {
      console.error('Error creating config directory:', error);
    }
  }

  async getProfiles(): Promise<ConfigProfile[]> {
    await this.ensureConfigDir();

    try {
      const data = await fs.readFile(PROFILES_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      // File doesn't exist or is empty
      return [];
    }
  }

  async getActiveProfile(): Promise<ConfigProfile | null> {
    const profiles = await this.getProfiles();
    return profiles.find((p) => p.isActive) || null;
  }

  async createProfile(
    name: string,
    config: Omit<LDAPConfig, 'id' | 'created' | 'modified'>
  ): Promise<ConfigProfile> {
    const profiles = await this.getProfiles();

    const id = `profile_${Date.now()}`;
    const now = new Date().toISOString();

    const newConfig: LDAPConfig = {
      ...config,
      id,
      created: now,
      modified: now,
    };

    const newProfile: ConfigProfile = {
      id,
      name,
      isActive: profiles.length === 0, // First profile is active by default
      config: newConfig,
    };

    profiles.push(newProfile);
    await this.saveProfiles(profiles);

    return newProfile;
  }

  async updateProfile(
    profileId: string,
    updates: Partial<{
      name: string;
      config: Omit<LDAPConfig, 'id' | 'created' | 'modified'>;
    }>
  ): Promise<ConfigProfile | null> {
    const profiles = await this.getProfiles();
    const profile = profiles.find((p) => p.id === profileId);

    if (!profile) return null;

    if (updates.name) {
      profile.name = updates.name;
    }

    if (updates.config) {
      profile.config = {
        ...profile.config,
        ...updates.config,
        modified: new Date().toISOString(),
      };
    }

    await this.saveProfiles(profiles);
    return profile;
  }

  async setActiveProfile(profileId: string): Promise<boolean> {
    const profiles = await this.getProfiles();
    const profile = profiles.find((p) => p.id === profileId);

    if (!profile) return false;

    profiles.forEach((p) => {
      p.isActive = p.id === profileId;
    });

    await this.saveProfiles(profiles);
    return true;
  }

  async deleteProfile(profileId: string): Promise<boolean> {
    const profiles = await this.getProfiles();
    const index = profiles.findIndex((p) => p.id === profileId);

    if (index === -1) return false;

    profiles.splice(index, 1);

    // If deleted profile was active, make first one active
    if (profiles.length > 0 && !profiles.some((p) => p.isActive)) {
      profiles[0].isActive = true;
    }

    await this.saveProfiles(profiles);
    return true;
  }

  private async saveProfiles(profiles: ConfigProfile[]): Promise<void> {
    await this.ensureConfigDir();

    try {
      await fs.writeFile(PROFILES_FILE, JSON.stringify(profiles, null, 2), 'utf-8');
    } catch (error) {
      console.error('Error saving profiles:', error);
      throw error;
    }
  }
}

export const configService = new ConfigService();
