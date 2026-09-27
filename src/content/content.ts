import { extractFields } from "../lib/extractor";
import { matchField } from "../lib/matcher";
import {
  fillField,
  highlightField,
  clearHighlights,
  attachValuePicker,
} from "../lib/filler";
import { Profile, getFieldValues } from "../lib/schema";
import { fillGoogleFormField } from "../adapters/googleForms";

export interface FillSummary {
  success: boolean;
  error?: "NO_FIELDS";
  totalFields: number;
  matchedCount: number;
  reviewCount: number;
  filledCount: number;
  unmatchedCount: number;
}

function fillForm(profile: Profile): FillSummary {
  const fields = extractFields();
  if (fields.length === 0) {
    return {
      success: false,
      error: "NO_FIELDS",
      totalFields: 0,
      matchedCount: 0,
      filledCount: 0,
      reviewCount: 0,
      unmatchedCount: 0,
    };
  }

  clearHighlights();

  const fieldById = new Map(profile.fields.map((f) => [f.fieldId, f]));
  let matchedCount = 0;
  let filledCount = 0;
  let reviewCount = 0;

  for (const field of fields) {
    try {
      const typeHint =
        field.typeHint ??
        field.element.getAttribute("type") ??
        field.element.getAttribute("autocomplete") ??
        "";

      const match = matchField(
        field.label,
        typeHint,
        profile,
        field.autocomplete,
      );
      if (!match) continue;

      const profileField = fieldById.get(match.fieldId);
      if (!profileField) continue;

      const values = getFieldValues(profileField);
      if (values.length === 0) continue;

      const primaryValue = values[0];

      matchedCount++;
      const filled = false
      
      if(field.adapter === 'google_forms'){
        filled = fillGoogleFormField(field.element as HTMLElement, primaryValue);       
      } else{
        filled = fillField(field.element, primaryValue);
      }

      if (filled) {
        const isReview = values.length > 1 || match.confidence === "medium";
        const confidence = isReview ? "medium" : "high";
        highlightField(field.element, confidence);
        if (isReview){
          reviewCount++;  
        } 
        if(
          values.length > 1 && 
          !(field.element.getAttribute("role") === "radiogroup") &&
          !(field.element.getAttribute("role") === "group")
        ){
          attachValuePicker(field.element, values);
        }
        filledCount++;
      }
    } catch (err) {
      console.warn(
        "Fill My Form: skipped a field that threw during fill.",
        field.element,
        err,
      );
    }
  }

  return {
    success: true,
    totalFields: fields.length,
    matchedCount,
    filledCount,
    reviewCount,
    unmatchedCount: fields.length - filledCount,
  };
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === "SCAN_FIELDS") {
    const fields = extractFields();
    sendResponse({ count: fields.length });
    return;
  }

  if (request.action === "FILL_FORM") {
    const summary = fillForm(request.profile as Profile);
    sendResponse(summary);
    return;
  }
});
