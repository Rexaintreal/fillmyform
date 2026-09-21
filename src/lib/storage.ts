import {
  DEFAULT_SYNC_SETTINGS,
  type Profile,
  type SyncSettings,
} from "./schema";

const STORAGE_KEY_PROFILES = "fmf_profiles";
const STORAGE_KEY_SYNC = "fmf_sync_settings";

export async function getProfiles(): Promise<Profile[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY_PROFILES);
  return (result[STORAGE_KEY_PROFILES] as Profile[]) || [];
}

export async function saveProfile(profile: Profile): Promise<void> {
  const profiles = await getProfiles();
  const existingIndex = profiles.findIndex(
    (p) => p.profileId === profile.profileId,
  );
  if (existingIndex >= 0) profiles[existingIndex] = profile;
  else profiles.push(profile);

  await chrome.storage.local.set({ [STORAGE_KEY_PROFILES]: profiles });
}

export async function saveAllProfiles(profiles: Profile[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY_PROFILES]: profiles });
}

export async function deleteProfile(profileId: string): Promise<void> {
  const profiles = await getProfiles();
  const newProfiles = profiles.filter((p) => p.profileId !== profileId);
  await chrome.storage.local.set({ [STORAGE_KEY_PROFILES]: newProfiles });
}

export async function getSyncSettings(): Promise<SyncSettings> {
  const result = await chrome.storage.local.get(STORAGE_KEY_SYNC);
  return (
    (result[STORAGE_KEY_SYNC] as SyncSettings) || { ...DEFAULT_SYNC_SETTINGS }
  );
}

export async function saveSyncSettings(settings: SyncSettings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY_SYNC]: settings });
}

export async function createNewProfile(
  profileName = "New Profile",
): Promise<Profile> {
  const profile: Profile = {
    profileId: crypto.randomUUID(),
    profileName,
    lastUpdated: new Date().toISOString(),
    fields: [],
  };

  await saveProfile(profile);
  return profile;
}
