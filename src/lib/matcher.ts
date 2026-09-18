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
  "address-level1": "state",
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
    tel: "phone",
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
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1),
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  const distance = levenshtein(a, b);
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1.0;
  return 1 - distance / maxLength;
}

export interface MatchResult {
  fieldId: string;
  confidence: "high" | "medium";
  score: number;
}

const FUZZY_THRESHOLD = 0.8;
const TIE_EPSILON = 0.05;

function isMeaningfulTypeHint(typeHint: string): boolean {
  const t = typeHint.trim().toLowerCase();
  return t !== "" && t !== "text";
}

function preferByType(
  candidates: { field: ProfileField; score: number }[],
  typeHint: string,
): { field: ProfileField; score: number } {
  if (isMeaningfulTypeHint(typeHint)) {
    const t = typeHint.trim().toLowerCase();
    const typed = candidates.find(
      (c) => c.field.type.trim().toLowerCase() === t,
    );
    if (typed) return typed;
  }
  return candidates[0];
}

export function matchField(
  extractedLabel: string,
  typeHint: string,
  profile: Profile,
  autocompleteHint?: string,
): MatchResult | null {
  if (autocompleteHint) {
    const cleanAuto = autocompleteHint.trim().toLowerCase();
    for (const token of cleanAuto.split(/\s+/)) {
      const mappedId = AUTOCOMPLETE_MAP[token];
      if (mappedId) {
        const found = profile.fields.find((f) => f.fieldId === mappedId);
        if (found) {
          return { fieldId: found.fieldId, confidence: "high", score: 1.0 };
        }
      }
    }
  }
  const normalizedExtracted = normalizeText(extractedLabel);
  if (!normalizedExtracted) return null;

  const exact: { field: ProfileField; score: number }[] = [];
  const fuzzy: { field: ProfileField; score: number }[] = [];

  for (const field of profile.fields) {
    const targets = [field.label, ...field.synonyms].map(normalizeText);
    if (targets.includes(normalizedExtracted)) {
      exact.push({ field, score: 1.0 });
      continue;
    }
    let best = 0;
    for (const target of targets) {
      const levScore = calculateSimilarity(normalizedExtracted, target);
      const tokScore = tokenOverlapScore(normalizedExtracted, target);
      const score = Math.max(levScore, tokScore);
      if (score > best) best = score;
    }
    fuzzy.push({ field, score: best });
  }
  if (exact.length > 0) {
    const winner = preferByType(exact, typeHint);
    return { fieldId: winner.field.fieldId, confidence: "high", score: 1.0 };
  }
  fuzzy.sort((a, b) => b.score - a.score);
  const top = fuzzy[0];
  if (!top || top.score < FUZZY_THRESHOLD) {
    return null;
  }

  const tied = fuzzy.filter((c) => top.score - c.score <= TIE_EPSILON);
  const winner = preferByType(tied, typeHint);
  return {
    fieldId: winner.field.fieldId,
    confidence: "medium",
    score: winner.score,
  };
}
