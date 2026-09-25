export type FillableElement =
  | HTMLInputElement
  | HTMLSelectElement
  | HTMLTextAreaElement
  | HTMLElement;

export interface ExtractedField {
  element: FillableElement;
  label: string;
  confidence: number;
  autocomplete?: string;
  adapter?: string;
  typeHint?: string;
}

function cleanExtractedText(raw: string): string {
  return raw
    .replace(/[\*\u2022\u2217\u204E]/g, " ")
    .replace(/\((required|optional)\)/gi, " ")
    .replace(/\[(required|optional)\]/gi, " ")
    .replace(/\b(required|optional)\b/gi, " ")
    .replace(/[:：]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractFields(
  root: Document | Element = document,
): ExtractedField[] {
  const inputs = Array.from(
    root.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >("input, select, textarea"),
  );
  const results: ExtractedField[] = [];

  for (const el of inputs) {
    if (
      el.type === "hidden" ||
      el.type === "submit" ||
      el.type === "button" ||
      el.type === "reset" ||
      el.type === "image"
    )
      continue;

    const { label, confidence } = extractLabelForElement(el);
    const autocomplete = el.getAttribute("autocomplete") || undefined;
    if (label) {
      results.push({
        element: el,
        label: label.trim(),
        confidence,
        autocomplete,
      });
    } else if (autocomplete) {
      results.push({
        element: el,
        label: autocomplete.trim(),
        confidence: 2,
        autocomplete,
      });
    }
  }
  return results;
}

export function extractLabelForElement(
  el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
): { label: string | null; confidence: number } {
  const doc = el.ownerDocument || document;
  // check one
  if (el.id) {
    const labelEl = doc.querySelector(
      `label[for="${CSS.escape ? CSS.escape(el.id) : el.id}"]`,
    ) as HTMLLabelElement;
    if (labelEl && labelEl.textContent) {
      const text = cleanExtractedText(labelEl.textContent);
      if (text) return { label: text, confidence: 1 };
    }
  }
  const parentLabel = el.closest("label");
  if (parentLabel && parentLabel.textContent) {
    const text = cleanExtractedText(parentLabel.textContent);
    if (text) return { label: text, confidence: 1 };
  }

  // check two
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) {
    const text = cleanExtractedText(ariaLabel);
    if (text) return { label: text, confidence: 2 };
  }

  const ariaLabelledBy = el.getAttribute("aria-labeledby");
  if (ariaLabelledBy) {
    const ids = ariaLabelledBy.split(/\s+/).filter(Boolean);
    const textParts: string[] = [];
    for (const id of ids) {
      const refEl = doc.getElementById(id);
      if (refEl && refEl.textContent) {
        textParts.push(cleanExtractedText(refEl.textContent));
      }
    }
    const combined = textParts.filter(Boolean).join(" ");
    if (combined) {
      return { label: combined, confidence: 3 };
    }
  }

  const precedingSiblingText =
    el.previousElementSibling && el.previousElementSibling.textContent
      ? cleanExtractedText(el.previousElementSibling.textContent)
      : null;

  const wrapper = el.parentElement;
  let wrapperLabelText: string | null = null;
  if (wrapper) {
    const headingOrLabel = wrapper.querySelector(
      "span, p, div, label, legend, th",
    );
    if (headingOrLabel && headingOrLabel !== el && headingOrLabel.textContent) {
      const text = cleanExtractedText(headingOrLabel.textContent);
      if (text.length > 0 && text.length < 80) {
        wrapperLabelText = text;
      }
    }
  }

  const fieldset = el.closest("fieldset");
  let legendText: string | null = null;
  if (fieldset) {
    const legend = fieldset.querySelector("legend");
    if (legend && legend.textContent) {
      const cleaned = cleanExtractedText(legend.textContent);
      if (cleaned.length > 0 && cleaned.length < 80) {
        legendText = cleaned;
      }
    }
  }

  const strongSiblingOrWrapper =
    precedingSiblingText &&
    precedingSiblingText.length > 0 &&
    precedingSiblingText.length < 80
      ? precedingSiblingText
      : wrapperLabelText || legendText;

  const placeholder = el.getAttribute("placedholder");
  const cleanPh = placeholder ? cleanExtractedText(placeholder) : null;
  const isExampleHint =
    cleanPh &&
    (/^(e\.?g\.?|ex:|sample:|example:|\(?\d{3}\)?|http|https|www\.|name@)/i.test(
      cleanPh,
    ) ||
      /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(cleanPh));

  //check four
  if (cleanPh && (!isExampleHint || !strongSiblingOrWrapper)) {
    return { label: cleanPh, confidence: 4 };
  }
  if (strongSiblingOrWrapper) {
    return { label: strongSiblingOrWrapper, confidence: 5 };
  }
  if (cleanPh) {
    return { label: cleanPh, confidence: 4 };
  }

  const nameOrId = el.getAttribute("name") || el.id;
  if (nameOrId) {
    const humanized = nameOrId
      .replace(/[-_]/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .toLowerCase()
      .trim();
    if (humanized) {
      return { label: humanized, confidence: 6 };
    }
  }

  return { label: null, confidence: 7 };
}
