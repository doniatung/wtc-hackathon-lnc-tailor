/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface ExtractionItem {
  description: string;
  price: number | null;
  notes: string | null;
}

export interface ExtractionResult {
  customer_name: string | null;
  phone: string | null;
  order_number: string | null;
  pick_up_date: string | null; // YYYY-MM-DD
  pick_up_time: string | null; // HH:MM
  ticket_total: number | null;
  amount_paid: number | null;
  balance_due: number | null;
  preferred_language: 'en' | 'zh-hans' | null;
  reminder_1_date: string | null;
  reminder_2_date: string | null;
  has_picked_up: string | null;
  donated: string | null;
  items: ExtractionItem[];
  confidence: {
    name: ConfidenceLevel;
    phone: ConfidenceLevel;
    items: ConfidenceLevel;
    amounts: ConfidenceLevel;
  };
  flags: string[];
}

export type TicketStatus = 'pending' | 'extracting' | 'done' | 'error';

export interface Ticket {
  id: string;
  fileName: string;
  fileSize: number;
  lastModified: number;
  previewUrl: string; // Base64 or Blob URL
  mimeType: string;
  status: TicketStatus;
  data: ExtractionResult | null;
  error?: string;
  costEstimate: number;
  tailorLanguage?: 'en' | 'es';
}

export interface AppState {
  tickets: Ticket[];
  totalCost: number;
}
