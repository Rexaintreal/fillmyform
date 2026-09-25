export interface ProfileField {
  fieldId: string;
  label: string;
  synonyms: string[];
  value: string;
  values?: string[];
  type: string;
  isCustom: boolean;
  group?: string;
}

export interface Profile {
  profileId: string;
  profileName: string;
  lastUpdated: string;
  fields: ProfileField[];
}

export interface SyncSettings {
  enabled: boolean;
  autoSync: boolean;
  passphrase?: string;
  syncEndpoint?: string;
  lastSyncedAt: string | null;
}

export function getFieldValues(field: ProfileField): string[] {
  const list: string[] = [];
  if (field.value && field.value.trim()) {
    list.push(field.value.trim());
  }
  if (field.values && Array.isArray(field.values)) {
    for (const v of field.values) {
      const trimmed = v.trim();
      if (trimmed && !list.includes(trimmed)) {
        list.push(trimmed);
      }
    }
  }
  return list;
}
export const DEFAULT_SYNC_SETTINGS: SyncSettings = {
  enabled: false,
  autoSync: false,
  lastSyncedAt: null,
};
