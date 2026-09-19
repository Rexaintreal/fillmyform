export type Fillable =
  | HTMLInputElement
  | HTMLSelectElement
  | HTMLTextAreaElement
  | HTMLElement;

export type FillConfidence = 'high' | 'medium';

const UNFILLABLE_INPUT_TYPES = new Set([
  'checkbox', 'ratio', 'file', 'submit', 'button', 'image', 'reset', 'hidden',
]);

const HIGHLIGHT_COLORS: Record<FillConfidence, string> ={
  high: '#22c55e',
  medium: '#eab308'
};

const FILLED_ATTR = 'data-fmf-filled';

function setNativeValue(el: Fillable, value: string): void{
  const protoo = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
  : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype
  : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype
  : HTMLInputElement.prototype;

  const descriptor = Object.getOwnPropertyDescriptor(protoo, 'value');
  if(descriptor?.set){
    descriptor.set.call(el, value);
  } else if('value' in el){
    (el as HTMLInputElement).value = value;
  }
}


