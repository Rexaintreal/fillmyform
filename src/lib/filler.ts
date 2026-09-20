export type Fillable =
  | HTMLInputElement
  | HTMLSelectElement
  | HTMLTextAreaElement
  | HTMLElement;
export type FillConfidence = "high" | "medium";

const UNFILLABLE_INPUT_TYPES = new Set([
  "checkbox",
  "radio",
  "file",
  "submit",
  "button",
  "image",
  "reset",
  "hidden",
]);

const HIGHLIGHT_COLORS: Record<FillConfidence, string> = {
  high: "#22c55e",
  medium: "#eab308",
};

const FILLED_ATTR = "data-fmf-filled";

function setNativeValue(el: Fillable, value: string): void {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : el instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;

  const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
  if (descriptor?.set) {
    descriptor.set.call(el, value);
  } else if ("value" in el) {
    (el as HTMLInputElement).value = value;
  }
}

const COUNTRY_STATE_MAP: Record<string, string[]> = {
  us: ["united states", "usa", "united states of america"],
  ca: ["canada", "california"],
  gb: ["united kingdom", "uk", "great britain"],
  in: ["india"],
  au: ["australia"],
  de: ["germany"],
  fr: ["france"],
  ny: ["new york"],
  tx: ["texas"],
  fl: ["florida"],
  wa: ["washington"],
  il: ["illinois"],
};
function resolveSelectValue(
  el: HTMLSelectElement,
  value: string,
): string | null {
  const wanted = value.trim().toLowerCase();

  for (const option of Array.from(el.options)) {
    if (option.value.trim().toLowerCase() === wanted) return option.value;
  }

  for (const option of Array.from(el.options)) {
    if ((option.textContent ?? "").trim().toLowerCase() === wanted)
      return option.value;
  }

  for (const option of Array.from(el.options)) {
    const optVal = option.value.trim().toLowerCase();
    const optText = (option.textContent ?? "").trim().toLowerCase();

    const aliases = COUNTRY_STATE_MAP[wanted] || [];
    if (aliases.includes(optVal) || aliases.includes(optText)) {
      return option.value;
    }

    const optAliases = COUNTRY_STATE_MAP[optVal] || [];
    if (optAliases.includes(wanted)) {
      return option.value;
    }
  }

  return null;
}
export function fillField(el: Fillable, value: string): boolean {
  if (!value) return false;
  if ("disabled" in el && (el as HTMLInputElement).disabled) return false;
  if ("readOnly" in el && (el as HTMLInputElement).readOnly) return false;

  if (el instanceof HTMLInputElement && UNFILLABLE_INPUT_TYPES.has(el.type)) {
    return false;
  }

  let toWrite = value;
  if (el instanceof HTMLSelectElement) {
    const resolved = resolveSelectValue(el, value);
    if (resolved === null) return false;
    toWrite = resolved;
  }

  setNativeValue(el, toWrite);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

export function highlightField(el: Fillable, confidence: FillConfidence): void {
  el.style.outline = `2px solid ${HIGHLIGHT_COLORS[confidence]}`;
  el.style.outlineOffset = "1px";
  el.setAttribute(FILLED_ATTR, confidence);
}

const PICKER_CLASS = "fmf-multi-picker";
export function attachValuePicker(el: Fillable, values: string[]): void {
  if (values.length <= 1) return;

  const doc = el.ownerDocument || document;
  const pickerWrapper = doc.createElement("div");
  pickerWrapper.className = PICKER_CLASS;
  pickerWrapper.style.cssText = `
    display: inline-flex;
    align-items: center;
    position: relative;
    margin-left: 6px;
    font-family: system-ui, sans-serif;
    font-size: 11px;
    vertical-align: middle;
    z-index: 99999;
  `;

  const trigger = doc.createElement("button");
  trigger.type = "button";
  trigger.textContent = `▾ Switch (${values.length})`;
  trigger.style.cssText = `
    background: #eab308;
    color: #1c1917;
    border: none;
    border-radius: 4px;
    padding: 2px 6px;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    line-height: 1.3;
  `;

  const menu = doc.createElement("div");
  menu.style.cssText = `
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 2px;
    background: #ffffff;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    min-width: 140px;
    max-width: 260px;
    padding: 4px 0;
    z-index: 100000;
  `;

  for (const val of values) {
    const item = doc.createElement("div");
    item.textContent = val;
    item.style.cssText = `
      padding: 4px 8px;
      cursor: pointer;
      color: #374151;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    `;
    item.addEventListener("mouseenter", () => {
      item.style.background = "#f3f4f6";
    });
    item.addEventListener("mouseleave", () => {
      item.style.background = "#ffffff";
    });
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      fillField(el, val);
      highlightField(el, "medium");
      menu.style.display = "none";
    });
    menu.appendChild(item);
  }

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.style.display = menu.style.display === "none" ? "block" : "none";
  });

  doc.addEventListener("click", () => {
    menu.style.display = "none";
  });

  pickerWrapper.appendChild(trigger);
  pickerWrapper.appendChild(menu);

  if (el.nextSibling) {
    el.parentNode?.insertBefore(pickerWrapper, el.nextSibling);
  } else {
    el.parentNode?.appendChild(pickerWrapper);
  }
}

export function clearHighlights(root: Document | Element = document): void {
  root.querySelectorAll<Fillable>(`[${FILLED_ATTR}]`).forEach((el) => {
    el.style.outline = "";
    el.style.outlineOffset = "";
    el.removeAttribute(FILLED_ATTR);
  });

  root.querySelectorAll(`.${PICKER_CLASS}`).forEach((el) => el.remove());
}
