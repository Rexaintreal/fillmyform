import {getProfiles } from '../lib/storage';
import { Profile } from '../lib/schema';


interface FillSummary {
    success: boolean;
    error?: 'NO_FIELDS';
    totalFields: number;
    matchedCount: number;
    filledCount: number;
}

const CONTENT_SCRIPT_PATH = 'content.js';

const profileSelect = document.getElementById('profileSelect') as HTMLSelectElement;

const fillButton= document.getElementById('fillButton') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLParagraphElement;
const legendEl = document.getElementById('legend') as HTMLDivElement;

let profiles: Profile[] = [];

function setStatus(message: string, kind: 'error' | 'ok' | 'none' = 'none') : void {
    statusEl.textContent = message;
    statusEl.className = kind === 'none' ? '' : kind;
}

async function loadProfiles(): Promise<void> {
    profiles = await getProfiles();
    profileSelect.innerHTML = '';

    if (profiles.length === 0) {
        profileSelect.innerHTML = '<option value="">No profiles yet</option>';
        profileSelect.disabled = true;
        fillButton.disabled = true;
        setStatus('Create a profile first - see Manage Profiles below.');
        return;
    }

    for (const profile of profiles) {
        const option = document.createElement('option');
        option.value = profile.profileId;
        option.textContent = profile.profileName; 
        profileSelect.appendChild(option);
    }
}

function sendFill(tabId: number, profile: Profile, isRetry = false): void {
  chrome.tabs.sendMessage(tabId, { action: 'FILL_FORM', profile }, async (summary: FillSummary | undefined) => {
    if ((chrome.runtime.lastError || !summary) && !isRetry) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: [CONTENT_SCRIPT_PATH],
        });
        sendFill(tabId, profile, true);
        return;
      } catch (err) {
        console.warn('Dynamic script injection failed:', err);
      }
    }

    fillButton.disabled = false;

    if (chrome.runtime.lastError || !summary) {
      setStatus('Cannot reach this page. Reload the tab and try again.', 'error');
      return;
    }

    if (!summary.success) {
      setStatus('No fillable fields found on this page.', 'error');
      return;
    }

    if (summary.filledCount === 0) {
      setStatus(
        `Found ${summary.totalFields} field(s) but none matched this profile. ` +
          `Add values or synonyms in Manage Profiles.`,
        'error',
      );
      return;
    }

    setStatus(`Filled ${summary.filledCount} of ${summary.totalFields} field(s). Review before submitting.`, 'ok');
    legendEl.style.display = 'block';
  });
}

fillButton.addEventListener('click', async () => {
    const profile = profiles.find(p => p.profileId === profileSelect.value);
    if(!profile) {
        setStatus('Select a profile first.', 'error');
        return;
    }

    const emptyProfile = profile.fields.every(f => !f.value && (!f.values || f.values.length === 0));
    if (emptyProfile) {
        setStatus(`"${profile.profileName}" has no value saved yet.`, 'error');
        return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
        setStatus('No active tab.', 'error');
        return;
    }

    fillButton.disabled = true;
    setStatus('Filling...');
    legendEl.style.display = 'none';
    sendFill(tab.id, profile);
});

document.getElementById('optionsLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
});

document.getElementById('testFormBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create( {url: chrome.runtime.getURL('test-form.html')});
});

loadProfiles();