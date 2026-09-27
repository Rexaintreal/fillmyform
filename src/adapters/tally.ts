import { ExtractedField } from "../lib/extractor";
import { normalizeText, calculateSimilarity } from '../lib/matcher';

export function isTally(root: Document | Element = document): boolean {
    if(typeof window !== 'undefined' && window.location) {
        if(window.location.hostname === 'tally.so' || window.location.hostname.endsWith('.tally.so')) {
            return true;
        }
    }

    return!!(
        root.querySelector('[data-tally-form-id]') ||
        root.querySelector('.tally-form') || 
        root.querySelector('form[action*=tally') ||
        root.querySelector('[data-testid*="tally"')
    );
}

function cleanTallyLabel(raw: string): string{
    return raw
        .replace(/\*+/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}
