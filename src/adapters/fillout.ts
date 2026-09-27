import  { ExtractedField } from '../lib/extractor';
import { normalizeText, calculateSimilarity } from '../lib/matcher';

export function isFillout(root: Document | Element = document): boolean {
    if(typeof window !== 'undefined' && window.location) {
        const hostname = window.location.hostname;
        if(hostname ===  'fillout.com' || hostname.endsWith('.fillout.com') || hostname === 'forms.fillout.com') {
            return true;
        }
    }
    return !!(
        root.querySelector('[data-fillout-id]') ||
        root.querySelector('[data-forn-id]') ||
        root.querySelector('div.fillout-form') ||
        root.querySelector('[class*="fillout"]') ||
        root.querySelector('form[data-fillout]')
    );
}

function cleanFilloutLabel(raw: string): string {
    return raw
        .replace(/\*+/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}



function triggerFilloutClick(target: HTMLElement): void {
    const events = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
    for (const eventType of events) {
        target.dispatchEvent(
            new MouseEvent(eventType, {
                bubbles: true,
                cancelable: true,
                view: target.ownerDocument.defaultView || window
            })
        );
    }
}
