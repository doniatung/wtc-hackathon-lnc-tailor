// ─────────────────────────────────────────────
//  CONFIGURATION
// ─────────────────────────────────────────────
const TWILIO_ACCOUNT_SID = "ACXXXXXXXXXXXXXXXX"; // Replace with twilio account sid
const TWILIO_AUTH_TOKEN  = "your_auth_token"; // Replace with twilio auth token
const TWILIO_FROM_NUMBER = "whatsapp:+14155238886";
const STUDIO_FLOW_SID    = "FWXXXXXXXXXXXXXXXX"; // Replace with your Twilio Studio Flow SID


// Column indexes (0-based) for the FinalOrders sheet
// A=0  B=1  C=2  D=3  E=4  F=5  G=6  H=7  I=8  J=9  K=10  L=11  M=12  N=13  O=14  P=15  Q=16  R=17  S=18  T=19
const COL = {
 NAME:           0,  // A - customer_name
 PHONE:          1,  // B - phone
 ORDER_NUMBER:   2,  // C - order_number
 PICKUP_DATE:    3,  // D - pick_up_date
 PICKUP_TIME:    4,  // E - pick_up_time
 ITEM:           5,  // F - item_description
 ITEM_NOTES:     6,  // G - item_notes
 ITEM_PRICE:     7,  // H - item_price
 TICKET_TOTAL:   8,  // I - ticket_total
 AMOUNT_PAID:    9,  // J - amount_paid
 BALANCE_DUE:    10, // K - balance_due
 LANG:           11, // L - preferred_language
 REMINDER1_DATE: 12, // M - reminder_1_date
 REMINDER2_DATE: 13, // N - reminder_2_date
 DONATED:        14, // O - donated
 CONFIRMED_SENT: 15, // P - order_confirmed_sent
 READY_SENT:     16, // Q - order_ready_sent
 REMINDER1_SENT: 17, // R - reminder_1_sent
 REMINDER2_SENT: 18, // S - reminder_2_sent
 DONATED_SENT:   19, // T - donated_sent
 HAS_PICKED_UP: 20, // U - has_picked_up
};
const VALID_LANGS = ["en", "zh-CN"];
// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────
// Safely checks if a cell has a meaningful value — handles 0, false, empty string
function hasValue(val) {
 return val !== undefined && val !== null && val.toString().trim() !== "";
}
// Normalizes phone numbers to E.164 format (+1XXXXXXXXXX)
function formatPhone(raw) {
 const digits = raw.toString().replace(/\D/g, ""); // strip non-digits
 if (digits.startsWith("1") && digits.length === 11) {
   return "+" + digits; // already has country code e.g. 16463142289
 }
 if (digits.length === 10) {
   return "+1" + digits; // US number e.g. 6463142289
 }
 return "+" + digits; // fallback
}
function resolveLanguage(rawLang) {
 const lang = rawLang ? rawLang.toString().trim() : "en";
 return VALID_LANGS.includes(lang) ? lang : "en";
}
function buildData(row, lang) {
 const pickupDate = row[COL.PICKUP_DATE] ? new Date(row[COL.PICKUP_DATE]) : null;
 return {
   customer_name:    row[COL.NAME]         ? row[COL.NAME].toString().trim()         : "",
   phone:            row[COL.PHONE]        ? formatPhone(row[COL.PHONE])              : "",
   order_number:     row[COL.ORDER_NUMBER] ? row[COL.ORDER_NUMBER].toString().trim() : "",
   pick_up_date:     pickupDate ? formatDate(pickupDate, lang) : "",
   pick_up_time:     row[COL.PICKUP_TIME]  ? row[COL.PICKUP_TIME].toString().trim()  : "",
   item_description: row[COL.ITEM]         ? row[COL.ITEM].toString().trim()         : "",
   item_notes:       row[COL.ITEM_NOTES]   ? row[COL.ITEM_NOTES].toString().trim()   : "",
   item_price:       hasValue(row[COL.ITEM_PRICE])   ? row[COL.ITEM_PRICE].toString().trim()   : "",
   ticket_total:     hasValue(row[COL.TICKET_TOTAL]) ? row[COL.TICKET_TOTAL].toString().trim() : "",
   amount_paid:      hasValue(row[COL.AMOUNT_PAID])  ? row[COL.AMOUNT_PAID].toString().trim()  : "",
   balance_due:      hasValue(row[COL.BALANCE_DUE])  ? row[COL.BALANCE_DUE].toString().trim()  : "",
 };
}
function formatDate(date, lang) {
 if (lang === "zh-CN") { return date.getFullYear() + "年" + (date.getMonth()+1) + "月" + date.getDate() + "日"; }
 return Utilities.formatDate(date, Session.getScriptTimeZone(), "MMMM dd, yyyy");
}
// ─────────────────────────────────────────────
//  TEMPLATE HELPERS
// ─────────────────────────────────────────────
function loadTemplates() {
 const sheet   = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Messages");
 const rows    = sheet.getDataRange().getValues();
 const headers = rows[0];
 const templates = {};
 for (let i = 1; i < rows.length; i++) {
   const type = rows[i][0];
   if (!type) continue;
   templates[type] = {};
   for (let j = 1; j < headers.length; j++) {
     templates[type][headers[j]] = rows[i][j];
   }
 }
 return templates;
}
function getTemplate(templates, type, lang) {
 const msgType = templates[type] || {};
 return msgType[lang] || msgType["en"] || "";
}
function buildMessage(template, data) {
 return template.replace(/{{(\w+)}}/g, (_, key) =>
   data[key] !== undefined ? data[key] : `{{${key}}}`
 );
}
// ─────────────────────────────────────────────
//  TRIGGER: onEdit — fires Order Confirmed once all
//           required fields are filled, and Donated
//           message as soon as Donated = "yes"
// ─────────────────────────────────────────────
function onEdit(e) {
 const sheet = e.range.getSheet();
 if (sheet.getName() !== "FinalOrders") return;
 const row = e.range.getRow();
 const col = e.range.getColumn() - 1; // convert to 0-based
 if (row < 2) return; // skip header
 const rows = sheet.getDataRange().getValues();
 const i    = row - 1; // 0-based row index in values array


 // Skip entire row if customer has already picked up
 if (rows[i][COL.HAS_PICKED_UP] && rows[i][COL.HAS_PICKED_UP].toString().trim().toLowerCase() === "yes") return;
  // Fire Order Confirmed only when ALL required fields are present
 const CONFIRMED_TRIGGER_COLS = [
   COL.NAME, COL.PHONE, COL.PICKUP_DATE, COL.PICKUP_TIME,
   COL.ITEM, COL.TICKET_TOTAL, COL.AMOUNT_PAID, COL.BALANCE_DUE, COL.LANG
 ];
 if (CONFIRMED_TRIGGER_COLS.includes(col)) {
   const confirmedSent = rows[i][COL.CONFIRMED_SENT];
   const allFilled =
     hasValue(rows[i][COL.NAME])         &&
     hasValue(rows[i][COL.PHONE])        &&
     hasValue(rows[i][COL.PICKUP_DATE])  &&
     hasValue(rows[i][COL.PICKUP_TIME])  &&
     hasValue(rows[i][COL.ITEM])         &&
     hasValue(rows[i][COL.TICKET_TOTAL]) &&
     hasValue(rows[i][COL.AMOUNT_PAID])  &&
     hasValue(rows[i][COL.BALANCE_DUE])  &&
     hasValue(rows[i][COL.LANG]);
   if (allFilled && !confirmedSent) {
     const templates    = loadTemplates();
     const lang         = resolveLanguage(rows[i][COL.LANG]);
     const data         = buildData(rows[i], lang);
     const name         = rows[i][COL.NAME].toString().trim();
     const phone        = formatPhone(rows[i][COL.PHONE]);
     const msg          = buildMessage(getTemplate(templates, "confirmed", lang), data);
     triggerStudioFlow(phone, msg, "confirmed", name, lang, data);
     sheet.getRange(row, COL.CONFIRMED_SENT + 1).setValue("Triggered"); // P
   }
 }
 // Fire Donated message when Donated column is set to "yes"
 if (col === COL.DONATED) {
   const donatedFlag   = rows[i][COL.DONATED]      ? rows[i][COL.DONATED].toString().trim().toLowerCase() : "";
   const donatedSent   = rows[i][COL.DONATED_SENT];
   const name          = rows[i][COL.NAME]  ? rows[i][COL.NAME].toString().trim()  : "";
   const phone         = rows[i][COL.PHONE] ? formatPhone(rows[i][COL.PHONE]) : "";


   console.log("Console.log", donatedFlag, donatedSent, phone)
   if (donatedFlag === "yes" && !donatedSent && name && phone) {
     const templates = loadTemplates();
     const lang      = resolveLanguage(rows[i][COL.LANG]);
     const data      = buildData(rows[i], lang);
     const msg       = buildMessage(getTemplate(templates, "donated", lang), data);
     triggerStudioFlow(phone, msg, "donated", name, lang, data);
     sheet.getRange(row, COL.DONATED_SENT + 1).setValue("Triggered"); // T
   }
 }
}
// ─────────────────────────────────────────────
//  DAILY TRIGGER — run on a time-based trigger
//  (e.g. every day at 8 AM via Apps Script triggers)
//  Handles: Order Ready, Reminder 1, Reminder 2
// ─────────────────────────────────────────────
function checkAndSendMessages() {
 const templates = loadTemplates();
 const sheet     = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("FinalOrders");
 const rows      = sheet.getDataRange().getValues();
 const today     = new Date();
 today.setHours(0, 0, 0, 0);
 for (let i = 1; i < rows.length; i++) {
   const name  = rows[i][COL.NAME]  ? rows[i][COL.NAME].toString().trim()  : "";
   const phone = rows[i][COL.PHONE] ? formatPhone(rows[i][COL.PHONE]) : "";


   if (rows[i][COL.HAS_PICKED_UP] && rows[i][COL.HAS_PICKED_UP].toString().trim().toLowerCase() === "yes") {
     console.log(`Row ${i + 1} (${name}) skipped — already picked up.`);
     continue;
   }
   if (!name || !phone) {
     console.log(`Row ${i + 1} skipped — missing name or phone.`);
     continue;
   }
   if (!rows[i][COL.PICKUP_DATE]) {
     console.log(`Row ${i + 1} (${name}) skipped — no pickup date.`);
     continue;
   }
   const pickUpDate = new Date(rows[i][COL.PICKUP_DATE]);
   if (isNaN(pickUpDate)) {
     console.log(`Row ${i + 1} (${name}) skipped — invalid pickup date.`);
     continue;
   }
   pickUpDate.setHours(0, 0, 0, 0);
   const reminder1Date = rows[i][COL.REMINDER1_DATE] ? new Date(rows[i][COL.REMINDER1_DATE]) : null;
   const reminder2Date = rows[i][COL.REMINDER2_DATE] ? new Date(rows[i][COL.REMINDER2_DATE]) : null;
   if (reminder1Date) reminder1Date.setHours(0, 0, 0, 0);
   if (reminder2Date) reminder2Date.setHours(0, 0, 0, 0);
   const readySent     = rows[i][COL.READY_SENT];
   const reminder1Sent = rows[i][COL.REMINDER1_SENT];
   const reminder2Sent = rows[i][COL.REMINDER2_SENT];
   const lang = resolveLanguage(rows[i][COL.LANG]);
   const data = buildData(rows[i], lang);
   // 1. Order Ready — day of pickup
   if (!readySent && today.getTime() === pickUpDate.getTime()) {
     const msg = buildMessage(getTemplate(templates, "ready", lang), data);
     triggerStudioFlow(phone, msg, "ready", name, lang, data);
     sheet.getRange(i + 1, COL.READY_SENT + 1).setValue("Triggered"); // Q
   }
   // 2. Reminder 1
   if (!reminder1Sent && reminder1Date && today.getTime() === reminder1Date.getTime()) {
     const msg = buildMessage(getTemplate(templates, "reminder1", lang), data);
     triggerStudioFlow(phone, msg, "reminder1", name, lang, data);
     sheet.getRange(i + 1, COL.REMINDER1_SENT + 1).setValue("Triggered"); // R
   }
   // 3. Reminder 2
   if (!reminder2Sent && reminder2Date && today.getTime() === reminder2Date.getTime()) {
     const msg = buildMessage(getTemplate(templates, "reminder2", lang), data);
     triggerStudioFlow(phone, msg, "reminder2", name, lang, data);
     sheet.getRange(i + 1, COL.REMINDER2_SENT + 1).setValue("Triggered"); // S
   }
 }
}
// ─────────────────────────────────────────────
//  TWILIO STUDIO TRIGGER
// ─────────────────────────────────────────────
function triggerStudioFlow(phone, message, flowType, name, lang, data) {
 const url = `https://studio.twilio.com/v2/Flows/${STUDIO_FLOW_SID}/Executions`;
 const parameters = {
   customer_name:    name,
   message:          message,
   flowType:         flowType,
   lang:             lang,
   order_number:     data.order_number,
   pick_up_date:     data.pick_up_date,
   pick_up_time:     data.pick_up_time,
   item_description: data.item_description,
   item_notes:       data.item_notes,
   item_price:       data.item_price,
   ticket_total:     data.ticket_total,
   amount_paid:      data.amount_paid,
   balance_due:      data.balance_due,
 };
 try {
   const response = UrlFetchApp.fetch(url, {
     method: "POST",
     headers: {
       Authorization: "Basic " + Utilities.base64Encode(
         TWILIO_ACCOUNT_SID + ":" + TWILIO_AUTH_TOKEN
       )
     },
     payload: {
       To:         phone,
       From:       TWILIO_FROM_NUMBER,
       Parameters: JSON.stringify(parameters)
     },
     muteHttpExceptions: true
   });
   const result = JSON.parse(response.getContentText());
   if (result.sid) {
     console.log(`✅ Studio triggered for ${name} (${flowType}): ${result.sid}`);
   } else {
     console.error(`❌ Studio error for ${name} (${flowType}):`, JSON.stringify(result));
   }
 } catch (err) {
   console.error(`❌ Failed to trigger Studio for ${name} (${flowType}):`, err);
 }
}
// ─────────────────────────────────────────────
//  WEBHOOK — handles action callbacks from Twilio Studio
//  Deploy this script as a Web App (anonymous access)
//  and point your Studio flow's HTTP widget to its URL
// ─────────────────────────────────────────────
function doPost(e) {
 try {
   const params = JSON.parse(e.postData.contents);
   const phone  = params.phone  ? params.phone.toString().trim()  : "";
   const action = params.action ? params.action.toString().trim() : "";
   if (!phone || !action) {
     return ContentService.createTextOutput("Missing phone or action");
   }
   const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("FinalOrders");
   const rows  = sheet.getDataRange().getValues();
   for (let i = 1; i < rows.length; i++) {
     const rowPhone = rows[i][COL.PHONE] ? formatPhone(rows[i][COL.PHONE]) : "";
     if (rowPhone !== phone) continue;
     const row = i + 1; // 1-based for getRange
     if (action === "extended") {
       const r1 = rows[i][COL.REMINDER1_DATE] ? new Date(rows[i][COL.REMINDER1_DATE]) : null;
       const r2 = rows[i][COL.REMINDER2_DATE] ? new Date(rows[i][COL.REMINDER2_DATE]) : null;
       if (r1) {
         r1.setDate(r1.getDate() + 15);
         sheet.getRange(row, COL.REMINDER1_DATE + 1).setValue(formatDate(r1));
         sheet.getRange(row, COL.REMINDER1_SENT + 1).setValue(""); // reset so it resends
       }
       if (r2) {
         r2.setDate(r2.getDate() + 15);
         sheet.getRange(row, COL.REMINDER2_DATE + 1).setValue(formatDate(r2));
         sheet.getRange(row, COL.REMINDER2_SENT + 1).setValue(""); // reset so it resends
       }
     } else if (action === "confirmed_pickup") {
       sheet.getRange(row, COL.READY_SENT + 1).setValue("Picked Up"); // Q
     } else if (action === "cancelled") {
       sheet.getRange(row, COL.CONFIRMED_SENT + 1).setValue("Cancelled"); // P
     }
     break;
   }
   return ContentService.createTextOutput("OK");
 } catch (err) {
   console.error("doPost error:", err);
   return ContentService.createTextOutput("Error: " + err.message);
 }
}
// ─────────────────────────────────────────────
//  TEST FUNCTION — remove before going live
// ─────────────────────────────────────────────
function testConfirmed() {
 const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("FinalOrders");
 const fakeEvent = {
   range: sheet.getRange(2, 1), // row 2, col A
   source: SpreadsheetApp.getActiveSpreadsheet()
 };
 onEdit(fakeEvent);
}
// ─────────────────────────────────────────────
//  MENU
// ─────────────────────────────────────────────
function onOpen() {
 SpreadsheetApp.getUi()
   .createMenu("📱 SMS")
   .addItem("Run Daily Check Now", "checkAndSendMessages")
   .addToUi();
}
