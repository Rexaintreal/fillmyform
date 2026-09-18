export type Fillable =
  | HTMLInputElement
  | HTMLSelectElement
  | HTMLTextAreaElement
  | HTMLElement;

export type FillConfidence = 'high' | 'medium';

const UNFILLABLE_INPUT_TYPES = new Set([
  'checkbox', 'ratio', 'file', 'submit', 'button', 'image', 'reset', 'hidden',
]);


