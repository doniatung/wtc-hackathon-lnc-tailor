# Configuration Change Guide

This document describes the steps required for common changes the owner might want to make to the messaging system. Each section lists every place that needs to be updated so nothing gets missed.

---

## Adding a New Language

The system currently supports English (`en`) and Chinese Simplified (`zh-CN`). Here is what needs to change to add a new language, using Spanish (`es`) as an example.

### 1. Messages Sheet
Add a new column to the Messages sheet with the language code as the header (e.g. `es`). Fill in translated versions of all 5 message types in that column.

| type | label | en | zh-CN | es |
|------|-------|----|-------|----|
| confirmed | Order Confirmed | Hi {{customer_name}}... | 您好... | Hola {{customer_name}}... |
| ready | Order Ready | ... | ... | ... |
| reminder1 | Reminder 1 | ... | ... | ... |
| reminder2 | Reminder 2 | ... | ... | ... |
| donated | Donated | ... | ... | ... |

### 2. Apps Script — VALID_LANGS
Add the new language code to the `VALID_LANGS` array at the top of the script:
```javascript
const VALID_LANGS = ["en", "zh-CN", "es"];
```

### 3. Apps Script — formatDate
If the new language has a different date format convention, add a case for it in the `formatDate` function:
```javascript
function formatDate(date, lang) {
  if (lang === "zh-CN") {
    return date.getFullYear() + "年" + (date.getMonth()+1) + "月" + date.getDate() + "日";
  }
  if (lang === "es") {
    // Spanish format: 22 de enero de 2026
    const months = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
    return date.getDate() + " de " + months[date.getMonth()] + " de " + date.getFullYear();
  }
  // Default English
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "MMMM dd, yyyy");
}
```
If the date format is the same as English, no change is needed here.

### 4. FinalOrders Sheet
No changes needed. Customers just need `es` entered in their `preferred_language` column cell.

---

## Adding a New Column

Adding a column is straightforward but requires updates in a few places depending on what the column is for.

### Steps for any new column

**1. Add the column to the FinalOrders sheet**
Insert the column in the appropriate position. Note that inserting a column in the middle will shift all columns after it, which means you will need to renumber everything after it in the `COL` map.

**2. Update the COL map in the script**
Add the new column to the `COL` object at the top of the script. The number is 0-based (column A = 0, B = 1, etc.):
```javascript
const COL = {
  ...
  YOUR_NEW_COLUMN: 21, // V - your_column_name
};
```
If you inserted the column in the middle rather than at the end, update all the index numbers for every column that shifted.

**3. Update buildData (if the value should be available in message templates)**
If you want the new column's value to be usable as a `{{placeholder}}` in message templates, add it to the `buildData` function:
```javascript
function buildData(row, lang) {
  return {
    ...
    your_column_name: row[COL.YOUR_NEW_COLUMN] ? row[COL.YOUR_NEW_COLUMN].toString().trim() : "",
  };
}
```
The key name you use here becomes the placeholder name in templates, e.g. `{{your_column_name}}`.

**4. Update allFilled (if the column should be required before Order Confirmed sends)**
If the new column must be filled in before the Order Confirmed message fires, add it to both `CONFIRMED_TRIGGER_COLS` and the `allFilled` check in `onEdit`:
```javascript
const CONFIRMED_TRIGGER_COLS = [
  ...
  COL.YOUR_NEW_COLUMN,
];

const allFilled =
  ...
  hasValue(rows[i][COL.YOUR_NEW_COLUMN]) &&
  ...
```

---

## Adding More Reminders

The system currently supports 2 reminders. Here is how to add a third (and the same pattern applies for any additional reminders).

### 1. FinalOrders Sheet
Add 2 new columns — one for the reminder date and one for the sent flag:
- `reminder_3_date` (e.g. column V)
- `reminder_3_sent` (e.g. column W)

### 2. Apps Script — COL map
Add the two new columns:
```javascript
REMINDER3_DATE: 21, // V - reminder_3_date
REMINDER3_SENT: 22, // W - reminder_3_sent
```

### 3. Apps Script — checkAndSendMessages
Add a new block for Reminder 3 inside the loop, following the same pattern as Reminder 1 and 2:
```javascript
const reminder3Date = rows[i][COL.REMINDER3_DATE] ? new Date(rows[i][COL.REMINDER3_DATE]) : null;
if (reminder3Date) reminder3Date.setHours(0, 0, 0, 0);

const reminder3Sent = rows[i][COL.REMINDER3_SENT];

// Reminder 3
if (!reminder3Sent && reminder3Date && today.getTime() === reminder3Date.getTime()) {
  const msg = buildMessage(getTemplate(templates, "reminder3", lang), data);
  triggerStudioFlow(phone, msg, "reminder3", name, lang, data);
  sheet.getRange(i + 1, COL.REMINDER3_SENT + 1).setValue("Triggered");
}
```

### 4. Messages Sheet
Add a new row for `reminder3` with the message content in each language:

| type | label | en | zh-CN |
|------|-------|----|-------|
| reminder3 | Reminder 3 | Hi {{customer_name}}, this is your third reminder... | 您好 {{customer_name}}，这是您的第三次提醒... |

---

## Quick Reference — What to Update for Each Change

| Change | Messages Sheet | VALID_LANGS | COL map | buildData | allFilled | checkAndSendMessages |
|--------|---------------|-------------|---------|-----------|-----------|----------------------|
| New language | ✅ Add column | ✅ | — | — | — | — |
| New data column | — | — | ✅ | ✅ if templated | ✅ if required | — |
| New reminder | ✅ Add row | — | ✅ | — | — | ✅ |
