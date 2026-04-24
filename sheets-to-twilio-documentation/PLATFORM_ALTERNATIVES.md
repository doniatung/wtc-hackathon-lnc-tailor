# Messaging Platform Alternatives

## Overview

The current prototype uses Twilio + Google Apps Script to send WhatsApp messages automatically. It was built to validate the core messaging flow and is not intended as a long-term production solution. It requires occasional developer involvement when structural changes are needed (new columns, new reminders, new languages).

This document outlines alternative platforms that may be more owner-friendly for day-to-day management, along with their costs and tradeoffs. It is intended to help the owner make an informed decision about the future of the messaging system.

---

## Current Prototype — Twilio + Google Apps Script

**How it works:** Google Sheets triggers a script that calls Twilio Studio, which sends the message. Message templates are managed directly in the Messages sheet. The prototype currently uses Twilio's WhatsApp sandbox, which is free but limited to verified numbers only and not suitable for real customers.

**What the owner can do without a developer:**
- Edit message templates in the Messages sheet
- Add new orders in FinalOrders
- Change the language of a customer's messages

**What requires a developer:**
- Adding or renaming columns
- Adding new reminder types
- Adding new languages
- Any changes to trigger logic

**Costs (prototype):**
- Twilio WhatsApp Sandbox: Free (prototyping only, not for real customers)
- Google Apps Script: Free

**Costs (production):**
- Twilio local SMS number: ~$1/month
- A2P 10DLC registration (required for US SMS): ~$4–$20 one-time fee
- SMS messages: ~$0.0079 per message sent
- Google Apps Script: Free

**Steps to go from prototype to production with Twilio:**

1. **Get a local Twilio phone number** — In the Twilio Console go to Phone Numbers → Manage → Buy a Number. Search by area code and select a number with SMS capability. Avoid toll-free numbers as they require a separate verification process that can take weeks.

2. **Register for A2P 10DLC** — Go to Messaging → Regulatory Compliance → A2P 10DLC in the Twilio Console. Register your brand (business name, address, EIN if available) and create a campaign describing your messaging use case (e.g. "Order notifications and pickup reminders"). Link your phone number to the campaign. Approval typically takes a few days to a few weeks.

3. **Update the script** — Replace the WhatsApp sandbox number with your new local number and remove the `whatsapp:` prefix:
   ```javascript
   const TWILIO_FROM_NUMBER = "+1XXXXXXXXXX";
   ```

4. **Update Twilio Studio** — In your Studio flow's Send Message block, update the From field to your new local number (plain format, no `whatsapp:` prefix) and update the To field from `whatsapp:{{contact.channel.address}}` back to `{{contact.channel.address}}`. Make sure the channel is set to SMS. Save and Publish.

5. **Test with a verified number** — Send a test message to confirm everything works end to end before sharing with real customers.

**Best for:** Teams that want full control over their messaging logic, support multiple languages with custom date formatting, and have occasional developer access for structural changes.

---

## Alternative Platforms

### Zapier + SMS Provider

**How it works:** Zapier is a no-code automation tool that connects apps together visually. You set up "Zaps" — rules like "when a row is added to Google Sheets, send a text via SimpleTexting." No coding required.

**What the owner can do without a developer:**
- Build and edit automations through a visual interface
- Change message templates
- Add new triggers and conditions
- Connect to other tools (email, Slack, etc.)

**What requires a developer:**
- Complex multi-step logic
- Custom date formatting per language
- Anything beyond Zapier's built-in features

**Costs:**
- Zapier Free plan: 100 tasks/month, limited features
- Zapier Starter: ~$20/month, 750 tasks/month
- Zapier Professional: ~$49/month, 2,000 tasks/month
- SMS provider (e.g. Twilio) costs still apply on top

**Best for:** Owners who want to manage automations themselves without touching any code.

---

### SimpleTexting

**How it works:** A business texting platform with built-in automations, scheduling, and templates. Has a simple dashboard the owner can manage entirely on her own. Google Sheets integration is available through Zapier.

**What the owner can do without a developer:**
- Create and edit message templates
- Set up auto-reply and scheduled messages
- Manage contacts and opt-outs
- View delivery reports and analytics

**What requires a developer:**
- Google Sheets integration (needs Zapier)
- Custom logic beyond SimpleTexting's built-in automation rules

**Costs:**
- Starter: ~$39/month (local number) or ~$29/month (toll-free) — includes 500 messages
- Additional messages billed at overage rates (~$0.05/message on lower plans)
- Local number requires one-time $4 carrier registration fee
- Toll-free number included at no extra cost; local number adds ~$10/month
- Note: extra users cost ~$20/month each — factor this in for team use

**Best for:** Owners who want a standalone SMS platform with minimal setup and no coding.

---

### Sakari

**How it works:** A business SMS platform similar to SimpleTexting. Despite being listed as having a Google Sheets integration, it actually connects through Zapier — not directly. So the setup is Google Sheets → Zapier → Sakari → SMS.

**What the owner can do without a developer:**
- Edit message templates in Zapier visually
- Map Google Sheets columns to message placeholders (e.g. customer name, item)
- Manage contacts and view delivery reports in Sakari's dashboard

**What requires a developer or workaround:**
- Date-based triggers (e.g. "send when today equals pickup date") — Zapier does not have a native trigger for this, requiring a daily scheduled Zap with filter conditions
- Multilingual date formatting — no equivalent of the custom date logic in the prototype, dates would be sent as-is from the sheet
- Writing "Triggered" back to the sent columns in Sheets — doable but requires an extra action step per Zap

**Costs:**
- Plans start at ~$25/month — includes a set number of messaging credits
- Per-message rate varies by plan (~$0.03–$0.05 per segment in the US)
- Unused credits roll over for 90 days
- Unlimited users and contacts on all plans — no per-user fee
- One free dedicated phone number included
- Zapier plan required on top for Google Sheets integration: ~$20–49/month

**Best for:** Owners who want a visual interface for managing message templates and are comfortable with simpler date handling and no multilingual date formatting.

---

### OpenPhone (now rebranded as Quo)

**How it works:** A business phone and messaging platform designed for small teams (rebranded as Quo in September 2025 — same product, new name). Has automations, auto-replies, shared inboxes, and an AI receptionist called Sona. More of a full business communication tool than a pure messaging API. Google Sheets integration goes through Zapier.

**What the owner can do without a developer:**
- Manage all messaging from a clean mobile and desktop app
- Set up auto-replies and basic automations
- Share a team inbox for customer conversations
- Send and receive calls as well as texts

**What requires a developer:**
- Google Sheets integration (needs Zapier)
- Custom automation logic

**Costs:**
- Starter: $15/user/month (annual) or $19/user/month (monthly)
- Business: $23/user/month (annual) or $33/user/month (monthly)
- One number per user included; extra numbers ~$5/month each
- A2P 10DLC registration required for US SMS texting
- Zapier costs additional if needed for Sheets integration

**Best for:** Owners who want a full business phone system and want to handle customer replies as well as outbound messages.

---

## Side-by-Side Comparison

| | Twilio + Apps Script (prototype) | Twilio + Apps Script (production) | Zapier + Twilio | SimpleTexting | Sakari | OpenPhone (Quo) |
|---|---|---|---|---|---|---|
| No coding needed | ❌ Partially | ❌ Partially | ✅ | ✅ | ✅ | ✅ |
| Google Sheets native | ✅ | ✅ | ✅ via Zapier | ✅ via Zapier | ✅ via Zapier | ✅ via Zapier |
| Multilingual support | ✅ Custom | ✅ Custom | ⚠️ Manual | ⚠️ Manual | ⚠️ Manual | ⚠️ Manual |
| Custom date formatting | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Date-based reminders | ✅ Native | ✅ Native | ⚠️ Workaround | ⚠️ Workaround | ⚠️ Workaround | ⚠️ Workaround |
| Real customer SMS | ❌ Sandbox only | ✅ | ✅ | ✅ | ✅ | ✅ |
| A2P registration required | ❌ | ✅ (~$4–20, few weeks) | ✅ | ✅ (handled by platform) | ✅ (handled by platform) | ✅ (handled by platform) |
| Owner can edit templates | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Owner can add automations without developer | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Approx. monthly cost | Free | ~$1–5 | ~$20–50+ | ~$39+ | ~$25+ Zapier | ~$15–23/user |
| Developer needed for changes | Sometimes | Sometimes | Rarely | Rarely | Rarely | Rarely |

---

## Recommendation

If the owner's priority is **independence from developers**, the best path forward is:

1. **Short term:** The prototype has validated that the messaging flow works end to end. Use it while evaluating which production platform best fits the business. Do not use the prototype for real customers — the WhatsApp sandbox is for testing only.

2. **Medium term — two paths depending on priorities:**
   - **Stay with Twilio + Apps Script (production):** If the custom multilingual date formatting and native date-based reminders are important, the cleanest path is to take the existing prototype to production. This means registering for A2P 10DLC, getting a local Twilio number, and making the small script and Studio changes described above. The developer dependency stays the same but the core logic is already built and tested.
   - **Migrate to Zapier + SimpleTexting or Sakari:** If the owner wants to manage automations herself without any developer involvement, this is the better path. Trade-off is losing the custom date formatting and needing workarounds for date-based reminders.

3. **Long term:** If the business grows and customer communication becomes more complex (two-way conversations, team inboxes, call handling), consider **OpenPhone (now Quo)** for a full business communication platform.

The prototype is not a dead end — the messaging logic, column structure, and template system are all transferable concepts regardless of which platform is chosen next.
