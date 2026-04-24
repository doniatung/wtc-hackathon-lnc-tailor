# App Scripts

This folder contains Google Apps Script files that should be added at [script.google.com](https://script.google.com). Each `.gs` file corresponds to a separate Apps Script project tied to a Google Sheet.

## ImageUpload.gs

This script receives ticket data from the Ticket Extractor app and writes it to a Google Sheet.

### Setup

1. Open [script.google.com](https://script.google.com) and create a new project (or open the script editor from your target Google Sheet).
2. Copy the contents of `ImageUpload.gs` into the editor.
3. Save the project.

### Deploying as a Web App

The script must be deployed as a **Web app** so the Ticket Extractor can send data to it.

1. Click **Deploy > New deployment** in the Apps Script editor.
2. Under **Select type**, choose **Web app**.
3. Configure the deployment:
   - **Description** — can be anything.
   - **Execute as** — your account (default).
   - **Who has access** — must be set to **Anyone**.
4. Click **Deploy**.
5. Copy the resulting URL.

### Connecting to the Ticket Extractor

Paste the deployed URL into the **Apps Script URL** field under **Sync Settings** in the Ticket Extractor's Scan tab. Once saved, the app will show a "Connected to Sheet" status and ticket data will sync automatically.

---

## SheetToTwilio.gs

This script reads order data from a **FinalOrders** sheet and sends WhatsApp messages to customers via a Twilio Studio Flow. It handles the full notification lifecycle: order confirmation, order ready, pickup reminders, donation notices, and Studio callback webhooks.

### Required Sheet Structure

The script expects two sheets in the same spreadsheet:

- **FinalOrders** — one row per order. Columns A–U map to: customer name, phone, order number, pickup date, pickup time, item description, item notes, item price, ticket total, amount paid, balance due, preferred language (`en` or `zh-CN`), reminder 1 date, reminder 2 date, donated flag, and five sent-status columns (order confirmed, order ready, reminder 1, reminder 2, donated), plus a "has picked up" flag.
- **Messages** — message templates. First column is the message type (`confirmed`, `ready`, `reminder1`, `reminder2`, `donated`); subsequent columns are keyed by language code (`en`, `zh-CN`). Templates use `{{field_name}}` placeholders that are filled from the row data.

### Configuration

At the top of the file, update the four constants before deploying:

```js
const TWILIO_ACCOUNT_SID = "...";   // Your Twilio Account SID
const TWILIO_AUTH_TOKEN  = "...";   // Your Twilio Auth Token
const TWILIO_FROM_NUMBER = "whatsapp:+14155238886"; // Twilio WhatsApp sender
const STUDIO_FLOW_SID    = "...";   // Your Twilio Studio Flow SID
```

### Setup

1. Open [script.google.com](https://script.google.com) and create a new project bound to your target Google Sheet (or open the script editor from the sheet directly).
2. Copy the contents of `SheetToTwilio.gs` into the editor.
3. Fill in the four configuration constants above.
4. Save the project.

### Triggers

The script uses two trigger types that must be set up in **Triggers** (clock icon in the Apps Script editor):

| Trigger | Function | When it fires |
|---|---|---|
| On edit | `onEdit` | Automatically when a cell is edited in FinalOrders |
| Time-based | `checkAndSendMessages` | Run daily (e.g. 8 AM) via a time-driven trigger |

**`onEdit` behavior:**
- Fires an **Order Confirmed** WhatsApp message the first time all required fields (name, phone, pickup date/time, item, totals, language) are filled in a row.
- Fires a **Donated** message when the Donated column (O) is set to `yes`.
- Skips rows where Has Picked Up (U) is `yes`.

**`checkAndSendMessages` behavior (run daily):**
- Sends an **Order Ready** message on the day of pickup.
- Sends **Reminder 1** and **Reminder 2** on their respective dates (columns M and N).
- Skips rows already sent, missing required fields, or marked as picked up.

### Deploying the Webhook

> **Note:** This section has not been tested. The current Twilio integration only handles outbound message sending — two-way communication (receiving replies and triggering callbacks) is not yet implemented end-to-end.

The `doPost` function handles action callbacks from Twilio Studio (e.g. a customer replies to confirm or extend their pickup). To enable it:

1. Click **Deploy > New deployment**, choose **Web app**.
2. Set **Execute as** to your account and **Who has access** to **Anyone**.
3. Copy the resulting URL and set it as the HTTP request URL in your Twilio Studio flow.

Supported `action` values posted to the webhook:

| Action | Effect |
|---|---|
| `extended` | Shifts reminder 1 and reminder 2 dates forward 15 days and resets their sent flags |
| `confirmed_pickup` | Marks the Ready Sent column as "Picked Up" |
| `cancelled` | Marks the Confirmed Sent column as "Cancelled" |
