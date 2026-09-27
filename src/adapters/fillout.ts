import  { ExtractedField, extractLabelForElement } from '../lib/extractor';
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

export function extractFilloutFields(root: Document | Element = document): ExtractedField[] {
    const results: ExtractedField[] = [];
    const seenElements = new Set<Element>();

    const questionBlocks = Array.from(root.querySelectorAll(
        '[data-question-id], [class*="question"], [class*="Question"], ' +
        '[class*="FormField"], [class*="form-field"], ' +
        '[data-field-id], [class*="fillout-question"]'
    ));

    for( const block of questionBlocks) {
        const label = extractFilloutQuestionLabel(block);
        if(!label) continue;

        const field = findFilloutInteractiveElement(block, label, seenElements);

        if(results.length === 0){
            const input = Array.from(root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
                'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select'
            ));

            for(const el of inputs){
                if(seenElements.has(el)) continue;
                const label = extractLabelForFilloutInput(el);
                if(!label) continue;

                seenElements.add(el);
                const typeHint = el instanceof HTMLSelectElement ? 'select'
                    : el instanceof HTMLSelectElement ? 'text'
                    : el.getAttribute('type') || 'text';

                results.push({
                    element: el,
                    label,
                    confidence: 1,
                    typeHint,
                    adapter: 'fillout'
                });
            }
        }
    }
    return results
}


function extractFilloutQuestionLabel(block: Element): string | null {
    const labelEl = block.querySelector(
        'label, [class*="Label"], [class*="label"], ' +
        '[class*="Title"], [class*="title"], ' +
        '[class*="Heading"], [class*="heading"], ' +
        'h2, h3, h4, p[class*="question"]'
    );
    if( labelEl && labelEl.textContent){
        const text = cleanFilloutLabel(labelEl.textContent);
        if( text.length>0 && text.length < 100) return text;
    }

    for(const child of Array.from(block.children)){
        if(child.querySelector('input, textarea, select')) continue;
        const text = cleanFilloutLabel(child.textContent || '');
        if(text.length > 1 && text.length < 100) return text;
    }

    return null;
}


function findFilloutInteractiveElement<HTMLElement>(
    block: Element,
    label: string,
    seenElements: Set<Element>
): ExtractedField | null {
    const input = block.querySelector<HTMLInputElement>(
        'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="radio"]):not([type="checkbox"])'
    );
      if (input && !seenElements.has(input)) {
        seenElements.add(input);
        return {
            element: input,
            label,
            confidence: 1,
            typeHint: input.getAttribute('type') || 'text',
            adapter: 'fillout'
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
            adapter: 'fillout'
        };
    }

    const select= block.querySelector<HTMLSelectElement>('select');
    if(select && !seenElements.has(select)) {
        seenElements.add(select);
        return {
            element: select,
            label,
            confidence: 1,
            typeHint: 'select',
            adapter: 'fillout'
        };
    }

    const combobox = block.querySelector<HTMLElement>(
        '[role="combobox"], [role="listbox"], [class*="dropdown"], [class*="Dropdown"], [class*="Select"]'
    );
    if(combobox && !seenElements.has(combobox)){
        seenElements.add(combobox);
        return {
            element: combobox,
            label,
            confidence: 1,
            typeHint: 'select',
            adapter: 'fillout'
        };
    }

    const radiogroup = block.querySelector<HTMLElement>(
        '[role="radiogroup"], [class*="RadioGroup"], [class*="radio-group"]'
    );
    if( radiogroup && !seenElements.has(radiogroup)){
        seenElements.add(radiogroup);
        return {
            element: radiogroup,
            label,
            confidence: 1,
            typeHint: 'radio',
            adapter: 'fillout'
        };
    }

    const radios = block.querySelectorAll<HTMLElement>('input[type="radio"]');
    if(radios.length > 0){
        const container = radios[0].closest('[role="radiogroup"]') || block;
        if(!seenElements.has(container)){
            seenElements.add(container);
            return {
                element: container as HTMLElement,
                label,
                confidence: 1,
                typeHint: 'radio',
                adapter: 'fillout'
            };
        }
    }

    const checkboxGroup = block.querySelector<HTMLElement>('[role="group"]');
    if(checkboxGroup && checkboxGroup.querySelector('[role="group"], input[type="checkbox"]') && !seenElements.has(checkboxGroup)){
        seenElements.add(checkboxGroup);
        return{
            element: checkboxGroup,
            label,
            confidence: 1,
            typHint: 'checkbox',
            adapter: 'fillout'
        };
    }
    return null;
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
