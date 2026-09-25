import { ProfileField, Profile } from "./schema";

export const DEFAULT_FIELDS: ProfileField[] = [
  {
    fieldId: "full_name",
    label: "Full Name",
    synonyms: ["name", "your name"],
    value: "",
    type: "text",
    isCustom: false,
    group: "identity",
  },
  {
    fieldId: "first_name",
    label: "First Name",
    synonyms: ["given name"],
    value: "",
    type: "text",
    isCustom: false,
    group: "identity",
  },
  {
    fieldId: "last_name",
    label: "Last Name",
    synonyms: ["surname"],
    value: "",
    type: "text",
    isCustom: false,
    group: "identity",
  },
  {
    fieldId: "dob",
    label: "Date of Birth",
    synonyms: ["dob"],
    value: "",
    type: "date",
    isCustom: false,
    group: "identity",
  },
  {
    fieldId: "email",
    label: "Email",
    synonyms: ["email addresss"],
    value: "",
    type: "email",
    isCustom: false,
    group: "contact",
  },

  {
    fieldId: "phone",
    label: "Phone Number",
    synonyms: ["tel"],
    value: "",
    type: "tel",
    isCustom: false,
    group: "contact",
  },
];

export function createNewProfile(name: string): Profile {
  return {
    profileId: crypto.randomUUID(),
    profileName: name,
    lastUpdated: new Date().toISOString(),
    fields: JSON.parse(JSON.stringify(DEFAULT_FIELDS)),
  };
}
