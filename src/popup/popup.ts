import { getProfiles } from '../lib/storage';
import type { Profile } from '../lib/schema';

interface FillSummary {
  success: boolean;
  error?: 'NO_FIELDS';
  totalFields: number;
  matchedCount: number;
  filledCount: number;
  reviewCount: number;
  unmatchedCount: number;
}

const onboardingCardEl = document.getElementById('onboardingCard')! as HTMLDivElement;
const onboardingCreateBtn = document.getElementById('onboardingCreateBtn')! as HTMLButtonElement;
const mainFormSectionEl = document.getElementById('mainFormSection')! as HTMLDivElement;
const profileSelectEl = document.getElementById('profileSelect')! as HTMLSelectElement;
const fillButtonEl = document.getElementById('fillButton')! as HTMLButtonElement;
const resultSectionEl = document.getElementById('resultSection')! as HTMLDivElement;
const statusBarEl = document.getElementById('statusBar')! as HTMLDivElement;
const statusIconEl = document.getElementById('statusIcon')! as HTMLSpanElement;
const statusTextEl = document.getElementById('statusText')! as HTMLSpanElement;
const statusActionWrapEl = document.getElementById('statusActionWrap')! as HTMLDivElement;
const statusActionBtnEl = document.getElementById('statusActionBtn')! as HTMLButtonElement;
const resultStatsEl = document.getElementById('resultStats')! as HTMLDivElement;
const statFilledEl = document.getElementById('statFilled')! as HTMLDivElement;
const statReviewEl = document.getElementById('statReview')! as HTMLDivElement;
const statSkippedEl = document.getElementById('statSkipped')! as HTMLDivElement;
const legendRowEl = document.getElementById('legendRow')! as HTMLDivElement;
const profileMiniFillEl = document.getElementById('profileMiniFill')! as HTMLDivElement;
const profileMiniLabelEl = document.getElementById('profileMiniLabel')! as HTMLDivElement;
const pageDotEl = document.getElementById('pageDot')! as HTMLDivElement;
const platformBadgeEl = document.getElementById('platformBadge')! as HTMLDivElement;
const platformLabelEl = document.getElementById('platformLabel')! as HTMLSpanElement;

const CONTENT_SCRIPT_PATH = 'content.js';

let profiles: Profile[] = [];
let currentPlatform: PlatformInfo = { 
  label: 'Detecting page…', 
  supported: false 
};

type StatusKind = 'success' | 'error' | 'warning' | 'loading' | 'none';

interface StatusAction {
  label: string;
  icon?: string; 
  onClick: () => void;
}

const STATUS_ICONS: Record<StatusKind, string> = {
  success: '<i class="fa-solid fa-check"></i>',
  error:   '<i class="fa-solid fa-circle-exclamation"></i>',
  warning: '<i class="fa-solid fa-triangle-exclamation"></i>',
  loading: '<i class="fa-solid fa-spinner fa-spin"></i>',
  none:    '',
};

function setStatus(
  message: string,
  kind: StatusKind = 'none',
  showResult = false,
  action?: StatusAction,
) {
  resultSectionEl.classList.add('visible');
  statusBarEl.className = `status-bar ${kind === 'none' ? '' : kind}`;
  statusIconEl.innerHTML = STATUS_ICONS[kind] || '';
  statusTextEl.textContent = message;

  if (action) {
    statusActionBtnEl.innerHTML = action.icon
      ? `<i class="fa-solid ${action.icon}"></i> ${action.label}`
      : action.label;
    statusActionBtnEl.onclick = (e) => {
      e.stopPropagation();
      action.onClick();
    };
    statusActionWrapEl.style.display = 'block';
  } else {
    statusActionWrapEl.style.display = 'none';
  }

  if (!showResult) {
    resultStatsEl.style.display = 'none';
    legendRowEl.style.display = 'none';
  }
}

function clearStatus() {
  resultSectionEl.classList.remove('visible');
  resultStatsEl.style.display = 'none';
  legendRowEl.style.display = 'none';
  statusActionWrapEl.style.display = 'none';
}

function setFillLoading(loading: boolean) {
  if (loading) {
    fillButtonEl.classList.add('loading');
    fillButtonEl.disabled = true;
  } else {
    fillButtonEl.classList.remove('loading');
    fillButtonEl.disabled = false;
  }
}

function updateProfileMiniBar(profile: Profile | null) {
  if (!profile) {
    profileMiniFillEl.style.width = '0%';
    profileMiniLabelEl.textContent = '—';
    profileMiniLabelEl.className = 'profile-mini-label';
    return;
  }
  const total = profile.fields.length;
  const filled = profile.fields.filter(f => (f.value || '').trim()).length;
  const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
  profileMiniFillEl.style.width = pct + '%';

  if (filled === 0) {
    profileMiniLabelEl.textContent = 'Profile is empty — add values in Manage Profile';
    profileMiniLabelEl.className = 'profile-mini-label';
  } else if (pct === 100) {
    profileMiniLabelEl.textContent = `All ${total} fields filled`;
    profileMiniLabelEl.className = 'profile-mini-label ready';
  } else {
    profileMiniLabelEl.textContent = `${filled} of ${total} fields filled`;
    profileMiniLabelEl.className = 'profile-mini-label';
  }
}

interface PlatformInfo {
  label: string;
  supported: boolean;
  isBrowserPage?: boolean;
}

function detectPlatform(url: string): PlatformInfo {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const protocol = parsed.protocol;

    if (protocol === 'chrome-extension:' && url.includes('test-form.html')) {
      return { 
        label: 'Test Playground', 
        supported: true 
      };
    }
    if (protocol === 'chrome:' || protocol === 'chrome-extension:' || protocol === 'about:' || protocol === 'edge:') {
      return { 
        label: 'Browser page — not fillable', 
        supported: false, 
        isBrowserPage: true 
      };
    }
    if (host.includes('docs.google.com') && url.includes('/forms/')) {
      return { 
        label: 'Google Forms', 
        supported: true 
      };
    }
    if (host.includes('tally.so')) {
      return { 
        label: 'Tally', 
        supported: true 
      };
    }
    if (host.includes('fillout.com') || host.includes('forms.fillout.com')) {
      return { 
        label: 'Fillout', 
        supported: true 
      };
    }
    return { 
      label: 'HTML form page', 
      supported: true 
    };
  } catch {
    return { 
      label: 'Unknown page', 
      supported: false 
    };
  }
}

async function detectAndShowPlatform() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.url) {
      currentPlatform = { label: 'No active tab', supported: false };
      showPlatformBadge(currentPlatform);
      pageDotEl.className = 'page-dot inactive';
      return tab ?? null;
    }
    currentPlatform = detectPlatform(tab.url);
    showPlatformBadge(currentPlatform);
    pageDotEl.className = currentPlatform.supported ? 'page-dot' : 'page-dot inactive';

    if (!currentPlatform.supported) {
      fillButtonEl.disabled = true;
      if (currentPlatform.isBrowserPage) {
        setStatus(
          'Browser system pages cannot be auto-filled',
          'warning',
          false,
          {
            label: 'Open Test Form',
            icon: 'fa-arrow-up-right-from-square',
            onClick: () => chrome.tabs.create({ url: chrome.runtime.getURL('test-form.html') }),
          }
        );
      } else {
        setStatus(
          'This page is not supported for form filling.',
          'warning',
          false,
          {
            label: 'Open Test Form',
            icon: 'fa-arrow-up-right-from-square',
            onClick: () => chrome.tabs.create({url: chrome.runtime.getURL('test-form.html')}),
          }
        );
      }
    }
    return tab;
  } catch {
    currentPlatform = {label: 'Error detecting page', supported: false};
    showPlatformBadge(currentPlatform);
    return null;
  }
}

function showPlatformBadge({ label, supported }: PlatformInfo) {
  platformLabelEl.textContent = label;
  platformBadgeEl.className = 'platform-badge' + (supported ? ' supported': ' unsupported ');
}

async function loadProfiles(): Promise<void> {
  profiles = await getProfiles();
  profileSelectEl.innerHTML = '';

  if(profiles.length == 0 ) {
    onboardingCardEl.style.display = 'block';
    mainFormSectionEl.style.display = 'none';
    clearStatus();
    return;
  }

  onboardingCardEl.style.display = 'none';
  mainFormSectionEl.style.display = 'block';
  profileSelectEl.disabled = false;

  for (const profile of profiles) {
    const option = document.createElement('option');
    option.value = profile.profileId;
    option.textContent = profile.profileName;
    profileSelectEl.appendChild(option);
  }
  const stored = await chrome.storage.local.get('fmf_last_profile_id');
  const lastId = stored['fmf_last_profile_id'] as string | undefined;
  if (lastId && profiles.find(p => p.profileId === lastId)) {
    profileSelectEl.value = lastId;
  }

  onProfileChange();
}

function onProfileChange() {
  const profile = profiles.find(p => p.profileId === profileSelectEl.value) ?? null;
  updateProfileMiniBar(profile);
  clearStatus();

  if(!profile) {
    fillButtonEl.disabled = true;
    return;
  }

  if (!currentPlatform.supported) {
    fillButtonEl.disabled = true;
    return;
  }

  const hasValues = profile.fields.some(f => (f.value || '').trim());
  if (!hasValues) {
    fillButtonEl.disabled = true;
    setStatus(
      `"${profile.profileName}" has no values. Add your info to start auto-filling.`,
      'warning',
      false,
      {
        label: 'Manage Profile',
        icon: 'fa-arrow-up-right-from-square',
        onClick: () => chrome.runtime.openOptionsPage(),
      }
    );
  } else {
    fillButtonEl.disabled = false;
  }

  chrome.storage.local.set({ fmf_last_profile_id: profile.profileId });
}

function sendFill(tabId: number, profile: Profile, isRetry = false): void {
  chrome.tabs.sendMessage(tabId, { action: 'FILL_FORM', profile }, async (summary: FillSummary | undefined) => {
    if ((chrome.runtime.lastError || !summary) && !isRetry) {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true});
      const isExtensionPage = activeTab?.url?.startsWith('chrome-extension://');
      if (!isExtensionPage) {
        try {
          await chrome.scripting.executeScript({
            target:{ 
              tabId,
              allFrames: true
            },
            files: [CONTENT_SCRIPT_PATH],
          });
          sendFill(tabId, profile, true);
          return;
        } catch(err) {
          console.warn('[FMF] Script injection failed:', err);
        }
      } else {
        sendFill(tabId, profile, true);
        return;
      }
    }

    setFillLoading(false);
    if (chrome.runtime.lastError || !summary) {
      setStatus(
        'Could not reach this page. Reload the tab and try again',
        'error',
        false,
        {
          label: 'Reload Tab',
          icon: 'fa-arrow-rotate-right',
          onClick: () => {
            chrome.tabs.reload(tabId);
            window.close();
          },
        }
      );
      return;
    }
    if (!summary.success || summary.totalFields === 0) {
      setStatus(
        'No fillable form fields found on this active tab.',
        'warning',
        false, 
        {
          label: 'Open Test Form',
          icon: 'fa-arrow-up-right-from-square',
          onClick: () => chrome.tabs.create({ url: chrome.runtime.getURL('test-form.html')}),
        }
      );
      return;
    }

    if (summary.filledCount === 0) {
      statFilledEl.textContent = '0';
      statReviewEl.textContent= '0';
      statSkippedEl.textContent = String(summary.totalFields);
      resultStatsEl.style.display = 'flex';
      legendRowEl.style.display = 'none';
      setStatus(
        `Found ${summary.totalFields} field(s), but none matched "${profile.profileName}". ` +
        `Add values or synonyms in Manage Profile.`,
        'warning',
        true,
        {
          label: 'Manage Profile',
          icon: 'fa-arrow-up-right-from-square',
          onClick: () => chrome.runtime.openOptionsPage(),
        }
      );
      return;
    }
    const skipped = summary.unmatchedCount ?? (summary.totalFields - summary.filledCount);
    const review = summary.reviewCount ?? 0;

    if (review > 0) {
      setStatus(
        `Filled ${summary.filledCount} field(s) (${review} need review). Check highlights on page before submitting.`,
        'warning',
        true,
      );
    } else {
      setStatus(
        `All ${summary.filledCount} matched field(s) filled with high confidence.`,
        'success',
        true,
      );
    }
    statFilledEl.textContent = String(summary.filledCount);
    statReviewEl.textContent = String(review);
    statSkippedEl.textContent = String(skipped);
    resultStatsEl.style.display = 'flex';
    legendRowEl.style.display = review > 0 ? 'flex' : 'none';
  });
}

fillButtonEl.addEventListener('click', async () => {
  const profile = profiles.find(p => p.profileId === profileSelectEl.value);
  if (!profile) {
    setStatus('Select a profile first.', 'error');
    return;
  }
  const hasValues = profile.fields.some(f => (f.value || '').trim());
  if (!hasValues) {
    setStatus(
      `"${profile.profileName}" has no values. Add them in Manage Profile.`,
      'error',
      false,
      {
        label: 'Manage Profile',
        icon: 'fa-arrow-up-right-from-square',
        onClick: () => chrome.runtime.openOptionsPage(),
      }
    );
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    setStatus('No active tab found.', 'error');
    return;
  }

  setFillLoading(true);
  setStatus('Filling form...', 'loading');
  legendRowEl.style.display = 'none';
  resultStatsEl.style.display = 'none';

  sendFill(tab.id, profile);
});


profileSelectEl.addEventListener('change', onProfileChange);

onboardingCreateBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

document.getElementById('optionsLink')?.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

document.getElementById('testFormBtn')?.addEventListener('click', () => {
  chrome.tabs.create({url: chrome.runtime.getURL('test-form.html') });
});

async function init() {
  await Promise.all([
    loadProfiles(),
    detectAndShowPlatform(),
  ]);
}

init();