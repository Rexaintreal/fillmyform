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
  normalized = normalized.replace(/\s+/g, " ").trim();

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
  return tokens.join(" ");
}

export function tokenOverlapScore(a: string, b: string): number {
  const tokensA = new Set(a.split(" ").filter((t) => t.length > 1));
  const tokensB = new Set(b.split(" ").filter((t) => t.length > 1));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }
  const union = new Set([...tokensA, ...tokensB]).size;
  return union === 0 ? 0 : intersection / union;
}

export function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) == a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, 
          Math.min(
            matrix[i][j - 1] + 1, 
            matrix[i - 1][j] + 1  
          )
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

export function calculateSimilarity(a: string, b: string): number{
  if(a===b) return 1.0;
  const distance = levenshtein(a, b);
  const maxLength = Math.max(a.length, b.length);
  if(maxLength ===0) return 1.0;
  return 1 - (distance/maxLength);
}

export interface MatchResult{
  fieldId: string;
  confidence: 'high' | 'medium';
  score: number;
}

const FUZZY_THRESHOLD = 0.80;
const TIE_EPSILON = 0.05;

function isMeaningfulTypeHint(typeHint: string):boolean{
  const t = typeHint.trim().toLowerCase();
  return t !== '' && t !== 'text';
}

export type MatchType = "exact" | "close" | "none";

export function resolveAutocompleteKey(raw: string | null): string | null {
  if (!raw) return null;
  return AUTOCOMPLETE_MAP[raw] ?? null;
}

export function matchProfileField(
  candidateText: string,
  field: ProfileField
): MatchType {
  const normalizedCandidate = normalizeText(candidateText);
  const normalizedLabel = normalizeText(field.label);
  const normalizedSynonyms = field.synonyms.map(normalizeText);

  if (normalizedCandidate === normalizedLabel) return "exact";
  if (normalizedSynonyms.includes(normalizedCandidate)) return "exact";

  if (
    normalizedLabel.includes(normalizedCandidate) || normalizedCandidate.includes(normalizedLabel)
  ) {
    return "close";
  }
  if (
    normalizedSynonyms.some(
      (s) => s.includes(normalizedCandidate) || normalizedCandidate.includes(s)
    )
  ) {
    return "close";
  }
  return "none";
}

export function findBestMatch(
  candidateText: string,
  rawAutocomplete: string | null,
  profile: Profile
): { field: ProfileField; matchType: MatchType } | null {
  const autoKey = resolveAutocompleteKey(rawAutocomplete);

  if (autoKey) {
    const mapped = profile.fields.find((f) => f.field === autoKey);

    if (mapped) {
      return { field: mapped, matchType: "exact" };
    }
  }
  let best: {
    field: ProfileField;
    matchType: MatchType;
  } | null = null;

  for (const field of profile.fields) {
    const matchType = matchProfileField(candidateText, field);

    if (matchType === "exact") {
      return { field, matchType };
    }

    if (matchType === "close" && !best) {
      best = { field, matchType };
    }
  }

  return best;
}