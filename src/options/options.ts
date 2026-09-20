import { getProfiles, saveProfile, deleteProfile, createNewProfile } from '../lib/storage';
import { Profile, SyncSettings } from '../lib/schema';


let currentProfile: Profile | null = null;
let allProfiles: Profile[] = [];
let SyncSettings: SyncSettings;

const profileListEl = document.getElementById('profileList') as HTMLUListElement;
const profileEditorEl = document.getElementById('profileEditor') as HTMLDivElement;
const currentProfileNameEl = document.getElementById('currentProfileName') as HTMLHeadingElement;
const fieldsContainerEl = document.getElementById('fields Container') as HTMLDivElement;


async function init() {
  await loadProfiles();
}

async function loadProfiles() {
  allProfiles = await getProfiles();
  renderSidebar();
}
function renderSidebar() {
    profileListEl.innerHTML = '';
    allProfiles.forEach(p => {
        const li = document.createElement('li');
        li.textContent = p.profileName;
        li.style.cursor = 'pointer';
        li.style.padding = '6px 8px';
        li.style.borderRadius = '4px';
        li.style.marginBottom = '2px';
        if (currentProfile?.profileId === p.profileId) {
            li.style.fontWeight = 'bold';
            li.style.backgroundClip = '#e0e7ff';
            li.style.color = '#3730a3';
        }
        li.addEventListener('click', () => selectProfile(p));
        profileListEl.appendChild(li);
    });
}

function selectProfile(profile: Profile) {
    currentProfile = JSON.parse(JSON.stringify(profile));
    profileEditorEl.style.display = 'block';
    currentProfileNameEl.textContent = currentProfile!.profileName;
    renderFields();
    renderSidebar();
}

function renderFields() {
    fieldsContainerEl.innerHTML = '';
    if (!currentProfile) return;

    currentProfile.fields.forEach((field, index) => {
        const row = document.createElement('div');
        row.className = 'field-row';

        const labelInput = document.createElement('input');
        labelInput.type = 'text';
        labelInput.value = field.label;
        labelInput.placeholder = 'Field Label';
        labelInput.disabled = !field.isCustom;

        const valueInput = document.createElement('input');
        valueInput.type = 'text';
        valueInput.value = field.value || '';
        valueInput.placeholder = 'Primary value';
        valueInput.dataset.index = index.toString();
        valueInput.addEventListener('input', (e) => {
            const val = (e.target as HTMLInputElement).value;
            currentProfile!.fields[index].value = val;
        });

        const altValuesInput = document.createElement('input');
        altValuesInput.type = 'text';
        altValuesInput.value = (field.values || []).join(', ');
        altValuesInput.placeholder = 'Alt values (comma-separated)';
        altValuesInput.title = 'Secondary values (e.g. alternative emails or phone numbers';
        altValuesInput.style.fontSize = '0.85em';
        altValuesInput.style.color = '#555';
        altValuesInput.addEventListener('input', (e) => {
            const val = (e.target as HTMLInputElement).value;
            currentProfile!.fields[index].values = val.split(',').map(s=> s.trim()).filter(Boolean);
        });

        row.appendChild(labelInput);
        row.appendChild(valueInput);
        row.appendChild(altValuesInput);

        if (field.isCustom) {
            labelInput.addEventListener('input', (e) => {
                const val = (e.target as HTMLInputElement).value;
                currentProfile!.fields[index].label = val;
            });

            const delBtn = document.createElement('button');
            delBtn.textContent = 'x';
            delBtn.style.color = '#ef444';
            delBtn.title = 'Delete custom field';
            delBtn.addEventListener('click', () => {
                currentProfile!.fields.splice(index, 1);
                renderFields();
            });
            row.appendChild(delBtn);
        }

        fieldsContainerEl.appendChild(row);
    });
}

function setupEventListeners() {
    document.getElementById('newProfileBtn')?.addEventListener('click', async () => {
        const name = prompt("Enter profile name:");
        if (name) {
            const newProfile = createNewProfile(name);
            await saveProfile(newProfile);
            await loadProfiles();
            selectProfile(newProfile);
        }
    });
    document.getElementById('saveProfileBtn')?.addEventListener('click', async () => {
        if (currentProfile) {
            currentProfile.lastUpdated = new Date().toISOString();
            await saveProfile(currentProfile);
            await loadProfiles();
            alert('Profile saved!');
        }
    });

    document.getElementById('deleteProfileBtn')?.addEventListener('click', async () => {
        if (currentProfile && confirm('Delete this profile?')) {
            await deleteProfile(currentProfile.profileId);
            currentProfile = null;
            profileEditorEl.style.display = 'none';
            await loadProfiles();
        }
    });


  document.getElementById('addFieldBtn')?.addEventListener('click', () => {
    if (currentProfile) {
      currentProfile.fields.push({
        fieldId: 'custom_' + Date.now(),
        label: 'New Custom Field',
        synonyms: [],
        value: '',
        type: 'text',
        isCustom: true
      });
      renderFields();
    }
  });

  //json export
  document.getElementById('exportBtn')?.addEventListener('click', () => {
    if (!currentProfile) {
        alert("Select a profile to export first.");
        return;
    }

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentProfile, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `${currentProfile.profileName.replace(/\s+/g, '_')}_profile.json`);
    dlAnchorElem.click();
  });

  document.getElementById('importBtn')?.addEventListener('click', () => {
    document.getElementById('importFile')?.click();
  });

  document.getElementById('importFile')?.addEventListener('change', (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedProfile = JSON.parse(e.target?.result as string) as Profile;
                await saveProfile(importedProfile);
                await loadProfiles();
                alert('Profile imported successfully!');
            } catch {
                alert('Invalid profile JSON file.');
            }
        };
        reader.readAsText(file);
    }
  });
}

init();