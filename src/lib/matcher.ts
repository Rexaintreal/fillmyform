import { Profile, ProfileField } from "./schema";

const AUTOCOMPLETE_MAP: Record<string, string> = {
  "given-name": "first_name",
  "family-name": "last_name",
  "additional-name": "first_name",
  name: "full_name",
  email: "email",
  tel: "phone",
  "tel-national": "phone",
  "street-address": "address_1",
  "address-line1": "address_1",
  "address-line2": "address_2",
  "address-level2": "city",
  address_level1: "state",
  "postal-code": "zip",
  country: "country",
  "country-name": "country",
  bday: "dob",
};

export function normalizeText(text: string): string {
  let normalized = text.toLowerCase();

  normalized = normalized
    .replace(/\*+/g, " ")
    .replace(/\(required\)/gi, " ")
    .replace(/\[required\]/gi, " ")
    .replace(/\brequired\b/gi, " ")
    .replace(/\(optional\)/gi, " ")
    .replace(/\[optional\]/gi, " ")
    .replace(/\boptional\b/gi, " ");

  normalized = normalized
    .replace(/^please\s+(enter|provide|type|input)\s+(your\s+)?/i, "")
    .replace(/^(enter|provide|type|input)\s+(your\s+)?/i, "")
    .replace(/^your\s+/i, "");

  normalized = normalized.replace(/[^\w\s]/gi, " ");

  const abbreviations: Record<string, string> = {
    addr: "address",
    apt: "apartment",
    ste: "suite",
    no: "number",
    num: "number",
    tel: "number",
    ph: "phone",
    telephone: "phone",
    mobile: "phone",
    mob: "phone",
    cell: "phone",
    zipcode: "zip code",
    postcode: "postal code",
    dob: "date of birth",
    fname: "first name",
    lname: "last name",
    org: "organization",
    cntry: "country",
    prov: "province",
  };

  const tokens = normalized
    .split(" ")
    .filter(Boolean)
    .map((token) => abbreviations[token] || token);
  return tokens.join(' ');
}


