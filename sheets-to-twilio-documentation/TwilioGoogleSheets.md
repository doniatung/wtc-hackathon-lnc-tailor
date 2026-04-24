# Order Messaging System — Documentation

## Overview

This system connects Google Sheets to Twilio Studio to automatically send WhatsApp messages to customers at key points in their order lifecycle. When order details are filled in, or when specific dates arrive, the script fires messages through Twilio Studio without any manual effort.

---

## Sheets Setup

### FinalOrders
The main sheet where orders are entered. Each row is one customer order. The columns are:

| Column | Name | Description |
|--------|------|-------------|
| A | customer_name | Customer's full name |
| B | phone | Customer's phone number (any format, script normalizes it) |
| C | order_number | Order reference number |
| D | pick_up_date | Date the order is available for pickup |
| E | pick_up_time | Time the order is available for pickup |
| F | item_description | Description of the item |
| G | item_notes | Additional notes about the item |
| H | item_price | Price of the item |
| I | ticket_total | Total ticket amount |
| J | amount_paid | Amount already paid |
| K | balance_due | Remaining balance (can be 0) |
| L | preferred_language | Language for messages — `en` or `zh-CN` |
| M | reminder_1_date | Date to send Reminder 1 (auto-calculated: pickup + 15 days) |
| N | reminder_2_date | Date to send Reminder 2 (auto-calculated: pickup + 30 days) |
| O | donated | Type `yes` when an unclaimed order is donated |
| P | order_confirmed_sent | Auto-filled by script when confirmed message is sent |
| Q | order_ready_sent | Auto-filled by script when ready message is sent |
| R | reminder_1_sent | Auto-filled by script when reminder 1 is sent |
| S | reminder_2_sent | Auto-filled by script when reminder 2 is sent |
| T | donated_sent | Auto-filled by script when donated message is sent |
| U | has_picked_up | Type `yes` when customer has picked up — stops all future messages |

### Messages
The template sheet where message content is stored. The script reads from this sheet to build messages before sending.

The sheet must have this header row:

| type | label | en | zh-CN |
|------|-------|----|----|
| confirmed | Order Confirmed | Hi {{customer_name}}... | 您好 {{customer_name}}... |
| ready | Order Ready | ... | ... |
| reminder1 | Reminder 1 | ... | ... |
| reminder2 | Reminder 2 | ... | ... |
| donated | Donated | ... | ... |

**Important:** The `type` column values must be exactly `confirmed`, `ready`, `reminder1`, `reminder2`, `donated` — the script uses these as lookup keys. Do not rename or reorder them. The `label` column is for reference only and is ignored by the script.

**Available placeholders** for message templates:

| Placeholder | Value |
|-------------|-------|
| `{{customer_name}}` | Customer's name |
| `{{phone}}` | Customer's phone number |
| `{{order_number}}` | Order number |
| `{{pick_up_date}}` | Pickup date (formatted by language) |
| `{{pick_up_time}}` | Pickup time |
| `{{item_description}}` | Item description |
| `{{item_notes}}` | Item notes |
| `{{item_price}}` | Item price |
| `{{ticket_total}}` | Ticket total |
| `{{amount_paid}}` | Amount paid |
| `{{balance_due}}` | Balance due |

Dates are automatically formatted based on language — English gets `January 22, 2026` and Chinese gets `2026年1月22日`.

---

## Script Logic

### Message Types & When They Fire

**Order Confirmed**
Fires automatically via `onEdit` the moment all required fields are filled in for a row. Required fields are: customer name, phone, pickup date, pickup time, item description, ticket total, amount paid, balance due, and preferred language. Once all are present and `order_confirmed_sent` is empty, the message fires and the column is marked "Triggered".

**Order Ready**
Fires via the daily `checkAndSendMessages` function on the day of pickup (when today's date matches `pick_up_date`). Only fires if `order_ready_sent` is empty.

**Reminder 1**
Fires via the daily `checkAndSendMessages` function when today's date matches `reminder_1_date`. Only fires if `reminder_1_sent` is empty. The reminder date is typically auto-calculated as pickup date + 15 days using an ArrayFormula in the sheet.

**Reminder 2**
Same as Reminder 1 but uses `reminder_2_date` (typically pickup date + 30 days).

**Donated**
Fires automatically via `onEdit` the moment someone types `yes` in the `donated` column. Only fires if `donated_sent` is empty and the row has a name and phone number.

### Skipping Rows
The script skips a row entirely (no messages sent) if:
- `has_picked_up` is set to `yes`
- The row is missing a name or phone number
- The pickup date is missing or invalid

### Sent Columns
Columns P through T track which messages have been sent. The script checks these before sending to prevent duplicate messages. If you need to re-send a message for any reason, clear the corresponding sent column cell and the script will send it again on the next run or edit.

### Phone Number Formatting
The script automatically normalizes phone numbers to E.164 format (`+1XXXXXXXXXX`). Numbers can be entered in any common format — `6463142289`, `646-314-2289`, `(646) 314-2289` — and the script will handle the formatting.

---

## Triggers

There are two types of triggers in this system.

### onEdit (Automatic)
This trigger fires automatically whenever a cell in the FinalOrders sheet is edited. It handles Order Confirmed and Donated messages. No setup is required for this to work, but it must be installed as an **installable trigger** (not the default simple trigger) so it has permission to make external calls to Twilio.

**How to set up the onEdit installable trigger:**
1. In Apps Script, click the clock icon in the left sidebar
2. Click **+ Add Trigger**
3. Configure as follows:
   - Function: `onEdit`
   - Deployment: Head
   - Event source: From spreadsheet
   - Event type: On edit
4. Click Save and authorize when prompted

### checkAndSendMessages (Daily)
This function runs once a day and checks every row for Order Ready, Reminder 1, and Reminder 2 messages. It must be set up as a time-based trigger.

**How to set up the daily trigger:**
1. In Apps Script, click the clock icon in the left sidebar
2. Click **+ Add Trigger**
3. Configure as follows:
   - Function: `checkAndSendMessages`
   - Deployment: Head
   - Event source: Time-driven
   - Type: Day timer
   - Time of day: 8am – 9am (or preferred time)
4. Click Save and authorize when prompted

Make sure the Apps Script timezone matches your customers' timezone. Check and update it under **Project Settings → Script timezone**.

---

## Twilio Configuration

The following constants at the top of the script must be filled in:

```javascript
const TWILIO_ACCOUNT_SID = "ACxxxxxxx";       // Twilio Console dashboard
const TWILIO_AUTH_TOKEN  = "xxxxxxx";         // Twilio Console dashboard
const TWILIO_FROM_NUMBER = "whatsapp:+14155238886"; // Twilio WhatsApp sandbox number
const STUDIO_FLOW_SID    = "FWxxxxxxx";       // Studio → Flows
```

The Twilio Studio flow must have a Send Message block configured as:
- **From:** `whatsapp:+14155238886`
- **To:** `whatsapp:{{contact.channel.address}}`
- **Body:** `{{flow.data.message}}`


