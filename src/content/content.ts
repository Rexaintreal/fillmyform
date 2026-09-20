import { extractFields} from '../lib/extractor';
import { matchField } from '../lib/matcher';
import { fillField, highlightField, clearHighlights, attachValuePicker } from '../lib/filler';
import { Profile, getFieldValues} from '../lib/schema';

export interface FillSummary{
    success: boolean;
    error?: 'NO_FIELDS';
    totalFields: number;
    matchedCount: number;
    filledCount: number;
}

function fillForm(profile: Profile): FillSummary{
    const fields = extractFields();
    if(fields.length === 0){
        return { success: false, error: 'NO_FIELDS', totalFields: 0, matchedCount: 0, filledCount: 0};
    }

    clearHighlights();

    const fieldById = new Map(profile.fields.map(f=>[f.fieldId, f]));
    let matchedCount = 0;
    let filledCount = 0;

    for(const field of fields){
        try{
            const typeHint = field.typeHint
                ?? field.element.getAttribute('type')
                ?? field.element.getAttribute('autocomplete')
                ?? '';

            const match = matchField(field.label, typeHint, profile, field.autocomplete);
            if(!match) continue;

            const profileField = fieldById.get(match.fieldId);
            if(!profileField) continue;

            const values = getFieldValues(profileField);
            if (values.length === 0) continue;

            const primaryValue = values[0];

            matchedCount++;
            let filled: boolean;
            switch(field.adapter){
                case 'google_forms':
                    //next version
                    break;
                case 'tally':
                    //next version
                    break;
                case 'fillout':
                    //next version
                    break;
                default:
                    filled = fillField(field.element, primaryValue);
            }

            if(filled){
                const confidence = values.length > 1? 'medium' : match.confidence;
                highlightField(field.element, confidence);
                if(values.length > 1 && !(field.element.getAttribute('role') === 'radiogroup')){
                    attachValuePicker(field.element, values);
                }
                filledCount++;
            }
        }   catch(err){
            console.warn('Fill My Form: skipped a field that threw during fill.', field.element, err);
        }
    }

    return { success: true, totalFields: fields.length, matchedCount, filledCount };
}
