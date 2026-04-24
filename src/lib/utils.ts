/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ExtractionResult } from "../types";

export function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ');
}

export function formatCurrency(value: number | null): string {
  if (value === null) return '';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

export function generateCSV(results: (ExtractionResult | null)[]): string {
  const headers = [
    'customer_name', 'phone', 'order_number', 'pick_up_date', 'pick_up_time', 
    'item_description', 'item_notes', 'item_price', 
    'ticket_total', 'amount_paid', 'balance_due', 'preferred_language',
    'reminder_1_date', 'reminder_2_date', 'donated', 'has_picked_up',
    'order_confirmed_sent', 'order_ready_sent', 'reminder_1_sent', 
    'reminder_2_sent', 'donated_sent'
  ];

  const rows = results.flatMap(data => {
    if (!data) return [];
    
    return data.items.map((item, index) => {
      const isFirst = index === 0;

      return [
        isFirst ? (data.customer_name || '') : '',
        isFirst ? (data.phone || '') : '',
        isFirst ? (data.order_number || '') : '',
        isFirst ? (data.pick_up_date || '') : '',
        isFirst ? (data.pick_up_time || '') : '',
        item.description || '',
        item.notes || '',
        item.price?.toString() || '',
        isFirst ? (data.ticket_total?.toString() || '') : '',
        isFirst ? (data.amount_paid?.toString() || '') : '',
        isFirst ? (data.balance_due?.toString() || '') : '',
        isFirst ? (data.preferred_language || '') : '',
        isFirst ? (data.reminder_1_date || '') : '',
        isFirst ? (data.reminder_2_date || '') : '',
        '', // donated
        isFirst ? 'Triggered' : '', // order_confirmed_sent
        '', // order_ready_sent
        '', // reminder_1_sent
        '', // reminder_2_sent
        '', // donated_sent
      ].map(val => `"${val.replace(/"/g, '""')}"`).join(',');
    });
  });

  return [headers.join(','), ...rows].join('\n');
}

export function generateTSV(results: (ExtractionResult | null)[]): string {
  const headers = [
    'customer_name', 'phone', 'order_number', 'pick_up_date', 'pick_up_time', 
    'item_description', 'item_notes', 'item_price', 
    'ticket_total', 'amount_paid', 'balance_due', 'preferred_language',
    'reminder_1_date', 'reminder_2_date', 'donated', 'has_picked_up',
    'order_confirmed_sent', 'order_ready_sent', 'reminder_1_sent', 
    'reminder_2_sent', 'donated_sent'
  ];

  const rows = results.flatMap(data => {
    if (!data) return [];
    
    return data.items.map((item, index) => {
      const isFirst = index === 0;

      return [
        isFirst ? (data.customer_name || '') : '',
        isFirst ? (data.phone || '') : '',
        isFirst ? (data.order_number || '') : '',
        isFirst ? (data.pick_up_date || '') : '',
        isFirst ? (data.pick_up_time || '') : '',
        item.description || '',
        item.notes || '',
        item.price?.toString() || '',
        isFirst ? (data.ticket_total?.toString() || '') : '',
        isFirst ? (data.amount_paid?.toString() || '') : '',
        isFirst ? (data.balance_due?.toString() || '') : '',
        isFirst ? (data.preferred_language || '') : '',
        isFirst ? (data.reminder_1_date || '') : '',
        isFirst ? (data.reminder_2_date || '') : '',
        '', // donated
        isFirst ? 'Triggered' : '', // order_confirmed_sent
        '', // order_ready_sent
        '', // reminder_1_sent
        '', // reminder_2_sent
        '', // donated_sent
      ].join('\t');
    });
  });

  return [headers.join('\t'), ...rows].join('\n');
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
}
