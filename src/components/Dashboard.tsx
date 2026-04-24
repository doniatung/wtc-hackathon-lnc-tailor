import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { 
  LayoutDashboard, 
  Package, 
  CheckCircle2, 
  Clock, 
  DollarSign,
  TrendingUp,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';

interface SheetRow {
  customer_name: string;
  phone: string;
  order_number: string;
  pick_up_date: string;
  pick_up_time: string;
  item_description: string;
  item_notes: string;
  item_price: string;
  ticket_total: string;
  amount_paid: string;
  balance_due: string;
  donated: string;
  has_picked_up: string;
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];

export function Dashboard() {
  const [data, setData] = useState<SheetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSheetData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Direct CSV export link for the provided sheet ID and GID
      const sheetId = '1R_nAY-XPAJGlnLCOStoH3qkXxHbt2QucgTT10OoRwYg';
      const gid = '613324229';
      const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`;
      
      const response = await fetch(url);
      const csvText = await response.text();
      
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const rawData = results.data as SheetRow[];
          const processedData: SheetRow[] = [];
          let currentStatus = { donated: '', has_picked_up: '', pick_up_date: '' };

          for (const row of rawData) {
            // A row with an order_number or customer_name is considered a "main" row of a ticket
            if ((row.order_number && row.order_number.trim() !== '') || (row.customer_name && row.customer_name.trim() !== '')) {
              currentStatus = {
                donated: row.donated || '',
                has_picked_up: row.has_picked_up || '',
                pick_up_date: row.pick_up_date || ''
              };
            }
            
            processedData.push({
              ...row,
              donated: row.donated || currentStatus.donated,
              has_picked_up: row.has_picked_up || currentStatus.has_picked_up,
              pick_up_date: row.pick_up_date || currentStatus.pick_up_date,
            });
          }

          setData(processedData);
          setLoading(false);
        },
        error: (err: any) => {
          setError(err.message);
          setLoading(false);
        }
      });
    } catch (err) {
      setError('Failed to connect to Google Sheets. Make sure the sheet is shared as "Anyone with the link can view".');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSheetData();
  }, []);

  // Filter for active/inflight projects (donated and picked_up are empty)
  // We use lowercase match just in case or trim whitespace
  const inflightProjects = data.filter(row => 
    (!row.donated || row.donated.trim() === '') && 
    (!row.has_picked_up || row.has_picked_up.trim() === '')
  );

  const stats = {
    inFlight: inflightProjects.length,
    finishedNotPicked: inflightProjects.filter(row => 
      row.pick_up_date && row.pick_up_date.trim() !== ''
    ).length,
    beingWorkedOn: inflightProjects.filter(row => {
      if (!row.pick_up_date || row.pick_up_date.trim() === '') return true;
      const pickUp = new Date(row.pick_up_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return pickUp >= today;
    }).length,
    pendingRevenue: inflightProjects.reduce((sum, row) => {
      const val = parseFloat(row.balance_due?.replace(/[^0-9.-]+/g, "") || "0");
      return sum + (isNaN(val) ? 0 : val);
    }, 0)
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-slate-500 font-medium animate-pulse">Fetching latest records from Google Sheets...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-red-50 border border-red-100 rounded-xl flex flex-col items-center gap-4 text-center">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <div>
          <h3 className="text-red-900 font-bold text-lg">Sheet Access Error</h3>
          <p className="text-red-700 mt-1 max-w-md">{error}</p>
        </div>
        <button 
          onClick={fetchSheetData}
          className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  const chartData = [
    { name: 'In Progress', value: stats.beingWorkedOn },
    { name: 'Ready', value: stats.finishedNotPicked }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-500" />
          Analytics & Metrics
        </h2>
        <button 
          onClick={fetchSheetData}
          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm cursor-pointer"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          Refresh Data
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          icon={<Package className="w-5 h-5" />} 
          label="In Flight" 
          value={stats.inFlight} 
          color="indigo"
          description="Total active tickets"
        />
        <StatCard 
          icon={<CheckCircle2 className="w-5 h-5" />} 
          label="Ready but Pending" 
          value={stats.finishedNotPicked} 
          color="emerald"
          description="Finished items awaiting pickup"
        />
        <StatCard 
          icon={<Clock className="w-5 h-5" />} 
          label="In Progress" 
          value={stats.beingWorkedOn} 
          color="amber"
          description="Items currently being worked on"
        />
        <StatCard 
          icon={<DollarSign className="w-5 h-5" />} 
          label="Pending Revenue" 
          value={formatCurrency(stats.pendingRevenue)} 
          color="blue"
          description="Total balance due"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-500" />
              Volume Breakdown
            </h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Real-time status</span>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-6">Status Mix</h3>
          <div className="h-[300px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                   contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-4">
            {chartData.map((d, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-slate-600">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  {d.name}
                </div>
                <span className="font-bold text-slate-900">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color, description }: { 
  icon: React.ReactNode, 
  label: string, 
  value: string | number, 
  color: string,
  description: string
}) {
  const colorClasses: Record<string, string> = {
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    blue: "bg-blue-50 text-blue-600 border-blue-100",
  };

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
      <div className={cn("inline-flex p-2.5 rounded-xl border mb-4", colorClasses[color])}>
        {icon}
      </div>
      <div className="space-y-1">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
        <h4 className="text-2xl font-black text-slate-900 tracking-tight">{value}</h4>
        <p className="text-[10px] text-slate-400 font-medium">{description}</p>
      </div>
    </div>
  );
}
