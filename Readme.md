# FillMyForm

---

_FillMyForm_ is a web browser extension which keeps track of your different profiles and help you fill tedious long forms in ONE CLICK!

Just set up your profile & dont worry all the information is stored locally; then save it. and done!

Currently V1 supports Standard HTMl form field Forms (for later we plan to upgrade to Google Forms, Tally, Fillout & more).

---

## Features

---

- Fills up your rigourous information in one click
- Stores personal data locally. No privacy risk.
- Create multiple profiles for work & personal switch
- Currently support standard HTML forms
- Uses Synonyms to match if not exact match (needs better approach or db)

---

## Demo Video

- Demo: [Here](https://drive.google.com/file/d/1s8X8mNem5TYBNx56bBD2sSksYEtp4Z2g/view?usp=sharing)

## Installation

---

1. Clone the repo

```
git clone https://github.com/raze-me/fillmyform
cd fillmyform
```

2. Install Dependencies

```
npm install
```

3. Build the extension

```
npm run build
```

The production extension will be generated inside:

```
dist/
```

4. Load the extension in Chrome

Open:

```
chrome://extensions
```

Then:

i. Enable Developer Mode
ii. Click Load unpacked
iii. Select project's dist directory

---

## Testing

---

1. Create a Profile.
2. Open the sample test form
3. Select the profile in the extension.
4. Click "Fill My Form"
5. Review the populated fields

## Authors

---

@raze-me

@rexaintreal

_MIT LICENCED_
