import { ExtractedField, extractLabelForElement } from "../lib/extractor";
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

export function extractTallyFields(root: Document | Element = document): ExtractedField[] {
    const result: ExtractedField[] = [];
    const seenElements = new Set<Elements>();

    const questionBlocks = Array.from(root.querySelectorAll(
        '[data-testid*="question"], .tally-question, .tally-block, ' +
        '[class*=QuestionBlock"], [class*=question-block"], ' +
        'div[data-block-type]' 
    ));

    for( const block of questionBlocks){
        const label= extractTallyQuestionLabel(block);
        if(!label) continue;

        const field = findTallyInteractiveElement(block, label, seenElements);
        if(field) result.push(field);
    }
}

function extractTallyQuestionLabel(block: Element): string | null {
    const labelEl = block.querySelector(
        'label, [class*="Label"], [class*="label"], '+
        '[class*="Title"], [class*="title"], '+
        'h2, h3, h4, span[class=*="haeding"], p[class*="heading"]'
    );

    if( labelEl && labelEl.textContent){
        const text= cleanTallyLabel(labelEl.textContent);
        if(text.length > 0 && text.length < 100) return text;
    }

    for( const child of Array.from(block.children)){
        if(child.querySelector('input, textarea, select')) continue;
        const text = cleanTallyLabel(child.textContent || '');
        if( text.length >  1 && text.length < 100) return text;
    }

    return null;
}



function findTallyInteractiveElement(
    block: Element,
    label: string, 
    seenElements: Set<Element>
): ExtractedField | null {
    const input = block.querySelector<HTMLInputElement>(
        'input:not([type="hidden"]): not([type="submit"]): not([type="button"]): not([type="radio"]): not([type="checkbox"])'
    );
    if( input && !seenElements.has(input)){
        seenElements.add(input);
        return{
            element: input,
            label,
            confidence: 1,
            typeHint: input.getAttribute('type') || 'text',
            adapter: 'tally'
        };
    }

    const textarea = block.querySelector<HTMLTextAreaElement>('textarea');
    if(textarea && !seenElements.has(textarea)) {
        seenElements.add(textarea);
        return {
            element: textarea,
            label,
            confidence: 1,
            typeHint: 'text',
            adapter: 'tally'
        };
    }
    
    const select = block.querySelector<HTMLSelectElement>('select');
    if( select && !seenElements.has(select)){
        seenElements.add(select);
        return { 
            element: select,
            label,
            confidence: 1,
            typeHint: 'select',
            adapter: 'tally'
        };
    }

    const customDropdown = block.querySelector<HTMLElement>(
        '[role="listbox"], [role="combobox"], [class*="dropdown"], [class*="Dropdown"]'
    );
    if(customDropdown && !seenElements.has(customDropdown)) {
        return { 
            element: customDropdown,
            label,
            confidence: 1,
            typeHint: 'select',
            adapter: 'tally'
        };
    }

    const radioGroup = block.querySelector<HTMLElement>(
        '[role="radiogroup"], [class*="RadioGroup"], [class*="radio-group]'
    );
    if(radioGroup && !seenElements.has(radioGroup)){
        seenElements.add(radioGroup);
        return {
            element: radioGroup,
            label,
            confidence: 1,
            typeHint: 'radio',
            adapter: 'tally'
        };
    }

}




function triggerTallyClick(target: HTMLElement): void {
    const events = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
    for( const eventType of events){
        target.dispatchEvent(
            new MouseEvent(eventType, {
                bubbles: true,
                cancelable: true,
                view: target.ownerDocument.defaultView || window
            })
        );
    }
}