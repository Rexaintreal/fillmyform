import type { ExtractedField } from '../lib/extractor';

const QUESTION_SELECTOR =
    '[data-question-id], [class*="question"], [class*="Question"], ' +
    '[class*="FormField"], [class*="form-field"], ' +
    '[data-field-id], [class*="fillout-question"]';

const TEXT_INPUT_SELECTOR =
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"])' +
    ':not([type="radio"]):not([type="checkbox"]):not([type="file"])';

const COMBOBOX_SELECTOR =
    '[role="combobox"], [role="listbox"], [class*="dropdown"], [class*="Dropdown"]';

function normalize(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function makeField(element: HTMLElement, label: string, typeHint: string): ExtractedField {
    return {
        element,
        label,
        confidence: 1,
        typeHint,
        adapter: 'fillout',
    };
}

export function isFillout(root: Document | Element = document): boolean {
    if (typeof window !== 'undefined' && window.location) {
        const hostname = window.location.hostname;
        if (
            hostname === 'fillout.com' ||
            hostname.endsWith('.fillout.com') ||
            hostname === 'forms.fillout.com'
        ) {
            return true;
        }
    }
    return !!(
        root.querySelector('[data-fillout-id]') ||
        root.querySelector('[data-form-id]') ||
        root.querySelector('div.fillout-form') ||
        root.querySelector('[class*="fillout"]') ||
        root.querySelector('form[data-fillout]')
    );
}

function cleanFilloutLabel(raw: string): string {
    return raw.replace(/\*+/g, '').replace(/\s+/g, ' ').trim();
}

function extractFilloutQuestionLabel(block: Element): string | null {
    const labelEl = block.querySelector(
        'label, [class*="Label"], [class*="label"], ' +
        '[class*="Title"], [class*="title"], ' +
        '[class*="Heading"], [class*="heading"], ' +
        'h2, h3, h4, p[class*="question"]'
    );
    if (labelEl && labelEl.textContent) {
        const text = cleanFilloutLabel(labelEl.textContent);
        if (text.length > 0 && text.length < 100) return text;
    }

    for (const child of Array.from(block.children)) {
        if (child.querySelector('input, textarea, select')) continue;
        const text = cleanFilloutLabel(child.textContent || '');
        if (text.length > 1 && text.length < 100) return text;
    }

    return null;
}

function extractLabelForFilloutInput(el: HTMLElement): string | null {
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim()) return cleanFilloutLabel(ariaLabel);

    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
        const text = labelledBy
            .split(/\s+/)
            .map((id) => document.getElementById(id)?.textContent || '')
            .join(' ');
        if (text.trim()) return cleanFilloutLabel(text);
    }

    if (el.id) {
        const linked = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (linked && linked.textContent && linked.textContent.trim()) {
            return cleanFilloutLabel(linked.textContent);
        }
    }

    const wrapping = el.closest('label');
    if (wrapping && wrapping.textContent && wrapping.textContent.trim()) {
        return cleanFilloutLabel(wrapping.textContent);
    }

    const placeholder = el.getAttribute('placeholder');
    if (placeholder && placeholder.trim()) return cleanFilloutLabel(placeholder);

    const name = el.getAttribute('name');
    if (name && name.trim()) return cleanFilloutLabel(name);

    return null;
}

function findFilloutInteractiveElement(
    block: Element,
    label: string,
    seen: Set<Element>
): ExtractedField | null {
    const select = block.querySelector<HTMLSelectElement>('select');
    if (select && !seen.has(select)) {
        seen.add(select);
        return makeField(select, label, 'select');
    }

    const textarea = block.querySelector<HTMLTextAreaElement>('textarea');
    if (textarea && !seen.has(textarea)) {
        seen.add(textarea);
        return makeField(textarea, label, 'text');
    }

    const radios = block.querySelectorAll<HTMLElement>('input[type="radio"], [role="radio"]');
    if (radios.length > 0) {
        const container =
            (radios[0].closest('[role="radiogroup"]') as HTMLElement | null) ||
            (block as HTMLElement);
        if (!seen.has(container)) {
            seen.add(container);
            radios.forEach((r) => seen.add(r));
            return makeField(container, label, 'radio');
        }
    }

    const checkboxes = block.querySelectorAll<HTMLElement>(
        'input[type="checkbox"], [role="checkbox"]'
    );
    if (checkboxes.length > 0) {
        const container =
            (checkboxes[0].closest('[role="group"]') as HTMLElement | null) ||
            (block as HTMLElement);
        if (!seen.has(container)) {
            seen.add(container);
            checkboxes.forEach((c) => seen.add(c));
            return makeField(container, label, 'checkbox');
        }
    }

    const combobox = block.querySelector<HTMLElement>(COMBOBOX_SELECTOR);
    if (combobox && !seen.has(combobox)) {
        seen.add(combobox);
        return makeField(combobox, label, 'select');
    }

    const input = block.querySelector<HTMLInputElement>(TEXT_INPUT_SELECTOR);
    if (input && !seen.has(input)) {
        seen.add(input);
        return makeField(input, label, input.getAttribute('type') || 'text');
    }

    return null;
}

export function extractFilloutFields(root: Document | Element = document): ExtractedField[] {
    const results: ExtractedField[] = [];
    const seen = new Set<Element>();

    const blocks = Array.from(root.querySelectorAll(QUESTION_SELECTOR));

    for (const block of blocks) {
        if (block.querySelector(QUESTION_SELECTOR)) continue;

        const label = extractFilloutQuestionLabel(block);
        if (!label) continue;

        const field = findFilloutInteractiveElement(block, label, seen);
        if (field) results.push(field);
    }

    const looseInputs = Array.from(
        root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
            `${TEXT_INPUT_SELECTOR}, textarea, select`
        )
    );

    for (const el of looseInputs) {
        if (seen.has(el)) continue;
        const label = extractLabelForFilloutInput(el);
        if (!label) continue;

        seen.add(el);
        const typeHint =
            el instanceof HTMLSelectElement
                ? 'select'
                : el instanceof HTMLTextAreaElement
                ? 'text'
                : el.getAttribute('type') || 'text';

        results.push(makeField(el, label, typeHint));
    }

    return results;
}

function triggerFilloutClick(target: HTMLElement): void {
    const events = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
    for (const eventType of events) {
        target.dispatchEvent(
            new MouseEvent(eventType, {
                bubbles: true,
                cancelable: true,
                view: target.ownerDocument.defaultView || window,
            })
        );
    }
}

function setNativeValue(
    element: HTMLInputElement | HTMLTextAreaElement,
    value: string
): boolean {
    const proto =
        element instanceof HTMLInputElement
            ? HTMLInputElement.prototype
            : HTMLTextAreaElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (!setter) return false;

    element.focus();
    setter.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.blur();
    return element.value.trim() !== '';
}

function labelMatches(optionLabel: string, value: string): boolean {
    const a = normalize(optionLabel);
    const b = normalize(value);
    if (!a || !b) return false;
    return a === b;
}

function labelLooselyMatches(optionLabel: string, value: string): boolean {
    const a = normalize(optionLabel);
    const b = normalize(value);
    if (!a || !b) return false;
    return a.includes(b) || b.includes(a);
}

function fillNativeSelect(element: HTMLSelectElement, value: string): boolean {
    const options = Array.from(element.options);
    const option =
        options.find((o) => labelMatches(o.value, value) || labelMatches(o.text, value)) ||
        options.find(
            (o) =>
                o.value !== '' &&
                (labelLooselyMatches(o.value, value) || labelLooselyMatches(o.text, value))
        );
    if (!option) return false;

    element.value = option.value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
}

function getChoiceLabel(el: HTMLElement): string {
    const aria = el.getAttribute('aria-label');
    if (aria && aria.trim()) return aria;

    if (el instanceof HTMLInputElement) {
        if (el.id) {
            const linked = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
            if (linked && linked.textContent) return linked.textContent;
        }
        const wrapping = el.closest('label');
        if (wrapping && wrapping.textContent) return wrapping.textContent;
        const parentText = el.parentElement?.textContent;
        if (parentText) return parentText;
    }

    return el.textContent || '';
}

function isChoiceChecked(el: HTMLElement): boolean {
    if (el instanceof HTMLInputElement) return el.checked;
    return el.getAttribute('aria-checked') === 'true';
}

function clickChoice(el: HTMLElement): void {
    if (el instanceof HTMLInputElement) {
        el.click();
    } else {
        triggerFilloutClick(el);
    }
}

function fillRadioGroup(container: HTMLElement, value: string): boolean {
    const choices = Array.from(
        container.querySelectorAll<HTMLElement>('input[type="radio"], [role="radio"]')
    );
    if (choices.length === 0) return false;

    const target =
        choices.find((c) => labelMatches(getChoiceLabel(c), value)) ||
        choices.find((c) => labelLooselyMatches(getChoiceLabel(c), value));
    if (!target) return false;

    if (!isChoiceChecked(target)) clickChoice(target);
    return true;
}

function fillCheckboxGroup(container: HTMLElement, value: string): boolean {
    const choices = Array.from(
        container.querySelectorAll<HTMLElement>('input[type="checkbox"], [role="checkbox"]')
    );
    if (choices.length === 0) return false;

    const wanted = value.split(/[,;]/).map((v) => v.trim()).filter(Boolean);
    let matchedAny = false;

    for (const want of wanted) {
        const target =
            choices.find((c) => labelMatches(getChoiceLabel(c), want)) ||
            choices.find((c) => labelLooselyMatches(getChoiceLabel(c), want));
        if (!target) continue;

        matchedAny = true;
        if (!isChoiceChecked(target)) clickChoice(target);
    }

    return matchedAny;
}

function selectListboxOption(value: string): boolean {
    const options = Array.from(
        document.querySelectorAll<HTMLElement>('[role="option"], [role="listbox"] li')
    );
    const target =
        options.find((o) => labelMatches(o.textContent || '', value)) ||
        options.find((o) => labelLooselyMatches(o.textContent || '', value));
    if (!target) return false;

    triggerFilloutClick(target);
    return true;
}

function fillCombobox(element: HTMLElement, value: string): boolean {
    if (element instanceof HTMLInputElement) {
        setNativeValue(element, value);
    } else {
        triggerFilloutClick(element);
    }

    if (selectListboxOption(value)) return true;

    setTimeout(() => {
        selectListboxOption(value);
    }, 250);

    return false;
}

export function fillFilloutField(element: HTMLElement, value: string): boolean {
    const trimmed = value.trim();
    if (!trimmed) return false;

    if (element instanceof HTMLSelectElement) {
        return fillNativeSelect(element, trimmed);
    }

    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        if (element.getAttribute('role') === 'combobox') {
            return fillCombobox(element, trimmed);
        }
        return setNativeValue(element, trimmed);
    }

    if (
        element.getAttribute('role') === 'radiogroup' ||
        element.querySelector('input[type="radio"], [role="radio"]')
    ) {
        return fillRadioGroup(element, trimmed);
    }

    if (element.querySelector('input[type="checkbox"], [role="checkbox"]')) {
        return fillCheckboxGroup(element, trimmed);
    }

    return fillCombobox(element, trimmed);
}