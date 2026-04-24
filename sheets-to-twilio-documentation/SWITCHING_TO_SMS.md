# Switching from WhatsApp Sandbox to a Real Twilio SMS Number

## Background

The current setup uses Twilio's WhatsApp sandbox for messaging. This works well for prototyping but has limitations — sandbox numbers require each recipient to manually opt in, and it is not suitable for production use with real customers.

When you are ready to send real SMS messages to customers, you will need a proper Twilio phone number. This document explains what to expect and how to make the switch.

---

## What to Expect When Getting a Twilio SMS Number

### Local 10-Digit Numbers (e.g. +16462550000)
These are the most common type for small businesses. However, as of 2023, carriers in the US require all businesses sending SMS through 10-digit local numbers to register through a program called **A2P 10DLC** (Application-to-Person 10-Digit Long Code). This involves:
- Registering your brand with The Campaign Registry (TCR)
- Describing your messaging use case
- A one-time registration fee (typically $4–$20)
- Approval can take a few days to a few weeks

### Toll-Free Numbers (e.g. +18885550000)
Toll-free numbers (800, 833, 844, 855, 866, 877, 888) require **Toll-Free Verification** before they can send SMS. This also involves submitting business information and can take several weeks to be approved.

### Short Codes (e.g. 12345)
5 or 6 digit numbers that are pre-approved for high-volume messaging. These are overkill for small businesses and cost significantly more.

### Recommendation
For a small business sending order notifications, a **local 10-digit number with A2P 10DLC registration** is the right choice. It is the most straightforward path to a production-ready SMS setup.

---

## How to Register for A2P 10DLC

1. Log in to the **Twilio Console**
2. Go to **Messaging → Regulatory Compliance → A2P 10DLC**
3. Register your **Brand** — this is your business identity (name, address, EIN if available)
4. Create a **Campaign** — describe how you use SMS (e.g. "Order notifications and pickup reminders for customers")
5. Link your Twilio phone number to the campaign
6. Wait for approval — Twilio will notify you by email

Once approved, your number can send SMS to any US number without restrictions.

---

## Script Changes Required

Once you have a verified Twilio SMS number, update the following in the Apps Script:

**1. Update the From number:**
```javascript
const TWILIO_FROM_NUMBER = "+1XXXXXXXXXX"; // your verified Twilio local number
```
Note: remove the `whatsapp:` prefix — that was only needed for the WhatsApp sandbox.

**2. Update the formatPhone function:**
The current version formats numbers for WhatsApp. For SMS, no prefix is needed — the function already returns plain E.164 format (`+1XXXXXXXXXX`) which is correct for SMS.

---

## Twilio Studio Changes Required

In your Studio Send Message block, update the following:

- **From:** your Twilio local number (e.g. `+16462550000`) — remove the `whatsapp:` prefix
- **To:** `{{contact.channel.address}}` — remove the `whatsapp:` prefix
- **Channel:** make sure it is set to **SMS**, not WhatsApp
- **Body:** `{{flow.data.message}}` — no change needed

Save and Publish the flow after making these changes.

---

## Summary of Changes

| | WhatsApp Sandbox (current) | SMS with Twilio Number |
|---|---|---|
| From number | `whatsapp:+14155238886` | `+1XXXXXXXXXX` |
| To number in Studio | `whatsapp:{{contact.channel.address}}` | `{{contact.channel.address}}` |
| Registration required | No | Yes (A2P 10DLC) |
| Recipients need to opt in | Yes (sandbox only) | No |
| Production ready | No | Yes |
| Script changes | None | Update `TWILIO_FROM_NUMBER` |
