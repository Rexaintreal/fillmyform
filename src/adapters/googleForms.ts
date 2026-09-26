import { ExtractedField } from '../lib/extractor';
import { normalizeText, calculateSimilarity } from '../lib/matcher'

// Google forms identifier
export function isGoogleForms(root: Document | Element = document): boolean {
    if(typeof window !== 'undefined' && window.location){
        if(
            window.location.hostname === 'docs.google.com' &&
            window.location.pathname.includes('/forms')
        ){
            return true;
        }
    }

    return !!(
        root.querySelector('form[action*="fromResponse"]') ||
        root.querySelector('.freebirdFormviwerViewFormContent') || 
        root.querySelector('div[role="list"] div[role="listitem"] div[role="heading"]') ||
        root.querySelector('div[jsmodel] div[role="heading"]')
    );
}

export function cleanQuestionTitle(raw: string): string {
    return raw
    .replace()
    .trim();
}

export function fillGoogleFormField(el: HTMLElement, value: string): boolean {
    if(!value) return false;

    if(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement){
        const proto = 
        el instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;
        const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
        if(descriptor?.set){
            descriptor.set.call
        }
    }

}