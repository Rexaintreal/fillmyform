import type { Profile } from "./schema";

const KEY = "profiles";

export async function getProfiles(): Promise<Profile[]> {
  const data = await chrome.storage.local.get(KEY);
  return (data[KEY] as Profile[]) ?? [];
}

export async function saveProfile(profile: Profile): Promise<void> {
    const profiles = await getProfiles();
    const idx = profiles.findIndex(p => p.profileId === profile.profileId);
    if (idx >= 0) profiles[idx] = profile;
    else profiles.push(profile);
    await chrome.storage.local.set({ [KEY]: profiles});
}

export async function deleteProfile(profileId: string): Promise<void> {
    const profiles = await getProfiles();
    await chrome.storage.local.set({ [KEY]: profiles.filter(p => p.profileId !== profileId)});
}