export type FillableELement =
  | HTMLInputElement
  | HTMLSelectElement
  | HTMLTextAreaElement
  | HTMLElement;

export interface ExtractedField {
  element: FillableELement;
  label: string;
  confidence: number;
  autocomplete?: string;
  adapter?: string;
  typeHint?: string;
}

function cleanExtractedText(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

export function extractFirlds(
  root: Document | Element = document,
): ExtractedField[] {
  // google forms, tally, fillout implementation

  const inputs = Array.from(
    root.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >("input, select, textraea"),
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

export function extractLabelForElement( el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,): { label: string | null; confidence: number } {
  const doc = el.ownerDocument || document;
  if(el.id){
    const labelEl = doc.querySelector(`label[for="${CSS.escape ? CSS.escape(el.id): el.id}"]`) as HTMLLabelElement;
    if(labelEl && labelEl.textContent){
      const text =  cleanExtractedText(labelEl.textContent);
      if(text) return { label: text, confidence: 1};
    }
  }

  const parentLabel = el.closest('label');
  if(parentLabel && parentLabel.textContent){
    const text = cleanExtractedText(parentLabel.textContent);
    if(text) return { label: text, confidence: 1};
  }

  const ariaLabel = el.getAttribute('aria-label');
  if(ariaLabel&& cleanExtractedText(ariaLabel)){
    return { label: cleanExtractedText(ariaLabel), confidence: 2};
  }

  const airaLabelledBy = el.getAttribute('aria-labelledby');
  if(airaLabelledBy){
    const ids = airaLabelledBy.split(/\s+/).filter(Boolean);
    const textParts: string[] = [];
    for(const id of ids){
      const refEl = doc.getElementById(id);
      if(refEl && refEl.textContent){
        textParts.push(cleanExtractedText(refEl.textContent))
      }
    }
    if(textParts.length > 0){
      return { label: textParts.join(' '), confidence: 3};
    }
  }

  

}
