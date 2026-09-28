import { ExtractedField } from '../lib/extractor';
import { normalizeText, calculateSimilarity } from '../lib/matcher';


export function isFillout(root: Document | Element = document): boolean {
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    if (hostname === 'fillout.com' || hostname.endsWith('.fillout.com') || hostname === 'forms.fillout.com') {
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

  for (const block of questionBlocks) {
    const label = extractFilloutQuestionLabel(block);
    if (!label) continue;

    const field = findFilloutInteractiveElement(block, label, seenElements);
    if (field) results.push(field);
  }

  if (results.length === 0) {
    const inputs = Array.from(root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select'
    ));

    for (const el of inputs) {
      if (seenElements.has(el)) continue;

      const label = extractLabelForFilloutInput(el);
      if (!label) continue;

      seenElements.add(el);
      const typeHint = el instanceof HTMLSelectElement ? 'select'
        : el instanceof HTMLTextAreaElement ? 'text'
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

  return results;
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
function findFilloutInteractiveElement(
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
  if (textarea && !seenElements.has(textarea)) {
    seenElements.add(textarea);
    return {
      element: textarea,
      label,
      confidence: 1,
      typeHint: 'text',
      adapter: 'fillout'
    };
  }

  const select = block.querySelector<HTMLSelectElement>('select');
  if (select && !seenElements.has(select)) {
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
  if (combobox && !seenElements.has(combobox)) {
    seenElements.add(combobox);
    return {
      element: combobox,
      label,
      confidence: 1,
      typeHint: 'select',
      adapter: 'fillout'
    };
  }

  const radioGroup = block.querySelector<HTMLElement>(
    '[role="radiogroup"], [class*="RadioGroup"], [class*="radio-group"]'
  );
  if (radioGroup && !seenElements.has(radioGroup)) {
    seenElements.add(radioGroup);
    return {
      element: radioGroup,
      label,
      confidence: 1,
      typeHint: 'radio',
      adapter: 'fillout'
    };
  }

  const radios = block.querySelectorAll<HTMLInputElement>('input[type="radio"]');
  if (radios.length > 0) {
    const container = radios[0].closest('[role="radiogroup"]') || block;
    if (!seenElements.has(container)) {
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
  if (checkboxGroup && checkboxGroup.querySelector('[role="checkbox"], input[type="checkbox"]') && !seenElements.has(checkboxGroup)) {
    seenElements.add(checkboxGroup);
    return {
      element: checkboxGroup,
      label,
      confidence: 1,
      typeHint: 'checkbox',
      adapter: 'fillout'
    };
  }

  return null;
}


function extractLabelForFilloutInput(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string | null {
  const doc = el.ownerDocument || document;


  if (el.id) {
    const labelEl = doc.querySelector(`label[for="${el.id}"]`);
    if (labelEl && labelEl.textContent) {
      const text = cleanFilloutLabel(labelEl.textContent);
      if (text) return text;
    }
  }


  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) {
    const text = cleanFilloutLabel(ariaLabel);
    if (text) return text;
  }

  const parentLabel = el.closest('label');
  if (parentLabel && parentLabel.textContent) {
    const text = cleanFilloutLabel(parentLabel.textContent);
    if (text) return text;
  }


  const prev = el.previousElementSibling;
  if (prev && prev.textContent) {
    const text = cleanFilloutLabel(prev.textContent);
    if (text.length > 0 && text.length < 80) return text;
  }

 
  const placeholder = el.getAttribute('placeholder');
  if (placeholder) {
    const text = cleanFilloutLabel(placeholder);
    if (text) return text;
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


export function fillFilloutField(el: HTMLElement, value: string): boolean {
  if (!value) return false;

 
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const proto = el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;

    const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
    if (descriptor?.set) {
      descriptor.set.call(el, value);
    } else {
      el.value = value;
    }

    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
    return true;
  }

 
  if (el instanceof HTMLSelectElement) {
    const normalizedValue = value.trim().toLowerCase();

    for (const option of Array.from(el.options)) {
      const optValue = option.value.trim().toLowerCase();
      const optText = (option.textContent || '').trim().toLowerCase();
      if (optValue === normalizedValue || optText === normalizedValue) {
        const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
        if (descriptor?.set) {
          descriptor.set.call(el, option.value);
        } else {
          el.value = option.value;
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }
    return false;
  }

  const options = Array.from(el.querySelectorAll<HTMLElement>(
    'input[type="radio"], [role="radio"], [role="option"], label, [class*="option"], [class*="Option"]'
  ));

  if (options.length > 0) {
    const normalizedValue = normalizeText(value);
    let bestOption: HTMLElement | null = null;
    let bestScore = 0;

    for (const opt of options) {
      const text =
        (opt instanceof HTMLInputElement && opt.value ? opt.value : '') ||
        opt.getAttribute('value') ||
        opt.textContent ||
        '';
      const normText = normalizeText(text);

      if (normText === normalizedValue) {
        bestOption = opt;
        bestScore = 1.0;
        break;
      }

      const score = calculateSimilarity(normalizedValue, normText);
      if (score > bestScore && score >= 0.75) {
        bestScore = score;
        bestOption = opt;
      }
    }

    if (bestOption) {
      if (bestOption instanceof HTMLInputElement && bestOption.type === 'radio') {
        const checkedDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked');
        if (checkedDescriptor?.set) {
          checkedDescriptor.set.call(bestOption, true);
        } else {
          bestOption.checked = true;
        }
        bestOption.dispatchEvent(new Event('input', { bubbles: true }));
        bestOption.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        triggerFilloutClick(bestOption);
      }
      return true;
    }
  }

  const comboboxTrigger = el.querySelector<HTMLElement>(
    '[role="combobox"], [class*="trigger"], [class*="Trigger"], button'
  );
  if (comboboxTrigger) {
    triggerFilloutClick(comboboxTrigger);

    const doc = el.ownerDocument || document;
    setTimeout(() => {
      const listboxOptions = Array.from(doc.querySelectorAll<HTMLElement>(
        '[role="option"], [role="listbox"] [class*="option"], [role="listbox"] [class*="Option"]'
      ));

      const normalizedValue = normalizeText(value);
      for (const opt of listboxOptions) {
        const normText = normalizeText(opt.textContent || '');
        if (normText === normalizedValue || calculateSimilarity(normalizedValue, normText) >= 0.8) {
          triggerFilloutClick(opt);
          break;
        }
      }
    }, 100);
    return true;
  }

  return false;
}