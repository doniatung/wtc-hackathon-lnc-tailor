/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { ExtractionResult } from "../types";

// Note: Using process.env.GEMINI_API_KEY as per standard environment guidelines
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const SYSTEM_INSTRUCTION = `You extract handwritten tailoring shop tickets into structured JSON. Return exactly one JSON object and nothing else — no prose, no markdown fences, no commentary.

Rules:
- Tickets are pre-printed carbon receipts with numbered rows 1–15. Handwriting often wraps across multiple printed rows for a single item — treat indented or continuation lines as part of the item above. For example "bottom w/ pocket" on one line and "shift" on the next printed row is ONE item ("bottom w/ pocket shift"), not two.
- Parenthetical phrases like "(Harris Tweed)", "(lining)", "(not diagonal but even)", "(Twiggy 60s blue)" belong in item.notes, not item.description.
- Strikethrough numbers at the top of the ticket are prior balances that have been updated. The value that is NOT crossed out is the current one. If you see "$535" struck through and "$425" next to it, the current total is $425.
- "Fully Paid", "fully PAID", or "balance $0" means amount_paid == ticket_total and balance_due == 0.
- Dates like "12/11/2025" are US format (MM/DD/YYYY). Convert to YYYY-MM-DD.
- Times like "5PM" become "17:00". "3PM" becomes "15:00".
- Names may be first-name-only (e.g. "Angie"). Return what's written.
- Phone numbers: digits only, no formatting. If not written on the ticket, return null. NEVER fabricate a phone number.
- Order number is the red preprinted number at the top right (e.g. "0027389").
- If a digit is unclear, lower the relevant confidence to "low" and still return your best guess.
- Common flags when applicable: "no_phone", "strikethroughs_present", "partial_payment", "illegible_price", "ambiguous_name", "work_description_unclear".
- If the image is not a tailoring ticket or is completely illegible, return all fields null and set flags: ["not_a_ticket"].`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    customer_name: { type: Type.STRING, nullable: true },
    phone: { type: Type.STRING, nullable: true },
    order_number: { type: Type.STRING, nullable: true },
    pick_up_date: { type: Type.STRING, nullable: true, description: "YYYY-MM-DD" },
    pick_up_time: { type: Type.STRING, nullable: true, description: "HH:MM" },
    ticket_total: { type: Type.NUMBER, nullable: true },
    amount_paid: { type: Type.NUMBER, nullable: true },
    balance_due: { type: Type.NUMBER, nullable: true },
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING },
          price: { type: Type.NUMBER, nullable: true },
          notes: { type: Type.STRING, nullable: true }
        },
        required: ["description"]
      }
    },
    confidence: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, enum: ["high", "medium", "low"] },
        phone: { type: Type.STRING, enum: ["high", "medium", "low"] },
        items: { type: Type.STRING, enum: ["high", "medium", "low"] },
        amounts: { type: Type.STRING, enum: ["high", "medium", "low"] }
      },
      required: ["name", "phone", "items", "amounts"]
    },
    flags: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    }
  },
  required: ["customer_name", "phone", "order_number", "items", "confidence", "flags"]
};

export async function extractTicketData(base64Image: string, mimeType: string): Promise<ExtractionResult> {
  const model = "gemini-3-flash-preview"; // Latest model recommended for basic text/extraction
  
  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          parts: [
            {
              inlineData: {
                data: base64Image.split(',')[1] || base64Image,
                mimeType: mimeType
              }
            },
            {
              text: "Extract the tailoring ticket data according to the rules."
            }
          ]
        }
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA as any
      }
    });

    const result = JSON.parse(response.text || "{}");
    return result as ExtractionResult;
  } catch (error) {
    console.error("Gemini Extraction Error:", error);
    throw error;
  }
}
