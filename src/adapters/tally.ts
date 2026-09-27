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
    const results: ExtractedField[] = [];
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
        if(field) results.push(field);
    }

    if(results.length === 0){
        const inputs = Array.from(root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
            'input: not([type="hidden")]:not([type="submit"]):not([type="button"]), textarea, select'
        ));

        for( const el of inputs) {
            if(seenElements.has(el)) continue;

            const label = extractLabelForTallyInput(el);
            if(!label) continue;

            seenElements.add(el);
            const typeHint = el instanceof HTMLSelectElement? 'select'
                : el instanceof HTMLTextAreaElement ? 'text'
                : el.getAttribute('type') || 'text';
            
            results.push({
                element: el,
                label,
                confidence: 1,
                typeHint,
                adapter: 'tally'
            });
        }
    }

    return results;
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

    const radios = block.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    if(radios.length > 0){
        const container = radios[0].closest('[role="radiogroup"]') || block;
        if( !seenElements.has(container)){
            seenElements.add(container);
            return{
                element: container as HTMLElement,
                label,
                confidence: 1,
                typeHint: 'radio',
                adapter: 'tally'
            };
        }
    }

    return null;
}

function extractLabelForTallyInput(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string | null {
    const doc = el.ownerDocument || document;

    if(el.id){
        const labelEl = doc.querySelector(`label[for="${el.id}]`);
        if ( labelEl && labelEl.textContent){
            const text = cleanTallyLabel(labelEl.textContent);
            if(text) return text;
        }
    }

    const parentLabel = el.closest('label');
    if(parentLabel && parentLabel.textContent){
        const text = cleanTallyLabel(parentLabel.textContent);
        if(text) return text;
    }


    const ariaLabel = el.getAttribute('aria-label');
      if (ariaLabel) {
        const text = cleanTallyLabel(ariaLabel);
        if (text) return text;
    }      

    const prev = el.previousElementSibling;
    if(prev && prev.textContent){
        const text = cleanTallyLabel(prev.textContent);
        if(text.length > 0 && text.length < 80) return text;
    }



    const placeholder = el.getAttribute('placeholder');
    if(placeholder){
        const text = cleanTallyLabel(placeholder);
        if(text) return text;
    }

    return null;
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


export function fillTallyField(el: HTMLElement, value: string): boolean {
    if(!value) return false;

    if(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        const proto = el instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;
        
        const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
        if(descriptor?.set){
            descriptor.set.call(el, value);
        }else {
            el.value = value;
        }

        el.dispatchEvent(new Event('input', { bubbles: true}));
        el.dispatchEvent(new Event('charge', { bubbles: true}));
        el.dispatchEvent(new Event('blur', { bubbles: true}));
        return true;
    }

    if( el instanceof HTMLSelectElement) {
        const normalizedValue = value.trim().toLowerCase();
        let matched = false;

        for(const option of Array.from(el.options)) {
            const optValue = option.value.trim().toLowerCase();
            const optText = (option.textContent || '').trim().toLowerCase();
            if(optValue === normalizedValue || optText === normalizedValue) {
                const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
                if(descriptor?.set) {
                    descriptor.set.call(el, option.value);
                }
                el.dispatchEvent(new Event('input', { bubbles: true}));
                el.dispatchEvent(new Event('change', { bubbles: true}));
                matched = true;
                break;
            }
        }
        return matched;
    }

    const options = Array.from(el.querySelectorAll<HTMLElement>(
        'input[type="radio"], [role="radio"], [role="option"], label, [class*="option"], [class*="option"], [class*="Option"]'
    ));

    if( options.length > 0) {
        const normalizedValue = normalizeText(value);
        let bestOption: HTMLElement | null = null;
        let bestScore = 0;

        for( const opt of options) {
            const text = opt.textContent || '';
            const normText = normalizeText(text);

            if(normText === normalizedValue) {
                bestOption = opt;
                bestScore = 1.0;
                break;
            }
            const score = calculateSimilarity(normalizedValue, normText);
            if(score > bestScore && score >= 0.75){
                bestScore = score;
                bestOption = opt;
            }
        }

        if(bestOption) {
            if(bestOption instanceof HTMLInputElement && bestOption.type === 'radio'){
                bestOption.checked = true;
                bestOption.dispatchEvent(new Event('input', { bubbles: true}));
                bestOption.dispatchEvent(new Event('change', { bubbles: true}));
            } else {
                triggerTallyClick(bestOption);
            }
            return true;
        }
    }

    const comboboxTrigger = el.querySelector<HTMLElement>(
        '[role="combobox"], [class*="trigger"], [class*="Trigger"], button'
    );
    if(comboboxTrigger){
        triggerTallyClick(comboboxTrigger);

        const doc = el.ownerDocument || document;
        setTimeout(() => {
            const listboxOptions = Array.from(doc.querySelectorAll<HTMLElement>(
                '[role="option"], [role="listbox"] [class*="option"], [role="listbox"] [class*="Option"]'
            ));

            const normalizedValue = normalizeText(value);
            for(const opt of listboxOptions) {
                const normText = normalizeText(opt.textContent || '');
                if(normText === normalizedValue || calculateSimilarity(normalizedValue, normText) >= 0.8) {
                    triggerTallyClick(opt);
                    break;
                }
            }
        }, 100);
        return true;
    }

    return false;
}