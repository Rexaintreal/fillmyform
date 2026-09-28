import { getProfiles, saveProfile, deleteProfile } from '../lib/storage';
import { createNewProfile } from '../lib/defaults';
import type { Profile, ProfileField } from '../lib/schema';

let currentProfile: Profile | null = null;
let allProfiles: Profile[] = [];
let hasUnsavedChanges = false;
let searchQuery = '';

const profileListEl = document.getElementById('profileList')! as HTMLUListElement;
const emptyStateEl = document.getElementById('empty-state')! as HTMLDivElement;
const profileEditorEl = document.getElementById('profileEditor')! as HTMLDivElement;
const profileNameInputEl = document.getElementById('profileNameInput')! as HTMLInputElement;
const editorAvatarEl = document.getElementById('editorAvatar')! as HTMLDivElement;
const fieldsContainerEl = document.getElementById('fieldsContainer')! as HTMLDivElement;
const progressLabelEl = document.getElementById('progressLabel')! as HTMLDivElement;
const progressFillEl = document.getElementById('progressFill')! as HTMLDivElement;
const progressPctEl = document.getElementById('progressPct')! as HTMLDivElement;
const toastEl = document.getElementById('toast')! as HTMLDivElement;
const unsavedBadgeEl = document.getElementById('unsavedBadge')! as HTMLDivElement;
const noResultsEl = document.getElementById('noResults')! as HTMLDivElement;
const modalBackdropEl = document.getElementById('modalBackdrop')! as HTMLDivElement;
const modalNameInputEl = document.getElementById('modalNameInput')! as HTMLInputElement;

interface GroupMeta {
  label: string;
  color: string;
  icon: string;
}

const GROUP_META: Record<string, GroupMeta> = {
  identity: { label: 'Identity', color: '#a1a1aa', icon: 'fa-user' },
  contact: { label: 'Contact', color: '#a1a1aa', icon: 'fa-address-book' },
  address: { label: 'Address', color: '#a1a1aa', icon: 'fa-location-dot' },
  education: { label: 'Education', color: '#a1a1aa', icon: 'fa-graduation-cap' },
  professional: { label: 'Professional', color: '#a1a1aa', icon: 'fa-briefcase' },
  custom: { label: 'Custom', color: '#a1a1aa', icon: 'fa-wand-magic-sparkles' },
};

const GROUP_ORDER = ['identity', 'contact', 'address', 'education', 'professional', 'custom'];

const collapsedGroups = new Set<string>();

function createIcon(iconClass: string): HTMLElement {
  const icon = document.createElement('i');
  icon.className = `fa-solid ${iconClass}`;
  icon.setAttribute('aria-hidden', 'true');
  return icon;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

function showToast(message: string, type: 'success' | 'error' | 'info' = 'success') {
  if (toastTimer) clearTimeout(toastTimer);
  toastEl.textContent = '';

  const iconClass =
    type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-xmark' : 'fa-circle-info';
  const iconColor =
    type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--danger)' : 'var(--text-2)';

  const icon = createIcon(iconClass);
  icon.style.color = iconColor;

  const msg = document.createElement('span');
  msg.textContent = message;

  toastEl.append(icon, msg);
  toastEl.className = `toast show ${type}`;
  toastTimer = setTimeout(() => {
    toastEl.className = 'toast';
  }, 3400);
}

function markDirty() {
  hasUnsavedChanges = true;
  unsavedBadgeEl.classList.add('visible');
}

function markClean() {
  hasUnsavedChanges = false;
  unsavedBadgeEl.classList.remove('visible');
}

async function init() {
  setupEventListeners();
  await loadProfiles();
}

async function loadProfiles() {
  allProfiles = await getProfiles();
  renderSidebar();
  updateExportBtn();
}

function renderSidebar() {
  profileListEl.innerHTML = '';

  if (allProfiles.length === 0) {
    showView('empty');
    return;
  }

  allProfiles.forEach((p) => {
    const li = document.createElement('li');
    li.className = 'profile-item' + (currentProfile?.profileId === p.profileId ? ' active' : '');
    li.setAttribute('role', 'listitem');
    li.title = p.profileName;

    const avatar = document.createElement('div');
    avatar.className = 'profile-avatar';
    avatar.textContent = p.profileName.charAt(0).toUpperCase();
    avatar.setAttribute('aria-hidden', 'true');

    const info = document.createElement('div');
    info.className = 'profile-info';

    const name = document.createElement('div');
    name.className = 'profile-name';
    name.textContent = p.profileName;

    const countEl = document.createElement('div');
    countEl.className = 'profile-count';
    const filled = p.fields.filter((f) => (f.value || '').trim()).length;
    countEl.textContent = `${filled} / ${p.fields.length} filled`;

    info.append(name, countEl);
    li.append(avatar, info);
    li.addEventListener('click', () => {
      if (hasUnsavedChanges && currentProfile?.profileId !== p.profileId) {
        if (!confirm('You have unsaved changes. Switch profiles and discard them?')) return;
        markClean();
      }
      selectProfile(p);
    });
    profileListEl.appendChild(li);
  });
}

function showView(view: 'empty' | 'editor') {
  if (view === 'empty') {
    emptyStateEl.style.display = 'flex';
    profileEditorEl.className = 'editor';
  } else {
    emptyStateEl.style.display = 'none';
    profileEditorEl.className = 'editor visible';
  }
}

function updateExportBtn() {
  const exportBtn = document.getElementById('exportBtn') as HTMLButtonElement | null;
  if (exportBtn) exportBtn.disabled = !currentProfile;
}

function selectProfile(profile: Profile) {
  currentProfile = JSON.parse(JSON.stringify(profile));
  profileNameInputEl.value = currentProfile!.profileName;
  editorAvatarEl.textContent = currentProfile!.profileName.charAt(0).toUpperCase() || 'P';
  showView('editor');
  renderFields();
  renderSidebar();
  updateExportBtn();
  markClean();
  applySearch(searchQuery);
}

function createAddFieldButton(): HTMLButtonElement {
  const addBtn = document.createElement('button');
  addBtn.className = 'add-field-btn';
  addBtn.setAttribute('aria-label', 'Add custom field');
  addBtn.append(createIcon('fa-plus'), document.createTextNode('Add Custom Field'));
  addBtn.addEventListener('click', () => addCustomField());
  return addBtn;
}

function renderFields() {
  fieldsContainerEl.innerHTML = '';
  if (!currentProfile) return;

  const grouped: Record<string, ProfileField[]> = {};
  currentProfile.fields.forEach((f) => {
    const g = f.group || (f.isCustom ? 'custom' : 'identity');
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(f);
  });

  if (!grouped['custom']) grouped['custom'] = [];

  GROUP_ORDER.forEach((groupKey) => {
    const fields = grouped[groupKey];
    if (!fields) return;
    if (groupKey === 'custom' && fields.length === 0) return;

    const meta = GROUP_META[groupKey] || { label: groupKey, color: '#a1a1aa', icon: 'fa-shapes' };
    const isCollapsed = collapsedGroups.has(groupKey);

    const section = document.createElement('div');
    section.className = 'field-group' + (isCollapsed ? ' collapsed' : '');
    section.dataset.group = groupKey;
    section.setAttribute('role', 'listitem');

    const groupHeader = document.createElement('div');
    groupHeader.className = 'group-header';
    groupHeader.setAttribute('role', 'button');
    groupHeader.setAttribute('aria-expanded', String(!isCollapsed));
    groupHeader.setAttribute('aria-controls', `group-body-${groupKey}`);
    groupHeader.tabIndex = 0;

    const dot = document.createElement('div');
    dot.className = 'group-dot';
    dot.style.background = meta.color;

    const titleEl = document.createElement('span');
    titleEl.className = 'group-title';
    const titleIcon = createIcon(meta.icon);
    titleIcon.style.marginRight = '6px';
    titleEl.append(titleIcon, document.createTextNode(meta.label));

    const filledCount = fields.filter((f) => (f.value || '').trim()).length;
    const badge = document.createElement('span');
    badge.className = 'group-badge' + (filledCount === fields.length ? ' complete' : '');
    badge.dataset.groupBadge = groupKey;
    badge.textContent = `${filledCount} / ${fields.length}`;

    const toggleIcon = document.createElement('span');
    toggleIcon.className = 'group-toggle-icon';
    toggleIcon.setAttribute('aria-hidden', 'true');
    toggleIcon.appendChild(createIcon('fa-chevron-down'));

    groupHeader.append(dot, titleEl, badge, toggleIcon);

    const toggleGroup = () => {
      if (collapsedGroups.has(groupKey)) {
        collapsedGroups.delete(groupKey);
        section.classList.remove('collapsed');
        groupHeader.setAttribute('aria-expanded', 'true');
      } else {
        collapsedGroups.add(groupKey);
        section.classList.add('collapsed');
        groupHeader.setAttribute('aria-expanded', 'false');
      }
    };
    groupHeader.addEventListener('click', toggleGroup);
    groupHeader.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleGroup();
      }
    });

    section.appendChild(groupHeader);

    const groupBody = document.createElement('div');
    groupBody.className = 'group-body';
    groupBody.id = `group-body-${groupKey}`;

    const grid = document.createElement('div');
    grid.className = 'fields-grid';
    fields.forEach((field) => grid.appendChild(createFieldCard(field)));
    groupBody.appendChild(grid);

    if (groupKey === 'custom') {
      const addArea = document.createElement('div');
      addArea.className = 'add-field-area';
      addArea.appendChild(createAddFieldButton());
      groupBody.appendChild(addArea);
    }

    section.appendChild(groupBody);
    fieldsContainerEl.appendChild(section);
  });

  if (!grouped['custom'] || grouped['custom'].length === 0) {
    const addArea = document.createElement('div');
    addArea.className = 'add-field-area';
    addArea.appendChild(createAddFieldButton());
    fieldsContainerEl.appendChild(addArea);
  }

  updateProgress();
}

function createFieldCard(field: ProfileField): HTMLDivElement {
  const card = document.createElement('div');
  const isFilled = !!(field.value || '').trim();
  card.className = ['field-card', field.isCustom ? 'custom-field' : '', isFilled ? 'has-value' : 'empty-value']
    .filter(Boolean)
    .join(' ');
  card.dataset.fieldId = field.fieldId;
  card.dataset.label = field.label.toLowerCase();
  card.setAttribute('role', 'listitem');

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'field-delete-btn';
  deleteBtn.title = 'Delete this custom field';
  deleteBtn.setAttribute('aria-label', `Delete field: ${field.label}`);
  deleteBtn.appendChild(createIcon('fa-xmark'));
  deleteBtn.addEventListener('click', () => removeCustomField(field.fieldId));
  card.appendChild(deleteBtn);

  const labelRow = document.createElement('div');
  labelRow.className = 'field-label-row';

  if (field.isCustom) {
    const labelInput = document.createElement('input');
    labelInput.className = 'field-label-input';
    labelInput.value = field.label;
    labelInput.placeholder = 'Field name...';
    labelInput.setAttribute('aria-label', 'Custom field name');
    labelInput.addEventListener('input', (e) => {
      field.label = (e.target as HTMLInputElement).value;
      card.dataset.label = field.label.toLowerCase();
      deleteBtn.setAttribute('aria-label', `Delete field: ${field.label}`);
      markDirty();
    });
    labelRow.appendChild(labelInput);
  } else {
    const labelEl = document.createElement('span');
    labelEl.className = 'field-label';
    labelEl.textContent = field.label;
    labelRow.appendChild(labelEl);
  }

  const typeBadge = document.createElement('span');
  typeBadge.className = 'field-type-badge';
  typeBadge.textContent = field.type;
  typeBadge.setAttribute('aria-hidden', 'true');
  labelRow.appendChild(typeBadge);
  card.appendChild(labelRow);

  const valueInput = document.createElement('input');
  const inputType = ['email', 'url', 'date', 'tel', 'number'].includes(field.type) ? field.type : 'text';
  valueInput.type = inputType;
  valueInput.className = 'field-value-input' + (isFilled ? ' filled' : '');
  valueInput.value = field.value || '';
  valueInput.placeholder = getPlaceholder(field);
  valueInput.setAttribute('aria-label', `Value for ${field.label}`);
  valueInput.autocomplete = 'off';

  valueInput.addEventListener('input', (e) => {
    field.value = (e.target as HTMLInputElement).value;
    const nowFilled = !!field.value.trim();
    valueInput.classList.toggle('filled', nowFilled);
    card.classList.toggle('has-value', nowFilled);
    card.classList.toggle('empty-value', !nowFilled);
    markDirty();
    updateProgress();
    updateGroupBadge(field.group || 'custom');
    updateSidebarCount();
  });
  card.appendChild(valueInput);

  if (field.isCustom) {
    const typeRow = document.createElement('div');
    typeRow.className = 'custom-type-row';
    const typeLabel = document.createElement('span');
    typeLabel.className = 'custom-type-label';
    typeLabel.textContent = 'Type:';
    const typeSelect = document.createElement('select');
    typeSelect.className = 'custom-type-select';
    typeSelect.setAttribute('aria-label', 'Field type');
    ['text', 'email', 'tel', 'url', 'number', 'date'].forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      if (t === field.type) opt.selected = true;
      typeSelect.appendChild(opt);
    });
    typeSelect.addEventListener('change', () => {
      field.type = typeSelect.value;
      typeBadge.textContent = field.type;
      valueInput.type = ['email', 'url', 'date', 'tel', 'number'].includes(field.type) ? field.type : 'text';
      markDirty();
    });
    typeRow.append(typeLabel, typeSelect);
    card.appendChild(typeRow);
  }

  return card;
}

function getPlaceholder(field: ProfileField): string {
  const map: Record<string, string> = {
    full_name: 'e.g. Jane Doe',
    first_name: 'e.g. Jane',
    last_name: 'e.g. Doe',
    dob: '',
    email: 'e.g. jane@example.com',
    phone: 'e.g. +1 555-0100',
    address_1: 'e.g. 123 Main St',
    address_2: 'e.g. Apt 4B',
    city: 'e.g. San Francisco',
    state: 'e.g. California',
    zip: 'e.g. 94103',
    country: 'e.g. United States',
    university: 'e.g. MIT',
    degree: 'e.g. B.S. Computer Science',
    graduation_year: 'e.g. 2024',
    company: 'e.g. Acme Corp',
    job_title: 'e.g. Software Engineer',
    linkedin: 'e.g. https://linkedin.com/in/janedoe',
    github: 'e.g. https://github.com/janedoe',
    portfolio: 'e.g. https://janedoe.dev',
  };
  return map[field.fieldId] || `Enter ${field.label.toLowerCase()}...`;
}

function addCustomField() {
  if (!currentProfile) return;
  const newField: ProfileField = {
    fieldId: 'custom_' + Date.now(),
    label: 'New Field',
    synonyms: [],
    value: '',
    type: 'text',
    isCustom: true,
    group: 'custom',
  };
  currentProfile.fields.push(newField);
  collapsedGroups.delete('custom');
  renderFields();
  markDirty();
  setTimeout(() => {
    const cards = fieldsContainerEl.querySelectorAll<HTMLElement>('.custom-field');
    const last = cards[cards.length - 1];
    if (last) {
      last.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      const labelInput = last.querySelector<HTMLInputElement>('.field-label-input');
      labelInput?.focus();
      labelInput?.select();
    }
  }, 60);
}

function removeCustomField(fieldId: string) {
  if (!currentProfile) return;
  const field = currentProfile.fields.find((f) => f.fieldId === fieldId);
  if (field && !confirm(`Remove "${field.label}" from this profile?`)) return;
  currentProfile.fields = currentProfile.fields.filter((f) => f.fieldId !== fieldId);
  renderFields();
  markDirty();
}

function updateProgress() {
  if (!currentProfile) return;
  const total = currentProfile.fields.length;
  const filled = currentProfile.fields.filter((f) => (f.value || '').trim()).length;
  const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
  progressLabelEl.textContent = `${filled} of ${total} fields filled`;
  progressFillEl.style.width = pct + '%';
  progressPctEl.textContent = pct + '%';
}

function updateGroupBadge(groupKey: string) {
  if (!currentProfile) return;
  const badge = fieldsContainerEl.querySelector<HTMLElement>(`[data-group-badge="${groupKey}"]`);
  if (!badge) return;
  const fields = currentProfile.fields.filter((f) => (f.group || 'custom') === groupKey);
  const filled = fields.filter((f) => (f.value || '').trim()).length;
  badge.textContent = `${filled} / ${fields.length}`;
  badge.className = 'group-badge' + (filled === fields.length && fields.length > 0 ? ' complete' : '');
}

function updateSidebarCount() {
  if (!currentProfile) return;
  const countEl = profileListEl.querySelector<HTMLElement>('.profile-item.active .profile-count');
  if (!countEl) return;
  const filled = currentProfile.fields.filter((f) => (f.value || '').trim()).length;
  countEl.textContent = `${filled} / ${currentProfile.fields.length} filled`;
}

function applySearch(query: string) {
  searchQuery = query.trim().toLowerCase();
  if (!currentProfile) return;

  const cards = fieldsContainerEl.querySelectorAll<HTMLElement>('.field-card');
  let anyVisible = false;

  cards.forEach((card) => {
    const label = (card.dataset.label || '').toLowerCase();
    const valueInput = card.querySelector<HTMLInputElement>('.field-value-input');
    const value = (valueInput?.value || '').toLowerCase();
    const matches = !searchQuery || label.includes(searchQuery) || value.includes(searchQuery);
    card.classList.toggle('hidden-by-search', !matches);
    if (matches) anyVisible = true;
  });

  const sections = fieldsContainerEl.querySelectorAll<HTMLElement>('.field-group');
  sections.forEach((section) => {
    const visibleCards = section.querySelectorAll<HTMLElement>('.field-card:not(.hidden-by-search)');
    section.style.display = visibleCards.length === 0 && searchQuery ? 'none' : '';
  });

  noResultsEl.style.display = !anyVisible && !!searchQuery ? 'block' : 'none';
}

function openModal() {
  modalNameInputEl.value = '';
  modalBackdropEl.classList.add('open');
  setTimeout(() => modalNameInputEl.focus(), 60);
}

function closeModal() {
  modalBackdropEl.classList.remove('open');
}

async function confirmCreateProfile() {
  const name = modalNameInputEl.value.trim();
  if (!name) {
    modalNameInputEl.focus();
    return;
  }
  closeModal();
  const newProfile = createNewProfile(name);
  await saveProfile(newProfile);
  await loadProfiles();
  selectProfile(newProfile);
  showToast(`"${name}" created!`);
}

async function saveCurrentProfile() {
  if (!currentProfile) return;
  currentProfile.lastUpdated = new Date().toISOString();
  await saveProfile(currentProfile);
  const idx = allProfiles.findIndex((p) => p.profileId === currentProfile!.profileId);
  if (idx >= 0) allProfiles[idx] = JSON.parse(JSON.stringify(currentProfile));
  renderSidebar();
  markClean();
  showToast('Profile saved!');
}

async function deleteCurrentProfile() {
  if (!currentProfile) return;
  if (!confirm(`Delete "${currentProfile.profileName}"? This cannot be undone.`)) return;
  await deleteProfile(currentProfile.profileId);
  const deletedId = currentProfile.profileId;
  currentProfile = null;
  markClean();
  await loadProfiles();
  const remaining = allProfiles.filter((p) => p.profileId !== deletedId);
  if (remaining.length > 0) {
    selectProfile(remaining[0]);
  } else {
    showView('empty');
    updateExportBtn();
  }
  showToast('Profile deleted.', 'error');
}

function exportProfile() {
  if (!currentProfile) return;
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(currentProfile, null, 2));
  const a = document.createElement('a');
  a.setAttribute('href', dataStr);
  a.setAttribute('download', `${currentProfile.profileName.replace(/\s+/g, '_')}_profile.json`);
  a.click();
  showToast('Profile exported!', 'info');
}

function handleFileImport(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const imported = JSON.parse(e.target?.result as string) as Profile;
      if (!imported.profileId || !Array.isArray(imported.fields)) throw new Error('Invalid profile');
      await saveProfile(imported);
      await loadProfiles();
      selectProfile(imported);
      showToast(`"${imported.profileName}" imported!`);
    } catch {
      showToast('Invalid profile JSON file.', 'error');
    }
    (event.target as HTMLInputElement).value = '';
  };
  reader.readAsText(file);
}

function setupEventListeners() {
  document.getElementById('newProfileBtn')?.addEventListener('click', openModal);
  document.getElementById('newProfileBtnEmpty')?.addEventListener('click', openModal);

  document.getElementById('modalCreateBtn')?.addEventListener('click', confirmCreateProfile);
  document.getElementById('modalCancelBtn')?.addEventListener('click', closeModal);
  modalBackdropEl.addEventListener('click', (e) => {
    if (e.target === modalBackdropEl) closeModal();
  });
  modalNameInputEl.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') confirmCreateProfile();
    if (e.key === 'Escape') closeModal();
  });

  profileNameInputEl.addEventListener('input', () => {
    if (!currentProfile) return;
    currentProfile.profileName = profileNameInputEl.value;
    editorAvatarEl.textContent = (profileNameInputEl.value.charAt(0) || 'P').toUpperCase();
    renderSidebar();
    markDirty();
  });

  document.getElementById('saveProfileBtn')?.addEventListener('click', saveCurrentProfile);
  document.getElementById('deleteProfileBtn')?.addEventListener('click', deleteCurrentProfile);

  document.getElementById('exportBtn')?.addEventListener('click', exportProfile);
  document.getElementById('exportBtnEditor')?.addEventListener('click', exportProfile);

  const triggerImport = () => document.getElementById('importFile')?.click();
  document.getElementById('importBtn')?.addEventListener('click', triggerImport);
  document.getElementById('importBtnEditor')?.addEventListener('click', triggerImport);
  document.getElementById('importFile')?.addEventListener('change', handleFileImport);

  document.getElementById('fieldSearch')?.addEventListener('input', (e) => {
    applySearch((e.target as HTMLInputElement).value);
  });

  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (currentProfile) saveCurrentProfile();
    }
    if (e.key === 'Escape' && modalBackdropEl.classList.contains('open')) {
      closeModal();
    }
  });

  window.addEventListener('beforeunload', (e) => {
    if (hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

init();