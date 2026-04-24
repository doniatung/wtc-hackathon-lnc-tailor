/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Upload, 
  Trash2, 
  Copy, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Plus, 
  X,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Image as ImageIcon,
  DollarSign,
  Printer,
  LayoutDashboard,
  Scan
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { Ticket, TicketStatus, ExtractionResult, ExtractionItem } from './types';
import { extractTicketData } from './services/geminiService';
import { cn, formatCurrency, generateCSV, generateTSV, fileToBase64 } from './lib/utils';
import { Dashboard } from './components/Dashboard';

const MAX_CONCURRENT = 3;
const COST_PER_TICKET = 0.0002;
const STORAGE_KEY = 'ticket_extractor_state';

export default function App() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTab, setActiveTab] = useState<'scan' | 'dashboard'>('scan');
  const [isDragging, setIsDragging] = useState(false);
  const processingQueue = useRef<string[]>([]);
  const activeRequests = useRef(new Set<string>());

  // Load from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setTickets(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse storage", e);
      }
    }
  }, []);

  // Save to LocalStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
  }, [tickets]);

  // Handle processing queue
  const processNextInQueue = useCallback(async () => {
    if (activeRequests.current.size >= MAX_CONCURRENT || processingQueue.current.length === 0) return;

    const ticketId = processingQueue.current.shift()!;
    activeRequests.current.add(ticketId);

    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: 'extracting' } : t));

    try {
      const ticket = tickets.find(t => t.id === ticketId) || (window as any)._lastUploadedTickets?.find((t: any) => t.id === ticketId);
      if (!ticket) throw new Error("Ticket not found");

      const result = await extractTicketData(ticket.previewUrl, ticket.mimeType);
      
      // Add defaults for new fields
      const getBaseDate = () => {
        if (result.pick_up_date) {
            const d = new Date(result.pick_up_date);
            if (!isNaN(d.getTime())) return d;
        }
        return new Date();
      };

      const baseDate = getBaseDate();
      const formatDate = (date: Date) => date.toISOString().split('T')[0];
      const r1 = new Date(baseDate);
      r1.setDate(baseDate.getDate() + 15);
      const r2 = new Date(baseDate);
      r2.setDate(baseDate.getDate() + 30);

      const resultWithDefaults: ExtractionResult = {
        ...result,
        preferred_language: result.preferred_language || 'en',
        reminder_1_date: result.reminder_1_date || formatDate(r1),
        reminder_2_date: result.reminder_2_date || formatDate(r2)
      };

      setTickets(prev => prev.map(t => 
        t.id === ticketId 
          ? { ...t, status: 'done', data: resultWithDefaults, error: undefined, tailorLanguage: 'en' } 
          : t
      ));
    } catch (err) {
      setTickets(prev => prev.map(t => 
        t.id === ticketId 
          ? { ...t, status: 'error', error: err instanceof Error ? err.message : "Extraction failed" } 
          : t
      ));
    } finally {
      activeRequests.current.delete(ticketId);
      processNextInQueue();
    }
  }, [tickets]);

  useEffect(() => {
    processNextInQueue();
  }, [tickets, processNextInQueue]);

  const handleFiles = async (files: FileList | File[]) => {
    const newItems: Ticket[] = [];
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const base64 = await fileToBase64(file);
        
        const newTicket: Ticket = {
            id: Math.random().toString(36).substring(7),
            fileName: file.name,
            fileSize: file.size,
            lastModified: file.lastModified,
            previewUrl: base64,
            mimeType: file.type,
            status: 'pending',
            data: null,
            costEstimate: COST_PER_TICKET,
        };
        newItems.push(newTicket);
        processingQueue.current.push(newTicket.id);
    }
    
    // Store temporarily to avoid stale state in processNextInQueue
    (window as any)._lastUploadedTickets = newItems;
    setTickets(prev => [...prev, ...newItems]);
  };

  const removeTicket = (id: string) => {
    setTickets(prev => prev.filter(t => t.id !== id));
    activeRequests.current.delete(id);
    processingQueue.current = processingQueue.current.filter(qid => qid !== id);
  };

  const reprocessTicket = (id: string) => {
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status: 'pending', error: undefined } : t));
    if (!processingQueue.current.includes(id)) {
        processingQueue.current.push(id);
        processNextInQueue();
    }
  };

  const clearAll = () => {
    setTickets([]);
    processingQueue.current = [];
    activeRequests.current.clear();
  };

    const updateTicketData = (id: string, newData: ExtractionResult) => {
    // Recalculate balance due
    const total = newData.ticket_total || 0;
    const paid = newData.amount_paid || 0;
    const balance = total - paid;
    const status = balance === 0 ? "Fully Paid" : "Balance Due";
    
    // Auto-update balance_due if it's purely a calculation of the two
    const updatedWithBalance = {
      ...newData,
      balance_due: balance
    };

    setTickets(prev => prev.map(t => t.id === id ? { ...t, data: updatedWithBalance } : t));
  };

  const updateTailorLanguage = (id: string, tailorLanguage: 'en' | 'es') => {
    setTickets(prev => prev.map(t => t.id === id ? { ...t, tailorLanguage } : t));
  };

  const copyToClipboard = async () => {
    const tsv = generateTSV(tickets.map(t => t.data));
    await navigator.clipboard.writeText(tsv);
    alert("Table copied to clipboard as TSV!");
  };

  const downloadCSV = () => {
    const csv = generateCSV(tickets.map(t => t.data));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "extracted_tickets.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalCost = tickets.length * COST_PER_TICKET;

    const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [isSyncing, setIsSyncing] = useState(false);
    const [sheetUrl, setSheetUrl] = useState(() => localStorage.getItem('sheet_sync_url') || '');

    useEffect(() => {
        localStorage.setItem('sheet_sync_url', sheetUrl);
    }, [sheetUrl]);

    useEffect(() => {
        if (syncStatus !== 'idle') {
            const timer = setTimeout(() => setSyncStatus('idle'), 3000);
            return () => clearTimeout(timer);
        }
    }, [syncStatus]);

    const syncToSheets = async () => {
        if (!sheetUrl) return;

        setIsSyncing(true);
        try {
            const approvedTickets = tickets.filter(t => t.status === 'done');
            if (approvedTickets.length === 0) return;
            
            const flatData = approvedTickets.flatMap(t => {
                const data = t.data;
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
                        '', // order_confirmed_sent
                        '', // order_ready_sent
                        '', // reminder_1_sent
                        '', // reminder_2_sent
                        '', // donated_sent
                    ];
                });
            });

            await fetch(sheetUrl, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(flatData)
            });
            
            setSyncStatus('success');
        } catch (error) {
            console.error("Sync Error:", error);
            setSyncStatus('error');
        } finally {
            setIsSyncing(false);
        }
    };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans flex flex-col p-6 selection:bg-indigo-100 h-screen overflow-hidden">
      {/* Header Section */}
      <header className="flex justify-between items-center mb-6 shrink-0 px-2">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <ImageIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Ticket Extractor <span className="text-slate-400 font-normal ml-2">v1.0</span></h1>
            </div>
          </div>

          <nav className="flex items-center bg-slate-100 p-1 rounded-xl">
             <button 
              onClick={() => setActiveTab('scan')}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                activeTab === 'scan' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
             >
               <Scan className="w-4 h-4" />
               Scan
             </button>
             <button 
              onClick={() => setActiveTab('dashboard')}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                activeTab === 'dashboard' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
             >
               <LayoutDashboard className="w-4 h-4" />
               Dashboard
             </button>
          </nav>
        </div>
        
        <div className="flex items-center gap-4">
          {tickets.length > 0 && (
            <button 
              onClick={clearAll}
              className="text-sm font-medium text-red-600 hover:text-red-700 transition-colors px-2 cursor-pointer"
            >
              Clear All
            </button>
          )}
        </div>
      </header>

      <AnimatePresence mode="wait">
        {activeTab === 'scan' ? (
          <motion.div 
            key="scan"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex flex-col flex-grow overflow-hidden"
          >
            {/* Main Layout Grid */}
            <div className="grid grid-cols-12 gap-6 flex-grow overflow-hidden">
        
        {/* Left Sidebar: Upload & Queue */}
        <div className="col-span-4 flex flex-col gap-6 h-full overflow-hidden">
          
          {/* Upload Bento Card */}
          <section 
            id="upload-zone"
            className={cn(
              "relative group border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all duration-300 bg-white h-48 shrink-0",
              isDragging ? "border-indigo-500 bg-indigo-50/50 scale-[0.99]" : "border-slate-300 hover:border-indigo-400 bg-opacity-50"
            )}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files) handleFiles(e.dataTransfer.files); }}
          >
            <div className="w-12 h-12 text-slate-300 mb-4 group-hover:text-indigo-500 transition-colors">
              <Upload className="w-full h-full" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600">Drop ticket photos here</p>
              <p className="text-xs text-slate-400 mt-1">Supports JPG, PNG, HEIC</p>
            </div>
            <label id="file-picker-label" className="mt-4 cursor-pointer bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors shadow-lg active:scale-95">
              Browse Files
              <input 
                id="file-input"
                type="file" 
                multiple 
                className="hidden" 
                accept="image/*" 
                onChange={(e) => { if (e.target.files) handleFiles(e.target.files); }} 
              />
            </label>
          </section>

          {/* Configuration Bento Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shrink-0 shadow-sm">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 px-1">Sync Settings</h2>
            <div className="space-y-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-tight ml-1">Apps Script URL</label>
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        value={sheetUrl}
                        onChange={(e) => setSheetUrl(e.target.value)}
                        placeholder="Paste Web App URL here..."
                        className="flex-grow text-[10px] bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-indigo-500 outline-none font-mono truncate"
                    />
                    {sheetUrl && (
                        <button onClick={() => setSheetUrl('')} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
              </div>
              <div className="flex items-center gap-2 px-1">
                <div className={cn("w-2 h-2 rounded-full", sheetUrl ? "bg-green-500 animate-pulse" : "bg-slate-300")}></div>
                <span className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">
                    {sheetUrl ? "Connected to Sheet" : "Not Connected"}
                </span>
              </div>
            </div>
          </div>

          {/* Processing Queue Bento Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex-grow overflow-hidden flex flex-col shadow-sm">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4 px-1">Processing Queue</h2>
            <div className="grid grid-cols-2 gap-3 overflow-y-auto pr-1 custom-scrollbar">
              <AnimatePresence>
                {tickets.map(ticket => (
                  <motion.div 
                    key={ticket.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className={cn(
                      "relative group rounded-xl overflow-hidden border bg-slate-50 aspect-square transition-all",
                      ticket.status === 'extracting' ? "border-2 border-indigo-500" : "border-slate-200"
                    )}
                  >
                    <img src={ticket.previewUrl} className={cn("w-full h-full object-cover", ticket.status !== 'done' && "grayscale opacity-40")} />
                    
                    {/* Status Overlays */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center">
                      {ticket.status === 'extracting' && (
                        <div className="bg-indigo-500/90 text-white text-[9px] font-bold px-2 py-1 rounded-md shadow-lg animate-pulse">EXTRACTING</div>
                      )}
                      {ticket.status === 'pending' && (
                        <div className="bg-slate-800/40 text-white text-[9px] font-bold px-2 py-1 rounded-md backdrop-blur-sm">PENDING</div>
                      )}
                      {ticket.status === 'error' && (
                         <div className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full border-2 border-white shadow-sm" />
                      )}
                      {ticket.status === 'done' && (
                        <div className="absolute top-2 right-2 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white border-2 border-white shadow-sm">
                           <CheckCircle2 className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {tickets.length === 0 && (
                <div className="col-span-2 flex flex-col items-center justify-center py-12 opacity-30">
                  <Clock className="w-8 h-8 mb-2" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">No Active Tasks</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Human Review UI */}
        <div className="col-span-8 flex flex-col overflow-hidden">
          <div className="bg-white border border-slate-200 rounded-2xl flex-grow flex flex-col overflow-hidden shadow-sm relative">
             <AnimatePresence mode="wait">
                {tickets.filter(t => t.status === 'done' || t.status === 'error').length > 0 ? (
                    <div className="flex-grow flex flex-col overflow-y-auto custom-scrollbar">
                         {tickets.filter(t => t.status === 'done' || t.status === 'error').map((ticket, idx) => (
                            <TicketCard 
                                key={ticket.id} 
                                ticket={ticket} 
                                index={idx}
                                onRemove={() => removeTicket(ticket.id)}
                                onReprocess={() => reprocessTicket(ticket.id)}
                                onUpdate={(data) => updateTicketData(ticket.id, data)}
                                onTailorLanguageUpdate={(lang) => updateTailorLanguage(ticket.id, lang)}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex-grow flex items-center justify-center bg-slate-50/50">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-white border border-slate-200 rounded-3xl flex items-center justify-center mx-auto mb-4 text-slate-300 shadow-sm">
                                <Plus className="w-8 h-8" />
                            </div>
                            <p className="text-slate-400 text-sm font-medium">Select a ticket from the queue to prioritize review</p>
                            <p className="text-slate-300 text-[10px] font-bold uppercase tracking-widest mt-1">Review Window Empty</p>
                        </div>
                    </div>
                )}
             </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <footer className="mt-6 flex justify-between items-center h-16 shrink-0 px-2">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-loose">
          <p>{tickets.length} tickets in session &bull; Autocentering active &bull; Syncing with localStorage</p>
        </div>
        
        {tickets.some(t => t.status === 'done') && (
            <motion.div 
                id="floating-export-bar"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="flex gap-4"
            >
                <button 
                    onClick={syncToSheets}
                    disabled={isSyncing || !sheetUrl}
                    className={cn(
                        "flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all active:scale-95 shadow-lg",
                        !sheetUrl ? "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none" :
                        syncStatus === 'success' ? "bg-green-100 text-green-700 shadow-green-900/10" :
                        syncStatus === 'error' ? "bg-red-100 text-red-700 shadow-red-900/10" :
                        "bg-green-600 text-white hover:bg-green-700 shadow-green-900/10",
                        isSyncing && "opacity-50 cursor-wait"
                    )}
                >
                    <div className={cn("w-4 h-4", isSyncing && "animate-spin")}>
                        {isSyncing ? <RefreshCw className="w-full h-full" /> : 
                         syncStatus === 'success' ? <CheckCircle2 className="w-full h-full" /> :
                         syncStatus === 'error' ? <AlertCircle className="w-full h-full" /> :
                         <ChevronRight className="w-full h-full rotate-45" />}
                    </div>
                    {isSyncing ? 'Syncing...' : 
                     syncStatus === 'success' ? 'Synced!' :
                     syncStatus === 'error' ? 'Failed' :
                     'Sync to Sheets'}
                </button>
                <button 
                    onClick={copyToClipboard}
                    className="flex items-center gap-2 bg-white border border-slate-200 px-6 py-3 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
                >
                    <Copy className="w-4 h-4 text-slate-400" />
                    Copy TSV to Clipboard
                </button>
                <button 
                    onClick={downloadCSV}
                    className="flex items-center gap-2 bg-indigo-600 px-8 py-3 rounded-xl text-sm font-bold text-white hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-200"
                >
                    <Download className="w-4 h-4" />
                    Download Nested CSV
                </button>
            </motion.div>
        )}
      </footer>
          </motion.div>
        ) : (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="flex-grow overflow-y-auto custom-scrollbar pr-2"
          >
            <Dashboard />
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
    </div>
  );
}

function TicketCard({ ticket, onRemove, onReprocess, onUpdate, onTailorLanguageUpdate, index }: { 
    ticket: Ticket; 
    onRemove: () => void; 
    onReprocess: () => void;
    onUpdate: (data: ExtractionResult) => void;
    onTailorLanguageUpdate: (lang: 'en' | 'es') => void;
    index: number;
    key?: string | number;
}) {
    if (ticket.status === 'error') {
        return (
            <motion.div 
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-12 text-center border-b border-slate-100 flex flex-col items-center"
            >
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mb-4 border border-red-100 shadow-sm shadow-red-900/5">
                    <AlertCircle className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Extraction Failed</h3>
                <p className="text-slate-500 text-sm max-w-xs mx-auto mb-6">{ticket.error}</p>
                <div className="flex gap-2">
                    <button onClick={onReprocess} className="bg-slate-900 text-white px-6 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-lg active:scale-95 flex items-center gap-2">
                        <RefreshCw className="w-3.5 h-3.5" />
                        Reprocess
                    </button>
                    <button onClick={onRemove} className="bg-white border border-slate-200 text-slate-500 px-6 py-2 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all active:scale-95">
                        Dismiss
                    </button>
                </div>
            </motion.div>
        );
    }

    if (!ticket.data) return null;

    const data = ticket.data;

    const [isPrinting, setIsPrinting] = useState(false);

    const handlePrint = async () => {
        setIsPrinting(true);
        try {
            let itemsToPrint = [...data.items];
            const targetLang = ticket.tailorLanguage === 'es' ? 'Spanish' : 'English';

            if (ticket.tailorLanguage === 'es') {
                const ai = new GoogleGenAI({ apiKey: (process as any).env.GEMINI_API_KEY });
                const prompt = `Translate the following dry cleaning item descriptions and notes into ${targetLang}. 
                Return the translation as a JSON array of objects with 'description' and 'notes' fields.
                
                Input:
                ${JSON.stringify(data.items.map(i => ({ description: i.description, notes: i.notes })))}
                
                Keep the translations concise and appropriate for a tailor/dry cleaner work order.`;

                const response = await ai.models.generateContent({
                    model: "gemini-3-flash-preview",
                    contents: prompt,
                    config: {
                        responseMimeType: "application/json"
                    }
                });

                if (response.text) {
                    itemsToPrint = JSON.parse(response.text);
                }
            }

            const translations = {
                en: { customer: 'Customer', ticket: 'Ticket #', items: 'Items', description: 'Description', notes: 'Notes' },
                es: { customer: 'Cliente', ticket: 'Ticket #', items: 'Artículos', description: 'Descripción', notes: 'Notas' }
            };

            const t = translations[ticket.tailorLanguage || 'en'];

            // Simplified print template
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                const html = `
                    <html>
                    <head>
                        <title>Print Ticket #${data.order_number}</title>
                        <style>
                            body { font-family: sans-serif; padding: 40px; color: #1e293b; }
                            header { border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 20px; }
                            h1 { margin: 0; font-size: 24px; color: #4f46e5; }
                            .meta { display: flex; justify-content: space-between; margin-top: 10px; font-weight: bold; }
                            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                            th { text-align: left; background: #f8fafc; padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; text-transform: uppercase; color: #64748b; }
                            td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
                            .notes { font-style: italic; color: #94a3b8; font-size: 12px; }
                            @media print {
                                body { padding: 0; }
                                button { display: none; }
                            }
                        </style>
                    </head>
                    <body>
                        <header>
                            <h1>${t.customer}: ${data.customer_name || 'N/A'}</h1>
                            <div class="meta">
                                <span>${t.ticket} ${data.order_number || 'N/A'}</span>
                                <span>${new Date().toLocaleDateString()}</span>
                            </div>
                        </header>
                        <h3>${t.items}</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>${t.description}</th>
                                    <th>${t.notes}</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemsToPrint.map(item => `
                                    <tr>
                                        <td>${item.description}</td>
                                        <td class="notes">${item.notes || ''}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        <script>
                            window.onload = () => {
                                window.print();
                                setTimeout(() => window.close(), 500);
                            };
                        </script>
                    </body>
                    </html>
                `;
                printWindow.document.write(html);
                printWindow.document.close();
            }

        } catch (error) {
            console.error("Print translation error:", error);
            alert("Failed to translate for printing. Please try again.");
        } finally {
            setIsPrinting(false);
        }
    };

    const handleFieldChange = (field: keyof ExtractionResult, value: any) => {
        onUpdate({ ...data, [field]: value });
    };

    const handleItemChange = (idx: number, field: keyof ExtractionItem, value: any) => {
        const newItems = [...data.items];
        newItems[idx] = { ...newItems[idx], [field]: value };
        onUpdate({ ...data, items: newItems });
    };

    const addItem = () => {
        onUpdate({ ...data, items: [...data.items, { description: '', price: null, notes: '' }] });
    };

    const removeItem = (idx: number) => {
        onUpdate({ ...data, items: data.items.filter((_, i) => i !== idx) });
    };

    return (
        <div className="flex-grow flex flex-col border-b border-slate-100 last:border-0 min-h-[600px] group/card">
            {/* Bento Card Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">REPAIR TICKET</span>
                    <span className="text-lg font-mono font-bold text-slate-900">#{data.order_number || '0000000'}</span>
                </div>
                <div className="flex gap-2 items-center">
                    {data.flags.map(f => (
                        <span key={f} className="bg-orange-100 text-orange-700 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-tight">{f}</span>
                    ))}
                    <div className="h-6 w-px bg-slate-200 mx-1"></div>
                    <button 
                        onClick={handlePrint}
                        disabled={isPrinting}
                        title="Print Translated Ticket"
                        className="flex items-center gap-1.5 p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                    >
                        {isPrinting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                        {isPrinting ? 'Translating...' : 'Print'}
                    </button>
                    <button 
                        onClick={onRemove}
                        className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Split Editor Content */}
            <div className="flex-grow flex overflow-hidden">
                {/* Left: Image Preview */}
                <div className="w-1/3 bg-slate-900 flex flex-col items-center justify-center p-6 relative overflow-hidden group/img">
                    <div className="w-full h-full border border-slate-700 rounded-xl bg-slate-800 flex items-center justify-center overflow-hidden shadow-inner">
                        <img 
                            src={ticket.previewUrl} 
                            className="w-full h-full object-contain hover:scale-110 transition-transform duration-700 cursor-zoom-in"
                        />
                    </div>
                    <button 
                        onClick={onReprocess}
                        className="mt-4 flex items-center gap-2 text-indigo-400 text-[10px] font-black uppercase tracking-widest hover:text-indigo-300 transition-colors active:scale-95"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Reprocess with Gemini
                    </button>
                    {/* Shadow Decor */}
                    <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-900 to-transparent pointer-events-none opacity-40"></div>
                </div>

                {/* Right: Editable Form */}
                <div className="w-2/3 p-8 overflow-y-auto bg-white custom-scrollbar">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-6 mb-10">
                        <FormField 
                            label="Customer Name" 
                            confidence={data.confidence.name}
                            value={data.customer_name || ''}
                            onChange={(v) => handleFieldChange('customer_name', v)}
                        />
                        <FormField 
                            label="Phone Number" 
                            confidence={data.confidence.phone}
                            value={data.phone || ''}
                            onChange={(v) => handleFieldChange('phone', v)}
                        />
                        <FormField 
                            label="Pick Up Date" 
                            type="date"
                            value={data.pick_up_date || ''}
                            onChange={(v) => handleFieldChange('pick_up_date', v)}
                        />
                        <FormField 
                            label="Time" 
                            type="time"
                            value={data.pick_up_time || ''}
                            onChange={(v) => handleFieldChange('pick_up_time', v)}
                        />
                        <div className="flex flex-col gap-1">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-loose">
                                Customer Preferred Language
                            </label>
                            <select 
                                value={data.preferred_language || 'en'} 
                                onChange={(e) => handleFieldChange('preferred_language', e.target.value as any)}
                                className="w-full border-b border-slate-200 focus:border-indigo-500 outline-none pb-2 font-medium text-sm bg-transparent transition-all appearance-none cursor-pointer"
                            >
                                <option value="en">English</option>
                                <option value="zh-hans">Simplified Chinese</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-loose">
                                Tailor Language
                            </label>
                            <select 
                                value={ticket.tailorLanguage || 'en'} 
                                onChange={(e) => onTailorLanguageUpdate(e.target.value as any)}
                                className="w-full border-b border-slate-200 focus:border-indigo-500 outline-none pb-2 font-medium text-sm bg-transparent transition-all appearance-none cursor-pointer"
                            >
                                <option value="en">English</option>
                                <option value="es">Spanish</option>
                            </select>
                        </div>
                        <FormField 
                            label="Reminder 1 Date" 
                            type="date"
                            value={data.reminder_1_date || ''}
                            onChange={(v) => handleFieldChange('reminder_1_date', v)}
                        />
                        <FormField 
                            label="Reminder 2 Date" 
                            type="date"
                            value={data.reminder_2_date || ''}
                            onChange={(v) => handleFieldChange('reminder_2_date', v)}
                        />
                    </div>

                    {/* Items Table */}
                    <div className="mb-10">
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-2">
                                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Repair Items</h3>
                                <div className={cn(
                                    "text-[9px] font-bold px-2 py-0.5 rounded shadow-sm transition-colors uppercase tracking-widest",
                                    data.confidence.items === 'high' ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"
                                )}>
                                    Confidence: {data.confidence.items}
                                </div>
                            </div>
                            <button onClick={addItem} className="text-indigo-600 hover:text-indigo-700 text-[10px] font-bold uppercase tracking-tight flex items-center gap-1">
                                <Plus className="w-3 h-3" /> Add Row
                            </button>
                        </div>
                        <table className="w-full text-xs text-left">
                            <thead className="text-slate-400 border-b border-slate-100 font-bold uppercase tracking-wider text-[10px]">
                                <tr>
                                    <th className="pb-3 font-semibold">Description</th>
                                    <th className="pb-3 font-semibold">Notes</th>
                                    <th className="pb-3 font-semibold text-right pr-4">Price</th>
                                    <th className="pb-3 w-8"></th>
                                </tr>
                            </thead>
                            <tbody className="text-slate-700">
                                {data.items.map((item, i) => (
                                    <tr key={i} className="border-b border-slate-50 group/row hover:bg-slate-50/50 transition-colors">
                                        <td className="py-3 pr-2">
                                            <input 
                                                className="w-full bg-transparent border-0 focus:ring-0 font-medium p-0"
                                                value={item.description}
                                                onChange={(e) => handleItemChange(i, 'description', e.target.value)}
                                            />
                                        </td>
                                        <td className="py-3">
                                            <input 
                                                className="w-full bg-transparent border-0 focus:ring-0 italic text-slate-400 text-[11px] p-0"
                                                placeholder="Notes..."
                                                value={item.notes || ''}
                                                onChange={(e) => handleItemChange(i, 'notes', e.target.value)}
                                            />
                                        </td>
                                        <td className="py-3 text-right font-mono pr-4">
                                            <div className="flex items-center justify-end">
                                                <span className="opacity-30 mr-0.5">$</span>
                                                <input 
                                                    className="w-16 bg-transparent border-0 focus:ring-0 text-right p-0 font-mono"
                                                    type="number"
                                                    step="0.01"
                                                    value={item.price || ''}
                                                    onChange={(e) => handleItemChange(i, 'price', parseFloat(e.target.value) || 0)}
                                                />
                                            </div>
                                        </td>
                                        <td className="py-3 text-right">
                                            <button onClick={() => removeItem(i)} className="opacity-0 group-hover/row:opacity-100 transition-opacity p-1 text-slate-300 hover:text-red-500">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Amounts Grid */}
                    <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-100">
                        <div className="bg-slate-50 p-4 rounded-2xl flex flex-col gap-1 border border-transparent hover:border-slate-200 transition-all shadow-sm">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Bill</label>
                            <div className="flex items-center gap-2">
                                <span className="text-xl font-mono font-bold text-slate-900">$</span>
                                <input 
                                    className="w-full bg-transparent border-0 focus:ring-0 text-xl font-mono font-bold p-0"
                                    type="number"
                                    step="0.01"
                                    value={data.ticket_total || ''}
                                    onChange={(e) => handleFieldChange('ticket_total', parseFloat(e.target.value) || 0)}
                                />
                            </div>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl flex flex-col gap-1 border border-transparent hover:border-slate-200 transition-all shadow-sm">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount Paid</label>
                            <div className="flex items-center gap-2">
                                <span className="text-xl font-mono font-bold text-green-600">$</span>
                                <input 
                                    className="w-full bg-transparent border-0 focus:ring-0 text-xl font-mono font-bold text-green-600 p-0"
                                    type="number"
                                    step="0.01"
                                    value={data.amount_paid || 0}
                                    onChange={(e) => handleFieldChange('amount_paid', parseFloat(e.target.value) || 0)}
                                />
                            </div>
                        </div>
                        <div className="bg-indigo-50 p-4 rounded-2xl flex flex-col gap-1 border border-indigo-100 shadow-lg shadow-indigo-900/5">
                            <label className="block text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Balance Due</label>
                            <span className="text-xl font-mono font-bold text-indigo-700 leading-tight">
                                {formatCurrency(data.balance_due)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function FormField({ label, value, onChange, type = "text", confidence }: { 
    label: string; 
    value: string; 
    onChange: (v: string) => void;
    type?: string;
    confidence?: string;
}) {
    return (
        <div className="flex flex-col gap-1">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-loose">
                {label}
            </label>
            <div className="group relative flex items-center gap-2">
                <input 
                    type={type} 
                    value={value} 
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full border-b border-slate-200 focus:border-indigo-500 outline-none pb-1.5 font-medium text-sm bg-transparent transition-all"
                />
                {confidence && (
                    <div 
                        className={cn(
                            "w-2 h-2 rounded-full absolute right-0 bottom-3 shadow-md",
                            confidence === 'high' ? "bg-green-500 shadow-green-200" : confidence === 'medium' ? "bg-amber-400 shadow-amber-100" : "bg-red-500 shadow-red-100"
                        )} 
                        title={`${confidence} confidence`}
                    ></div>
                )}
            </div>
        </div>
    );
}

function ConfidenceBadge({ level, label }: { level: 'high' | 'medium' | 'low', label?: string }) {
    const config = {
        high: { color: 'bg-green-100 text-green-700', text: 'High' },
        medium: { color: 'bg-amber-100 text-amber-700', text: 'Med' },
        low: { color: 'bg-red-100 text-red-700', text: 'Low' },
    };

    const c = config[level] || config.medium;

    return (
        <div className={cn("px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest", c.color)}>
            {label ? `${label}: ` : ''}{c.text}
        </div>
    );
}
