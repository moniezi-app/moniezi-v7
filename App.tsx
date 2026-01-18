import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  FileText, 
  Settings, 
  Plus, 
  X, 
  Trash2, 
  Download, 
  ArrowRight, 
  BrainCircuit, 
  Sparkles, 
  Receipt, 
  Wallet, 
  BarChart3, 
  Sun, 
  Moon, 
  LayoutGrid, 
  CheckCircle, 
  AlertTriangle, 
  Calendar, 
  Clock3,
  User, 
  Info, 
  History, 
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Briefcase, 
  ShoppingBag, 
  Share2, 
  Landmark, 
  RotateCcw, 
  Megaphone, 
  Monitor, 
  Building, 
  Zap, 
  Package, 
  Smartphone, 
  Plane, 
  Utensils, 
  Shield, 
  Users, 
  UserCheck, 
  Hammer, 
  Truck, 
  CreditCard, 
  Code, 
  PenTool, 
  Wrench, 
  Key, 
  Flag, 
  GraduationCap, 
  AlertCircle, 
  Repeat, 
  Calculator, 
  BookOpen,
  Ban,
  HelpCircle,
  Percent,
  PlusCircle,
  MinusCircle,
  Search,
  Tag,
  Upload,
  Image as ImageIcon,
  Palette,
  AlignLeft,
  AlignCenter,
  Edit3,
  Loader2,
  Camera,
  Eye,
  ToggleLeft,
  ToggleRight,
  Copy
} from 'lucide-react';
import { Page, Transaction, Invoice, Estimate, Client, ClientStatus, UserSettings, Notification, FilterPeriod, RecurrenceFrequency, FilingStatus, TaxPayment, TaxEstimationMethod, InvoiceItem, EstimateItem, CustomCategories, Receipt as ReceiptType } from './types';
import { CATS_IN, CATS_OUT, CATS_BILLING, DEFAULT_PAY_PREFS, DB_KEY, TAX_CONSTANTS, TAX_PLANNER_2026, getFreshDemoData } from './constants';
import InsightsDashboard from './InsightsDashboard';
import { getInsightCount } from './services/insightsEngine';
// --- Utility: UUID Generator ---
const generateId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};



// --- Clients Helpers ---
const normalize = (s: string) => (s || '').trim().toLowerCase();

// --- Utility: Image Compressor ---
const compressReceiptImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800; // Limit width to 800px
        const scaleSize = MAX_WIDTH / img.width;
        // Only scale down if image is larger than max width
        const width = img.width > MAX_WIDTH ? MAX_WIDTH : img.width;
        const height = img.width > MAX_WIDTH ? img.height * scaleSize : img.height;
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        // Compress to JPEG with 0.6 quality
        resolve(canvas.toDataURL('image/jpeg', 0.6)); 
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

// --- Utility: Download Receipt ---
const downloadReceiptToDevice = (dataUrl: string) => {
    try {
        const link = document.createElement('a');
        link.href = dataUrl;
        const now = new Date();
        // Format: Receipt_YYYY-MM-DD_HHMMSS
        const timestamp = now.toISOString().replace(/[-:T.]/g, '').slice(0, 14); 
        const dateStr = now.toISOString().split('T')[0];
        
        // Attempt to place in BizReceipts folder (Browser support varies, might fallback to filename prefix)
        link.download = `Receipt_${dateStr}_${timestamp}.jpg`; 
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return true;
    } catch (e) {
        console.error("Download failed", e);
        return false;
    }
};

// --- Utility: Date Helpers ---
const getStartOfWeek = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
  return new Date(d.setDate(diff));
};

const getEndOfWeek = (date: Date) => {
  const d = getStartOfWeek(date);
  d.setDate(d.getDate() + 6);
  return d;
};

const formatDateRange = (start: Date, end: Date) => {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', opts)} - ${end.toLocaleDateString('en-US', opts)}`;
};

const getDaysOverdue = (dueDate: string) => {
  if (!dueDate) return 0;
  const due = new Date(dueDate);
  const today = new Date();
  due.setHours(0,0,0,0);
  today.setHours(0,0,0,0);
  
  const diffTime = today.getTime() - due.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  return diffDays;
};

const calculateNextDate = (currentDate: string, freq: RecurrenceFrequency): string => {
  const d = new Date(currentDate);
  if (freq === 'weekly') d.setDate(d.getDate() + 7);
  if (freq === 'monthly') d.setMonth(d.getMonth() + 1);
  if (freq === 'quarterly') d.setMonth(d.getMonth() + 3);
  if (freq === 'yearly') d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split('T')[0];
};

const getNextEstimatedTaxDeadline = () => {
  const now = new Date();
  const year = now.getFullYear();
  const deadlines = [
    new Date(year, 3, 15), 
    new Date(year, 5, 15), 
    new Date(year, 8, 15), 
    new Date(year + 1, 0, 15)
  ];
  
  const next = deadlines.find(d => {
    d.setHours(23, 59, 59, 999); 
    return d >= now;
  }) || deadlines[0];

  const diffTime = next.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return { 
    date: next.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), 
    days: diffDays 
  };
};

// --- Helper: Category Icons ---
const getCategoryIcon = (category: string) => {
  switch (category) {
    case "Sales / Services": return <Briefcase size={16} />;
    case "Consulting / Freelance": return <User size={16} />;
    case "Product Sales": return <ShoppingBag size={16} />;
    case "Affiliate / Referral": return <Share2 size={16} />;
    case "Interest / Bank": return <Landmark size={16} />;
    case "Refunds": return <RotateCcw size={16} />;
    case "Advertising / Marketing": return <Megaphone size={16} />;
    case "Software / SaaS": return <Monitor size={16} />;
    case "Rent / Workspace": return <Building size={16} />;
    case "Utilities": return <Zap size={16} />;
    case "Office Supplies": return <Package size={16} />;
    case "Phone / Internet": return <Smartphone size={16} />;
    case "Travel": return <Plane size={16} />;
    case "Meals (Business)": return <Utensils size={16} />;
    case "Professional Services": return <Briefcase size={16} />;
    case "Insurance": return <Shield size={16} />;
    case "Contractors": return <Users size={16} />;
    case "Payroll": return <UserCheck size={16} />;
    case "Taxes & Licenses": return <FileText size={16} />;
    case "Equipment": return <Hammer size={16} />;
    case "Shipping / Delivery": return <Truck size={16} />;
    case "Bank Fees": return <CreditCard size={16} />;
    case "Web Development": return <Code size={16} />;
    case "Graphic Design": return <PenTool size={16} />;
    case "Strategy Consulting": return <Briefcase size={16} />;
    case "Content Writing": return <FileText size={16} />;
    case "Digital Marketing": return <Megaphone size={16} />;
    case "Maintenance Retainer": return <Wrench size={16} />;
    case "Software Licensing": return <Key size={16} />;
    case "Project Milestone": return <Flag size={16} />;
    case "Training / Workshop": return <GraduationCap size={16} />;
    default: return <Tag size={16} />;
  }
};

// --- Components ---

const Logo: React.FC<{ size?: 'sm' | 'lg', onClick?: () => void, forceDarkText?: boolean }> = ({ size = 'sm', onClick, forceDarkText = false }) => {
  const isLarge = size === 'lg';
  return (
    <div 
      onClick={onClick}
      className={`flex items-center gap-3 cursor-pointer group select-none transition-transform active:scale-95`}
    >
      <div 
        className={`${isLarge ? 'w-12 h-12 rounded-2xl' : 'w-10 h-10 rounded-xl'} bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-all duration-500`}
      >
        <div className="relative w-full h-full flex items-center justify-center">
            <div className="w-1/2 h-1/2 border-l-[3px] border-r-[3px] border-t-[3px] border-white opacity-90 rounded-t-sm" />
            <div className="absolute w-1.5 h-1.5 bg-white rounded-full bottom-2.5 left-1/2 -translate-x-1/2 shadow-sm" />
        </div>
      </div>
      <div className="flex flex-col leading-none">
        <div className={`font-brand uppercase tracking-[0.22em] ${isLarge ? 'text-2xl' : 'text-lg'} ${forceDarkText ? 'text-slate-950' : 'text-slate-950 dark:text-white'}`}>
          <span className="font-bold">Moni</span>
          <span className={`font-bold ${forceDarkText ? 'text-blue-700' : 'bg-gradient-to-r bg-clip-text text-transparent from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400'}`}>ezi</span>
        </div>
        <div className={`text-[10px] sm:text-xs font-bold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-300 mt-1 pl-0.5 whitespace-nowrap`}>
          Pro Finance
        </div>
       
            </div>
    </div>
  );
};

const ToastContainer: React.FC<{ notifications: Notification[]; remove: (id: string) => void }> = ({ notifications, remove }) => {
  return (
    <div className="fixed top-24 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {notifications.map(n => (
        <div 
          key={n.id} 
          className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl border animate-in slide-in-from-right-10 fade-in duration-300 max-w-sm ${
            n.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 
            n.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 
            'bg-blue-50 border-blue-200 text-blue-800'
          }`}
          onClick={() => remove(n.id)}
        >
           {n.type === 'success' ? <CheckCircle size={18} /> : n.type === 'error' ? <AlertTriangle size={18} /> : <Info size={18} />}
           <span className="text-sm font-bold">{n.message}</span>
        </div>
      ))}
    </div>
  );
};

const EmptyState: React.FC<{ icon: React.ReactNode, title: string, subtitle: string, action?: () => void, actionLabel?: string }> = ({ icon, title, subtitle, action, actionLabel }) => (
  <div className="flex flex-col items-center justify-center py-16 px-4 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50">
    <div className="mb-4 text-slate-500 dark:text-slate-300 p-4 bg-white dark:bg-slate-950 rounded-full shadow-sm">
      {icon}
    </div>
    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 font-brand">{title}</h3>
    <p className="text-slate-600 dark:text-slate-300 text-sm max-w-[250px] mx-auto mb-6">{subtitle}</p>
    {action && (
      <button onClick={action} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-2.5 rounded-lg text-sm font-bold shadow-lg hover:opacity-90 transition-all">
        {actionLabel}
      </button>
    )}
  </div>
);

const StatCard: React.FC<{ 
  label: string; 
  value: string; 
  colorClass?: string; 
  subText?: string; 
  subTextClass?: string;
  onClick?: () => void; 
  icon?: React.ReactNode 
}> = ({ 
  label, value, colorClass = "text-slate-950 dark:text-white", subText, subTextClass, onClick, icon 
}) => (
  <div 
    onClick={onClick}
    className={`bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-md transition-all duration-300 group overflow-hidden ${onClick ? 'cursor-pointer active:scale-95 hover:border-blue-500/50 hover:shadow-lg' : ''}`}
  >
    <div className="flex justify-between items-start mb-4">
        <div className="bg-slate-100 dark:bg-slate-950 p-3 rounded-lg text-slate-600 dark:text-slate-300 group-hover:bg-blue-600 group-hover:text-white transition-all">
            {icon}
        </div>
        {onClick && <ArrowRight size={16} className="text-slate-400 dark:text-slate-300 -rotate-45 group-hover:rotate-0 group-hover:text-blue-500 transition-all duration-300" />}
    </div>
    <div className={`text-2xl font-bold tracking-tight mb-1 break-words ${colorClass}`}>{value}</div>
    <div className="flex justify-between items-end min-w-0">
        <label className="text-base font-semibold text-slate-600 dark:text-slate-300 truncate">{label}</label>
    </div>
    {subText && <div className={`text-xs mt-2 font-bold inline-block px-3 py-1 rounded-md ${subTextClass || 'bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300'}`}>{subText}</div>}
  </div>
);

const DateInput = ({ label, value, onChange }: { label: string, value: string, onChange: (val: string) => void }) => (
  <div className="group">
    <label className="text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider mb-2 block pl-1 group-focus-within:text-blue-600 dark:group-focus-within:text-white transition-colors">
      {label}
    </label>
    <div className="relative">
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-300 pointer-events-none">
        <Calendar size={18} />
      </div>
      <input 
        type="date" 
        value={value} 
        onChange={e => onChange(e.target.value)} 
        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-0 rounded-lg pl-12 pr-5 py-4 font-medium text-lg text-slate-900 dark:text-white outline-none focus:bg-white dark:focus:bg-slate-900 transition-all shadow-inner focus:ring-2 focus:ring-blue-500/20" 
      />
    </div>
  </div>
);

const Drawer: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-md p-0 sm:p-4 transition-all">
      <div className="fixed inset-0" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-xl sm:rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center justify-between p-8 pb-4">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="p-2 bg-slate-100 dark:bg-slate-950 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full text-slate-600 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-colors">
            <X size={28} strokeWidth={1.5} />
          </button>
        </div>
        <div className="px-8 pb-8 overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
};

// --- Period Selector Component ---
const PeriodSelector: React.FC<{ 
  period: FilterPeriod, 
  setPeriod: (p: FilterPeriod) => void,
  refDate: Date,
  setRefDate: (d: Date) => void 
}> = ({ period, setPeriod, refDate, setRefDate }) => {

  const navigateDate = (dir: number) => {
    const newDate = new Date(refDate);
    if (period === 'daily') newDate.setDate(newDate.getDate() + dir);
    else if (period === 'weekly') newDate.setDate(newDate.getDate() + (dir * 7));
    else if (period === 'monthly') newDate.setMonth(newDate.getMonth() + dir);
    else if (period === 'yearly') newDate.setFullYear(newDate.getFullYear() + dir);
    setRefDate(newDate);
  };

  const getLabel = () => {
    if (period === 'all') return 'All Time';
    if (period === 'daily') {
       return refDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
    if (period === 'weekly') {
       const start = getStartOfWeek(refDate);
       const end = getEndOfWeek(refDate);
       return formatDateRange(start, end);
    }
    if (period === 'monthly') {
       return refDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    if (period === 'yearly') {
       return refDate.getFullYear().toString();
    }
    return '';
  };

  return (
    <div className="mb-6 space-y-4">
       <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto custom-scrollbar">
          {(['all', 'daily', 'weekly', 'monthly', 'yearly'] as FilterPeriod[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-1 min-w-[60px] py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${
                period === p 
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-white shadow-sm' 
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {p === 'daily' ? 'Day' : p === 'weekly' ? 'Week' : p === 'monthly' ? 'Month' : p === 'yearly' ? 'Year' : 'All'}
            </button>
          ))}
       </div>

       {period !== 'all' && (
         <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
            <button onClick={() => navigateDate(-1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-200 transition-colors">
               <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-2 font-brand font-bold text-slate-900 dark:text-white text-sm uppercase tracking-wide">
               <Calendar size={16} className="text-blue-500 mb-0.5" />
               {getLabel()}
            </div>
            <button onClick={() => navigateDate(1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-200 transition-colors">
               <ChevronRight size={20} />
            </button>
         </div>
       )}
    </div>
  );
};

// --- App Root ---

// --- Safety net: prevent “blank screen” by catching render errors in any page.
class PageErrorBoundary extends React.Component<
  { onReset?: () => void; children: React.ReactNode },
  { hasError: boolean; message?: string }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(err: any) {
    return { hasError: true, message: String(err?.message || err) };
  }
  componentDidCatch(err: any) {
    // eslint-disable-next-line no-console
    console.error('[Moniezi] Page render error:', err);
  }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="mx-auto max-w-md p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900 shadow-sm">
          <div className="text-sm font-semibold">Something broke on this screen.</div>
          <div className="mt-2 text-xs opacity-80">{this.state.message}</div>
          <button
            onClick={() => {
              this.setState({ hasError: false, message: undefined });
              this.props.onReset?.();
            }}
            className="mt-3 w-full rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white"
          >
            Go back to Home
          </button>
        </div>
      </div>
    );
  }
}

function normalizePage(p: any): Page {
  // Accept legacy strings from older builds (or stale SW cache)
  const v = String(p ?? '');
  const map: Record<string, Page> = {
    home: Page.Dashboard,
    dashboard: Page.Dashboard,
    invoices: Page.Invoices,
    invoice: Page.Invoices,
    ledger: Page.Ledger,
    transactions: Page.AllTransactions,
    all_transactions: Page.AllTransactions,
    reports: Page.Reports,
  };
  return map[v] ?? (Object.values(Page).includes(v as any) ? (v as Page) : Page.Dashboard);
}

export default function App() {
  const [dataLoaded, setDataLoaded] = useState(false);
  const [currentPage, _setCurrentPage] = useState<Page>(Page.Dashboard);
  const setCurrentPage = (p: any) => _setCurrentPage(normalizePage(p));
  const [invoiceQuickFilter, setInvoiceQuickFilter] = useState<'all' | 'unpaid' | 'overdue'>('all');
  const [estimateQuickFilter, setEstimateQuickFilter] = useState<'all' | 'draft' | 'sent' | 'accepted' | 'declined'>('all');

  const HOME_KPI_PERIOD_KEY = 'moniezi_home_kpi_period';
  type HomeKpiPeriod = 'ytd' | 'mtd' | '30d' | 'all';
  const [homeKpiPeriod, setHomeKpiPeriod] = useState<HomeKpiPeriod>(() => {
    try {
      const v = localStorage.getItem(HOME_KPI_PERIOD_KEY);
      if (v === 'ytd' || v === 'mtd' || v === '30d' || v === 'all') return v;
    } catch {
      // ignore
    }
    return 'ytd';
  });

  useEffect(() => {
    try {
      localStorage.setItem(HOME_KPI_PERIOD_KEY, homeKpiPeriod);
    } catch {
      // ignore
    }
  }, [homeKpiPeriod]);


  // The app scrolls inside an internal container (<main className="overflow-y-auto">),
  // not the browser window. Without resetting this container, switching pages via the
  // bottom nav keeps the previous scroll position.
  const mainScrollRef = useRef<HTMLElement | null>(null);

  // Always reset scroll position when switching bottom tabs.
  // Some mobile browsers "remember" the scrollTop of the same scrolling container.
  // We enforce it (and re-enforce on the next tick) so each tab starts at the top.
  useLayoutEffect(() => {
    const el = mainScrollRef.current;
    if (!el) return;

    const toTop = () => {
      // Instant jump; keep it deterministic.
      el.scrollTop = 0;

      // Also reset the window scroll (some mobile browsers still use the page scroll).
      try {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      } catch {
        // ignore
      }

      // Also try the standards API on the container (some browsers behave better with scrollTo).
      // @ts-ignore
      if (typeof (el as any).scrollTo === "function") (el as any).scrollTo({ top: 0, left: 0, behavior: "auto" });
    };

    toTop();
    requestAnimationFrame(toTop);
    setTimeout(toTop, 0);
  }, [currentPage]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [settings, setSettings] = useState<UserSettings>({
    businessName: "My Business",
    ownerName: "Owner",
    payPrefs: DEFAULT_PAY_PREFS,
    taxRate: 22,
    stateTaxRate: 0,
    taxEstimationMethod: 'custom',
    filingStatus: 'single',
    currencySymbol: '$',
    showLogoOnInvoice: true,
    logoAlignment: 'left',
    brandColor: '#2563eb'
  });
  const [customCategories, setCustomCategories] = useState<CustomCategories>({ income: [], expense: [], billing: [] });
  const [taxPayments, setTaxPayments] = useState<TaxPayment[]>([]);
  const [receipts, setReceipts] = useState<ReceiptType[]>([]);

  // Clients / Leads (Lightweight CRM)
  const [clientSearch, setClientSearch] = useState('');
  const [clientFilter, setClientFilter] = useState<'all' | ClientStatus>('all');
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Partial<Client>>({ status: 'lead' });

  // UI State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'add' | 'edit_tx' | 'edit_inv' | 'tax_payments' | 'create_cat'>('add');
  const [activeTab, setActiveTab] = useState<'income' | 'expense' | 'billing'>('income');
  const [billingDocType, setBillingDocType] = useState<'invoice' | 'estimate'>('invoice');
  const [activeItem, setActiveItem] = useState<Partial<Transaction> & Partial<Invoice> & Partial<Estimate>>({});
  const [activeTaxPayment, setActiveTaxPayment] = useState<Partial<TaxPayment>>({ type: 'Estimated', date: new Date().toISOString().split('T')[0] });
  
  const [categorySearch, setCategorySearch] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const previousDrawerMode = useRef<'add' | 'edit_tx' | 'edit_inv' | 'tax_payments'>('add');

  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'income' | 'expense' | 'invoice'>('all');
  const [lastYearCalc, setLastYearCalc] = useState({ profit: '', tax: '' });
  const [selectedInvoiceForDoc, setSelectedInvoiceForDoc] = useState<Invoice | null>(null);
  const [selectedEstimateForDoc, setSelectedEstimateForDoc] = useState<Estimate | null>(null);
  const [isEstimatePdfPreviewOpen, setIsEstimatePdfPreviewOpen] = useState(false);
  const [isGeneratingEstimatePdf, setIsGeneratingEstimatePdf] = useState(false);
  const [showPLPreview, setShowPLPreview] = useState(false);
  const [plExportRequested, setPlExportRequested] = useState(false);
  const [isGeneratingPLPdf, setIsGeneratingPLPdf] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [showInsights, setShowInsights] = useState(false);
  const [duplicationCount, setDuplicationCount] = useState<Record<string, number>>({});
  const [showTemplateSuggestion, setShowTemplateSuggestion] = useState(false);
  const [templateSuggestionData, setTemplateSuggestionData] = useState<{name: string, category: string, type: string} | null>(null);
  
  // Phase 3: Advanced Duplicate Features
  const [showBatchDuplicateModal, setShowBatchDuplicateModal] = useState(false);
  const [batchDuplicateData, setBatchDuplicateData] = useState<Transaction | Invoice | null>(null);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [recurringData, setRecurringData] = useState<Transaction | Invoice | null>(null);
  const [savedTemplates, setSavedTemplates] = useState<Array<{id: string, name: string, data: Partial<Transaction | Invoice>, type: string}>>([]);
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);
  const [duplicationHistory, setDuplicationHistory] = useState<Record<string, {originalId: string, originalDate: string}>>({});
  
  // Settings Tab State
  const [settingsTab, setSettingsTab] = useState<'backup' | 'branding' | 'tax' | 'data'>('backup');

  const insightsBadgeCount = useMemo(() => {
    return getInsightCount({ transactions, invoices, taxPayments, settings });
  }, [transactions, invoices, taxPayments, settings]);

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  
  const [scrollToTaxSnapshot, setScrollToTaxSnapshot] = useState(false);
  const taxSnapshotRef = useRef<HTMLDivElement>(null);

  // Backup & Restore State
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [pendingBackupData, setPendingBackupData] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scan Receipt State
  const [scanPreview, setScanPreview] = useState<string | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<ReceiptType | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  // Tax Planner State
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);
  const [plannerTab, setPlannerTab] = useState<'basic' | 'advanced'>('basic');
  const [advSection, setAdvSection] = useState<string | null>(null);
  const [plannerData, setPlannerData] = useState({
      income: 0,
      expenses: 0,
      filingStatus: 'single' as 'single' | 'joint' | 'head' | 'separate',
      taxRate: 15,
      useCustomRate: false,
      useSE: true,
      useStdDed: true,
      retirement: 0,
      credits: 0,
      // Advanced fields
      otherIncomeInterest: 0,
      otherIncomeDividends: 0,
      otherIncomeCapital: 0,
      otherIncomeOther: 0,
      deductionMode: 'standard' as 'standard' | 'itemized',
      itemizedDeduction: 0,
      adjustmentHSA: 0,
      adjustmentHealth: 0,
      // Section E: QBI
      applyQBI: false,
      qbiOverride: 0,
      // Section F: Payments
      paymentsYTD: 0,
      withholdingYTD: 0,
      lastYearTaxRef: 0
  });

  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('monthly');
  const [referenceDate, setReferenceDate] = useState<Date>(new Date());

  const formatCurrency = useMemo(() => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: settings.currencySymbol === '€' ? 'EUR' : settings.currencySymbol === '£' ? 'GBP' : 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }, [settings.currencySymbol]);

  // Tax Planner Calculations (2026)
  const plannerResults = useMemo(() => {
      const income = Number(plannerData.income) || 0;
      const expenses = Number(plannerData.expenses) || 0;
      const profit = Math.max(0, income - expenses);
      const rate = Number(plannerData.taxRate) / 100;
      const credits = Number(plannerData.credits) || 0;
      
      const seTax = plannerData.useSE ? Math.max(0, profit) * TAX_PLANNER_2026.SE_TAX_RATE : 0;
      
      if (plannerTab === 'basic') {
          let stdDed = 0;
          if (plannerData.useStdDed) {
              if (plannerData.filingStatus === 'joint') stdDed = TAX_PLANNER_2026.STD_DEDUCTION_JOINT;
              else if (plannerData.filingStatus === 'head') stdDed = TAX_PLANNER_2026.STD_DEDUCTION_HEAD;
              else stdDed = TAX_PLANNER_2026.STD_DEDUCTION_SINGLE;
          }

          const retirement = Number(plannerData.retirement) || 0;
          const taxableIncome = Math.max(0, profit - stdDed - retirement);
          
          const incomeTax = taxableIncome * rate;
          const totalTax = Math.max(0, incomeTax + seTax - credits);
          
          return {
              profit,
              otherIncome: 0,
              adjustments: retirement,
              deduction: stdDed,
              qbiDeduction: 0,
              taxableIncome,
              incomeTax,
              seTax,
              totalTax,
              paidSoFar: 0,
              taxRemaining: totalTax,
              taxAhead: 0,
              monthly: totalTax / 12,
              quarterly: totalTax / 4,
              quarterlySuggestion: totalTax / 4
          };
      } else {
          // Advanced Logic
          const otherInc = (Number(plannerData.otherIncomeInterest)||0) + (Number(plannerData.otherIncomeDividends)||0) + (Number(plannerData.otherIncomeCapital)||0) + (Number(plannerData.otherIncomeOther)||0);
          const adjustments = (Number(plannerData.retirement)||0) + (Number(plannerData.adjustmentHSA)||0) + (Number(plannerData.adjustmentHealth)||0);
          
          let deduction = 0;
          if (plannerData.deductionMode === 'itemized') {
              deduction = Number(plannerData.itemizedDeduction) || 0;
          } else {
              if (plannerData.filingStatus === 'joint') deduction = TAX_PLANNER_2026.STD_DEDUCTION_JOINT;
              else if (plannerData.filingStatus === 'head') deduction = TAX_PLANNER_2026.STD_DEDUCTION_HEAD;
              else deduction = TAX_PLANNER_2026.STD_DEDUCTION_SINGLE;
          }

          // QBI Logic
          const userQbiBase = Number(plannerData.qbiOverride);
          const qbiBase = userQbiBase > 0 ? userQbiBase : Math.max(0, profit);
          const qbiDeduction = plannerData.applyQBI ? qbiBase * 0.2 : 0;

          const baseIncome = profit + otherInc;
          const taxableIncome = Math.max(0, baseIncome - adjustments - deduction - qbiDeduction);
          const incomeTax = taxableIncome * rate;
          const totalTax = Math.max(0, incomeTax + seTax - credits);

          // Payments Logic
          const paidSoFar = (Number(plannerData.paymentsYTD)||0) + (Number(plannerData.withholdingYTD)||0);
          const taxRemaining = Math.max(0, totalTax - paidSoFar);
          const taxAhead = Math.max(0, paidSoFar - totalTax);

          return {
              profit,
              otherIncome: otherInc,
              adjustments,
              deduction,
              qbiDeduction,
              taxableIncome,
              incomeTax,
              seTax,
              totalTax,
              paidSoFar,
              taxRemaining,
              taxAhead,
              monthly: totalTax / 12,
              quarterly: totalTax / 4,
              quarterlySuggestion: taxRemaining > 0 ? taxRemaining / 4 : 0
          };
      }
  }, [plannerData, plannerTab]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('moniezi_theme') as 'light' | 'dark' | null;
    if (savedTheme) {
        setTheme(savedTheme);
        document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    } else {
        document.documentElement.classList.add('dark');
    }
  }, []);

  useEffect(() => {
    if (currentPage === Page.Reports && scrollToTaxSnapshot && taxSnapshotRef.current) {
        setTimeout(() => {
            taxSnapshotRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setScrollToTaxSnapshot(false);
        }, 100);
    }
  }, [currentPage, scrollToTaxSnapshot]);

  const toggleTheme = () => {
      const newTheme = theme === 'light' ? 'dark' : 'light';
      setTheme(newTheme);
      document.documentElement.classList.toggle('dark', newTheme === 'dark');
      localStorage.setItem('moniezi_theme', newTheme);
  };

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: string) => setNotifications(prev => prev.filter(n => n.id !== id));


  const findMatchingClientId = useCallback((data: Partial<Invoice> & Partial<Estimate>) => {
    const email = normalize((data as any).clientEmail || '');
    const name = normalize((data as any).client || '');
    const company = normalize((data as any).clientCompany || '');

    if (data.clientId && clients.some(c => c.id === data.clientId)) return data.clientId;

    if (email) {
      const byEmail = clients.find(c => normalize(c.email || '') == email);
      if (byEmail) return byEmail.id;
    }
    if (name) {
      const byName = clients.find(c => normalize(c.name) === name && normalize(c.company || '') === company);
      if (byName) return byName.id;
      const byNameOnly = clients.find(c => normalize(c.name) == name);
      if (byNameOnly) return byNameOnly.id;
    }
    return undefined;
  }, [clients]);

  const upsertClientFromDoc = useCallback((data: Partial<Invoice> & Partial<Estimate>, statusHint: ClientStatus) => {
    const clientName = (data as any).client?.trim();
    if (!clientName) return undefined;

    const now = new Date().toISOString();
    const existingId = findMatchingClientId(data);

    if (existingId) {
      setClients(prev => prev.map(c => {
        if (c.id !== existingId) return c;
        return {
          ...c,
          name: clientName,
          company: (data as any).clientCompany || c.company,
          email: (data as any).clientEmail || c.email,
          address: (data as any).clientAddress || c.address,
          status: c.status === 'inactive' ? c.status : statusHint,
          updatedAt: now,
        };
      }));
      return existingId;
    }

    const newClient: Client = {
      id: generateId('cli'),
      name: clientName,
      company: (data as any).clientCompany || '',
      email: (data as any).clientEmail || '',
      phone: '',
      address: (data as any).clientAddress || '',
      notes: '',
      status: statusHint,
      createdAt: now,
      updatedAt: now,
    };
    setClients(prev => [newClient, ...prev]);
    return newClient.id;
  }, [findMatchingClientId]);

  const fillDocFromClient = useCallback((clientId: string) => {
    const c = clients.find(x => x.id === clientId);
    if (!c) return;
    setActiveItem(prev => ({
      ...prev,
      clientId: c.id,
      client: c.name,
      clientCompany: c.company || '',
      clientEmail: c.email || '',
      clientAddress: c.address || '',
    }));
  }, [clients]);

  useEffect(() => {
    const saved = localStorage.getItem(DB_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setTransactions(parsed.transactions || []);
        setInvoices(parsed.invoices || []);
        setEstimates(parsed.estimates || []);
        setClients(parsed.clients || []);
        const defaultMethod: TaxEstimationMethod = parsed.settings?.taxEstimationMethod || 'custom'; 
        setSettings({
            businessName: "My Business",
            ownerName: "Owner",
            payPrefs: DEFAULT_PAY_PREFS,
            taxRate: 22,
            stateTaxRate: 0,
            taxEstimationMethod: defaultMethod,
            filingStatus: 'single',
            currencySymbol: '$',
            showLogoOnInvoice: true,
            logoAlignment: 'left',
            brandColor: '#2563eb',
            ...parsed.settings
        });
        setCustomCategories({
            income: parsed.customCategories?.income || [],
            expense: parsed.customCategories?.expense || [],
            billing: parsed.customCategories?.billing || []
        });
        setTaxPayments(parsed.taxPayments || []);
        setReceipts(parsed.receipts || []);
      } catch (e) {
        console.error("Error loading data", e);
        showToast("Failed to load saved data.", "error");
      }
    } else {
        // First run (no saved DB): seed demo data so the app is never “empty/blank”
        // when viewed by a buyer on GitHub Pages.
        const demo = getFreshDemoData();

        // --- Demo Clients + Estimates (V7) ---
        const toISO = (d: Date) => d.toISOString().split('T')[0];
        const today = new Date();
        const daysAgo = (n: number) => new Date(today.getTime() - n * 24 * 60 * 60 * 1000);
        const daysFromNow = (n: number) => new Date(today.getTime() + n * 24 * 60 * 60 * 1000);

        const demoClients: Client[] = [
          {
            id: 'cli_demo_1',
            name: 'Kenny Barria',
            company: 'KB Landscaping',
            email: 'kenny@example.com',
            phone: '+1 (555) 010-2001',
            address: '12 Palm St, Miami, FL',
            status: 'lead',
            createdAt: toISO(daysAgo(45)),
            updatedAt: toISO(daysAgo(2)),
          },
          {
            id: 'cli_demo_2',
            name: 'Sophia Stanley',
            company: 'Stanley Studio',
            email: 'sophia@example.com',
            phone: '+1 (555) 010-2002',
            address: '88 Market Ave, Austin, TX',
            status: 'lead',
            createdAt: toISO(daysAgo(30)),
            updatedAt: toISO(daysAgo(10)),
          },
          {
            id: 'cli_demo_3',
            name: 'Jimmy Wilson',
            company: 'Wilson Renovations',
            email: 'jimmy@example.com',
            phone: '+1 (555) 010-2003',
            address: '5 Harbor Rd, San Diego, CA',
            status: 'client',
            createdAt: toISO(daysAgo(120)),
            updatedAt: toISO(daysAgo(1)),
          },
          {
            id: 'cli_demo_4',
            name: 'Rich Richards',
            company: 'Richards Consulting',
            email: 'rich@example.com',
            phone: '+1 (555) 010-2004',
            address: '101 King St, New York, NY',
            status: 'inactive',
            createdAt: toISO(daysAgo(300)),
            updatedAt: toISO(daysAgo(90)),
          },
        ];

        const demoEstimates: Estimate[] = [
          {
            id: 'est_demo_1',
            number: 'EST-0007',
            clientId: 'cli_demo_3',
            client: 'Jimmy Wilson',
            clientCompany: 'Wilson Renovations',
            clientEmail: 'jimmy@example.com',
            clientAddress: '5 Harbor Rd, San Diego, CA',
            category: 'Service',
            description: 'Bathroom repair + fixture replacement',
            date: toISO(daysAgo(5)),
            validUntil: toISO(daysFromNow(9)),
            status: 'accepted',
            items: [
              { id: 'e1_i1', description: 'Labor (3 hrs)', quantity: 3, rate: 95 },
              { id: 'e1_i2', description: 'Fixture & materials', quantity: 1, rate: 180 },
            ],
            subtotal: 465,
            discount: 0,
            taxRate: 8,
            shipping: 0,
            amount: Math.round((465 + 465 * 0.08) * 100) / 100,
            notes: 'Thank you! This estimate is valid for 14 days.',
            terms: '50% deposit to schedule work. Remaining due upon completion.',
            poNumber: 'PO-1027',
          },
          {
            id: 'est_demo_2',
            number: 'EST-0008',
            clientId: 'cli_demo_1',
            client: 'Kenny Barria',
            clientCompany: 'KB Landscaping',
            clientEmail: 'kenny@example.com',
            clientAddress: '12 Palm St, Miami, FL',
            category: 'Service',
            description: 'Monthly lawn maintenance (4 visits)',
            date: toISO(daysAgo(2)),
            validUntil: toISO(daysFromNow(12)),
            status: 'sent',
            items: [
              { id: 'e2_i1', description: 'Lawn mow + edge (per visit)', quantity: 4, rate: 85 },
              { id: 'e2_i2', description: 'Hedge trim (one time)', quantity: 1, rate: 120 },
            ],
            subtotal: 460,
            discount: 20,
            taxRate: 0,
            shipping: 0,
            amount: 440,
            notes: 'Includes green waste removal.',
            terms: 'Net 7 days after acceptance.',
          },
          {
            id: 'est_demo_3',
            number: 'EST-0009',
            clientId: 'cli_demo_2',
            client: 'Sophia Stanley',
            clientCompany: 'Stanley Studio',
            clientEmail: 'sophia@example.com',
            clientAddress: '88 Market Ave, Austin, TX',
            category: 'Service',
            description: 'Brand kit design (logo, colors, typography)',
            date: toISO(daysAgo(15)),
            validUntil: toISO(daysAgo(1)),
            status: 'draft',
            items: [
              { id: 'e3_i1', description: 'Discovery call + moodboard', quantity: 1, rate: 250 },
              { id: 'e3_i2', description: 'Logo concepts (3)', quantity: 1, rate: 900 },
              { id: 'e3_i3', description: 'Final files + brand guide', quantity: 1, rate: 650 },
            ],
            subtotal: 1800,
            discount: 0,
            taxRate: 0,
            shipping: 0,
            amount: 1800,
            notes: 'Draft estimate (not yet sent).',
            terms: '50% upfront. Remaining due before final delivery.',
          },
          {
            id: 'est_demo_4',
            number: 'EST-0010',
            clientId: 'cli_demo_4',
            client: 'Rich Richards',
            clientCompany: 'Richards Consulting',
            clientEmail: 'rich@example.com',
            clientAddress: '101 King St, New York, NY',
            category: 'Service',
            description: 'Quarterly strategy workshop (1 day)',
            date: toISO(daysAgo(40)),
            validUntil: toISO(daysAgo(20)),
            status: 'declined',
            items: [
              { id: 'e4_i1', description: 'On-site workshop', quantity: 1, rate: 2500 },
              { id: 'e4_i2', description: 'Follow-up report', quantity: 1, rate: 600 },
            ],
            subtotal: 3100,
            discount: 100,
            taxRate: 0,
            shipping: 0,
            amount: 3000,
            notes: 'Declined — budget shifted this quarter.',
            terms: 'Net 14 upon acceptance.',
          },
        ];

        setTransactions([...(demo.transactions || [])] as Transaction[]);
        setInvoices([...(demo.invoices || [])] as Invoice[]);
        setClients(demoClients);
        setEstimates(demoEstimates);
        setSettings({
          businessName: 'My Business',
          ownerName: 'Owner',
          payPrefs: DEFAULT_PAY_PREFS,
          taxRate: 15,
          stateTaxRate: 0,
          taxEstimationMethod: 'preset',
          filingStatus: 'single',
          currencySymbol: '$',
          showLogoOnInvoice: true,
          logoAlignment: 'left',
          brandColor: '#2563eb',
          ...(demo.settings || {}),
        });
        setTaxPayments([...(demo.taxPayments || [])] as TaxPayment[]);
        setCustomCategories({
          income: demo.customCategories?.income || [],
          expense: demo.customCategories?.expense || [],
          billing: demo.customCategories?.billing || [],
        });
        setReceipts([...(demo.receipts || [])] as ReceiptType[]);
    }
    setDataLoaded(true);
  }, []);

  useEffect(() => {
    if (dataLoaded) {
      localStorage.setItem(DB_KEY, JSON.stringify({ transactions, invoices, estimates, clients, settings, taxPayments, customCategories, receipts }));
    }
  }, [transactions, invoices, estimates, clients, settings, taxPayments, customCategories, receipts, dataLoaded]);

  useEffect(() => {
    if (!dataLoaded) return;
    const todayStr = new Date().toISOString().split('T')[0];
    const activeRecurring = invoices.filter(inv => inv.recurrence && inv.recurrence.active && inv.recurrence.nextDate <= todayStr && inv.status !== 'void');
    
    if (activeRecurring.length > 0) {
      const generatedInvoices: Invoice[] = [];
      const updatedParentInvoices = [...invoices];
      activeRecurring.forEach(parent => {
        if (!parent.recurrence) return;
        let currentNextDate = parent.recurrence.nextDate;
        while (currentNextDate <= todayStr) {
           const newDate = currentNextDate;
           const parentDateObj = new Date(parent.date);
           const parentDueObj = new Date(parent.due);
           const termDays = Math.ceil((parentDueObj.getTime() - parentDateObj.getTime()) / (1000 * 3600 * 24));
           const newDueObj = new Date(newDate);
           newDueObj.setDate(newDueObj.getDate() + termDays);
           generatedInvoices.push({
             ...parent,
             id: generateId('inv_auto'),
             date: newDate,
             due: newDueObj.toISOString().split('T')[0],
             status: 'unpaid',
             recurrence: undefined, 
             linkedTransactionId: undefined, 
             notes: `Generated from recurring invoice #${parent.id.substring(parent.id.length - 6).toUpperCase()}`
           });
           currentNextDate = calculateNextDate(currentNextDate, parent.recurrence.frequency);
        }
        const parentIndex = updatedParentInvoices.findIndex(p => p.id === parent.id);
        if (parentIndex >= 0) {
          updatedParentInvoices[parentIndex] = {
            ...parent,
            recurrence: {
              ...parent.recurrence,
              nextDate: currentNextDate
            }
          };
        }
      });
      if (generatedInvoices.length > 0) {
        setInvoices([...generatedInvoices, ...updatedParentInvoices]);
        showToast(`${generatedInvoices.length} recurring invoice(s) generated.`, 'success');
      }
    }
  }, [dataLoaded, invoices]); 

  const totals = useMemo(() => {
    const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const profit = income - expense;
    const allUnpaid = invoices.filter(i => i.status === 'unpaid');
    const overdueAmount = allUnpaid.filter(i => getDaysOverdue(i.due) > 0).reduce((sum, i) => sum + i.amount, 0);
    const pendingAmount = allUnpaid.reduce((sum, i) => sum + i.amount, 0);
    const totalTaxRate = (settings.taxRate / 100) + (settings.stateTaxRate / 100) + TAX_CONSTANTS.SE_TAX_RATE;
    const estimatedTax = profit > 0 ? profit * totalTaxRate : 0;
    const pendingCount = allUnpaid.length;
    const overdueCount = allUnpaid.filter(i => getDaysOverdue(i.due) > 0).length;
    return { income, expense, profit, pendingAmount, overdueAmount, pendingCount, overdueCount, estimatedTax };
  }, [transactions, invoices, settings.taxRate, settings.stateTaxRate]);

  const homeTotals = useMemo(() => {
    const parse = (dateStr: string) => {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? null : d;
    };

    const now = new Date();
    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const rangeFor = (p: HomeKpiPeriod): { start: Date | null; end: Date } => {
      if (p === 'all') return { start: null, end: endDate };
      if (p === 'ytd') return { start: new Date(now.getFullYear(), 0, 1), end: endDate };
      if (p === 'mtd') return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: endDate };
      // '30d'
      const start = new Date(endDate);
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      return { start, end: endDate };
    };

    const { start, end } = rangeFor(homeKpiPeriod);
    const inRange = (t: Transaction) => {
      const d = parse(t.date);
      if (!d) return false;
      if (start && d < start) return false;
      return d <= end;
    };

    const scoped = transactions.filter(inRange);
    const income = scoped.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = scoped.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const profit = income - expense;

    const label = homeKpiPeriod === 'ytd' ? 'YTD' : homeKpiPeriod === 'mtd' ? 'MTD' : homeKpiPeriod === '30d' ? '30D' : 'ALL';

    const fmtShort = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const rangeText = start ? `${fmtShort(start)} — ${fmtShort(end)}` : `All Time`;

    return { income, expense, profit, label, rangeText };
  }, [transactions, homeKpiPeriod]);


  const reportData = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // Helper to safely get amount as number
    const getAmt = (t: any) => Number(t.amount) || 0;
    // Helper to safe parse date
    const getYear = (dateStr: string) => {
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? 0 : d.getFullYear();
    };
    const getMonth = (dateStr: string) => {
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? -1 : d.getMonth();
    };

    // 1. YTD Calculations (Calendar Year)
    const ytdTx = transactions.filter(t => getYear(t.date) === currentYear);
    
    const ytdIncome = ytdTx
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + getAmt(t), 0);
        
    const ytdExpense = ytdTx
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + getAmt(t), 0);

    // Allow negative for display
    const ytdNetProfit = ytdIncome - ytdExpense; 

    // 2. Tax Calculations
    // Tax is calculated on positive profit only
    const taxableProfit = Math.max(0, ytdNetProfit);

    const seTaxLiability = taxableProfit * TAX_CONSTANTS.SE_TAXABLE_PORTION * TAX_CONSTANTS.SE_TAX_RATE;
    
    const totalIncomeTaxRate = (settings.taxRate || 0) + (settings.stateTaxRate || 0);
    const incomeTaxLiability = taxableProfit * (totalIncomeTaxRate / 100);
    
    const totalEstimatedTax = seTaxLiability + incomeTaxLiability;
    
    // 3. Tax Payments (YTD)
    const taxPaymentsYTD = taxPayments.filter(p => getYear(p.date) === currentYear);
    const totalTaxPaidYTD = taxPaymentsYTD.reduce((sum, p) => sum + getAmt(p), 0);
    
    // 4. Current Period (Month) for P&L Card
    const currentMonthTx = transactions.filter(t => {
        return getMonth(t.date) === currentMonth && getYear(t.date) === currentYear;
    });
    
    const monthIncome = currentMonthTx
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + getAmt(t), 0);
        
    const monthExpense = currentMonthTx
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + getAmt(t), 0);

    const monthNetProfit = monthIncome - monthExpense;

    // 5. Extras
    const taxShield = ytdExpense * (TAX_CONSTANTS.SE_TAX_RATE + (totalIncomeTaxRate / 100));
    
    const stdDeduction = settings.filingStatus === 'joint' ? TAX_CONSTANTS.STD_DEDUCTION_JOINT : settings.filingStatus === 'head' ? TAX_CONSTANTS.STD_DEDUCTION_HEAD : TAX_CONSTANTS.STD_DEDUCTION_SINGLE;

    return { 
        income: monthIncome,
        expense: monthExpense,
        netProfit: monthNetProfit,
        ytdNetProfit, 
        seTaxLiability,
        incomeTaxLiability,
        totalEstimatedTax,
        stdDeduction,
        taxShield,
        totalTaxPaidYTD,
        taxRemaining: Math.max(0, totalEstimatedTax - totalTaxPaidYTD),
        taxAhead: Math.max(0, totalTaxPaidYTD - totalEstimatedTax),
        taxPaymentsYTD, 
        totalIncomeTaxRate
    };
  }, [transactions, settings, taxPayments]);

  const getFilteredTransactions = useCallback(() => {
     if (filterPeriod === 'all') return transactions;
     return transactions.filter(t => {
       const tDate = new Date(t.date);
       const checkDate = new Date(tDate.getFullYear(), tDate.getMonth(), tDate.getDate());
       const ref = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
       if (filterPeriod === 'daily') return checkDate.getTime() === ref.getTime();
       if (filterPeriod === 'weekly') {
          const start = getStartOfWeek(ref);
          const end = getEndOfWeek(ref);
          return checkDate >= start && checkDate <= end;
       }
       if (filterPeriod === 'monthly') return tDate.getMonth() === ref.getMonth() && tDate.getFullYear() === ref.getFullYear();
       return tDate.getFullYear() === ref.getFullYear();
     });
  }, [transactions, filterPeriod, referenceDate]);

  const filteredTransactions = useMemo(() => getFilteredTransactions(), [getFilteredTransactions]);
  
  const ledgerItems = useMemo(() => {
    const txItems = transactions.map(t => ({ ...t, dataType: 'transaction', listId: t.id, original: t, sortDate: new Date(t.date).getTime() }));
    const invItems = invoices.map(i => ({ ...i, name: i.client, dataType: 'invoice', type: 'invoice', listId: i.id, original: i, sortDate: new Date(i.date).getTime() }));
    let merged = [...txItems, ...invItems];
    if (filterPeriod !== 'all') {
      merged = merged.filter(item => {
        const itemDate = new Date(item.date);
        const ref = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
        if (filterPeriod === 'monthly') return itemDate.getMonth() === ref.getMonth() && itemDate.getFullYear() === ref.getFullYear();
        if (filterPeriod === 'yearly') return itemDate.getFullYear() === ref.getFullYear();
        return true; 
      });
    }
    if (ledgerFilter !== 'all') {
      merged = merged.filter(item => ledgerFilter === 'invoice' ? item.dataType === 'invoice' : item.type === ledgerFilter);
    }
    return merged.sort((a, b) => b.sortDate - a.sortDate);
  }, [transactions, invoices, filterPeriod, referenceDate, ledgerFilter]);

  const periodTotals = useMemo(() => {
    const inc = filteredTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const exp = filteredTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { inc, exp, net: inc - exp };
  }, [filteredTransactions]);

  const getFilteredInvoices = useCallback(() => {
    if (filterPeriod === 'all') return invoices;
    return invoices.filter(i => {
      const iDate = new Date(i.date);
      const ref = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
      if (filterPeriod === 'monthly') return iDate.getMonth() === ref.getMonth() && iDate.getFullYear() === ref.getFullYear();
      if (filterPeriod === 'yearly') return iDate.getFullYear() === ref.getFullYear();
      return true;
    });
 }, [invoices, filterPeriod, referenceDate]);

 const filteredInvoices = useMemo(() => getFilteredInvoices(), [getFilteredInvoices]);

  const displayedInvoices = useMemo(() => {
    if (invoiceQuickFilter === 'all') return filteredInvoices;
    if (invoiceQuickFilter === 'unpaid') return filteredInvoices.filter(i => i.status === 'unpaid');
    return filteredInvoices.filter(i => i.status === 'unpaid' && getDaysOverdue(i.due) > 0);
  }, [filteredInvoices, invoiceQuickFilter]);

  const invoiceQuickCounts = useMemo(() => {
    const validInvoices = filteredInvoices.filter(i => i.status !== 'void');
    const all = validInvoices.length;
    const unpaid = validInvoices.filter(i => i.status === 'unpaid').length;
    const overdue = validInvoices.filter(i => i.status === 'unpaid' && getDaysOverdue(i.due) > 0).length;
    return { all, unpaid, overdue };
  }, [filteredInvoices]);

 const invoicePeriodTotals = useMemo(() => {
   const validInvoices = filteredInvoices.filter(i => i.status !== 'void');
   const total = validInvoices.reduce((sum, i) => sum + i.amount, 0);
   const paid = validInvoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0);
   const unpaidAll = validInvoices.filter(i => i.status === 'unpaid');
   const unpaid = unpaidAll.reduce((sum, i) => sum + i.amount, 0);
   const overdue = unpaidAll.filter(i => getDaysOverdue(i.due) > 0).reduce((sum, i) => sum + i.amount, 0);
   return { total, paid, unpaid, overdue };
 }, [filteredInvoices]);

  // Estimates (Quotes)
  const getFilteredEstimates = useCallback(() => {
    if (filterPeriod === 'all') return estimates;
    return estimates.filter(e => {
      const eDate = new Date(e.date);
      const ref = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
      if (filterPeriod === 'monthly') return eDate.getMonth() === ref.getMonth() && eDate.getFullYear() === ref.getFullYear();
      if (filterPeriod === 'yearly') return eDate.getFullYear() === ref.getFullYear();
      return true;
    });
  }, [estimates, filterPeriod, referenceDate]);

  const filteredEstimates = useMemo(() => getFilteredEstimates(), [getFilteredEstimates]);

  const displayedEstimates = useMemo(() => {
    if (estimateQuickFilter === 'all') return filteredEstimates;
    return filteredEstimates.filter(e => e.status === estimateQuickFilter);
  }, [filteredEstimates, estimateQuickFilter]);

  const estimateQuickCounts = useMemo(() => {
    const valid = filteredEstimates.filter(e => e.status !== 'void');
    const all = valid.length;
    const draft = valid.filter(e => e.status === 'draft').length;
    const sent = valid.filter(e => e.status === 'sent').length;
    const accepted = valid.filter(e => e.status === 'accepted').length;
    const declined = valid.filter(e => e.status === 'declined').length;
    return { all, draft, sent, accepted, declined };
  }, [filteredEstimates]);

 const recentCategories = useMemo(() => {
    if (!dataLoaded) return [];
    const sourceData = activeTab === 'billing' ? invoices.map(i => i.category) : transactions.filter(t => t.type === activeTab).map(t => t.category);
    const counts: Record<string, number> = {};
    sourceData.forEach(cat => { counts[cat] = (counts[cat] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([cat]) => cat);
 }, [transactions, invoices, activeTab, dataLoaded]);

  const resetActiveItem = (type: 'income' | 'expense' | 'billing') => {
    const today = new Date().toISOString().split('T')[0];
    if (type === 'billing') {
      if (billingDocType === 'estimate') {
        setActiveItem({
          client: '', amount: 0, category: CATS_BILLING[0], description: '', date: today, validUntil: today, status: 'draft',
          items: [{ id: generateId('est_item'), description: '', quantity: 1, rate: 0 }],
          subtotal: 0, discount: 0, taxRate: 0, shipping: 0,
          notes: settings.defaultInvoiceNotes || '', terms: settings.defaultInvoiceTerms || ''
        });
      } else {
        setActiveItem({ 
          client: '', amount: 0, category: CATS_BILLING[0], description: '', date: today, due: today, status: 'unpaid',
          items: [{ id: generateId('item'), description: '', quantity: 1, rate: 0 }],
          subtotal: 0, discount: 0, taxRate: 0, shipping: 0,
          notes: settings.defaultInvoiceNotes || '', terms: settings.defaultInvoiceTerms || ''
        });
      }
    } else {
      setActiveItem({ type, date: today, name: '', amount: 0, category: type === 'income' ? CATS_IN[0] : CATS_OUT[0] });
    }
  };

  const handleOpenFAB = (
    type: 'income' | 'expense' | 'billing' = 'income',
    billingType?: 'invoice' | 'estimate'
  ) => {
    setDrawerMode('add');
    setActiveTab(type);

    // When creating a billing document, make sure the drawer opens in the
    // correct mode (Invoice vs Estimate).
    if (type === 'billing' && billingType) {
      setBillingDocType(billingType);
    }

    resetActiveItem(type);
    setCategorySearch('');
    setIsDrawerOpen(true);
  };

  const getHeaderFabType = (): 'income' | 'expense' | 'billing' => {
    if (currentPage === Page.Income) return 'income';
    if (currentPage === Page.Expenses) return 'expense';
    if ((currentPage === Page.Invoices || currentPage === Page.Invoice) || currentPage === Page.Invoice) return 'billing';
    if ((currentPage === Page.AllTransactions || currentPage === Page.Ledger) || currentPage === Page.Ledger) {
      if (ledgerFilter === 'income') return 'income';
      if (ledgerFilter === 'invoice') return 'billing';
      if (ledgerFilter === 'expense') return 'expense';
      return 'income'; // 'all'
    }
    return 'expense';
  };
  
  const handleEditItem = (item: any) => {
      setCategorySearch('');
      
      // Determine if the item is an invoice or a transaction.
      // It handles both "Ledger" items (which have a .original property) and raw items (from Recent Activity).
      const rawData = item.original || item;
      
      // Check for billing doc types (invoice vs estimate)
      const isEstimate = item.dataType === 'estimate' || rawData.validUntil !== undefined;
      const isInvoice = item.dataType === 'invoice' || rawData.due !== undefined;

      if (isInvoice || isEstimate) {
          setBillingDocType(isEstimate ? 'estimate' : 'invoice');
          setActiveItem(rawData); 
          setActiveTab('billing'); 
          setDrawerMode('edit_inv');
      } else {
          setActiveItem(rawData); 
          // Correctly set tab based on the transaction type (income vs expense)
          const txType = rawData.type || 'income';
          setActiveTab(txType === 'income' ? 'income' : 'expense'); 
          setDrawerMode('edit_tx');
      }
      setIsDrawerOpen(true);
  };

  const handleOpenTaxDrawer = () => {
    setDrawerMode('tax_payments'); setActiveTaxPayment({ type: 'Estimated', date: new Date().toISOString().split('T')[0], amount: 0, note: '' }); setIsDrawerOpen(true);
  };

  const saveTaxPayment = () => {
    if (!activeTaxPayment.amount || Number(activeTaxPayment.amount) <= 0) return showToast("Please enter a valid amount", "error");
    setTaxPayments(prev => [{ id: generateId('tax'), date: activeTaxPayment.date!, amount: Number(activeTaxPayment.amount), type: activeTaxPayment.type || 'Estimated', note: activeTaxPayment.note }, ...prev]);
    showToast("Tax payment recorded", "success"); setActiveTaxPayment(prev => ({ ...prev, amount: 0, note: '' }));
  };

  const deleteTaxPayment = (id: string) => {
    if(confirm("Delete this tax payment?")) { setTaxPayments(prev => prev.filter(p => p.id !== id)); showToast("Payment deleted", "info"); }
  };

  const handleSeedDemoData = () => {
    const demo = getFreshDemoData();
    // --- Demo Clients + Estimates (V7) ---
    const toISO = (d: Date) => d.toISOString().split('T')[0];
    const today = new Date();
    const daysAgo = (n: number) => new Date(today.getTime() - n * 24 * 60 * 60 * 1000);
    const daysFromNow = (n: number) => new Date(today.getTime() + n * 24 * 60 * 60 * 1000);

    const demoClients: Client[] = [
      {
        id: 'cli_demo_1',
        name: 'Kenny Barria',
        company: 'KB Landscaping',
        email: 'kenny@example.com',
        phone: '+1 (555) 010-2001',
        address: '12 Palm St, Miami, FL',
        status: 'lead',
        createdAt: toISO(daysAgo(45)),
        updatedAt: toISO(daysAgo(2)),
      },
      {
        id: 'cli_demo_2',
        name: 'Sophia Stanley',
        company: 'Stanley Studio',
        email: 'sophia@example.com',
        phone: '+1 (555) 010-2002',
        address: '88 Market Ave, Austin, TX',
        status: 'lead',
        createdAt: toISO(daysAgo(30)),
        updatedAt: toISO(daysAgo(10)),
      },
      {
        id: 'cli_demo_3',
        name: 'Jimmy Wilson',
        company: 'Wilson Renovations',
        email: 'jimmy@example.com',
        phone: '+1 (555) 010-2003',
        address: '5 Harbor Rd, San Diego, CA',
        status: 'client',
        createdAt: toISO(daysAgo(120)),
        updatedAt: toISO(daysAgo(1)),
      },
      {
        id: 'cli_demo_4',
        name: 'Rich Richards',
        company: 'Richards Consulting',
        email: 'rich@example.com',
        phone: '+1 (555) 010-2004',
        address: '101 King St, New York, NY',
        status: 'inactive',
        createdAt: toISO(daysAgo(300)),
        updatedAt: toISO(daysAgo(90)),
      },
    ];

    const demoEstimates: Estimate[] = [
      {
        id: 'est_demo_1',
        number: 'EST-0007',
        clientId: 'cli_demo_3',
        client: 'Jimmy Wilson',
        clientCompany: 'Wilson Renovations',
        clientEmail: 'jimmy@example.com',
        clientAddress: '5 Harbor Rd, San Diego, CA',
        category: 'Service',
        description: 'Bathroom repair + fixture replacement',
        date: toISO(daysAgo(5)),
        validUntil: toISO(daysFromNow(9)),
        status: 'accepted',
        items: [
          { id: 'e1_i1', description: 'Labor (3 hrs)', quantity: 3, rate: 95 },
          { id: 'e1_i2', description: 'Fixture & materials', quantity: 1, rate: 180 },
        ],
        subtotal: 465,
        discount: 0,
        taxRate: 8,
        shipping: 0,
        amount: Math.round((465 + 465 * 0.08) * 100) / 100,
        notes: 'Thank you! This estimate is valid for 14 days.',
        terms: '50% deposit to schedule work. Remaining due upon completion.',
        poNumber: 'PO-1027',
      },
      {
        id: 'est_demo_2',
        number: 'EST-0008',
        clientId: 'cli_demo_1',
        client: 'Kenny Barria',
        clientCompany: 'KB Landscaping',
        clientEmail: 'kenny@example.com',
        clientAddress: '12 Palm St, Miami, FL',
        category: 'Service',
        description: 'Monthly lawn maintenance (4 visits)',
        date: toISO(daysAgo(2)),
        validUntil: toISO(daysFromNow(12)),
        status: 'sent',
        items: [
          { id: 'e2_i1', description: 'Lawn mow + edge (per visit)', quantity: 4, rate: 85 },
          { id: 'e2_i2', description: 'Hedge trim (one time)', quantity: 1, rate: 120 },
        ],
        subtotal: 460,
        discount: 20,
        taxRate: 0,
        shipping: 0,
        amount: 440,
        notes: 'Includes green waste removal.',
        terms: 'Net 7 days after acceptance.',
      },
      {
        id: 'est_demo_3',
        number: 'EST-0009',
        clientId: 'cli_demo_2',
        client: 'Sophia Stanley',
        clientCompany: 'Stanley Studio',
        clientEmail: 'sophia@example.com',
        clientAddress: '88 Market Ave, Austin, TX',
        category: 'Service',
        description: 'Brand kit design (logo, colors, typography)',
        date: toISO(daysAgo(15)),
        validUntil: toISO(daysAgo(1)),
        status: 'draft',
        items: [
          { id: 'e3_i1', description: 'Discovery call + moodboard', quantity: 1, rate: 250 },
          { id: 'e3_i2', description: 'Logo concepts (3)', quantity: 1, rate: 900 },
          { id: 'e3_i3', description: 'Final files + brand guide', quantity: 1, rate: 650 },
        ],
        subtotal: 1800,
        discount: 0,
        taxRate: 0,
        shipping: 0,
        amount: 1800,
        notes: 'Draft estimate (not yet sent).',
        terms: '50% upfront. Remaining due before final delivery.',
      },
      {
        id: 'est_demo_4',
        number: 'EST-0010',
        clientId: 'cli_demo_4',
        client: 'Rich Richards',
        clientCompany: 'Richards Consulting',
        clientEmail: 'rich@example.com',
        clientAddress: '101 King St, New York, NY',
        category: 'Service',
        description: 'Quarterly strategy workshop (1 day)',
        date: toISO(daysAgo(40)),
        validUntil: toISO(daysAgo(20)),
        status: 'declined',
        items: [
          { id: 'e4_i1', description: 'On-site workshop', quantity: 1, rate: 2500 },
          { id: 'e4_i2', description: 'Follow-up report', quantity: 1, rate: 600 },
        ],
        subtotal: 3100,
        discount: 100,
        taxRate: 0,
        shipping: 0,
        amount: 3000,
        notes: 'Declined — budget shifted this quarter.',
        terms: 'Net 14 upon acceptance.',
      },
    ];

    // Keep original demo data, but add our V7 demo entities
    setTransactions([...demo.transactions] as Transaction[]);
    setInvoices([...demo.invoices] as Invoice[]);
    setClients(demoClients);
    setEstimates(demoEstimates);
    setSettings({ ...demo.settings });
    setTaxPayments([...(demo.taxPayments || [])] as TaxPayment[]);
    setSeedSuccess(true); showToast("Demo data loaded successfully!", "success"); setCurrentPage(Page.Dashboard); setTimeout(() => setSeedSuccess(false), 2000);
  };

  const handleClearData = () => setShowResetConfirm(true);
  
  const performReset = () => {
    try {
        localStorage.setItem(DB_KEY, JSON.stringify({ transactions: [], invoices: [], estimates: [], clients: [], settings: { businessName: "My Business", ownerName: "Owner", payPrefs: DEFAULT_PAY_PREFS, taxRate: 25, currencySymbol: '$' }, taxPayments: [], customCategories: { income: [], expense: [], billing: [] }, receipts: [] }));
    } catch (e) { console.error("Failed to wipe", e); }
    setTransactions([]); setInvoices([]); setEstimates([]); setTaxPayments([]); setReceipts([]); setCustomCategories({ income: [], expense: [], billing: [] }); setSettings({ businessName: "My Business", ownerName: "Owner", payPrefs: DEFAULT_PAY_PREFS, taxRate: 25, stateTaxRate: 0, taxEstimationMethod: 'preset', filingStatus: 'single', currencySymbol: '$' });
     setSeedSuccess(false); setShowResetConfirm(false); showToast("All data has been wiped.", "success"); setCurrentPage(Page.Dashboard);
  };

  const confirmDeleteInvoice = () => {
    if (!invoiceToDelete) return;
    const inv = invoices.find(i => i.id === invoiceToDelete);
    setInvoices(prev => prev.filter(i => i.id !== invoiceToDelete));
    if (inv && inv.linkedTransactionId) {
        setTransactions(prev => prev.filter(t => t.id !== inv.linkedTransactionId));
    }
    setInvoiceToDelete(null);
    setIsDrawerOpen(false);
    showToast("Invoice deleted", "info");
  };

  const saveTransaction = (data: Partial<Transaction>) => {
    if (!data.name?.trim()) return showToast("Please enter a description", "error");
    if (!data.amount || Number(data.amount) <= 0) return showToast("Please enter a valid amount", "error");
    const newTx: Transaction = { id: generateId('tx'), name: data.name, amount: Number(data.amount), category: data.category || "General", date: data.date || new Date().toISOString().split('T')[0], type: (data.type as any) || 'income', notes: data.notes };
    if (drawerMode === 'edit_tx' && activeItem.id) {
      setTransactions(prev => prev.map(t => t.id === activeItem.id ? { ...t, ...newTx, id: t.id } as Transaction : t)); showToast("Transaction updated", "success");
    } else {
      setTransactions(prev => [newTx, ...prev]); showToast("Transaction saved", "success");
    }
    setIsDrawerOpen(false);
  };

  const duplicateTransaction = (original: Transaction) => {
    const duplicated = {
      ...original,
      id: undefined, // Will be generated on save
      date: new Date().toISOString().split('T')[0], // Set to today
      receiptImage: undefined, // Don't copy receipt
      notes: original.notes || '' // Keep notes but don't add "duplicated" marker
    };
    
    setActiveItem(duplicated);
    setActiveTab(original.type); // Set correct tab (income/expense)
    setDrawerMode('add'); // Open in add mode
    setIsDrawerOpen(true);
    showToast("Transaction duplicated - review and save", "success");
    
    // Track duplication for smart suggestions
    const trackingKey = `${original.name}_${original.category}_${original.type}`;
    const currentCount = duplicationCount[trackingKey] || 0;
    const newCount = currentCount + 1;
    
    setDuplicationCount(prev => ({
      ...prev,
      [trackingKey]: newCount
    }));
    
    // After 3 duplications, suggest saving as template
    if (newCount === 3) {
      setTimeout(() => {
        setTemplateSuggestionData({
          name: original.name,
          category: original.category,
          type: original.type
        });
        setShowTemplateSuggestion(true);
      }, 1000);
    }
  };

  const saveInvoice = (data: Partial<Invoice>) => {
    if (!data.client?.trim()) return showToast("Please enter a client name", "error");
    // Auto-create/update client record and tie document to clientId
    const clientId = upsertClientFromDoc(data as any, 'client');
    data = { ...data, clientId };
    let totalAmount = 0, subtotal = 0;
    if (data.items && data.items.length > 0) {
        subtotal = data.items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
        totalAmount = Math.max(0, subtotal - (data.discount || 0) + ((subtotal - (data.discount || 0)) * ((data.taxRate || 0) / 100)) + (data.shipping || 0));
    } else {
        totalAmount = Number(data.amount) || 0; subtotal = totalAmount;
    }
    if (totalAmount <= 0) return showToast("Please add items or enter a valid amount", "error");
    const description = data.description || (data.items && data.items.length > 0 ? data.items[0].description : "Services Rendered");
    
    if (drawerMode === 'edit_inv' && activeItem.id) {
      setInvoices(prev => prev.map(i => {
        if (i.id === activeItem.id) {
           const updatedInvoice = { ...i, ...data, amount: totalAmount, subtotal, description } as Invoice;
           if (updatedInvoice.status !== 'void' && updatedInvoice.linkedTransactionId) {
             setTransactions(txs => txs.map(t => t.id === updatedInvoice.linkedTransactionId ? { ...t, amount: updatedInvoice.amount, name: `Pmt: ${updatedInvoice.client}`, date: updatedInvoice.date } : t));
           }
           return updatedInvoice;
        }
        return i;
      }));
      showToast("Invoice updated", "success");
    } else {
      const newInv: Invoice = {
        id: generateId('inv'), clientId: data.clientId, client: data.client, clientAddress: data.clientAddress, clientEmail: data.clientEmail, clientCompany: data.clientCompany,
        amount: totalAmount, category: data.category || "Service", description, date: data.date || new Date().toISOString().split('T')[0],
        due: data.due || new Date().toISOString().split('T')[0], status: 'unpaid', notes: data.notes || settings.defaultInvoiceNotes,
        terms: data.terms || settings.defaultInvoiceTerms, payMethod: data.payMethod, recurrence: data.recurrence, items: data.items,
        subtotal, discount: data.discount, shipping: data.shipping, taxRate: data.taxRate, poNumber: data.poNumber
      };
      setInvoices(prev => [newInv, ...prev]); showToast("Invoice generated", "success");
    }
    setIsDrawerOpen(false);
  };

  // Estimates (Quotes)
  const saveEstimate = (data: Partial<Estimate>) => {
    if (!data.client?.trim()) return showToast('Please enter a client name', 'error');
    const statusHint: ClientStatus = (data.status === 'accepted') ? 'client' : 'lead';
    const clientId = upsertClientFromDoc(data as any, statusHint);
    data = { ...data, clientId };
    let totalAmount = 0;
    let subtotal = 0;
    if (data.items && data.items.length > 0) {
        subtotal = data.items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
        const taxable = Math.max(0, subtotal - (data.discount || 0));
        totalAmount = Math.max(0, taxable + (taxable * ((data.taxRate || 0) / 100)) + (data.shipping || 0));
    } else {
        totalAmount = Number(data.amount) || 0;
        subtotal = totalAmount;
    }
    if (totalAmount <= 0) return showToast('Please add items or enter a valid amount', 'error');
    const description = data.description || (data.items && data.items.length > 0 ? data.items[0].description : 'Services / Work');

    if (drawerMode === 'edit_inv' && activeItem.id) {
      setEstimates(prev => prev.map(e => e.id === activeItem.id ? ({ ...e, ...data, amount: totalAmount, subtotal, description } as Estimate) : e));
      showToast('Estimate updated', 'success');
    } else {
      const newEst: Estimate = {
        id: generateId('est'),
        clientId: data.clientId,
        client: data.client!,
        clientCompany: data.clientCompany,
        clientAddress: data.clientAddress,
        clientEmail: data.clientEmail,
        amount: totalAmount,
        category: data.category || 'Service',
        description,
        date: data.date || new Date().toISOString().split('T')[0],
        validUntil: data.validUntil || data.date || new Date().toISOString().split('T')[0],
        status: (data.status as any) || 'draft',
        notes: data.notes || settings.defaultInvoiceNotes,
        terms: data.terms || settings.defaultInvoiceTerms,
        items: data.items,
        subtotal,
        discount: data.discount,
        shipping: data.shipping,
        taxRate: data.taxRate,
        poNumber: data.poNumber
      };
      setEstimates(prev => [newEst, ...prev]);
      showToast('Estimate generated', 'success');
    }
    setIsDrawerOpen(false);
  };

  const deleteEstimate = (est: Partial<Estimate>) => {
    if (!est.id) return;
    if (confirm('Delete this estimate?')) {
      setEstimates(prev => prev.filter(e => e.id !== est.id));
      setIsDrawerOpen(false);
      showToast('Estimate deleted', 'info');
    }
  };

  const duplicateEstimate = (original: Estimate) => {
    const today = new Date().toISOString().split('T')[0];
    const daysValid = original.validUntil && original.date ? Math.max(0, Math.round((new Date(original.validUntil).getTime() - new Date(original.date).getTime()) / (1000 * 60 * 60 * 24))) : 30;
    const valid = new Date();
    valid.setDate(valid.getDate() + daysValid);

    const duplicated: Partial<Estimate> = {
      ...original,
      id: undefined,
      date: today,
      validUntil: valid.toISOString().split('T')[0],
      status: 'draft',
    };

    setBillingDocType('estimate');
    setActiveItem(duplicated);
    setActiveTab('billing');
    setDrawerMode('add');
    setIsDrawerOpen(true);
    showToast('Estimate duplicated - review and save', 'success');
  };

  // Convert Estimate -> Invoice (Wave-style)
  const convertEstimateToInvoice = (est: Estimate) => {
    if (!est?.id) return;
    if (est.status === 'void') return showToast('Cannot convert a void estimate', 'error');
    if (est.status === 'declined') {
      const ok = confirm('This estimate is Declined. Convert to an invoice anyway?');
      if (!ok) return;
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Default due date: today + 14 days (if user didn't set something else later)
    const due = new Date(today);
    due.setDate(due.getDate() + 14);
    const dueStr = due.toISOString().split('T')[0];

    // Build invoice from estimate
    const newInv: Invoice = {
      id: generateId('inv'),
      clientId: est.clientId,
      client: est.client,
      clientCompany: est.clientCompany,
      clientAddress: est.clientAddress,
      clientEmail: est.clientEmail,
      amount: est.amount,
      category: est.category || 'Service',
      description: est.description || (est.items && est.items[0]?.description) || 'Services Rendered',
      date: todayStr,
      due: dueStr,
      status: 'unpaid',
      notes: (est.notes ? `${est.notes}\n\n` : '') + `Converted from estimate ${est.number || est.id}`,
      terms: est.terms || settings.defaultInvoiceTerms,
      items: (est.items || []).map(it => ({ ...it, id: generateId('item') })),
      subtotal: est.subtotal,
      discount: est.discount,
      shipping: est.shipping,
      taxRate: est.taxRate,
      poNumber: est.poNumber,
    };

    // 1) Add invoice
    setInvoices(prev => [newInv, ...prev]);

    // 2) Mark estimate as accepted (so it reflects a closed deal)
    setEstimates(prev => prev.map(e => e.id === est.id ? ({ ...e, status: 'accepted' } as Estimate) : e));

    // 3) Ensure client is promoted to "client" status
    if (newInv.client?.trim()) {
      upsertClientFromDoc(newInv as any, 'client');
    }

    // 4) Jump user into the new invoice for review/edit
    setBillingDocType('invoice');
    setCurrentPage(Page.Invoices);
    setActiveTab('billing');
    setActiveItem(newInv);
    setDrawerMode('edit_inv');
    setIsDrawerOpen(true);
    showToast('Estimate converted to invoice', 'success');
  };

  const handlePrintEstimate = (est: Partial<Estimate>) => {
    const estimateToPrint = { ...est } as Estimate;
    if (!estimateToPrint.items || estimateToPrint.items.length === 0) {
        estimateToPrint.items = [{ id: 'generated_1', description: est.description || 'Services', quantity: 1, rate: est.amount || 0 }];
        estimateToPrint.subtotal = est.amount;
    }
    setSelectedEstimateForDoc(estimateToPrint);
    setIsEstimatePdfPreviewOpen(true);
  };

  const handleDirectExportEstimatePDF = () => {
    if (!activeItem.id) return;
    const updatedEstimate = { ...activeItem } as Estimate;
    if (!updatedEstimate.items || updatedEstimate.items.length === 0) {
        updatedEstimate.items = [{ id: 'generated_1', description: updatedEstimate.description || 'Services', quantity: 1, rate: updatedEstimate.amount || 0 }];
        updatedEstimate.subtotal = updatedEstimate.amount;
    }
    setEstimates(prev => prev.map(e => e.id === updatedEstimate.id ? updatedEstimate : e));
    setSelectedEstimateForDoc(updatedEstimate);
    setIsEstimatePdfPreviewOpen(true);
  };

  const duplicateInvoice = (original: Invoice) => {
    const today = new Date().toISOString().split('T')[0];
    const paymentTermsDays = original.due && original.date ? 
      Math.round((new Date(original.due).getTime() - new Date(original.date).getTime()) / (1000 * 60 * 60 * 24)) : 30;
    
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + paymentTermsDays);
    
    const duplicated = {
      ...original,
      id: undefined, // Will be generated on save
      date: today,
      due: dueDate.toISOString().split('T')[0],
      status: 'unpaid' as const, // Always unpaid
      linkedTransactionId: undefined, // Don't link to old payment
      // Keep all the important stuff: client info, items, rates, terms, notes
    };
    
    setActiveItem(duplicated);
    setActiveTab('billing');
    setDrawerMode('add');
    setIsDrawerOpen(true);
    showToast("Invoice duplicated - review and save", "success");
  };
  
  // Phase 3: Batch Duplicate Function
  const openBatchDuplicate = (original: Transaction | Invoice) => {
    setBatchDuplicateData(original);
    setShowBatchDuplicateModal(true);
  };
  
  const executeBatchDuplicate = (dates: string[]) => {
    if (!batchDuplicateData) return;
    
    const isInvoice = 'client' in batchDuplicateData;
    
    dates.forEach(date => {
      if (isInvoice) {
        const original = batchDuplicateData as Invoice;
        const paymentTermsDays = original.due && original.date ? 
          Math.round((new Date(original.due).getTime() - new Date(original.date).getTime()) / (1000 * 60 * 60 * 24)) : 30;
        
        const dueDate = new Date(date);
        dueDate.setDate(dueDate.getDate() + paymentTermsDays);
        
        const newInv: Invoice = {
          ...original,
          id: generateId('inv'),
          date,
          due: dueDate.toISOString().split('T')[0],
          status: 'unpaid',
          linkedTransactionId: undefined
        };
        setInvoices(prev => [newInv, ...prev]);
      } else {
        const original = batchDuplicateData as Transaction;
        const newTx: Transaction = {
          ...original,
          id: generateId('tx'),
          date,
          receiptImage: undefined
        };
        setTransactions(prev => [newTx, ...prev]);
        
        // Track duplication history
        setDuplicationHistory(prev => ({
          ...prev,
          [newTx.id]: { originalId: original.id!, originalDate: original.date }
        }));
      }
    });
    
    showToast(`Created ${dates.length} entries`, "success");
    setShowBatchDuplicateModal(false);
    setBatchDuplicateData(null);
  };
  
  // Phase 3: Recurring Transaction Setup
  const openRecurringSetup = (original: Transaction | Invoice) => {
    setRecurringData(original);
    setShowRecurringModal(true);
  };
  
  const setupRecurringTransaction = (frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly', occurrences: number) => {
    if (!recurringData) return;
    
    const dates: string[] = [];
    const startDate = new Date();
    
    for (let i = 0; i < occurrences; i++) {
      const date = new Date(startDate);
      
      switch (frequency) {
        case 'weekly':
          date.setDate(date.getDate() + (i * 7));
          break;
        case 'biweekly':
          date.setDate(date.getDate() + (i * 14));
          break;
        case 'monthly':
          date.setMonth(date.getMonth() + i);
          break;
        case 'quarterly':
          date.setMonth(date.getMonth() + (i * 3));
          break;
      }
      
      dates.push(date.toISOString().split('T')[0]);
    }
    
    executeBatchDuplicate(dates);
    setShowRecurringModal(false);
    setRecurringData(null);
  };
  
  // Phase 3: Template Management
  const saveAsTemplate = (data: Partial<Transaction | Invoice>, type: string, name: string) => {
    const template = {
      id: generateId('template'),
      name,
      data,
      type
    };
    setSavedTemplates(prev => [...prev, template]);
    showToast("Template saved", "success");
  };
  
  const loadTemplate = (template: typeof savedTemplates[0]) => {
    setActiveItem(template.data);
    setActiveTab(template.type as any);
    setDrawerMode('add');
    setIsDrawerOpen(true);
    showToast(`Template "${template.name}" loaded`, "success");
  };
  
  const deleteTemplate = (id: string) => {
    setSavedTemplates(prev => prev.filter(t => t.id !== id));
    showToast("Template deleted", "info");
  };

  const saveNewCategory = () => {
      if (!newCategoryName || newCategoryName.length < 2) return showToast("Category name too short", "error");
      setCustomCategories(prev => {
          const list = activeTab === 'income' ? 'income' : activeTab === 'expense' ? 'expense' : 'billing';
          return { ...prev, [list]: [...(prev[list] || []), newCategoryName] };
      });
      setActiveItem(prev => ({ ...prev, category: newCategoryName })); setNewCategoryName(''); setDrawerMode(previousDrawerMode.current); showToast("Category added", "success");
  };

  const deleteTransaction = (id?: string) => {
    if (!id) return;
    if(confirm("Delete this transaction?")) { setTransactions(prev => prev.filter(t => t.id !== id)); setIsDrawerOpen(false); showToast("Transaction deleted", "info"); }
  };

  const deleteInvoice = (inv: Partial<Invoice>) => {
    if (!inv.id) return;
    if(confirm("Delete this invoice?")) {
        setInvoices(prev => prev.filter(i => i.id !== inv.id));
        if (inv.linkedTransactionId) setTransactions(prev => prev.filter(t => t.id !== inv.linkedTransactionId));
        setIsDrawerOpen(false); showToast("Invoice deleted", "info");
    }
  };

  const toggleInvoicePaidStatus = (inv: Partial<Invoice>) => {
    if (!inv.id || inv.status === 'void') return;
    if (inv.status === 'paid') {
      setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, status: 'unpaid', linkedTransactionId: undefined } : i));
      if (inv.linkedTransactionId) setTransactions(prev => prev.filter(t => t.id !== inv.linkedTransactionId));
      setActiveItem(prev => ({ ...prev, status: 'unpaid' })); showToast("Invoice marked as Unpaid", "info");
    } else {
      const txId = generateId('tx_pay');
      const newTx: Transaction = { id: txId, name: `Pmt: ${inv.client}`, amount: inv.amount || 0, category: inv.category || 'Sales / Services', date: new Date().toISOString().split('T')[0], type: 'income', notes: `Linked to invoice #${inv.id.substring(0,6)}` };
      setTransactions(prev => [newTx, ...prev]);
      setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, status: 'paid', linkedTransactionId: txId } : i));
      setActiveItem(prev => ({ ...prev, status: 'paid' })); showToast("Invoice marked as Paid", "success");
    }
  };

  const markInvoicePaid = (inv: Invoice) => toggleInvoicePaidStatus(inv);

  const handlePrintInvoice = (inv: Partial<Invoice>) => {
    const invoiceToPrint = { ...inv } as Invoice;
    if (!invoiceToPrint.items || invoiceToPrint.items.length === 0) {
        invoiceToPrint.items = [{ id: 'generated_1', description: inv.description || "Services", quantity: 1, rate: inv.amount || 0 }];
        invoiceToPrint.subtotal = inv.amount;
    }
    setSelectedInvoiceForDoc(invoiceToPrint); setIsPdfPreviewOpen(true);
  };

  const handleDirectExportPDF = () => {
     if (!activeItem.id) return;
     const updatedInvoice = { ...activeItem } as Invoice;
     if (!updatedInvoice.items || updatedInvoice.items.length === 0) {
        updatedInvoice.items = [{ id: 'generated_1', description: updatedInvoice.description || "Services", quantity: 1, rate: updatedInvoice.amount || 0 }];
        updatedInvoice.subtotal = updatedInvoice.amount;
     }
     setInvoices(prev => prev.map(i => i.id === updatedInvoice.id ? updatedInvoice : i));
     setSelectedInvoiceForDoc(updatedInvoice); setIsPdfPreviewOpen(true);
  };
  const handleExportPLPDF = () => {
    setPlExportRequested(true);
    setShowPLPreview(true);
  };


  
  useEffect(() => {
     let isMounted = true;
     const generatePdf = async () => {
         if (!isPdfPreviewOpen || !selectedInvoiceForDoc || isGeneratingPdf) return;
         setIsGeneratingPdf(true);
         try {
             await new Promise(resolve => setTimeout(resolve, 800));
             if (!isMounted) return;
             const element = document.getElementById('visible-pdf-preview-content');
             if (!element) throw new Error("Preview element not found");
             const images = Array.from(element.querySelectorAll('img'));
             await Promise.all(images.map(img => {
                 if (img.complete) return Promise.resolve();
                 return new Promise(resolve => { img.onload = resolve; img.onerror = resolve; setTimeout(resolve, 2000); });
             }));
             const opt = { margin: [10, 10, 10, 10], filename: `Invoice_${selectedInvoiceForDoc.client.replace(/[^a-z0-9]/gi, '_')}_${selectedInvoiceForDoc.date}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', scrollY: 0 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
             await (window as any).html2pdf().set(opt).from(element).save();
             if (isMounted) { showToast("PDF Downloaded", "success"); setTimeout(() => setIsPdfPreviewOpen(false), 1000); }
         } catch (error) { console.error("PDF failed:", error); if (isMounted) showToast("Export failed", "error"); } finally { if (isMounted) setIsGeneratingPdf(false); }
     };
     if (isPdfPreviewOpen) generatePdf();
     return () => { isMounted = false; };
  }, [isPdfPreviewOpen, selectedInvoiceForDoc]);

  // Auto-generate Estimate PDF when preview opens
  useEffect(() => {
     let isMounted = true;
     const generatePdf = async () => {
         if (!isEstimatePdfPreviewOpen || !selectedEstimateForDoc || isGeneratingEstimatePdf) return;
         setIsGeneratingEstimatePdf(true);
         try {
             await new Promise(resolve => setTimeout(resolve, 800));
             if (!isMounted) return;
             const element = document.getElementById('visible-estimate-pdf-preview-content');
             if (!element) throw new Error('Preview element not found');
             const images = Array.from(element.querySelectorAll('img'));
             await Promise.all(images.map(img => {
                 // @ts-ignore
                 if ((img as any).complete) return Promise.resolve();
                 return new Promise(resolve => {
                   // @ts-ignore
                   img.onload = resolve;
                   // @ts-ignore
                   img.onerror = resolve;
                   setTimeout(resolve, 2000);
                 });
             }));
             const opt = { margin: [10, 10, 10, 10], filename: `Estimate_${selectedEstimateForDoc.client.replace(/[^a-z0-9]/gi, '_')}_${selectedEstimateForDoc.date}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', scrollY: 0 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
             await (window as any).html2pdf().set(opt).from(element).save();
             if (isMounted) { showToast('PDF Downloaded', 'success'); setTimeout(() => setIsEstimatePdfPreviewOpen(false), 1000); }
         } catch (error) { console.error('Estimate PDF failed:', error); if (isMounted) showToast('Export failed', 'error'); } finally { if (isMounted) setIsGeneratingEstimatePdf(false); }
     };
     if (isEstimatePdfPreviewOpen) generatePdf();
     return () => { isMounted = false; };
  }, [isEstimatePdfPreviewOpen, selectedEstimateForDoc]);


  useEffect(() => {
    let isMounted = true;
    const generatePLPdf = async () => {
      if (!showPLPreview || !plExportRequested || isGeneratingPLPdf) return;

      setIsGeneratingPLPdf(true);
      // Let the modal render fully
      await new Promise(resolve => setTimeout(resolve, 350));

      try {
        const element = document.getElementById('pl-pdf-preview-content');
        if (!element) throw new Error("P&L preview element not found");

        // Wait for any images (logo) to finish loading
        const images = Array.from(element.querySelectorAll('img'));
        await Promise.all(images.map(img => {
          const anyImg = img as HTMLImageElement;
          if (anyImg.complete) return Promise.resolve(true);
          return new Promise(resolve => {
            anyImg.onload = () => resolve(true);
            anyImg.onerror = () => resolve(true);
            setTimeout(() => resolve(true), 2000);
          });
        }));

        const periodLabel =
          filterPeriod === 'month'
            ? referenceDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
            : filterPeriod === 'quarter'
              ? `Q${Math.floor(referenceDate.getMonth() / 3) + 1}_${referenceDate.getFullYear()}`
              : filterPeriod === 'year'
                ? referenceDate.getFullYear().toString()
                : 'All_Time';

        const safeLabel = String(periodLabel).replace(/[^a-z0-9]/gi, '_');
        const opt = {
          margin: [10, 10, 10, 10],
          filename: `Profit_Loss_${safeLabel}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, letterRendering: true, backgroundColor: '#ffffff', scrollY: 0, scrollX: 0 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        await (window as any).html2pdf().set(opt).from(element).save();

        if (isMounted) {
          showToast("P&L PDF Downloaded", "success");
          setPlExportRequested(false);
          setTimeout(() => setShowPLPreview(false), 1000);
        }
      } catch (error) {
        console.error("P&L PDF failed:", error);
        if (isMounted) {
          showToast("P&L PDF export failed", "error");
          setPlExportRequested(false);
        }
      } finally {
        if (isMounted) setIsGeneratingPLPdf(false);
      }
    };

    if (showPLPreview && plExportRequested) generatePLPdf();

    return () => { isMounted = false; };
  }, [showPLPreview, plExportRequested, filterPeriod, referenceDate]);



  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
          if (file.size > 2 * 1024 * 1024) return showToast("File size too large (max 2MB)", "error");
          const reader = new FileReader();
          reader.onload = (e) => { setSettings(s => ({ ...s, businessLogo: e.target?.result as string })); showToast("Logo uploaded", "success"); };
          reader.readAsDataURL(file);
      }
  };

  // --- Scan Receipt Functions ---
  const handleScanReceipt = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        compressReceiptImage(file).then(base64 => {
            setScanPreview(base64);
        }).catch(err => {
            console.error("Compression error:", err);
            showToast("Failed to process image", "error");
        });
        // Reset input so same file can be selected again if needed
        event.target.value = '';
    }
  };

  const saveReceipt = () => {
      if (scanPreview) {
          const newReceipt: ReceiptType = {
              id: generateId('receipt'),
              date: new Date().toISOString().split('T')[0],
              imageData: scanPreview
          };
          setReceipts(prev => [newReceipt, ...prev]);
          
          downloadReceiptToDevice(scanPreview);

          setScanPreview(null);
          showToast("Receipt saved to Downloads", "success");
      }
  };

  const deleteReceipt = (id: string) => {
      if (confirm("Delete this receipt?")) {
          setReceipts(prev => prev.filter(r => r.id !== id));
          setViewingReceipt(null);
          showToast("Receipt deleted", "info");
      }
  };

  // --- Backup Functions ---
  const handleExportBackup = () => {
    const backup = {
        metadata: {
            appName: "Moniezi Pro v7",
            version: "7.0.0",
            timestamp: new Date().toISOString(),
        },
        data: {
            transactions,
            invoices,
            estimates,
            clients,
            settings,
            taxPayments,
            customCategories,
            receipts
        }
    };
    
    const dataStr = JSON.stringify(backup, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `moniezi_v7_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("Backup file downloaded", "success");
  };

  const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const content = e.target?.result as string;
            const parsed = JSON.parse(content);
            
            // Simple validation
            if (!parsed.metadata || !parsed.data) {
                throw new Error("Invalid backup format");
            }
            
            setPendingBackupData(parsed.data);
            setShowRestoreModal(true);
        } catch (err) {
            console.error(err);
            showToast("Invalid backup file", "error");
        }
        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const performRestore = () => {
    if (!pendingBackupData) return;
    
    try {
        const newData = pendingBackupData;
        
        // 1. Prepare safe data objects with defaults to prevent crashes
        const tx = Array.isArray(newData.transactions) ? newData.transactions : [];
        const inv = Array.isArray(newData.invoices) ? newData.invoices : [];
        const est = Array.isArray(newData.estimates) ? newData.estimates : [];
        const cls = Array.isArray(newData.clients) ? newData.clients : [];
        const tax = Array.isArray(newData.taxPayments) ? newData.taxPayments : [];
        const rec = Array.isArray(newData.receipts) ? newData.receipts : [];
        const set = { ...settings, ...(newData.settings || {}) };
        
        const cats = {
            income: Array.isArray(newData.customCategories?.income) ? newData.customCategories.income : [],
            expense: Array.isArray(newData.customCategories?.expense) ? newData.customCategories.expense : [],
            billing: Array.isArray(newData.customCategories?.billing) ? newData.customCategories.billing : []
        };

        // 2. Update State directly (triggers useEffect to save to LS)
        setTransactions(tx);
        setInvoices(inv);
        setEstimates(est);
        setClients(cls);
        setTaxPayments(tax);
        setReceipts(rec);
        setSettings(set);
        setCustomCategories(cats);

        // 3. UI Feedback & Cleanup
        setShowRestoreModal(false);
        setPendingBackupData(null);
        showToast("Backup restored successfully!", "success");
        
        // 4. Navigate to Dashboard to show data immediately
        setCurrentPage(Page.Dashboard);
        
    } catch (e) {
        console.error("Restore error", e);
        showToast("Failed to restore: Invalid data", "error");
    }
  };

  const renderCategoryChips = (current: string | undefined, onSelect: (cat: string) => void) => {
    const baseList = activeTab === 'income' ? CATS_IN : activeTab === 'expense' ? CATS_OUT : CATS_BILLING;
    const customList = activeTab === 'income' ? customCategories.income : activeTab === 'expense' ? customCategories.expense : customCategories.billing;
    const allCategories = [...customList, ...baseList.filter(c => !c.startsWith('Other'))];
    let displayList = allCategories;
    if (categorySearch) displayList = allCategories.filter(c => c.toLowerCase().includes(categorySearch.toLowerCase()));

    return (
      <div className="mt-3 space-y-3">
         <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16} />
            <input type="text" placeholder="Search or add category..." value={categorySearch} onChange={e => setCategorySearch(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-white" />
         </div>
         <div className="max-h-48 overflow-y-auto custom-scrollbar p-1">
            {!categorySearch && recentCategories.length > 0 && (
                <div className="mb-4">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider mb-2 block">Recent</label>
                    <div className="flex flex-wrap gap-2">
                        {recentCategories.map(cat => (
                            <button key={`recent-${cat}`} type="button" onClick={() => onSelect(cat)} className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 border ${current === cat ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>{getCategoryIcon(cat)}{cat}</button>
                        ))}
                    </div>
                </div>
            )}
            <div>
               <label className="text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider mb-2 block">{categorySearch ? 'Results' : 'All Categories'}</label>
               <div className="flex flex-wrap gap-2">
                  {displayList.map(cat => (
                    <button key={cat} type="button" onClick={() => onSelect(cat)} className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${current === cat ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-200 dark:bg-slate-900 text-slate-700 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-800 border border-slate-300/50 dark:border-0'}`}>{getCategoryIcon(cat)}{cat}</button>
                  ))}
                  <button type="button" onClick={() => { if (drawerMode !== 'create_cat') previousDrawerMode.current = drawerMode as any; setNewCategoryName(categorySearch); setDrawerMode('create_cat'); }} className="px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border-2 border-dashed border-blue-200 dark:border-blue-900 hover:bg-blue-50 dark:hover:bg-blue-900/30"><Plus size={14} />{categorySearch ? `Create "${categorySearch}"` : "Custom Category..."}</button>
               </div>
            </div>
         </div>
      </div>
    );
  };

  const addInvoiceItem = () => setActiveItem(prev => ({ ...prev, items: [...(prev.items || []), { id: generateId('item'), description: '', quantity: 1, rate: 0 }] }));
  const removeInvoiceItem = (itemId: string) => setActiveItem(prev => ({ ...prev, items: prev.items?.filter(item => item.id !== itemId) }));
  const updateInvoiceItem = (itemId: string, field: keyof InvoiceItem, value: any) => setActiveItem(prev => ({ ...prev, items: prev.items?.map(item => item.id === itemId ? { ...item, [field]: value } : item) }));

  const activeInvoiceTotals = useMemo(() => {
      if (!activeItem.items) return { subtotal: 0, total: 0, tax: 0 };
      const subtotal = activeItem.items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
      const discount = activeItem.discount || 0;
      const taxRate = activeItem.taxRate || 0;
      const taxAmount = (subtotal - discount) * (taxRate / 100);
      const total = Math.max(0, subtotal - discount + taxAmount + (activeItem.shipping || 0));
      return { subtotal, total, tax: taxAmount };
  }, [activeItem]);

  return (
    <>
      <style>{`
/* ================================
   Light mode readability boost
   (Makes text/icons a bit sharper)
   ================================ */
html:not(.dark) .text-slate-200 { color: rgb(148 163 184) !important; } /* slate-400 */
html:not(.dark) .text-slate-300 { color: rgb(100 116 139) !important; } /* slate-500 */
html:not(.dark) .text-slate-400 { color: rgb(71 85 105) !important; }  /* slate-600 */
html:not(.dark) .text-slate-500 { color: rgb(51 65 85) !important; }  /* slate-700 */
html:not(.dark) .text-slate-600 { color: rgb(30 41 59) !important; }  /* slate-800 */
html:not(.dark) .text-slate-700 { color: rgb(15 23 42) !important; }  /* slate-900 */
html:not(.dark) .text-slate-800 { color: rgb(2 6 23) !important; }    /* slate-950 */
html:not(.dark) .text-slate-900 { color: rgb(2 6 23) !important; }    /* slate-950 */

/* Slightly crisper borders in light mode */
html:not(.dark) .border-slate-100 { border-color: rgb(226 232 240) !important; } /* slate-200 */
html:not(.dark) .border-slate-200 { border-color: rgb(203 213 225) !important; } /* slate-300 */

/* Subtle “inkier” shadows in light mode */
html:not(.dark) .shadow-sm { box-shadow: 0 1px 2px rgba(2, 6, 23, 0.10) !important; }
html:not(.dark) .shadow { box-shadow: 0 1px 3px rgba(2, 6, 23, 0.14), 0 1px 2px rgba(2, 6, 23, 0.10) !important; }

/* Slightly stronger separators */
html:not(.dark) .divide-slate-200 > :not([hidden]) ~ :not([hidden]) { border-color: rgb(203 213 225) !important; }
`}</style>
      <div className="min-h-screen flex flex-col max-w-2xl mx-auto relative bg-slatebg dark:bg-slate-950 text-slate-900 dark:text-white overflow-hidden transition-colors duration-300">
      
      {/* Scan Receipt Confirm Modal */}
      {scanPreview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-xl p-4 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"><Receipt size={20} />Save Receipt?</h3>
                    <button onClick={() => setScanPreview(null)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"><X size={18} /></button>
                </div>
                <div className="flex-1 overflow-hidden rounded-lg bg-black border border-slate-800 relative mb-4">
                    <img src={scanPreview} alt="Receipt Preview" className="w-full h-full object-contain" />
                </div>
                <div className="flex gap-3">
                    <button onClick={() => setScanPreview(null)} className="flex-1 py-3 font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">Discard</button>
                    <button onClick={saveReceipt} className="flex-1 py-3 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-lg shadow-blue-500/20 transition-colors">Save</button>
                </div>
            </div>
        </div>
      )}

      {/* View Receipt Full Screen Modal */}
      {viewingReceipt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/95 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-lg h-full flex flex-col">
                <div className="flex items-center justify-between mb-4 text-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center"><Calendar size={18} /></div>
                        <div>
                            <div className="font-bold text-lg">Receipt View</div>
                            <div className="text-xs text-slate-400 flex items-center gap-2">{viewingReceipt.date} <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px]">Exports to Downloads</span></div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => { downloadReceiptToDevice(viewingReceipt.imageData); showToast("Downloaded to device", "success"); }} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"><Download size={24} /></button>
                        <button onClick={() => setViewingReceipt(null)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"><X size={24} /></button>
                    </div>
                </div>
                <div className="flex-1 bg-black rounded-xl overflow-hidden relative border border-white/10 shadow-2xl mb-4 flex items-center justify-center">
                    <img src={viewingReceipt.imageData} alt="Receipt" className="max-w-full max-h-full object-contain" />
                </div>
                <button onClick={() => deleteReceipt(viewingReceipt.id)} className="w-full py-4 bg-red-600/90 hover:bg-red-600 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95">
                    <Trash2 size={20} /> Delete Receipt
                </button>
            </div>
        </div>
      )}

      {isPdfPreviewOpen && selectedInvoiceForDoc && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="relative w-full max-w-[800px] bg-white text-slate-900 shadow-2xl overflow-y-auto max-h-[90vh] rounded-lg">
                <div className="sticky top-0 left-0 right-0 bg-white/90 backdrop-blur border-b border-slate-100 p-4 flex justify-between items-center z-50">
                    <div className="flex items-center gap-2">
                       {isGeneratingPdf ? <Loader2 className="animate-spin text-blue-600" /> : <Download className="text-emerald-600" />}
                       <span className="font-bold text-sm uppercase tracking-wider">{isGeneratingPdf ? 'Generating PDF...' : 'Previewing Invoice'}</span>
                    </div>
                    <button onClick={() => setIsPdfPreviewOpen(false)} className="p-2 hover:bg-slate-100 rounded-full"><X size={20} /></button>
                </div>
                <div id="visible-pdf-preview-content" className="p-8 md:p-12 bg-white min-h-[1000px]">
                    {selectedInvoiceForDoc.status === 'void' && <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0"><div className="transform -rotate-45 text-red-50 text-[150px] font-extrabold opacity-50 border-8 border-red-50 p-10 rounded-3xl">VOID</div></div>}
                    <div className={`flex ${settings.showLogoOnInvoice && settings.logoAlignment === 'center' ? 'flex-col items-center text-center' : 'flex-row justify-between items-start'} border-b border-slate-100 pb-8 mb-8 gap-6 z-10 relative`}>
                        <div className={`flex-1 ${settings.showLogoOnInvoice && settings.logoAlignment === 'center' ? 'w-full' : ''}`}>
                            {settings.showLogoOnInvoice && settings.businessLogo && <img src={settings.businessLogo} alt="Logo" className={`h-20 w-auto object-contain mb-4 ${settings.logoAlignment === 'center' ? 'mx-auto' : ''}`} />}
                            <h1 className="text-3xl font-extrabold uppercase tracking-tight text-slate-900 mb-2 font-brand">{settings.businessName}</h1>
                            <div className="text-sm text-slate-500 font-medium space-y-1">
                                <p>{settings.ownerName}</p>
                                {(settings.businessEmail || settings.businessPhone) && <p className={`flex flex-wrap gap-3 ${settings.logoAlignment === 'center' ? 'justify-center' : ''}`}>{settings.businessEmail && <span>{settings.businessEmail}</span>}{settings.businessPhone && <span>• {settings.businessPhone}</span>}</p>}
                                {settings.businessAddress && <p className="leading-tight pt-1">{settings.businessAddress}</p>}
                                {settings.businessWebsite && <p className="text-blue-600 pt-1" style={{ color: settings.brandColor }}>{settings.businessWebsite}</p>}
                            </div>
                        </div>
                        <div className={`text-left ${settings.showLogoOnInvoice && settings.logoAlignment === 'center' ? 'w-full mt-6 flex flex-col items-center' : 'text-right flex-1'}`}>
                            <h2 className="text-5xl font-extrabold tracking-tighter mb-4 font-brand" style={{ color: settings.brandColor || '#e2e8f0' }}>INVOICE</h2>
                            <div className={`space-y-2 ${settings.showLogoOnInvoice && settings.logoAlignment === 'center' ? 'w-full max-w-sm' : ''}`}>
                                <div className="flex justify-between md:justify-end gap-8"><span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Invoice #</span><span className="text-sm font-bold text-slate-900">{selectedInvoiceForDoc.number || selectedInvoiceForDoc.id.substring(selectedInvoiceForDoc.id.length - 6).toUpperCase()}</span></div>
                                <div className="flex justify-between md:justify-end gap-8"><span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Date</span><span className="text-sm font-bold text-slate-900">{selectedInvoiceForDoc.date}</span></div>
                                <div className="flex justify-between md:justify-end gap-8"><span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Due</span><span className="text-sm font-bold text-slate-900">{selectedInvoiceForDoc.due}</span></div>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-10 mb-12 z-10 relative">
                        <div className="flex-1">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Bill To</h3>
                            <div className="text-lg font-bold text-slate-900">{selectedInvoiceForDoc.client}</div>
                            {selectedInvoiceForDoc.clientCompany && <div className="text-base font-semibold text-slate-700 mt-0.5">{selectedInvoiceForDoc.clientCompany}</div>}
                            <div className="text-sm text-slate-500 mt-1 space-y-0.5">{selectedInvoiceForDoc.clientEmail && <div>{selectedInvoiceForDoc.clientEmail}</div>}{selectedInvoiceForDoc.clientAddress && <div className="whitespace-pre-line">{selectedInvoiceForDoc.clientAddress}</div>}</div>
                        </div>
                        {(selectedInvoiceForDoc.poNumber || settings.businessTaxId) && (
                            <div className="flex-1 text-right">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Details</h3>
                                {selectedInvoiceForDoc.poNumber && <div className="mb-2"><span className="text-xs font-bold text-slate-500 block">PO Number</span><span className="text-sm font-bold text-slate-900">{selectedInvoiceForDoc.poNumber}</span></div>}
                                {settings.businessTaxId && <div><span className="text-xs font-bold text-slate-500 block">Tax ID / VAT</span><span className="text-sm font-bold text-slate-900">{settings.businessTaxId}</span></div>}
                            </div>
                        )}
                    </div>
                    <div className="mb-8 z-10 relative">
                        <div className="grid grid-cols-12 gap-4 border-b-2 pb-3 mb-4" style={{ borderColor: settings.brandColor || '#0f172a' }}>
                            <div className="col-span-6 text-xs font-bold text-slate-900 uppercase tracking-wider">Description</div>
                            <div className="col-span-2 text-right text-xs font-bold text-slate-900 uppercase tracking-wider">Qty</div>
                            <div className="col-span-2 text-right text-xs font-bold text-slate-900 uppercase tracking-wider">Rate</div>
                            <div className="col-span-2 text-right text-xs font-bold text-slate-900 uppercase tracking-wider">Amount</div>
                        </div>
                        <div className="space-y-4">
                            {(selectedInvoiceForDoc.items || []).map((item, idx) => (
                                <div key={item.id || idx} className="border-b border-slate-100 pb-3 grid grid-cols-12 gap-4 items-start">
                                    <div className="col-span-6"><span className="font-bold text-slate-800 text-sm block">{item.description}</span></div>
                                    <div className="col-span-2 text-right text-sm font-medium text-slate-600">{item.quantity}</div>
                                    <div className="col-span-2 text-right text-sm font-medium text-slate-600">{formatCurrency.format(item.rate)}</div>
                                    <div className="col-span-2 text-right text-sm font-bold text-slate-900">{formatCurrency.format(item.quantity * item.rate)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="flex justify-end mt-4 mb-12 z-10 relative">
                        <div className="w-5/12 space-y-3">
                            <div className="flex justify-between text-sm"><span className="font-bold text-slate-500">Subtotal</span><span className="font-bold text-slate-900">{formatCurrency.format(selectedInvoiceForDoc.subtotal || selectedInvoiceForDoc.amount)}</span></div>
                            {selectedInvoiceForDoc.discount ? (<div className="flex justify-between text-sm text-emerald-600"><span className="font-bold">Discount</span><span className="font-bold">-{formatCurrency.format(selectedInvoiceForDoc.discount)}</span></div>) : null}
                            {selectedInvoiceForDoc.taxRate ? (<div className="flex justify-between text-sm"><span className="font-bold text-slate-500">Tax ({selectedInvoiceForDoc.taxRate}%)</span><span className="font-bold text-slate-900">{formatCurrency.format(((selectedInvoiceForDoc.subtotal || 0) - (selectedInvoiceForDoc.discount || 0)) * (selectedInvoiceForDoc.taxRate / 100))}</span></div>) : null}
                            {selectedInvoiceForDoc.shipping ? (<div className="flex justify-between text-sm"><span className="font-bold text-slate-500">Shipping</span><span className="font-bold text-slate-900">{formatCurrency.format(selectedInvoiceForDoc.shipping)}</span></div>) : null}
                            <div className="h-px bg-slate-900 my-2"></div>
                            <div className="flex justify-between items-end"><span className="font-extrabold text-lg text-slate-900 uppercase tracking-wider">Total</span><span className="font-extrabold text-2xl text-slate-900">{formatCurrency.format(selectedInvoiceForDoc.amount)}</span></div>
                            {selectedInvoiceForDoc.status === 'paid' && <div className="flex justify-between items-center text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded mt-2"><span className="font-bold text-sm uppercase">Amount Paid</span><span className="font-bold">{formatCurrency.format(selectedInvoiceForDoc.amount)}</span></div>}
                        </div>
                    </div>
                    <div className="mt-auto z-10 relative">
                        <div className="grid grid-cols-2 gap-8 border-t border-slate-100 pt-8">
                            <div>{selectedInvoiceForDoc.notes && (<><h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Notes</h4><p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{selectedInvoiceForDoc.notes}</p></>)}</div>
                            <div>{(selectedInvoiceForDoc.terms || settings.payPrefs.length > 0) && (<><h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Terms & Payment</h4>{selectedInvoiceForDoc.terms && <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap mb-3">{selectedInvoiceForDoc.terms}</p>}{settings.payPrefs.length > 0 && (<div className="text-xs font-bold text-slate-500 bg-slate-50 p-3 rounded inline-block w-full">Accepted Methods: {settings.payPrefs.join(', ')}</div>)}</>)}</div>
                        </div>
                        <div className="mt-12 text-center text-xs text-slate-400 font-bold uppercase tracking-widest">Thank you for your business</div>
                    </div>
                </div>
            </div>
        </div>

      )}

      {isEstimatePdfPreviewOpen && selectedEstimateForDoc && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="relative w-full max-w-[800px] bg-white text-slate-900 shadow-2xl overflow-y-auto max-h-[90vh] rounded-lg">
                <div className="sticky top-0 left-0 right-0 bg-white/90 backdrop-blur border-b border-slate-100 p-4 flex justify-between items-center z-50">
                    <div className="flex items-center gap-2">
                       {(isGeneratingEstimatePdf) ? <Loader2 className="animate-spin text-blue-600" /> : <Download className="text-emerald-600" />}
                       <span className="font-bold text-sm uppercase tracking-wider">{(isGeneratingEstimatePdf) ? 'Generating PDF...' : 'Previewing Estimate'}</span>
                    </div>
                    <button onClick={() => setIsEstimatePdfPreviewOpen(false)} className="p-2 hover:bg-slate-100 rounded-full"><X size={20} /></button>
                </div>
                <div id="visible-estimate-pdf-preview-content" className="p-8 md:p-12 bg-white min-h-[1000px]">
                    {selectedEstimateForDoc.status === 'void' && <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0"><div className="transform -rotate-45 text-red-50 text-[150px] font-extrabold opacity-50 border-8 border-red-50 p-10 rounded-3xl">VOID</div></div>}
                    <div className={`flex ${settings.showLogoOnInvoice && settings.logoAlignment === 'center' ? 'flex-col items-center text-center' : 'flex-row justify-between items-start'} border-b border-slate-100 pb-8 mb-8 gap-6 z-10 relative`}>
                        <div className={`flex-1 ${settings.showLogoOnInvoice && settings.logoAlignment === 'center' ? 'w-full' : ''}`}>
                            {settings.showLogoOnInvoice && settings.businessLogo && <img src={settings.businessLogo} alt="Logo" className={`h-20 w-auto object-contain mb-4 ${settings.logoAlignment === 'center' ? 'mx-auto' : ''}`} />}
                            <h1 className="text-3xl font-extrabold uppercase tracking-tight text-slate-900 mb-2 font-brand">{settings.businessName}</h1>
                            <div className="text-sm text-slate-500 font-medium space-y-1">
                                <p>{settings.ownerName}</p>
                                {(settings.businessEmail || settings.businessPhone) && <p className={`flex flex-wrap gap-3 ${settings.logoAlignment === 'center' ? 'justify-center' : ''}`}>{settings.businessEmail && <span>{settings.businessEmail}</span>}{settings.businessPhone && <span>• {settings.businessPhone}</span>}</p>}
                                {settings.businessAddress && <p className="leading-tight pt-1">{settings.businessAddress}</p>}
                                {settings.businessWebsite && <p className="text-blue-600 pt-1" style={{ color: settings.brandColor }}>{settings.businessWebsite}</p>}
                            </div>
                        </div>
                        <div className={`text-left ${settings.showLogoOnInvoice && settings.logoAlignment === 'center' ? 'w-full mt-6 flex flex-col items-center' : 'text-right flex-1'}`}>
                            <h2 className="text-5xl font-extrabold tracking-tighter mb-4 font-brand" style={{ color: settings.brandColor || '#e2e8f0' }}>ESTIMATE</h2>
                            <div className={`space-y-2 ${settings.showLogoOnInvoice && settings.logoAlignment === 'center' ? 'w-full max-w-sm' : ''}`}>
                                <div className="flex justify-between md:justify-end gap-8"><span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Estimate #</span><span className="text-sm font-bold text-slate-900">{selectedEstimateForDoc.number || selectedEstimateForDoc.id.substring(selectedEstimateForDoc.id.length - 6).toUpperCase()}</span></div>
                                <div className="flex justify-between md:justify-end gap-8"><span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Date</span><span className="text-sm font-bold text-slate-900">{selectedEstimateForDoc.date}</span></div>
                                <div className="flex justify-between md:justify-end gap-8"><span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Valid Until</span><span className="text-sm font-bold text-slate-900">{selectedEstimateForDoc.validUntil || ''}</span></div>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-10 mb-12 z-10 relative">
                        <div className="flex-1">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Estimate For</h3>
                            <div className="text-lg font-bold text-slate-900">{selectedEstimateForDoc.client}</div>
                            {selectedEstimateForDoc.clientCompany && <div className="text-base font-semibold text-slate-700 mt-0.5">{selectedEstimateForDoc.clientCompany}</div>}
                            <div className="text-sm text-slate-500 mt-1 space-y-0.5">{selectedEstimateForDoc.clientEmail && <div>{selectedEstimateForDoc.clientEmail}</div>}{selectedEstimateForDoc.clientAddress && <div className="whitespace-pre-line">{selectedEstimateForDoc.clientAddress}</div>}</div>
                        </div>
                        {(selectedEstimateForDoc.poNumber || settings.businessTaxId) && (
                            <div className="flex-1 text-right">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Details</h3>
                                {selectedEstimateForDoc.poNumber && <div className="mb-2"><span className="text-xs font-bold text-slate-500 block">Reference</span><span className="text-sm font-bold text-slate-900">{selectedEstimateForDoc.poNumber}</span></div>}
                                {settings.businessTaxId && <div><span className="text-xs font-bold text-slate-500 block">Tax ID / VAT</span><span className="text-sm font-bold text-slate-900">{settings.businessTaxId}</span></div>}
                            </div>
                        )}
                    </div>
                    <div className="mb-8 z-10 relative">
                        <div className="grid grid-cols-12 gap-4 border-b-2 pb-3 mb-4" style={{ borderColor: settings.brandColor || '#0f172a' }}>
                            <div className="col-span-6 text-xs font-bold text-slate-900 uppercase tracking-wider">Description</div>
                            <div className="col-span-2 text-right text-xs font-bold text-slate-900 uppercase tracking-wider">Qty</div>
                            <div className="col-span-2 text-right text-xs font-bold text-slate-900 uppercase tracking-wider">Rate</div>
                            <div className="col-span-2 text-right text-xs font-bold text-slate-900 uppercase tracking-wider">Amount</div>
                        </div>
                        <div className="space-y-4">
                            {(selectedEstimateForDoc.items || []).map((item, idx) => (
                                <div key={item.id || idx} className="border-b border-slate-100 pb-3 grid grid-cols-12 gap-4 items-start">
                                    <div className="col-span-6"><span className="font-bold text-slate-800 text-sm block">{item.description}</span></div>
                                    <div className="col-span-2 text-right text-sm font-medium text-slate-600">{item.quantity}</div>
                                    <div className="col-span-2 text-right text-sm font-medium text-slate-600">{formatCurrency.format(item.rate)}</div>
                                    <div className="col-span-2 text-right text-sm font-bold text-slate-900">{formatCurrency.format(item.quantity * item.rate)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="flex justify-end mt-4 mb-12 z-10 relative">
                        <div className="w-5/12 space-y-3">
                            <div className="flex justify-between text-sm"><span className="font-bold text-slate-500">Subtotal</span><span className="font-bold text-slate-900">{formatCurrency.format(selectedEstimateForDoc.subtotal || selectedEstimateForDoc.amount)}</span></div>
                            {selectedEstimateForDoc.discount ? (<div className="flex justify-between text-sm text-emerald-600"><span className="font-bold">Discount</span><span className="font-bold">-{formatCurrency.format(selectedEstimateForDoc.discount)}</span></div>) : null}
                            {selectedEstimateForDoc.taxRate ? (<div className="flex justify-between text-sm"><span className="font-bold text-slate-500">Tax ({selectedEstimateForDoc.taxRate}%)</span><span className="font-bold text-slate-900">{formatCurrency.format(((selectedEstimateForDoc.subtotal || 0) - (selectedEstimateForDoc.discount || 0)) * (selectedEstimateForDoc.taxRate / 100))}</span></div>) : null}
                            {selectedEstimateForDoc.shipping ? (<div className="flex justify-between text-sm"><span className="font-bold text-slate-500">Shipping</span><span className="font-bold text-slate-900">{formatCurrency.format(selectedEstimateForDoc.shipping)}</span></div>) : null}
                            <div className="h-px bg-slate-900 my-2"></div>
                            <div className="flex justify-between items-end"><span className="font-extrabold text-lg text-slate-900 uppercase tracking-wider">Total</span><span className="font-extrabold text-2xl text-slate-900">{formatCurrency.format(selectedEstimateForDoc.amount)}</span></div>
                        </div>
                    </div>
                    <div className="mt-auto z-10 relative">
                        <div className="grid grid-cols-2 gap-8 border-t border-slate-100 pt-8">
                            <div>{selectedEstimateForDoc.notes && (<><h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Notes</h4><p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{selectedEstimateForDoc.notes}</p></>)}</div>
                            <div>{(selectedEstimateForDoc.terms || settings.payPrefs.length > 0) && (<><h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Terms</h4>{selectedEstimateForDoc.terms && <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap mb-3">{selectedEstimateForDoc.terms}</p>}{settings.payPrefs.length > 0 && (<div className="text-xs font-bold text-slate-500 bg-slate-50 p-3 rounded inline-block w-full">Accepted Methods: {settings.payPrefs.join(', ')}</div>)}</>)}</div>
                        </div>
                        <div className="mt-12 text-center text-xs text-slate-400 font-bold uppercase tracking-widest">Thank you</div>
                    </div>
                </div>
            </div>
        </div>
      )}

      <ToastContainer notifications={notifications} remove={removeToast} />


      {showResetConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-xl p-6 shadow-2xl border border-red-500/20">
                <div className="flex items-center gap-4 mb-4 text-red-600 dark:text-red-500">
                   <div className="bg-red-100 dark:bg-red-500/10 p-3 rounded-full"><AlertTriangle size={24} strokeWidth={2} /></div>
                   <h3 className="text-lg sm:text-xl font-bold">System Reset</h3>
                </div>
                <p className="text-slate-600 dark:text-slate-300 mb-6 font-medium leading-relaxed">Are you sure you want to delete <span className="text-slate-900 dark:text-white font-bold">all transactions and invoices</span>? This action cannot be undone.</p>
                <div className="flex gap-3">
                   <button onClick={() => setShowResetConfirm(false)} className="flex-1 py-3 font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">Cancel</button>
                   <button onClick={performReset} className="flex-1 py-3 font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-lg shadow-red-500/20 transition-colors">Yes, Delete All</button>
                </div>
            </div>
        </div>
      )}

      {/* NEW: Delete Invoice Confirmation Modal */}
      {invoiceToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3 mb-4 text-slate-900 dark:text-white">
                    <div className="bg-red-100 dark:bg-red-500/10 p-3 rounded-full text-red-600 dark:text-red-500">
                        <Trash2 size={20} strokeWidth={2} />
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold">Delete invoice?</h3>
                </div>
                <p className="text-slate-600 dark:text-slate-300 mb-6 font-medium leading-relaxed">This will permanently delete this invoice and cannot be undone.</p>
                <div className="flex gap-3">
                   <button onClick={() => setInvoiceToDelete(null)} className="flex-1 py-3 font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">Cancel</button>
                   <button onClick={confirmDeleteInvoice} className="flex-1 py-3 font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-lg shadow-red-500/20 transition-colors">Delete</button>
                </div>
            </div>
        </div>
      )}

      {/* NEW: Restore Backup Confirmation Modal */}
      {showRestoreModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-xl p-6 shadow-2xl border border-blue-500/20">
                <div className="flex items-center gap-4 mb-4 text-blue-600 dark:text-blue-400">
                    <div className="bg-blue-100 dark:bg-blue-500/10 p-3 rounded-full"><RotateCcw size={24} strokeWidth={2} /></div>
                    <h3 className="text-lg sm:text-xl font-bold">Restore Backup?</h3>
                </div>
                <p className="text-slate-600 dark:text-slate-300 mb-6 font-medium leading-relaxed">
                    This will <span className="text-slate-900 dark:text-white font-bold">replace all current data</span> with the backup from <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">{pendingBackupData?.metadata?.timestamp?.split('T')[0] || 'Unknown Date'}</span>.
                </p>
                <div className="flex gap-3">
                    <button onClick={() => { setShowRestoreModal(false); setPendingBackupData(null); }} className="flex-1 py-3 font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">Cancel</button>
                    <button onClick={performRestore} className="flex-1 py-3 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-lg shadow-blue-500/20 transition-colors">Restore Data</button>
                </div>
            </div>
        </div>
      )}

      <header className={`no-print flex items-center justify-between px-6 md:px-8 py-8 sticky top-0 bg-slatebg/90 dark:bg-slate-950/90 backdrop-blur-xl z-50 border-b border-slate-200 dark:border-slate-800 transition-colors duration-300`}>
        <Logo onClick={() => setCurrentPage(Page.Dashboard)} />
        <div className="flex gap-2">
           <button onClick={toggleTheme} className="w-12 h-12 flex items-center justify-center bg-white dark:bg-slate-900 rounded-full border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 transition-all shadow-md">{theme === 'dark' ? <Sun size={20} strokeWidth={1.2} /> : <Moon size={20} strokeWidth={1.2} />}</button>
           <button
             onClick={() => setShowInsights(true)}
             className="relative w-12 h-12 flex items-center justify-center bg-white dark:bg-slate-900 rounded-full border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-purple-600 transition-all shadow-md"
             title="Insights"
           >
             <BrainCircuit size={20} strokeWidth={1.2} />
             {insightsBadgeCount > 0 && (
               <span className="absolute -top-1 -right-1 w-5 h-5 bg-purple-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                 {Math.min(9, insightsBadgeCount)}
               </span>
             )}
           </button>
           <button onClick={() => setCurrentPage(Page.Settings)} className="w-12 h-12 flex items-center justify-center bg-white dark:bg-slate-900 rounded-full border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-950 transition-all shadow-md"><Settings size={20} strokeWidth={1.2} /></button>
        </div>
      </header>

      <main ref={mainScrollRef} className="flex-1 overflow-y-auto pb-44 px-6 md:px-8 no-print custom-scrollbar">

      <PageErrorBoundary key={currentPage} onReset={() => setCurrentPage(Page.Dashboard)}>

        {(currentPage === Page.Dashboard) && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white dark:bg-gradient-to-br dark:from-blue-800 dark:to-indigo-950 p-8 rounded-xl shadow-xl dark:shadow-none border border-slate-200 dark:border-white/10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-80 h-80 bg-slate-100/50 dark:bg-white/5 rounded-full blur-3xl -mr-20 -mt-20 group-hover:bg-slate-200/50 transition-colors duration-700 pointer-events-none" />

              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="min-w-0">
                  <label className="text-xs font-bold text-slate-500 dark:text-blue-200 mb-1 block tracking-widest uppercase font-brand">
                    Net Profit <span className="opacity-80">({homeTotals.label})</span>
                  </label>
                  <div className="text-[11px] font-bold text-slate-500 dark:text-blue-200/80 tracking-wide">{homeTotals.rangeText}</div>
                </div>

                <div className="flex bg-slate-100/70 dark:bg-white/10 p-1 rounded-xl border border-slate-200/70 dark:border-white/10 shadow-sm">
                  {(['ytd', 'mtd', '30d', 'all'] as HomeKpiPeriod[]).map(p => (
                    <button
                      key={p}
                      onClick={() => setHomeKpiPeriod(p)}
                      className={`px-2.5 sm:px-3 py-1.5 text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider rounded-lg transition-all ${homeKpiPeriod === p ? 'bg-white dark:bg-slate-950/70 text-blue-600 dark:text-white shadow' : 'text-slate-500 dark:text-blue-100/80 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                      {p === 'ytd' ? 'YTD' : p === 'mtd' ? 'MTD' : p === '30d' ? '30D' : 'ALL'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-4xl font-extrabold tracking-tighter mb-8 text-slate-950 dark:text-white font-brand">{formatCurrency.format(homeTotals.profit)}</div>

              <div className="flex items-center justify-center gap-4">
                <div className="bg-slate-50 dark:bg-white/10 backdrop-blur-md px-5 py-3.5 rounded-lg border border-slate-200 dark:border-white/5 min-w-[160px]">
                  <div className="flex items-center justify-center gap-2 mb-1 text-emerald-600 dark:text-emerald-300"><TrendingUp size={16} strokeWidth={2.5} /><span className="text-xs font-bold uppercase tracking-wide">In</span></div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white text-center">{formatCurrency.format(homeTotals.income)}</div>
                </div>
                <div className="bg-slate-50 dark:bg-white/10 backdrop-blur-md px-5 py-3.5 rounded-lg border border-slate-200 dark:border-white/5 min-w-[160px]">
                  <div className="flex items-center justify-center gap-2 mb-1 text-red-600 dark:text-red-300"><TrendingDown size={16} strokeWidth={2.5} /><span className="text-xs font-bold uppercase tracking-wide">Out</span></div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white text-center">{formatCurrency.format(homeTotals.expense)}</div>
                </div>
              </div>
            </div>

            <div
                className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 shadow-lg rounded-3xl p-6 relative overflow-hidden cursor-pointer hover:shadow-xl hover:-translate-y-0.5 transition-all"
                onClick={() => {
                  const mode = totals.overdueCount > 0 ? 'overdue' : totals.pendingCount > 0 ? 'unpaid' : 'all';
                  setInvoiceQuickFilter(mode);
                  setCurrentPage(Page.Invoices);
                }}
              >
                <div className="text-center">
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${
                      totals.overdueCount > 0
                        ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-300'
                        : totals.pendingCount > 0
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                    }`}
                  >
                    {totals.overdueCount > 0 ? <AlertTriangle size={24} /> : totals.pendingCount > 0 ? <Clock3 size={24} /> : <CheckCircle size={24} />}
                  </div>

                  <div
                    className={`text-4xl font-extrabold tracking-tight mb-2 ${
                      totals.overdueCount > 0
                        ? 'text-red-600 dark:text-red-300'
                        : totals.pendingCount > 0
                        ? 'text-amber-700 dark:text-amber-300'
                        : 'text-emerald-700 dark:text-emerald-300'
                    }`}
                  >
                    {formatCurrency.format(totals.overdueCount > 0 ? totals.overdueAmount : totals.pendingAmount)}
                  </div>

                  <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {totals.overdueCount > 0 ? 'Overdue Invoices' : totals.pendingCount > 0 ? 'Unpaid Invoices' : 'All invoices paid'}
                  </div>

                  <div
                    className={`inline-flex mt-3 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      totals.overdueCount > 0
                        ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'
                        : totals.pendingCount > 0
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                    }`}
                  >
                    {totals.overdueCount > 0 ? `${totals.overdueCount} overdue` : totals.pendingCount > 0 ? `${totals.pendingCount} unpaid` : 'Great job'}
                  </div>

                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold mt-3">Tap to open invoices</div>
                </div>
              </div>
            
            <div>
              <div className="flex items-center justify-between mb-4 pl-2">
                <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest font-brand">Recent Activity</h3>
                <button onClick={() => setCurrentPage(Page.AllTransactions)} className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors uppercase">See all</button>
              </div>
              <div className="space-y-3">
                {transactions.length === 0 ? <EmptyState icon={<Sparkles size={24} />} title="No activity yet" subtitle="Your latest transactions will appear here once you start recording." action={() => handleOpenFAB('income')} actionLabel="Add Transaction" /> :
                  transactions.slice().sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5).map(t => (
                    <div key={t.id} className="group flex items-center justify-between p-5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-blue-500/30 hover:shadow-lg transition-all cursor-pointer shadow-sm relative z-10" onClick={() => handleEditItem(t)}>
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${t.type === 'income' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>{t.type === 'income' ? <ArrowRight size={18} className="-rotate-45" strokeWidth={2.5} /> : <ArrowRight size={18} className="rotate-45" strokeWidth={2.5} />}</div>
                        <div className="min-w-0 pr-2">
                          <div className="text-base font-bold text-slate-900 dark:text-white truncate">{t.name}</div>
                          <div className="text-sm font-medium text-slate-600 dark:text-slate-300 mt-0.5 truncate">{t.category}</div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                         <div className={`text-base font-bold whitespace-nowrap ${t.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>{t.type === 'income' ? '+' : ''}{formatCurrency.format(t.amount)}</div>
                         <div className="text-left md:text-right mt-1"><div className="text-xs font-bold text-slate-500 dark:text-slate-300 whitespace-nowrap">{t.date}</div></div>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>

            <div onClick={() => { setScrollToTaxSnapshot(true); setCurrentPage(Page.Reports); }} className="bg-white dark:bg-slate-950 text-slate-900 dark:text-white p-6 rounded-xl shadow-md border border-slate-200 dark:border-slate-800 cursor-pointer active:scale-95 transition-all hover:shadow-lg hover:border-emerald-500/30 group">
               <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400"><Calculator size={20} /><span className="text-xs font-bold uppercase tracking-widest font-brand">Tax Snapshot</span></div>
                  <ArrowRight size={18} className="text-slate-300 dark:text-slate-400 -rotate-45 group-hover:rotate-0 group-hover:text-emerald-500 transition-all duration-300"/>
               </div>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                  <div><div className="text-xs text-slate-500 dark:text-slate-300 uppercase tracking-wider font-bold mb-1">Estimated Tax (YTD)</div><div className="text-2xl font-extrabold font-brand text-slate-900 dark:text-white">{formatCurrency.format(reportData.totalEstimatedTax)}</div></div>
                  <div><div className="text-xs text-slate-500 dark:text-slate-300 uppercase tracking-wider font-bold mb-1">YTD Net Profit</div><div className="text-2xl font-bold text-slate-600 dark:text-slate-200">{formatCurrency.format(reportData.ytdNetProfit)}</div></div>
               </div>
               <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="text-xs font-bold text-slate-600 dark:text-slate-300">Next Deadline: <span className="text-emerald-600 dark:text-emerald-400">{getNextEstimatedTaxDeadline().date}</span> — {getNextEstimatedTaxDeadline().days} days left</div>
                  <div onClick={(e) => { e.stopPropagation(); setCurrentPage(Page.Reports); setTimeout(() => { setScrollToTaxSnapshot(true); handleOpenTaxDrawer(); }, 100); }} className="text-xs font-bold text-blue-500 hover:underline uppercase tracking-wider cursor-pointer">Log Payment</div>
               </div>
            </div>

            {/* Scan Receipt Section */}
            <div>
              <div className="flex items-center justify-between mb-4 pl-2">
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-200 uppercase tracking-[0.10em] font-brand">Receipts</h3>
              </div>
              <div className="flex overflow-x-auto gap-3 pb-4 pt-1 px-1 -mx-1 custom-scrollbar snap-x">
                <button onClick={() => scanInputRef.current?.click()} className="flex-shrink-0 w-24 h-24 bg-slate-200 dark:bg-slate-800 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors border border-dashed border-slate-400 dark:border-slate-600 active:scale-95 snap-start">
                   <div className="bg-white dark:bg-slate-900 p-2.5 rounded-full shadow-sm text-slate-900 dark:text-white">
                     <Camera size={20} />
                   </div>
                   <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Scan</span>
                </button>
                <input type="file" ref={scanInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleScanReceipt} />
                
                {receipts.map(r => (
                   <div key={r.id} onClick={() => setViewingReceipt(r)} className="flex-shrink-0 w-24 h-24 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden relative cursor-pointer shadow-sm group active:scale-95 transition-transform snap-start">
                      <img src={r.imageData} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Eye className="text-white drop-shadow-md" size={20} />
                      </div>
                   </div>
                ))}
              </div>
              <div className="text-[10px] text-slate-400 font-medium text-center mt-2 uppercase tracking-wide">Exports to Downloads</div>
            </div>
          </div>
        )}

        {(currentPage === Page.Income || currentPage === Page.Expenses || (currentPage === Page.AllTransactions || currentPage === Page.Ledger)) && (
           <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
             <div className="flex items-center justify-between mb-2 pl-2">
                 <div className="flex items-center gap-3">
                     <div className="flex items-center gap-3">
                       <div className={`p-2.5 rounded-lg ${currentPage === Page.Income ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : currentPage === Page.Expenses ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-500' : 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400'}`}>{currentPage === Page.Income ? <TrendingUp size={24} strokeWidth={1.5}/> : currentPage === Page.Expenses ? <TrendingDown size={24} strokeWidth={1.5}/> : <History size={24} strokeWidth={1.5} />}</div>
                       <h2 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white font-brand">{currentPage === Page.Income ? 'Income' : currentPage === Page.Expenses ? 'Expenses' : 'Ledger'}</h2>
                     </div>
                 </div>
                 {(currentPage === Page.Income || currentPage === Page.Expenses || (currentPage === Page.AllTransactions || currentPage === Page.Ledger)) && (
                    <button onClick={() => handleOpenFAB(getHeaderFabType())} className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-blue-500 transition-all"><Plus size={24} strokeWidth={2.5} /></button>
                 )}
             </div>

             <PeriodSelector period={filterPeriod} setPeriod={setFilterPeriod} refDate={referenceDate} setRefDate={setReferenceDate} />

        {((currentPage === Page.AllTransactions || currentPage === Page.Ledger) || currentPage === Page.Ledger) && (
               <div className="flex bg-slate-200 dark:bg-slate-900 p-1 rounded-lg mb-4">
                  {(['all', 'income', 'expense', 'invoice'] as const).map(f => (
                    <button key={f} onClick={() => setLedgerFilter(f)} className={`flex-1 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${ledgerFilter === f ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-200'}`}>{f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}</button>
                  ))}
               </div>
             )}

             {filterPeriod !== 'all' && (
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 mb-6 flex items-center justify-between shadow-sm">
                   <div className="text-center flex-1 border-r border-slate-200 dark:border-slate-800"><div className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Cash In</div><div className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency.format(periodTotals.inc)}</div></div>
                   <div className="text-center flex-1"><div className="text-xs font-bold text-red-600 uppercase tracking-wider mb-1">Cash Out</div><div className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency.format(periodTotals.exp)}</div></div>
                </div>
             )}

             <div className="space-y-4">
               {((currentPage === Page.AllTransactions || currentPage === Page.Ledger) ? ledgerItems : filteredTransactions.filter(t => currentPage === Page.Income ? t.type === 'income' : t.type === 'expense')).length === 0 ? (
                  <EmptyState icon={currentPage === Page.Income ? <Wallet size={32} /> : currentPage === Page.Expenses ? <Receipt size={32} /> : <History size={32} />} title="No Items Found" subtitle="No activity found for the selected period." action={() => handleOpenFAB('income')} actionLabel="Add Transaction" />
               ) : (
                ((currentPage === Page.AllTransactions || currentPage === Page.Ledger) ? ledgerItems : filteredTransactions.filter(t => currentPage === Page.Income ? t.type === 'income' : t.type === 'expense').sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())).map((item: any) => {
                  const isInvoice = item.dataType === 'invoice';
                  const isIncome = item.type === 'income';
                  const amountColor = isInvoice ? 'text-blue-600 dark:text-blue-400' : isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
                  const iconBg = isInvoice ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400' : isIncome ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400';
                  const Icon = isInvoice ? FileText : isIncome ? Wallet : Receipt;
                  
                  // Invoice status calculations
                  let invoiceStatusBadge = null;
                  if (isInvoice) {
                    const inv = item as Invoice;
                    const isVoid = inv.status === 'void';
                    const overdueDays = inv.status === 'unpaid' ? getDaysOverdue(inv.due) : 0;
                    const isOverdue = overdueDays > 0;
                    
                    let badgeClass = '';
                    let badgeText = '';
                    
                    if (isVoid) {
                      badgeClass = 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
                      badgeText = 'VOID';
                    } else if (inv.status === 'paid') {
                      badgeClass = 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
                      badgeText = 'PAID';
                    } else if (isOverdue) {
                      badgeClass = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
                      badgeText = 'OVERDUE';
                    } else {
                      badgeClass = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
                      badgeText = 'UNPAID';
                    }
                    
                    invoiceStatusBadge = (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase flex-shrink-0 ${badgeClass}`}>
                        {badgeText}
                      </span>
                    );
                  }
                  
                  // If it's an invoice, use the detailed invoice card layout
                  if (isInvoice) {
                    const inv = item as Invoice;
                    const isVoid = inv.status === 'void';
                    const overdueDays = inv.status === 'unpaid' ? getDaysOverdue(inv.due) : 0;
                    const isOverdue = overdueDays > 0;
                    const isRecurring = inv.recurrence && inv.recurrence.active;
                    
                    return (
                      <div key={item.listId || item.id} className={`bg-white dark:bg-slate-900 p-6 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-blue-500/30 hover:shadow-lg transition-all shadow-md cursor-pointer ${isOverdue && !isVoid ? 'border-l-4 border-l-red-500' : ''} ${isVoid ? 'opacity-75 grayscale-[0.5] border-l-4 border-l-slate-400' : ''}`} onClick={() => handleEditItem(item)}>
                        {/* Top Section: Icon, Name, Description */}
                        <div className="flex items-start gap-4 mb-4">
                          <div className={`w-12 h-12 bg-slate-100 dark:bg-blue-500/10 text-slate-600 dark:text-blue-400 rounded-md flex items-center justify-center flex-shrink-0 ${isVoid ? 'bg-slate-200 dark:bg-slate-800 text-slate-400' : ''}`}>{isVoid ? <Ban size={20} strokeWidth={1.5} /> : isRecurring ? <Repeat size={20} strokeWidth={1.5} className="text-blue-500" /> : <FileText size={20} strokeWidth={1.5} />}</div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <div className={`font-bold text-slate-900 dark:text-white text-lg ${isVoid ? 'line-through text-slate-400' : ''}`}>{inv.client}</div>
                              {isRecurring && <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Recurring</span>}
                            </div>
                            <div className="text-sm font-medium text-slate-600 dark:text-slate-300">{inv.description}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{inv.date}</div>
                          </div>
                        </div>
                        
                        {/* Bottom Section: Amount, Status, Actions */}
                        <div className="flex items-end justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                          <div>
                              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1 uppercase tracking-wide">Total</label>
                              <div className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white mb-2">{formatCurrency.format(inv.amount)}</div>
                              <div className="flex flex-col gap-1">
                                <div className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 w-fit ${isVoid ? 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400' : inv.status === 'paid' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300' : isOverdue ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'}`}>
                                  {isOverdue && !isVoid && <AlertTriangle size={12} />}
                                  {isVoid ? 'Void' : inv.status === 'paid' ? 'Paid' : isOverdue ? `Overdue (${overdueDays}d)` : 'Unpaid'}
                                </div>
                                <div className={`text-xs font-medium ${isOverdue && !isVoid ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                  {isOverdue && !isVoid ? `Due was ${inv.due}` : `Due ${inv.due}`}
                                  {isRecurring && inv.recurrence && <span className="block text-blue-500 mt-0.5">Next: {inv.recurrence.nextDate}</span>}
                                </div>
                              </div>
                          </div>
                          <div className="flex gap-2">
                              <button onClick={(e) => { e.stopPropagation(); handlePrintInvoice(inv); }} title="Export PDF" className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-600 hover:text-white transition-all active:scale-95"><Download size={20} strokeWidth={1.5} /></button>
                              <button onClick={(e) => { e.stopPropagation(); markInvoicePaid(inv); }} title={inv.status === 'paid' ? "Mark Unpaid" : "Mark Paid"} disabled={isVoid} className={`p-2.5 rounded-lg transition-all active:scale-95 ${isVoid ? 'bg-slate-50 dark:bg-slate-900 text-slate-300 cursor-not-allowed' : inv.status === 'paid' ? 'bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400 hover:bg-green-600 hover:text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-green-600 hover:text-white'}`}><CheckCircle size={20} strokeWidth={1.5} /></button>
                              {!isVoid && <button onClick={(e) => { e.stopPropagation(); setActiveItem(inv); setDrawerMode('edit_inv'); setIsDrawerOpen(true); }} title="Edit Invoice" className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-900 hover:text-white dark:hover:bg-slate-700 transition-all active:scale-95"><Edit3 size={20} strokeWidth={1.5} /></button>}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  
                  // Otherwise use the standard transaction layout
                  return (
                   <div key={item.listId || item.id} className="p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-blue-500/30 hover:shadow-lg transition-all shadow-md" onClick={() => handleEditItem(item)}>
                      {/* Top Row: Icon, Name/Client, Amount */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${iconBg}`}><Icon size={22} strokeWidth={1.5} /></div>
                              <div className="min-w-0 flex-1 pt-1">
                                  <div className="flex items-center gap-2 mb-1">
                                      <div className="font-bold text-slate-900 dark:text-white text-base leading-tight">{item.name || item.client}</div>
                                      {invoiceStatusBadge}
                                  </div>
                                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{item.date} · {item.category}</div>
                              </div>
                          </div>
                          <div className={`text-xl font-bold whitespace-nowrap flex-shrink-0 pt-1 ${amountColor}`}>{isIncome ? '+' : ''}{formatCurrency.format(item.amount)}</div>
                      </div>
                      
                      {/* Bottom Row: Action Buttons */}
                      <div className="flex items-center justify-end gap-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                           <button onClick={(e) => { e.stopPropagation(); if (isInvoice) duplicateInvoice(item as Invoice); else duplicateTransaction(item as Transaction); }} className="p-2 rounded-lg text-slate-400 dark:text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all active:scale-95" title="Duplicate"><Copy size={18}/></button>
                           <button onClick={(e) => { e.stopPropagation(); handleEditItem(item); }} className="p-2 rounded-lg text-slate-400 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95" title="Edit"><Edit3 size={18}/></button>
                           <button onClick={(e) => { e.stopPropagation(); if (isInvoice) deleteInvoice(item); else deleteTransaction(item.id); }} className="p-2 rounded-lg text-slate-400 dark:text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all active:scale-95" title="Delete"><Trash2 size={18}/></button>
                      </div>
                   </div>
                  );
                }))}
             </div>
           </div>
        )}

        {((currentPage === Page.Invoices || currentPage === Page.Invoice) || currentPage === Page.Invoice) && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                  <FileText size={24} strokeWidth={1.5} />
                </div>
                <div className="flex flex-col gap-2">
                  <h2 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white font-brand">{billingDocType === 'estimate' ? 'Estimates' : 'Invoices'}</h2>
                  <div className="inline-flex w-fit bg-slate-200 dark:bg-slate-900 p-1 rounded-lg">
                    <button onClick={() => { setBillingDocType('invoice'); setInvoiceQuickFilter('all'); }} className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${billingDocType === 'invoice' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-300'}`}>Invoices</button>
                    <button onClick={() => { setBillingDocType('estimate'); setEstimateQuickFilter('all'); }} className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${billingDocType === 'estimate' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-300'}`}>Estimates</button>
                  </div>
                </div>
              </div>
              <button onClick={() => handleOpenFAB('billing', billingDocType === 'estimate' ? 'estimate' : 'invoice')} className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-blue-500 transition-all"><Plus size={24} strokeWidth={2.5} /></button>
            </div>
            <PeriodSelector period={filterPeriod} setPeriod={setFilterPeriod} refDate={referenceDate} setRefDate={setReferenceDate} />

            {billingDocType === 'invoice' && (<>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setInvoiceQuickFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${invoiceQuickFilter === 'all' ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800'}`}
              >
                All ({invoiceQuickCounts.all})
              </button>
              <button
                type="button"
                onClick={() => setInvoiceQuickFilter('unpaid')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${invoiceQuickFilter === 'unpaid' ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800'}`}
              >
                Unpaid ({invoiceQuickCounts.unpaid})
              </button>
              <button
                type="button"
                onClick={() => setInvoiceQuickFilter('overdue')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${invoiceQuickFilter === 'overdue' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800'}`}
              >
                Overdue ({invoiceQuickCounts.overdue})
              </button>
            </div>

             {filterPeriod !== 'all' && (
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 mb-6 flex items-center justify-between shadow-sm gap-4">
                   <div className="text-center flex-1 border-r border-slate-200 dark:border-slate-800"><div className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Paid</div><div className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency.format(invoicePeriodTotals.paid)}</div></div>
                   <div className="text-center flex-1 border-r border-slate-200 dark:border-slate-800"><div className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">Due Soon</div><div className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency.format(invoicePeriodTotals.unpaid - invoicePeriodTotals.overdue)}</div></div>
                   <div className="text-center flex-1"><div className="text-xs font-bold text-red-600 uppercase tracking-wider mb-1">Overdue</div><div className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency.format(invoicePeriodTotals.overdue)}</div></div>
                </div>
             )}
            <div className="space-y-4">
              {displayedInvoices.length === 0 ? <EmptyState icon={<FileText size={32} />} title="No Invoices Found" subtitle={filterPeriod === 'all' ? "Create professional invoices and track payments effortlessly." : "No invoices found for the selected period."} action={() => handleOpenFAB('billing', 'invoice')} actionLabel="Create Invoice" /> :
                displayedInvoices.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(inv => {
                  const overdueDays = inv.status === 'unpaid' ? getDaysOverdue(inv.due) : 0;
                  const isOverdue = overdueDays > 0;
                  const isRecurring = inv.recurrence && inv.recurrence.active;
                  const isVoid = inv.status === 'void';
                  return (
                  <div key={inv.id} className={`bg-white dark:bg-slate-900 p-6 rounded-lg border border-slate-200 dark:border-slate-800 group hover:border-blue-500/30 hover:shadow-lg transition-all shadow-md cursor-pointer ${isOverdue && !isVoid ? 'border-l-4 border-l-red-500' : ''} ${isVoid ? 'opacity-75 grayscale-[0.5] border-l-4 border-l-slate-400' : ''}`} onClick={() => handleEditItem({ dataType: 'invoice', original: inv })}>
                    {/* Top Section: Icon, Name, Description */}
                    <div className="flex items-start gap-4 mb-4">
                      <div className={`w-12 h-12 bg-slate-100 dark:bg-blue-500/10 text-slate-600 dark:text-blue-400 rounded-md flex items-center justify-center flex-shrink-0 ${isVoid ? 'bg-slate-200 dark:bg-slate-800 text-slate-400' : ''}`}>{isVoid ? <Ban size={20} strokeWidth={1.5} /> : isRecurring ? <Repeat size={20} strokeWidth={1.5} className="text-blue-500" /> : <FileText size={20} strokeWidth={1.5} />}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`font-bold text-slate-900 dark:text-white text-lg ${isVoid ? 'line-through text-slate-400' : ''}`}>{inv.client}</div>
                          {isRecurring && <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Recurring</span>}
                        </div>
                        <div className="text-sm font-medium text-slate-600 dark:text-slate-300">{inv.description}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{inv.date}</div>
                      </div>
                    </div>
                    
                    {/* Bottom Section: Amount, Status, Actions */}
                    <div className="flex items-end justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                      <div>
                          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1 uppercase tracking-wide">Total</label>
                          <div className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white mb-2">{formatCurrency.format(inv.amount)}</div>
                          <div className="flex flex-col gap-1">
                            <div className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 w-fit ${isVoid ? 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400' : inv.status === 'paid' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300' : isOverdue ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'}`}>
                              {isOverdue && !isVoid && <AlertTriangle size={12} />}
                              {isVoid ? 'Void' : inv.status === 'paid' ? 'Paid' : isOverdue ? `Overdue (${overdueDays}d)` : 'Unpaid'}
                            </div>
                            <div className={`text-xs font-medium ${isOverdue && !isVoid ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>
                              {isOverdue && !isVoid ? `Due was ${inv.due}` : `Due ${inv.due}`}
                              {isRecurring && inv.recurrence && <span className="block text-blue-500 mt-0.5">Next: {inv.recurrence.nextDate}</span>}
                            </div>
                          </div>
                      </div>
                      <div className="flex gap-2">
                          <button onClick={(e) => { e.stopPropagation(); handlePrintInvoice(inv); }} title="Export PDF" className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-600 hover:text-white transition-all active:scale-95"><Download size={20} strokeWidth={1.5} /></button>
                          <button onClick={(e) => { e.stopPropagation(); markInvoicePaid(inv); }} title={inv.status === 'paid' ? "Mark Unpaid" : "Mark Paid"} disabled={isVoid} className={`p-2.5 rounded-lg transition-all active:scale-95 ${isVoid ? 'bg-slate-50 dark:bg-slate-900 text-slate-300 cursor-not-allowed' : inv.status === 'paid' ? 'bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400 hover:bg-green-600 hover:text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-green-600 hover:text-white'}`}><CheckCircle size={20} strokeWidth={1.5} /></button>
                          {!isVoid && <button onClick={(e) => { e.stopPropagation(); setActiveItem(inv); setDrawerMode('edit_inv'); setIsDrawerOpen(true); }} title="Edit Invoice" className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-900 hover:text-white dark:hover:bg-slate-700 transition-all active:scale-95"><Edit3 size={20} strokeWidth={1.5} /></button>}
                      </div>
                    </div>
                  </div>
                )})
              }

            </div>
            </>
            )}

            {billingDocType === 'estimate' && (
              <>
                <div className="flex gap-2 flex-wrap">
                  <button type="button" onClick={() => setEstimateQuickFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${estimateQuickFilter === 'all' ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800'}`}>All ({estimateQuickCounts.all})</button>
                  <button type="button" onClick={() => setEstimateQuickFilter('draft')} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${estimateQuickFilter === 'draft' ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800'}`}>Draft ({estimateQuickCounts.draft})</button>
                  <button type="button" onClick={() => setEstimateQuickFilter('sent')} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${estimateQuickFilter === 'sent' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800'}`}>Sent ({estimateQuickCounts.sent})</button>
                  <button type="button" onClick={() => setEstimateQuickFilter('accepted')} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${estimateQuickFilter === 'accepted' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800'}`}>Accepted ({estimateQuickCounts.accepted})</button>
                  <button type="button" onClick={() => setEstimateQuickFilter('declined')} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${estimateQuickFilter === 'declined' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800'}`}>Declined ({estimateQuickCounts.declined})</button>
                </div>

                <div className="space-y-4">
                  {displayedEstimates.length === 0 ? (
                    <EmptyState icon={<FileText size={32} />} title="No Estimates Found" subtitle={filterPeriod === 'all' ? "Create professional estimates (quotes) and export to PDF." : "No estimates found for the selected period."} action={() => handleOpenFAB('billing', 'estimate')} actionLabel="Create Estimate" />
                  ) : (
                    displayedEstimates
                      .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map(est => {
                        const isExpired = est.validUntil ? new Date(est.validUntil) < new Date() : false;
                        const statusLabel = est.status === 'accepted' ? 'Accepted' : est.status === 'declined' ? 'Declined' : est.status === 'sent' ? 'Sent' : 'Draft';
                        const statusClass = est.status === 'accepted' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : est.status === 'declined' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' : est.status === 'sent' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
                        return (
                          <div key={est.id} className={`bg-white dark:bg-slate-900 p-6 rounded-lg border border-slate-200 dark:border-slate-800 group hover:border-blue-500/30 hover:shadow-lg transition-all shadow-md cursor-pointer ${isExpired && est.status !== 'accepted' ? 'border-l-4 border-l-amber-500' : ''}`} onClick={() => handleEditItem({ dataType: 'estimate', original: est })}>
                            <div className="flex items-start gap-4 mb-4">
                              <div className="w-12 h-12 bg-slate-100 dark:bg-blue-500/10 text-slate-600 dark:text-blue-400 rounded-md flex items-center justify-center flex-shrink-0"><FileText size={20} strokeWidth={1.5} /></div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <div className="font-bold text-slate-900 dark:text-white text-lg">{est.client}</div>
                                </div>
                                <div className="text-sm font-medium text-slate-600 dark:text-slate-300">{est.description}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{est.date}{est.validUntil ? ` • Valid until ${est.validUntil}` : ''}</div>
                              </div>
                            </div>

                            <div className="flex items-end justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                              <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1 uppercase tracking-wide">Total</label>
                                <div className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white mb-2">{formatCurrency.format(est.amount)}</div>
                                <div className="flex flex-col gap-1">
                                  <div className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 w-fit ${statusClass}`}>{statusLabel}</div>
                                  {isExpired && est.status !== 'accepted' && <div className="text-xs font-medium text-amber-600 dark:text-amber-400">Expired</div>}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={(e) => { e.stopPropagation(); handlePrintEstimate(est); }} title="Export PDF" className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-600 hover:text-white transition-all active:scale-95"><Download size={20} strokeWidth={1.5} /></button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); convertEstimateToInvoice(est); }}
                                  title="Convert to Invoice"
                                  disabled={est.status === 'void'}
                                  className={`p-2.5 rounded-lg transition-all active:scale-95 ${est.status === 'void'
                                    ? 'bg-slate-50 dark:bg-slate-900 text-slate-300 cursor-not-allowed'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-emerald-600 hover:text-white'}`}
                                >
                                  <ArrowRight size={20} strokeWidth={1.5} />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); setBillingDocType('estimate'); setActiveItem(est); setDrawerMode('edit_inv'); setIsDrawerOpen(true); }} title="Edit Estimate" className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-900 hover:text-white dark:hover:bg-slate-700 transition-all active:scale-95"><Edit3 size={20} strokeWidth={1.5} /></button>
                                <button onClick={(e) => { e.stopPropagation(); deleteEstimate(est); }} title="Delete Estimate" className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-red-600 hover:text-white transition-all active:scale-95"><Trash2 size={20} strokeWidth={1.5} /></button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {currentPage === Page.Reports && (
           <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                  <BarChart3 size={24} strokeWidth={1.5} />
                </div>
                <h2 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white font-brand">Reports</h2>
              </div>
              
              {/* Enhanced Profit & Loss Statement */}
              <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl">
                {/* Header with Actions */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <BarChart3 size={24} strokeWidth={2} className="text-blue-600 dark:text-blue-400" />
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tight font-brand">
                        Profit & Loss
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        {filterPeriod === 'month' ? referenceDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) :
                         filterPeriod === 'quarter' ? `Q${Math.floor(referenceDate.getMonth() / 3) + 1} ${referenceDate.getFullYear()}` :
                         filterPeriod === 'year' ? referenceDate.getFullYear().toString() : 'All Time'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setPlExportRequested(false); setShowPLPreview(true); }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm flex items-center gap-2 transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      <span className="hidden sm:inline">Preview</span>
                    </button>

                    <button
                      onClick={handleExportPLPDF}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm flex items-center gap-2 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      <span className="hidden sm:inline">Export PDF</span>
                    </button>
                  </div>
                </div>

                {/* Compact Summary - Left Aligned */}
                <div className="space-y-4">
                  <div className="py-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Revenue</span>
                    </div>
                    <div className="text-2xl font-bold text-emerald-600 tabular-nums">{formatCurrency.format(reportData.income)}</div>
                  </div>
                  
                  <div className="py-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Operating Expenses</span>
                    </div>
                    <div className="text-2xl font-bold text-red-600 tabular-nums">{formatCurrency.format(reportData.expense)}</div>
                  </div>
                  
                  <div className="pt-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-base font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Net Profit</span>
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        {reportData.income > 0 ? `${((reportData.netProfit / reportData.income) * 100).toFixed(1)}% margin` : '—'}
                      </span>
                    </div>
                    <div className={`text-4xl font-bold tabular-nums ${reportData.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatCurrency.format(reportData.netProfit)}
                    </div>
                  </div>
                </div>
              </div>

              <div ref={taxSnapshotRef} className="bg-white dark:bg-slate-950 text-slate-900 dark:text-white p-8 rounded-lg shadow-xl relative overflow-hidden border border-slate-200 dark:border-slate-800">
                <div className="absolute top-0 right-0 w-80 h-80 bg-blue-50 dark:bg-blue-600/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
                <div className="flex items-center justify-between mb-8 relative z-10">
                  <div className="flex items-center gap-3"><Calculator size={24} strokeWidth={2} className="text-emerald-600 dark:text-emerald-400" /><div><h3 className="text-lg sm:text-xl font-bold uppercase tracking-tight font-brand">Tax Snapshot</h3><p className="text-xs text-slate-600 dark:text-slate-300 font-bold mt-1">Based on Net Profit: {formatCurrency.format(reportData.ytdNetProfit)}</p></div></div>
                  <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleOpenTaxDrawer(); }} className="relative z-30 cursor-pointer text-xs font-bold text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors uppercase tracking-wider active:scale-95">Manage Payments</button>
                </div>
                <div className="space-y-6 relative z-10">
                  <div className="flex justify-between items-center"><div><div className="text-sm font-bold text-slate-700 dark:text-slate-300">Self-Employment Tax</div><div className="text-xs text-slate-600 dark:text-slate-300 uppercase tracking-wider">Social Security & Medicare (~15.3%)</div></div><div className="text-xl font-bold">{formatCurrency.format(reportData.seTaxLiability)}</div></div>
                  <div className="flex justify-between items-center"><div><div className="text-sm font-bold text-slate-700 dark:text-slate-300">Income Tax Estimate</div><div className="text-xs text-slate-600 dark:text-slate-300 uppercase tracking-wider">Based on {reportData.totalIncomeTaxRate}% Combined Rate</div></div><div className="text-xl font-bold">{formatCurrency.format(reportData.incomeTaxLiability)}</div></div>
                  <div className="flex justify-between items-center py-2 bg-slate-50 dark:bg-slate-900/50 -mx-4 px-4 rounded-lg"><div><div className="text-sm font-bold text-slate-700 dark:text-slate-300">Less: Payments (YTD)</div></div><div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">-{formatCurrency.format(reportData.totalTaxPaidYTD)}</div></div>
                  <div className="h-px bg-slate-100 dark:bg-slate-800 my-4" />
                  <div className="flex justify-between items-end"><span className="font-bold text-sm uppercase tracking-widest font-brand text-slate-600 dark:text-slate-300">{reportData.taxAhead > 0 ? 'Overpaid (Refund Est.)' : 'Net Remaining To Pay'}</span><span className={`font-extrabold text-3xl font-brand ${reportData.taxAhead > 0 ? 'text-emerald-500' : 'text-slate-900 dark:text-white'}`}>{formatCurrency.format(reportData.taxAhead > 0 ? reportData.taxAhead : reportData.taxRemaining)}</span></div>
                </div>

                {/* --- Tax Planner (2026) Accordion --- */}
              </div>
                <div className="bg-white dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800 shadow-lg rounded-3xl p-6 relative overflow-hidden">
                  <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-blue-500/10 dark:bg-blue-400/10 opacity-0 dark:opacity-100 blur-2xl pointer-events-none" />
                  <button
                    onClick={() => setIsPlannerOpen(!isPlannerOpen)}
                    className="w-full flex items-center justify-between gap-4 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <BrainCircuit size={22} className="text-blue-600 dark:text-blue-400" />
                      <h3 className="text-lg sm:text-xl font-bold uppercase tracking-tight font-brand text-slate-900 dark:text-white">
                        Tax Planner <span className="text-slate-500 dark:text-slate-400">(2026)</span>
                      </h3>
                    </div>
                    <span className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/60 shadow-sm">
                      {isPlannerOpen ? <ChevronUp size={18} className="text-slate-600 dark:text-slate-300" /> : <ChevronDown size={18} className="text-slate-600 dark:text-slate-300" />}
                    </span>
                  </button>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 pl-9">
                    Estimate and plan your 2026 taxes in one place.
                  </p>

                  {isPlannerOpen && (
                    <div className="mt-6 pt-6 border-t border-slate-200/60 dark:border-slate-800 animate-in slide-in-from-top-2 duration-200 space-y-6">
                            
                            {/* Tab Switcher */}
                            <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1 rounded-lg mb-4">
                                <button onClick={() => setPlannerTab('basic')} className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${plannerTab === 'basic' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>Basic</button>
                                <button onClick={() => setPlannerTab('advanced')} className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${plannerTab === 'advanced' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>Advanced</button>
                            </div>

                            {plannerTab === 'basic' ? (
                                // Basic Mode
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2 block">Projected Annual Income</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-bold">$</span>
                                                <input 
                                                    type="number" 
                                                    value={plannerData.income || ''} 
                                                    onChange={e => setPlannerData(p => ({...p, income: Number(e.target.value)}))}
                                                    className="w-full pl-7 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
                                                    placeholder="0"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2 block">Projected Annual Expenses</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-bold">$</span>
                                                <input 
                                                    type="number" 
                                                    value={plannerData.expenses || ''} 
                                                    onChange={e => setPlannerData(p => ({...p, expenses: Number(e.target.value)}))}
                                                    className="w-full pl-7 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
                                                    placeholder="0"
                                                />
                                            </div>
                                            <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-1 text-right">
                                                Proj. Profit: {formatCurrency.format(plannerResults.profit)}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2 block">Filing Status</label>
                                            <select 
                                                value={plannerData.filingStatus} 
                                                onChange={e => setPlannerData(p => ({...p, filingStatus: e.target.value as any}))}
                                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
                                            >
                                                <option value="single">Single</option>
                                                <option value="joint">Married Filing Jointly</option>
                                                <option value="head">Head of Household</option>
                                                <option value="separate">Married Filing Separately</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2 block">Est. Income Tax Rate</label>
                                            <div className="flex gap-2 mb-2">
                                                {[10, 15, 20].map(rate => (
                                                    <button 
                                                        key={rate}
                                                        onClick={() => setPlannerData(p => ({...p, taxRate: rate, useCustomRate: false}))}
                                                        className={`flex-1 py-1.5 rounded text-xs font-bold border transition-colors ${!plannerData.useCustomRate && plannerData.taxRate === rate ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}
                                                    >
                                                        {rate}%
                                                    </button>
                                                ))}
                                                <button 
                                                    onClick={() => setPlannerData(p => ({...p, useCustomRate: true}))}
                                                    className={`flex-1 py-1.5 rounded text-xs font-bold border transition-colors ${plannerData.useCustomRate ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}
                                                >
                                                    Custom
                                                </button>
                                            </div>
                                            {plannerData.useCustomRate && (
                                                <div className="relative">
                                                    <input 
                                                        type="number" 
                                                        value={plannerData.taxRate} 
                                                        onChange={e => setPlannerData(p => ({...p, taxRate: Number(e.target.value)}))}
                                                        className="w-full pl-3 pr-8 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-sm font-bold text-slate-900 dark:text-white outline-none"
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-bold text-xs">%</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-3 p-4 bg-slate-50 dark:bg-slate-900/30 rounded-lg border border-slate-100 dark:border-slate-800/50">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Apply SE Tax (~15.3%)</label>
                                            <button 
                                                onClick={() => setPlannerData(p => ({...p, useSE: !p.useSE}))}
                                                className={`w-10 h-5 rounded-full relative transition-colors ${plannerData.useSE ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                                            >
                                                <div className={`absolute top-1 bottom-1 w-3 bg-white rounded-full transition-all ${plannerData.useSE ? 'left-6' : 'left-1'}`} />
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Standard Deduction (2026)</label>
                                            <button 
                                                onClick={() => setPlannerData(p => ({...p, useStdDed: !p.useStdDed}))}
                                                className={`w-10 h-5 rounded-full relative transition-colors ${plannerData.useStdDed ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                                            >
                                                <div className={`absolute top-1 bottom-1 w-3 bg-white rounded-full transition-all ${plannerData.useStdDed ? 'left-6' : 'left-1'}`} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2 block">Annual Retirement Contrib.</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-bold">$</span>
                                                <input 
                                                    type="number" 
                                                    value={plannerData.retirement || ''} 
                                                    onChange={e => setPlannerData(p => ({...p, retirement: Number(e.target.value)}))}
                                                    className="w-full pl-7 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
                                                    placeholder="0"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2 block">Expected Annual Credits</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-bold">$</span>
                                                <input 
                                                    type="number" 
                                                    value={plannerData.credits || ''} 
                                                    onChange={e => setPlannerData(p => ({...p, credits: Number(e.target.value)}))}
                                                    className="w-full pl-7 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
                                                    placeholder="0"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                // Advanced Mode
                                <div className="space-y-6">
                                    {/* Reused Core Inputs */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2 block">Projected Annual Income</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-bold">$</span>
                                                <input 
                                                    type="number" 
                                                    value={plannerData.income || ''} 
                                                    onChange={e => setPlannerData(p => ({...p, income: Number(e.target.value)}))}
                                                    className="w-full pl-7 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
                                                    placeholder="0"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2 block">Projected Annual Expenses</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-bold">$</span>
                                                <input 
                                                    type="number" 
                                                    value={plannerData.expenses || ''} 
                                                    onChange={e => setPlannerData(p => ({...p, expenses: Number(e.target.value)}))}
                                                    className="w-full pl-7 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
                                                    placeholder="0"
                                                />
                                            </div>
                                            <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-1 text-right">
                                                Proj. Profit: {formatCurrency.format(plannerResults.profit)}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2 block">Filing Status</label>
                                            <select 
                                                value={plannerData.filingStatus} 
                                                onChange={e => setPlannerData(p => ({...p, filingStatus: e.target.value as any}))}
                                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
                                            >
                                                <option value="single">Single</option>
                                                <option value="joint">Married Filing Jointly</option>
                                                <option value="head">Head of Household</option>
                                                <option value="separate">Married Filing Separately</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2 block">Est. Income Tax Rate</label>
                                            <div className="flex gap-2 mb-2">
                                                {[10, 15, 20].map(rate => (
                                                    <button 
                                                        key={rate}
                                                        onClick={() => setPlannerData(p => ({...p, taxRate: rate, useCustomRate: false}))}
                                                        className={`flex-1 py-1.5 rounded text-xs font-bold border transition-colors ${!plannerData.useCustomRate && plannerData.taxRate === rate ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}
                                                    >
                                                        {rate}%
                                                    </button>
                                                ))}
                                                <button 
                                                    onClick={() => setPlannerData(p => ({...p, useCustomRate: true}))}
                                                    className={`flex-1 py-1.5 rounded text-xs font-bold border transition-colors ${plannerData.useCustomRate ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}
                                                >
                                                    Custom
                                                </button>
                                            </div>
                                            {plannerData.useCustomRate && (
                                                <div className="relative">
                                                    <input 
                                                        type="number" 
                                                        value={plannerData.taxRate} 
                                                        onChange={e => setPlannerData(p => ({...p, taxRate: Number(e.target.value)}))}
                                                        className="w-full pl-3 pr-8 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-sm font-bold text-slate-900 dark:text-white outline-none"
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-bold text-xs">%</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Advanced Sections */}
                                    <div className="space-y-4">
                                        {/* Section A: Other Income */}
                                        <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                                            <button onClick={() => setAdvSection(advSection === 'income' ? null : 'income')} className="flex items-center justify-between w-full p-4 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center"><Wallet size={16}/></div>
                                                    <div className="text-left">
                                                        <div className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">A. Other Income</div>
                                                        <div className="text-xs text-slate-500 dark:text-slate-400">Interest, Dividends, Capital Gains</div>
                                                    </div>
                                                </div>
                                                {advSection === 'income' ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                                            </button>
                                            {advSection === 'income' && (
                                                <div className="p-4 bg-white dark:bg-slate-950 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                                                    <div><label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Interest</label><input type="number" value={plannerData.otherIncomeInterest || ''} onChange={e => setPlannerData(p => ({...p, otherIncomeInterest: Number(e.target.value)}))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-sm outline-none" placeholder="0"/></div>
                                                    <div><label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Dividends</label><input type="number" value={plannerData.otherIncomeDividends || ''} onChange={e => setPlannerData(p => ({...p, otherIncomeDividends: Number(e.target.value)}))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-sm outline-none" placeholder="0"/></div>
                                                    <div><label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Capital Gains</label><input type="number" value={plannerData.otherIncomeCapital || ''} onChange={e => setPlannerData(p => ({...p, otherIncomeCapital: Number(e.target.value)}))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-sm outline-none" placeholder="0"/></div>
                                                    <div><label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Other</label><input type="number" value={plannerData.otherIncomeOther || ''} onChange={e => setPlannerData(p => ({...p, otherIncomeOther: Number(e.target.value)}))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-sm outline-none" placeholder="0"/></div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Section B: Deductions */}
                                        <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                                            <button onClick={() => setAdvSection(advSection === 'deductions' ? null : 'deductions')} className="flex items-center justify-between w-full p-4 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center"><FileText size={16}/></div>
                                                    <div className="text-left">
                                                        <div className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">B. Deductions</div>
                                                        <div className="text-xs text-slate-500 dark:text-slate-400">Standard vs. Itemized</div>
                                                    </div>
                                                </div>
                                                {advSection === 'deductions' ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                                            </button>
                                            {advSection === 'deductions' && (
                                                <div className="p-4 bg-white dark:bg-slate-950 animate-in slide-in-from-top-2">
                                                    <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg mb-4">
                                                        <button onClick={() => setPlannerData(p => ({...p, deductionMode: 'standard'}))} className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${plannerData.deductionMode === 'standard' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500'}`}>Standard</button>
                                                        <button onClick={() => setPlannerData(p => ({...p, deductionMode: 'itemized'}))} className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${plannerData.deductionMode === 'itemized' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500'}`}>Itemized</button>
                                                    </div>
                                                    {plannerData.deductionMode === 'itemized' ? (
                                                        <div><label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Total Itemized Deductions</label><input type="number" value={plannerData.itemizedDeduction || ''} onChange={e => setPlannerData(p => ({...p, itemizedDeduction: Number(e.target.value)}))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-sm outline-none" placeholder="0"/></div>
                                                    ) : (
                                                        <div className="text-sm text-slate-600 dark:text-slate-300">Using 2026 Standard Deduction for <b>{plannerData.filingStatus}</b>: {formatCurrency.format(plannerResults.deduction)}</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Section C: Adjustments */}
                                        <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                                            <button onClick={() => setAdvSection(advSection === 'adjustments' ? null : 'adjustments')} className="flex items-center justify-between w-full p-4 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center"><Shield size={16}/></div>
                                                    <div className="text-left">
                                                        <div className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">C. Adjustments</div>
                                                        <div className="text-xs text-slate-500 dark:text-slate-400">Retirement, HSA, Health Ins</div>
                                                    </div>
                                                </div>
                                                {advSection === 'adjustments' ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                                            </button>
                                            {advSection === 'adjustments' && (
                                                <div className="p-4 bg-white dark:bg-slate-950 grid grid-cols-1 gap-4 animate-in slide-in-from-top-2">
                                                    <div><label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Retirement Contributions</label><input type="number" value={plannerData.retirement || ''} onChange={e => setPlannerData(p => ({...p, retirement: Number(e.target.value)}))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-sm outline-none" placeholder="0"/></div>
                                                    <div><label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">HSA Contributions</label><input type="number" value={plannerData.adjustmentHSA || ''} onChange={e => setPlannerData(p => ({...p, adjustmentHSA: Number(e.target.value)}))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-sm outline-none" placeholder="0"/></div>
                                                    <div><label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">SE Health Insurance</label><input type="number" value={plannerData.adjustmentHealth || ''} onChange={e => setPlannerData(p => ({...p, adjustmentHealth: Number(e.target.value)}))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-sm outline-none" placeholder="0"/></div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Section D: Credits & SE Tax */}
                                        <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                                            <button onClick={() => setAdvSection(advSection === 'credits' ? null : 'credits')} className="flex items-center justify-between w-full p-4 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center"><CreditCard size={16}/></div>
                                                    <div className="text-left">
                                                        <div className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">D. Credits & Taxes</div>
                                                        <div className="text-xs text-slate-500 dark:text-slate-400">Credits, SE Tax Toggle</div>
                                                    </div>
                                                </div>
                                                {advSection === 'credits' ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                                            </button>
                                            {advSection === 'credits' && (
                                                <div className="p-4 bg-white dark:bg-slate-950 animate-in slide-in-from-top-2 space-y-4">
                                                    <div><label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Expected Credits ($)</label><input type="number" value={plannerData.credits || ''} onChange={e => setPlannerData(p => ({...p, credits: Number(e.target.value)}))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-sm outline-none" placeholder="0"/></div>
                                                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-900">
                                                        <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Apply SE Tax (~15.3%)</label>
                                                        <button 
                                                            onClick={() => setPlannerData(p => ({...p, useSE: !p.useSE}))}
                                                            className={`w-10 h-5 rounded-full relative transition-colors ${plannerData.useSE ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                                                        >
                                                            <div className={`absolute top-1 bottom-1 w-3 bg-white rounded-full transition-all ${plannerData.useSE ? 'left-6' : 'left-1'}`} />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Section E: QBI Deduction (Optional) */}
                                        <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                                            <button onClick={() => setAdvSection(advSection === 'qbi' ? null : 'qbi')} className="flex items-center justify-between w-full p-4 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center"><Briefcase size={16}/></div>
                                                    <div className="text-left">
                                                        <div className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">E. QBI Deduction (Optional)</div>
                                                        <div className="text-xs text-slate-500 dark:text-slate-400">Section 199A Estimate</div>
                                                    </div>
                                                </div>
                                                {advSection === 'qbi' ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                                            </button>
                                            {advSection === 'qbi' && (
                                                <div className="p-4 bg-white dark:bg-slate-950 animate-in slide-in-from-top-2 space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Apply QBI Deduction</label>
                                                        <button 
                                                            onClick={() => setPlannerData(p => ({...p, applyQBI: !p.applyQBI}))}
                                                            className={`w-10 h-5 rounded-full relative transition-colors ${plannerData.applyQBI ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                                                        >
                                                            <div className={`absolute top-1 bottom-1 w-3 bg-white rounded-full transition-all ${plannerData.applyQBI ? 'left-6' : 'left-1'}`} />
                                                        </button>
                                                    </div>
                                                    {plannerData.applyQBI && (
                                                        <>
                                                            <div><label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">QBI Amount Override ($)</label><input type="number" value={plannerData.qbiOverride || ''} onChange={e => setPlannerData(p => ({...p, qbiOverride: Number(e.target.value)}))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-sm outline-none" placeholder="Default: Profit"/></div>
                                                            <div className="text-xs text-slate-500 dark:text-slate-400 italic">Eligibility limits vary. Estimate is 20% of QBI base.</div>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Section F: Payments & On-Track */}
                                        <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                                            <button onClick={() => setAdvSection(advSection === 'payments' ? null : 'payments')} className="flex items-center justify-between w-full p-4 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 flex items-center justify-center"><CheckCircle size={16}/></div>
                                                    <div className="text-left">
                                                        <div className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">F. Payments & On-Track</div>
                                                        <div className="text-xs text-slate-500 dark:text-slate-400">YTD Status & Suggestions</div>
                                                    </div>
                                                </div>
                                                {advSection === 'payments' ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                                            </button>
                                            {advSection === 'payments' && (
                                                <div className="p-4 bg-white dark:bg-slate-950 animate-in slide-in-from-top-2 space-y-4">
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                        <div><label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Est. Payments YTD</label><input type="number" value={plannerData.paymentsYTD || ''} onChange={e => setPlannerData(p => ({...p, paymentsYTD: Number(e.target.value)}))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-sm outline-none" placeholder="0"/></div>
                                                        <div><label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Withholding YTD</label><input type="number" value={plannerData.withholdingYTD || ''} onChange={e => setPlannerData(p => ({...p, withholdingYTD: Number(e.target.value)}))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-sm outline-none" placeholder="0"/></div>
                                                    </div>
                                                    <div><label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Last Year Total Tax (Reference)</label><input type="number" value={plannerData.lastYearTaxRef || ''} onChange={e => setPlannerData(p => ({...p, lastYearTaxRef: Number(e.target.value)}))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-sm outline-none" placeholder="Optional"/></div>
                                                    
                                                    <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-100 dark:border-blue-900">
                                                        <div className="text-xs font-bold uppercase text-blue-600 dark:text-blue-400 mb-1">Quarterly Suggestion</div>
                                                        <div className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency.format(plannerResults.quarterlySuggestion)} <span className="text-xs font-normal text-slate-500">x 4 payments</span></div>
                                                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-2">
                                                            Next Due Dates: Apr 15, Jun 15, Sep 15, Jan 15.
                                                            <br/>Dates may shift for weekends/holidays.
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="bg-slate-100 dark:bg-slate-900 rounded-lg p-5 space-y-3 border border-slate-200 dark:border-slate-800">
                                {plannerTab === 'advanced' && (
                                    <>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-600 dark:text-slate-300 font-medium">Other Income</span>
                                            <span className="font-bold text-slate-900 dark:text-white">{formatCurrency.format(plannerResults.otherIncome)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-600 dark:text-slate-300 font-medium">Total Adjustments</span>
                                            <span className="font-bold text-slate-900 dark:text-white">-{formatCurrency.format(plannerResults.adjustments)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-600 dark:text-slate-300 font-medium">Deduction Used ({plannerData.deductionMode === 'itemized' ? 'Itemized' : 'Standard'})</span>
                                            <span className="font-bold text-slate-900 dark:text-white">-{formatCurrency.format(plannerResults.deduction)}</span>
                                        </div>
                                        {plannerResults.qbiDeduction > 0 && (
                                           <div className="flex justify-between items-center text-sm">
                                               <span className="text-slate-600 dark:text-slate-300 font-medium">QBI Deduction (Est.)</span>
                                               <span className="font-bold text-emerald-600 dark:text-emerald-400">-{formatCurrency.format(plannerResults.qbiDeduction)}</span>
                                           </div>
                                        )}
                                    </>
                                )}
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-600 dark:text-slate-300 font-medium">Projected Taxable Income</span>
                                    <span className="font-bold text-slate-900 dark:text-white">{formatCurrency.format(plannerResults.taxableIncome)}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-600 dark:text-slate-300 font-medium">Income Tax (Annual)</span>
                                    <span className="font-bold text-slate-900 dark:text-white">{formatCurrency.format(plannerResults.incomeTax)}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-600 dark:text-slate-300 font-medium">SE Tax (Annual)</span>
                                    <span className="font-bold text-slate-900 dark:text-white">{formatCurrency.format(plannerResults.seTax)}</span>
                                </div>
                                <div className="h-px bg-slate-200 dark:bg-slate-700 my-2" />
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-extrabold uppercase text-slate-700 dark:text-slate-200">Total Est. Annual Tax</span>
                                    <span className="text-xl font-extrabold text-slate-900 dark:text-white">{formatCurrency.format(plannerResults.totalTax)}</span>
                                </div>
                                {plannerTab === 'advanced' ? (
                                    <>
                                        <div className="flex justify-between items-center text-sm mt-1">
                                            <span className="text-slate-600 dark:text-slate-300 font-medium">Less: Paid YTD</span>
                                            <span className="font-bold text-slate-900 dark:text-white">-{formatCurrency.format(plannerResults.paidSoFar)}</span>
                                        </div>
                                        <div className="h-px bg-slate-200 dark:bg-slate-700 my-2" />
                                        <div className="flex justify-between items-center">
                                             <div className="flex items-center gap-2">
                                                <span className="text-sm font-extrabold uppercase text-slate-700 dark:text-slate-200">{plannerResults.taxAhead > 0 ? 'Ahead by' : 'Remaining Due'}</span>
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${plannerResults.taxAhead > 0 ? 'bg-emerald-100 text-emerald-700' : plannerResults.taxRemaining > 0 ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                                                    {plannerResults.taxAhead > 0 ? 'Ahead' : plannerResults.taxRemaining > 0 ? 'Behind' : 'On Track'}
                                                </span>
                                             </div>
                                             <span className={`text-xl font-extrabold ${plannerResults.taxAhead > 0 ? 'text-emerald-500' : 'text-slate-900 dark:text-white'}`}>{formatCurrency.format(plannerResults.taxAhead > 0 ? plannerResults.taxAhead : plannerResults.taxRemaining)}</span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                                        <div className="bg-white dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-700 text-center">
                                            <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Monthly Set-Aside</div>
                                            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{formatCurrency.format(plannerResults.monthly)}</div>
                                        </div>
                                        <div className="bg-white dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-700 text-center">
                                            <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Quarterly Payment</div>
                                            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{formatCurrency.format(plannerResults.quarterly)}</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

              {/* P&L Preview Modal */}
              {showPLPreview && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-stretch justify-stretch p-0">
                  <div className="bg-white dark:bg-slate-900 rounded-none w-full h-full overflow-hidden flex flex-col">
                    {/* Modal Header */}
                    <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        {isGeneratingPLPdf ? (
                          <Loader2 className="animate-spin text-blue-600" size={18} />
                        ) : plExportRequested ? (
                          <Download className="text-emerald-600" size={18} />
                        ) : (
                          <Eye className="text-blue-600" size={18} />
                        )}
                        <span className="font-bold text-sm uppercase tracking-wider text-slate-700 dark:text-slate-200">
                          {isGeneratingPLPdf ? 'Generating PDF...' : plExportRequested ? 'Exporting PDF...' : 'Previewing P&L'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {!isGeneratingPLPdf && !plExportRequested && (
                          <button
                            onClick={() => setPlExportRequested(true)}
                            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm flex items-center gap-2 transition-colors"
                          >
                            <Download className="w-4 h-4" />
                            <span className="hidden sm:inline">Export PDF</span>
                          </button>
                        )}

                        <button
                          onClick={() => { setPlExportRequested(false); setShowPLPreview(false); }}
                          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {/* PDF Preview Content */}
                    <div className="flex-1 overflow-y-auto p-0 bg-white">
                      <div id="pl-pdf-preview-content" className="w-full min-h-full bg-white text-slate-900 p-6 sm:p-10" style={{ backgroundColor: '#ffffff', color: '#0f172a' }}>
                        {/* Header */}
                        <div className="mb-8 pb-6 border-b-2 border-slate-300">
                          <div className="flex items-start gap-4">
                            <Building size={32} className="mt-1 text-blue-600" />
                            <div className="flex-1 min-w-0">
                              <h1 className="text-2xl font-bold text-slate-900 mb-1 text-left">{settings.businessName}</h1>
                              {settings.businessAddress && (
                                <p className="text-sm text-slate-600 whitespace-pre-line text-left">{settings.businessAddress}</p>
                              )}
                              <div className="mt-4 text-left">
                                <h2 className="text-xl font-bold text-slate-900 uppercase">Profit &amp; Loss Statement</h2>
                                <p className="text-sm text-slate-600 mt-1">
                                  Period: {filterPeriod === 'month' ? referenceDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) :
                                      filterPeriod === 'quarter' ? `Q${Math.floor(referenceDate.getMonth() / 3) + 1} ${referenceDate.getFullYear()}` :
                                      filterPeriod === 'year' ? referenceDate.getFullYear().toString() : 'All Time'}
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                  Generated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Revenue Section */}
                        <div className="mb-8">
                          <div className="flex items-center gap-2 mb-4">
                            <TrendingUp className="w-5 h-5 text-emerald-600" />
                            <h3 className="text-lg font-bold text-slate-900 uppercase">Revenue</h3>
                          </div>
                          <div className="space-y-2 ml-7">
                            {(() => {
                              const incomeByCategory = filteredTransactions.filter(t => t.type === 'income').reduce((acc, t) => {
                                acc[t.category] = (acc[t.category] || 0) + t.amount;
                                return acc;
                              }, {} as Record<string, number>);
                              return Object.entries(incomeByCategory).map(([category, amount]) => (
                                <div key={category} className="flex items-start justify-between gap-4 py-2">
                                  <span className="text-sm text-slate-700 flex-1 min-w-0 break-words">{category}</span>
                                  <span className="text-sm font-semibold text-slate-900 tabular-nums shrink-0">{formatCurrency.format(amount)}</span>
                                </div>
                              ));
                            })()}
                          </div>
                          <div className="flex justify-between items-center py-3 mt-2 border-t border-slate-300">
                            <span className="font-bold text-slate-900">Total Revenue</span>
                            <span className="text-lg font-bold text-emerald-600 tabular-nums">{formatCurrency.format(reportData.income)}</span>
                          </div>
                        </div>

                        {/* Expenses Section */}
                        <div className="mb-8">
                          <div className="flex items-center gap-2 mb-4">
                            <TrendingDown className="w-5 h-5 text-red-600" />
                            <h3 className="text-lg font-bold text-slate-900 uppercase">Operating Expenses</h3>
                          </div>
                          <div className="space-y-2 ml-7">
                            {(() => {
                              const expensesByCategory = filteredTransactions.filter(t => t.type === 'expense').reduce((acc, t) => {
                                acc[t.category] = (acc[t.category] || 0) + t.amount;
                                return acc;
                              }, {} as Record<string, number>);
                              return Object.entries(expensesByCategory).map(([category, amount]) => (
                                <div key={category} className="flex items-start justify-between gap-4 py-2">
                                  <span className="text-sm text-slate-700 flex-1 min-w-0 break-words">{category}</span>
                                  <span className="text-sm font-semibold text-slate-900 tabular-nums shrink-0">{formatCurrency.format(amount)}</span>
                                </div>
                              ));
                            })()}
                          </div>
                          <div className="flex justify-between items-center py-3 mt-2 border-t border-slate-300">
                            <span className="font-bold text-slate-900">Total Expenses</span>
                            <span className="text-lg font-bold text-red-600 tabular-nums">{formatCurrency.format(reportData.expense)}</span>
                          </div>
                        </div>

                        {/* Net Profit Section */}
                        <div className="pt-6 border-t-2 border-slate-900">
                          <div className="flex justify-between items-center mb-4">
                            <span className="text-xl font-bold text-slate-900 uppercase">Net Profit</span>
                            <span className={`text-3xl font-bold tabular-nums ${reportData.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {formatCurrency.format(reportData.netProfit)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-2 bg-slate-50 px-4 rounded">
                            <span className="text-sm font-semibold text-slate-700">Profit Margin</span>
                            <span className={`text-lg font-bold tabular-nums ${reportData.income > 0 && reportData.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {reportData.income > 0 ? `${((reportData.netProfit / reportData.income) * 100).toFixed(1)}%` : '—'}
                            </span>
                          </div>
                        </div>

                        {/* Summary Statistics */}
                        <div className="mt-8 pt-6 border-t border-slate-200">
                          <h4 className="text-sm font-bold text-slate-600 uppercase mb-3">Transaction Summary</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="bg-slate-50 p-3 rounded">
                              <div className="text-xs text-slate-600 mb-1">Income Transactions</div>
                              <div className="text-xl font-bold text-slate-900">
                                {filteredTransactions.filter(t => t.type === 'income').length}
                              </div>
                            </div>
                            <div className="bg-slate-50 p-3 rounded">
                              <div className="text-xs text-slate-600 mb-1">Expense Transactions</div>
                              <div className="text-xl font-bold text-slate-900">
                                {filteredTransactions.filter(t => t.type === 'expense').length}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Footer */}
                        <div className="mt-8 pt-6 border-t border-slate-200 text-center">
                          <p className="text-xs text-slate-500">
                            This statement has been prepared from the books of {settings.businessName}.
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            For period ending {filterPeriod === 'month' ? referenceDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) :
                                              filterPeriod === 'quarter' ? `Q${Math.floor(referenceDate.getMonth() / 3) + 1} ${referenceDate.getFullYear()}` :
                                              filterPeriod === 'year' ? referenceDate.getFullYear().toString() : 'All Time'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Modal Footer */}
                    <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200">
                      <button
                        onClick={() => setShowPLPreview(false)}
                        className="px-6 py-3 border border-slate-300 dark:border-slate-700 rounded-lg font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        Close
                      </button>
                      <button
                        onClick={async () => {
                          setIsGeneratingPDF(true);
                          try {
                            const element = document.getElementById('pl-pdf-preview-content');
                            if (!element) throw new Error('Preview content not found');
                            
                            const periodLabel = filterPeriod === 'month' 
                              ? referenceDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                              : filterPeriod === 'quarter' 
                                ? `Q${Math.floor(referenceDate.getMonth() / 3) + 1} ${referenceDate.getFullYear()}`
                                : filterPeriod === 'year'
                                  ? referenceDate.getFullYear().toString()
                                  : 'All-Time';
                            
                            const opt = {
                              margin: [10, 10, 10, 10],
                              filename: `PL-Statement-${periodLabel.replace(/\s+/g, '-')}.pdf`,
                              image: { type: 'jpeg', quality: 0.98 },
                              html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', scrollY: 0 },
                              jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                            };
                            
                            await (window as any).html2pdf().set(opt).from(element).save();
                            showToast('PDF exported successfully!', 'success');
                            setTimeout(() => setShowPLPreview(false), 1000);
                          } catch (error) {
                            console.error('PDF generation error:', error);
                            showToast('Failed to generate PDF. Please try again.', 'error');
                          }
                          setIsGeneratingPDF(false);
                        }}
                        disabled={isGeneratingPDF}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
                      >
                        <Download className="w-4 h-4" />
                        {isGeneratingPDF ? 'Generating...' : 'Export PDF'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="bg-white dark:bg-slate-900 p-6 rounded-lg border border-slate-200 dark:border-slate-800 shadow-md"><div className="flex items-center gap-2 mb-4 text-emerald-600"><Shield size={20} /><span className="font-bold uppercase tracking-widest text-xs">Tax Shield</span></div><div className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2">{formatCurrency.format(reportData.taxShield)}</div><p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">Your expenses have lowered your estimated tax bill by this amount. Every valid business expense saves you money at tax time.</p></div>
                 
                 <div className="bg-white dark:bg-slate-900 p-6 rounded-lg border border-slate-200 dark:border-slate-800 shadow-md">
                   <div className="flex items-center gap-2 mb-4 text-blue-600">
                     <BookOpen size={20} />
                     <span className="font-bold uppercase tracking-widest text-xs">2026 Standard Deduction</span>
                   </div>
                   
                   {/* Filing Status Dropdown */}
                   <div className="mb-4">
                     <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 block uppercase tracking-wide">Filing Status</label>
                     <select
                       value={settings.filingStatus}
                       onChange={(e) => {
                         const newStatus = e.target.value as FilingStatus;
                         setSettings(prev => ({ ...prev, filingStatus: newStatus }));
                       }}
                       className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
                     >
                       <option value="single">Single</option>
                       <option value="joint">Married Filing Jointly</option>
                       <option value="separate">Married Filing Separately</option>
                       <option value="head">Head of Household</option>
                     </select>
                   </div>
                   
                   {/* Deduction Amount */}
                   <div className="mb-3">
                     <div className="text-3xl font-extrabold text-slate-900 dark:text-white">
                       {(() => {
                         if (settings.filingStatus === 'joint') return formatCurrency.format(TAX_PLANNER_2026.STD_DEDUCTION_JOINT);
                         if (settings.filingStatus === 'head') return formatCurrency.format(TAX_PLANNER_2026.STD_DEDUCTION_HEAD);
                         return formatCurrency.format(TAX_PLANNER_2026.STD_DEDUCTION_SINGLE);
                       })()}
                     </div>
                   </div>
                   
                   <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                     Compare your personal itemized deductions against this standard amount. This affects your personal income tax, not SE tax.
                   </p>
                 </div>
              </div>
           </div>
        )}

        {currentPage === Page.Settings && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 pb-24">
            {/* Settings Header */}
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <Settings size={24} strokeWidth={1.5} />
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white font-brand">Settings</h2>
            </div>
            
            {/* Tab Navigation */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2 shadow-sm">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <button
                  onClick={() => setSettingsTab('backup')}
                  className={`flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 px-3 md:px-4 py-3 rounded-lg font-bold text-xs md:text-sm uppercase tracking-wide transition-all ${
                    settingsTab === 'backup'
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <Shield size={18} />
                  <span className="text-[10px] md:text-sm mt-0.5 md:mt-0">Backup</span>
                </button>
                
                <button
                  onClick={() => setSettingsTab('branding')}
                  className={`flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 px-3 md:px-4 py-3 rounded-lg font-bold text-xs md:text-sm uppercase tracking-wide transition-all ${
                    settingsTab === 'branding'
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <Palette size={18} />
                  <span className="text-[10px] md:text-sm mt-0.5 md:mt-0">Branding</span>
                </button>
                
                <button
                  onClick={() => setSettingsTab('tax')}
                  className={`flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 px-3 md:px-4 py-3 rounded-lg font-bold text-xs md:text-sm uppercase tracking-wide transition-all ${
                    settingsTab === 'tax'
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <Calculator size={18} />
                  <span className="text-[10px] md:text-sm mt-0.5 md:mt-0">Tax</span>
                </button>
                
                <button
                  onClick={() => setSettingsTab('data')}
                  className={`flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 px-3 md:px-4 py-3 rounded-lg font-bold text-xs md:text-sm uppercase tracking-wide transition-all ${
                    settingsTab === 'data'
                      ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <Trash2 size={18} />
                  <span className="text-[10px] md:text-sm mt-0.5 md:mt-0">Data</span>
                </button>
              </div>
            </div>

            {/* Tab Content */}
            <div className="space-y-6">
              
              {/* Backup & Restore Tab */}
              {settingsTab === 'backup' && (
                <div className="bg-white dark:bg-slate-900 p-8 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                      <Shield size={20} strokeWidth={2} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Backup & Restore</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                      <button 
                          onClick={handleExportBackup} 
                          className="flex items-center justify-center gap-3 py-5 rounded-lg bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all font-bold text-sm uppercase tracking-wider active:scale-95"
                      >
                          <Download size={20} /> Export Backup
                      </button>
                      <button 
                          onClick={() => fileInputRef.current?.click()} 
                          className="flex items-center justify-center gap-3 py-5 rounded-lg bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all font-bold text-sm uppercase tracking-wider active:scale-95"
                      >
                          <Upload size={20} /> Import Backup
                      </button>
                      <input 
                          type="file" 
                          ref={fileInputRef} 
                          onChange={handleImportBackup} 
                          className="hidden" 
                          accept=".json" 
                      />
                  </div>
                  
                  <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-amber-900 dark:text-amber-100">
                        <p className="font-semibold mb-1">Important Information</p>
                        <p>Save a complete copy of your data to your device. You can restore it later if needed.</p>
                        <p className="mt-2 text-amber-700 dark:text-amber-300 font-bold">⚠️ Warning: Importing a backup will overwrite all current data.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Branding & Customization Tab */}
              {settingsTab === 'branding' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                  <div className="bg-white dark:bg-slate-900 p-8 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                        <Palette size={20} strokeWidth={2} />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white">Branding & Customization</h3>
                    </div>
                    
                    <div className="mb-8">
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-300 mb-3 block">Business Logo</label>
                        <div className="flex items-start gap-6">
                            <div className="w-24 h-24 bg-white dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex items-center justify-center overflow-hidden relative group">
                                {settings.businessLogo ? (<><img src={settings.businessLogo} alt="Logo" className="w-full h-full object-contain p-2" /><div className="absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity"><button onClick={() => setSettings(s => ({ ...s, businessLogo: undefined }))} className="text-white bg-red-500 p-1.5 rounded-full hover:bg-red-600"><Trash2 size={14} /></button></div></>) : <ImageIcon className="text-slate-300 dark:text-slate-600" size={32} />}
                            </div>
                            <div className="flex-1"><input type="file" ref={logoInputRef} className="hidden" accept="image/png, image/jpeg, image/svg+xml" onChange={handleLogoUpload} /><button onClick={() => logoInputRef.current?.click()} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors mb-2"><Upload size={14} /> Upload Logo</button><p className="text-xs text-slate-500 dark:text-slate-400">Recommended: PNG with transparent background. Max 2MB.</p></div>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between"><span className="text-sm font-bold text-slate-700 dark:text-slate-300">Show Logo on Invoice</span><button onClick={() => setSettings(s => ({ ...s, showLogoOnInvoice: !s.showLogoOnInvoice }))} className={`w-12 h-6 rounded-full p-1 transition-colors ${settings.showLogoOnInvoice ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}><div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${settings.showLogoOnInvoice ? 'translate-x-6' : 'translate-x-0'}`} /></button></div>
                            <div><label className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-300 mb-2 block">Logo Alignment</label><div className="flex bg-slate-200 dark:bg-slate-900 p-1 rounded-lg"><button onClick={() => setSettings(s => ({ ...s, logoAlignment: 'left' }))} className={`flex-1 py-1.5 flex items-center justify-center gap-2 rounded-md transition-all ${settings.logoAlignment === 'left' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}><AlignLeft size={16} /> <span className="text-[10px] font-bold uppercase">Left</span></button><button onClick={() => setSettings(s => ({ ...s, logoAlignment: 'center' }))} className={`flex-1 py-1.5 flex items-center justify-center gap-2 rounded-md transition-all ${settings.logoAlignment === 'center' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}><AlignCenter size={16} /> <span className="text-[10px] font-bold uppercase">Center</span></button></div></div>
                        </div>
                        <div><label className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-300 mb-3 block">Brand Accent Color</label><div className="flex flex-wrap gap-3">{['#2563eb', '#4f46e5', '#9333ea', '#059669', '#dc2626', '#0f172a'].map(color => (<button key={color} onClick={() => setSettings(s => ({ ...s, brandColor: color }))} className={`w-10 h-10 rounded-lg shadow-sm transition-transform hover:scale-110 flex items-center justify-center ${settings.brandColor === color ? 'ring-2 ring-offset-2 ring-offset-slate-50 dark:ring-offset-slate-900 ring-slate-400' : ''}`} style={{ backgroundColor: color }}>{settings.brandColor === color && <CheckCircle size={16} className="text-white" strokeWidth={3} />}</button>))}</div><p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Used for invoice headings and highlights.</p></div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div><label className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-300 mb-3 block">Business Name</label><input type="text" value={settings.businessName} onChange={e => setSettings(s => ({ ...s, businessName: e.target.value }))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-5 py-4 font-bold text-lg text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/20 transition-all" /></div>
                        <div><label className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-300 mb-3 block">Owner Name</label><input type="text" value={settings.ownerName} onChange={e => setSettings(s => ({ ...s, ownerName: e.target.value }))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-5 py-4 font-bold text-lg text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/20 transition-all" /></div>
                    </div>

                    <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-6 bg-slate-50/50 dark:bg-slate-900/50">
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4">Invoice Contact Details</h4>
                        <div className="space-y-4">
                            <div><label className="text-xs font-bold text-slate-500 dark:text-slate-300 mb-1 block">Address</label><input type="text" value={settings.businessAddress || ''} onChange={e => setSettings(s => ({ ...s, businessAddress: e.target.value }))} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-sm font-medium outline-none focus:ring-1 focus:ring-purple-500" placeholder="123 Main St, City, State, Zip" /></div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-slate-500 dark:text-slate-300 mb-1 block">Email</label><input type="email" value={settings.businessEmail || ''} onChange={e => setSettings(s => ({ ...s, businessEmail: e.target.value }))} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-sm font-medium outline-none focus:ring-1 focus:ring-purple-500" placeholder="contact@business.com" /></div>
                                <div><label className="text-xs font-bold text-slate-500 dark:text-slate-300 mb-1 block">Phone</label><input type="tel" value={settings.businessPhone || ''} onChange={e => setSettings(s => ({ ...s, businessPhone: e.target.value }))} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-sm font-medium outline-none focus:ring-1 focus:ring-purple-500" placeholder="(555) 123-4567" /></div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-slate-500 dark:text-slate-300 mb-1 block">Website</label><input type="text" value={settings.businessWebsite || ''} onChange={e => setSettings(s => ({ ...s, businessWebsite: e.target.value }))} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-sm font-medium outline-none focus:ring-1 focus:ring-purple-500" placeholder="www.yourbusiness.com" /></div>
                                <div><label className="text-xs font-bold text-slate-500 dark:text-slate-300 mb-1 block">Tax ID / VAT (Optional)</label><input type="text" value={settings.businessTaxId || ''} onChange={e => setSettings(s => ({ ...s, businessTaxId: e.target.value }))} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-sm font-medium outline-none focus:ring-1 focus:ring-purple-500" placeholder="XX-XXXXXXX" /></div>
                            </div>
                        </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Tax Configuration Tab */}
              {settingsTab === 'tax' && (
                <div className="bg-white dark:bg-slate-900 p-8 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <Calculator size={20} strokeWidth={2} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Tax Configuration</h3>
                  </div>
                  
                 <label className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-300 mb-3 block">How do you want to estimate your income tax?</label>
                 <div className="flex bg-slate-200 dark:bg-slate-900 p-1 rounded-lg mb-6">
                    {(['preset', 'lastYear', 'custom'] as TaxEstimationMethod[]).map(method => (
                      <button key={method} onClick={() => setSettings(s => ({ ...s, taxEstimationMethod: method }))} className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${settings.taxEstimationMethod === method ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-200'}`}>{method === 'preset' ? 'Quick Preset' : method === 'lastYear' ? 'Use Last Year' : 'Custom %'}</button>
                    ))}
                 </div>
                 
                 <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-6 mb-6">
                    {settings.taxEstimationMethod === 'preset' && (
                       <div className="space-y-4 animate-in fade-in zoom-in-95">
                          <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">Select a rough estimate based on typical self-employed brackets. This is for planning only.</p>
                          <div className="grid grid-cols-3 gap-3">
                             {[10, 15, 20].map(rate => (
                               <button key={rate} onClick={() => setSettings(s => ({ ...s, taxRate: rate }))} className={`py-6 rounded-lg border-2 transition-all flex flex-col items-center justify-center ${settings.taxRate === rate ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 shadow-lg' : 'border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700'}`}><span className="text-3xl font-extrabold">{rate}%</span><span className="text-xs mt-1 font-medium">Federal</span></button>
                             ))}
                          </div>
                       </div>
                    )}
                    {settings.taxEstimationMethod === 'lastYear' && (
                       <div className="space-y-4 animate-in fade-in zoom-in-95">
                          <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">Enter values from last year's tax return to calculate your effective rate.</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                             <div><label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-300 mb-2 block">Net Profit (Last Year)</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-300 font-bold">$</span><input type="number" placeholder="0.00" value={lastYearCalc.profit} onChange={e => setLastYearCalc(p => ({...p, profit: e.target.value}))} className="w-full pl-8 pr-3 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20"/></div></div>
                             <div><label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-300 mb-2 block">Fed. Income Tax Paid</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-300 font-bold">$</span><input type="number" placeholder="0.00" value={lastYearCalc.tax} onChange={e => setLastYearCalc(p => ({...p, tax: e.target.value}))} className="w-full pl-8 pr-3 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20"/></div></div>
                          </div>
                          <button onClick={() => { const profit = Number(lastYearCalc.profit); const tax = Number(lastYearCalc.tax); if (profit > 0 && tax >= 0) { const rate = Math.min(40, Math.max(0, (tax / profit) * 100)); setSettings(s => ({ ...s, taxRate: Number(rate.toFixed(1)) })); showToast(`Rate set to ${rate.toFixed(1)}%`, 'success'); } else { showToast("Please enter valid profit amount", "error"); } }} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm uppercase tracking-widest rounded-lg transition-all active:scale-95">Calculate & Apply Rate</button>
                       </div>
                    )}
                    {settings.taxEstimationMethod === 'custom' && (
                       <div className="space-y-4 animate-in fade-in zoom-in-95">
                          <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">Manually enter your estimated effective federal income tax rate.</p>
                          <div><label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-300 mb-2 block">Federal Effective Rate</label><div className="relative"><input type="number" value={settings.taxRate} onChange={e => setSettings(s => ({ ...s, taxRate: Math.min(100, Math.max(0, Number(e.target.value))) }))} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-3 pr-12 font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"/><span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-300 font-bold"><Percent size={18} /></span></div></div>
                       </div>
                    )}
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div><label className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-300 mb-2 block">State Tax (Optional)</label><div className="relative"><input type="number" value={settings.stateTaxRate} onChange={e => setSettings(s => ({ ...s, stateTaxRate: Math.min(100, Math.max(0, Number(e.target.value))) }))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-3 pr-10 font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"/><span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-300 font-bold">%</span></div></div>
                    <div><label className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-300 mb-2 block">Filing Status</label><select value={settings.filingStatus} onChange={e => setSettings(s => ({ ...s, filingStatus: e.target.value as FilingStatus }))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-3 font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all appearance-none"><option value="single">Single</option><option value="joint">Married Filing Jointly</option><option value="separate">Married Filing Separately</option><option value="head">Head of Household</option></select></div>
                 </div>
                 
                 <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-lg p-6">
                    <h5 className="text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-4 uppercase tracking-wider">Current Estimate Summary</h5>
                    <div className="flex flex-col gap-3 text-sm">
                       <div className="flex justify-between items-center"><span className="text-emerald-700 dark:text-emerald-300">Federal Income Tax (Effective)</span><span className="font-bold text-emerald-900 dark:text-emerald-100 text-lg">{settings.taxRate}%</span></div>
                       <div className="flex justify-between items-center"><span className="text-emerald-700 dark:text-emerald-300">State Tax (Optional)</span><span className="font-bold text-emerald-900 dark:text-emerald-100 text-lg">{settings.stateTaxRate}%</span></div>
                       <div className="flex justify-between items-center"><span className="text-emerald-700 dark:text-emerald-300 flex items-center gap-1">Self-Employment Tax <HelpCircle size={14} className="cursor-help" title="Social Security (12.4%) + Medicare (2.9%)" /></span><span className="font-bold text-emerald-900 dark:text-emerald-100 text-lg">~15.3%</span></div>
                       <div className="h-px bg-emerald-200 dark:bg-emerald-800 my-1" />
                       <div className="flex justify-between items-center bg-emerald-100 dark:bg-emerald-900/20 -mx-2 px-2 py-2 rounded"><span className="font-bold uppercase text-xs tracking-wider text-emerald-900 dark:text-emerald-100">Combined Planning Rate</span><span className="font-extrabold text-2xl text-emerald-900 dark:text-emerald-100">{(settings.taxRate + settings.stateTaxRate + 15.3).toFixed(1)}%</span></div>
                    </div>
                 </div>
                </div>
              )}

              {/* Data Management Tab */}
              {settingsTab === 'data' && (
                <div className="bg-white dark:bg-slate-900 p-8 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center">
                      <Trash2 size={20} strokeWidth={2} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Data Management</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                      <button onClick={handleSeedDemoData} className="py-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/30 dark:hover:to-indigo-900/30 border-2 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100 rounded-lg text-sm font-bold uppercase tracking-widest shadow-lg transition-all flex flex-col items-center justify-center gap-3 active:scale-95">
                        {seedSuccess ? <CheckCircle size={24} /> : <Sparkles size={24} />}
                        <span>{seedSuccess ? 'Demo Data Loaded' : 'Load Demo Data'}</span>
                      </button>
                      <button onClick={handleClearData} className="py-6 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 hover:from-red-100 hover:to-orange-100 dark:hover:from-red-900/30 dark:hover:to-orange-900/30 border-2 border-red-200 dark:border-red-800 text-red-900 dark:text-red-100 rounded-lg text-sm font-bold uppercase tracking-widest shadow-lg transition-all flex flex-col items-center justify-center gap-3 active:scale-95">
                        <AlertTriangle size={24} />
                        <span>Reset & Clear All</span>
                      </button>
                  </div>
                  
                  <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-red-900 dark:text-red-100">
                        <p className="font-semibold mb-1">⚠️ Warning: Destructive Actions</p>
                        <p className="mb-2"><strong>Load Demo Data:</strong> Adds sample transactions, invoices, and tax payments to help you explore the app's features.</p>
                        <p><strong>Reset & Clear All:</strong> Permanently deletes ALL your data including transactions, invoices, tax payments, and custom categories. This action cannot be undone!</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {/* Safety net: never allow navigation to render a blank screen */}
        {!([
          Page.Dashboard,
          Page.Invoices,
          Page.Invoice,
          Page.AllTransactions,
          Page.Ledger,
          Page.Income,
          Page.Expenses,
          Page.Clients,
          Page.Reports,
          Page.Settings,
          Page.InvoiceDoc,
        ] as const).includes(currentPage) && (
          <div className="px-4 sm:px-6 pt-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-sm font-semibold text-slate-900">Navigation error</div>
              <div className="mt-1 text-sm text-slate-600">
                We couldn&apos;t load this screen. Tap a tab below to continue.
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => setCurrentPage(Page.Dashboard)}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                >
                  Home
                </button>
                <button
                  onClick={() => setCurrentPage(Page.Invoices)}
                  className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900"
                >
                  Invoices
                </button>
                <button
                  onClick={() => setCurrentPage(Page.AllTransactions)}
                  className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900"
                >
                  Ledger
                </button>
                <button
                  onClick={() => setCurrentPage(Page.Clients)}
                  className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900"
                >
                  Clients
                </button>
                <button
                  onClick={() => setCurrentPage(Page.Reports)}
                  className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900"
                >
                  Reports
                </button>
              </div>
            </div>
          </div>
        )}

      </PageErrorBoundary>

      </main>

      <div className="no-print fixed bottom-3 left-1/2 -translate-x-1/2 w-[94%] max-w-2xl z-[55]">
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl text-slate-900 dark:text-white rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-2 flex justify-between items-center relative">
            <button onClick={() => setCurrentPage(Page.Dashboard)} className={`flex-1 flex flex-col items-center justify-center py-2 rounded-xl transition-all active:scale-95 ${currentPage === Page.Dashboard ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'}`}><LayoutGrid size={22} strokeWidth={currentPage === Page.Dashboard ? 2.5 : 2} /><span className="text-xs font-bold mt-1">Home</span></button>
            <button onClick={() => setCurrentPage(Page.Invoices)} className={`flex-1 flex flex-col items-center justify-center py-2 rounded-xl transition-all active:scale-95 ${(currentPage === Page.Invoices || currentPage === Page.Invoice) ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'}`}><FileText size={22} strokeWidth={(currentPage === Page.Invoices || currentPage === Page.Invoice) ? 2.5 : 2} /><span className="text-xs font-bold mt-1">Invoice</span></button>
            <div className="mx-2 -mt-8"><button onClick={() => handleOpenFAB((currentPage === Page.Invoices || currentPage === Page.Invoice) ? 'billing' : 'income')} className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-full flex items-center justify-center shadow-xl shadow-blue-600/40 transition-transform active:scale-95 border-[4px] border-slatebg dark:border-slate-950"><Plus size={32} strokeWidth={3} /></button></div>
            <button onClick={() => setCurrentPage(Page.AllTransactions)} className={`flex-1 flex flex-col items-center justify-center py-2 rounded-xl transition-all active:scale-95 ${(currentPage === Page.AllTransactions || currentPage === Page.Ledger) ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'}`}><History size={22} strokeWidth={(currentPage === Page.AllTransactions || currentPage === Page.Ledger) ? 2.5 : 2} /><span className="text-xs font-bold mt-1">Ledger</span></button>
            <button onClick={() => setCurrentPage(Page.Clients)} className={`flex-1 flex flex-col items-center justify-center py-2 rounded-xl transition-all active:scale-95 ${currentPage === Page.Clients ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'}`}><Users size={22} strokeWidth={currentPage === Page.Clients ? 2.5 : 2} /><span className="text-xs font-bold mt-1">Clients</span></button>
            <button onClick={() => setCurrentPage(Page.Reports)} className={`flex-1 flex flex-col items-center justify-center py-2 rounded-xl transition-all active:scale-95 ${currentPage === Page.Reports ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'}`}><BarChart3 size={22} strokeWidth={currentPage === Page.Reports ? 2.5 : 2} /><span className="text-xs font-bold mt-1">Reports</span></button>
        </div>
      </div>
      

      {/* Insights Modal */}
      {showInsights && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-5xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <InsightsDashboard
              transactions={transactions}
              invoices={invoices}
              taxPayments={taxPayments}
              settings={settings}
              onClose={() => setShowInsights(false)}
            />
          </div>
        </div>
      )}

      <Drawer
         isOpen={isDrawerOpen}
         onClose={() => setIsDrawerOpen(false)}
         title={
            drawerMode === 'tax_payments' ? 'Tax Payments' :
            drawerMode === 'create_cat' ? 'New Category' :
            drawerMode === 'add' ? (activeTab === 'billing' ? (billingDocType === 'estimate' ? 'New Estimate' : 'New Invoice') : activeTab === 'income' ? 'Add Income' : 'Add Expense') : 
            drawerMode === 'edit_tx' ? 'Edit Transaction' : 
            'Edit Invoice'
         }
      >
         {drawerMode === 'tax_payments' ? (
             <div className="space-y-6">
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-lg border border-slate-100 dark:border-slate-800">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-wider">Log New Payment</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <DateInput label="Date" value={activeTaxPayment.date || ''} onChange={v => setActiveTaxPayment(p => ({...p, date: v}))} />
                        <div><label className="text-xs font-bold text-slate-500 dark:text-slate-300 mb-2 block pl-1 uppercase tracking-wider">Amount</label><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-300 font-bold">{settings.currencySymbol}</span><input type="number" value={activeTaxPayment.amount || ''} onChange={e => setActiveTaxPayment(p => ({...p, amount: Number(e.target.value)}))} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-0 rounded-lg pl-10 pr-4 py-4 font-bold text-lg outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="0.00" /></div></div>
                    </div>
                    <div className="mb-4"><label className="text-xs font-bold text-slate-500 dark:text-slate-300 mb-2 block pl-1 uppercase tracking-wider">Payment Type</label><div className="flex bg-slate-200 dark:bg-slate-900 p-1 rounded-lg">{['Estimated', 'Annual', 'Other'].map(type => (<button key={type} onClick={() => setActiveTaxPayment(p => ({...p, type: type as any}))} className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${activeTaxPayment.type === type ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'}`}>{type}</button>))}</div></div>
                    <button onClick={saveTaxPayment} className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg shadow-blue-500/20 uppercase tracking-widest transition-all active:scale-95">Record Payment</button>
                </div>
                <div><h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 pl-1">Payment History</h4>{taxPayments.length === 0 ? (<div className="text-center py-8 text-slate-400 italic text-sm">No payments recorded yet.</div>) : (<div className="space-y-3">{taxPayments.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(p => (<div key={p.id} className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center"><CheckCircle size={18} /></div><div><div className="font-bold text-slate-900 dark:text-white">{p.type} Tax</div><div className="text-xs text-slate-500">{p.date}</div></div></div><div className="text-right"><div className="font-bold text-slate-900 dark:text-white">{formatCurrency.format(p.amount)}</div><button onClick={() => deleteTaxPayment(p.id)} className="text-xs text-red-500 hover:text-red-600 mt-1 font-bold">DELETE</button></div></div>))}</div>)}</div>
             </div>
         ) : drawerMode === 'create_cat' ? (
             <div className="space-y-6">
                 <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-lg border border-slate-100 dark:border-slate-800">
                     <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-wider">Create {activeTab === 'billing' ? 'Invoice' : activeTab === 'income' ? 'Income' : 'Expense'} Category</h4>
                     <div className="mb-6"><label className="text-xs font-bold text-slate-500 dark:text-slate-300 mb-2 block pl-1 uppercase tracking-wider">Category Name</label><input type="text" autoFocus value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-4 font-bold text-lg outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-700" placeholder="e.g. Project Supplies" /><p className="text-xs text-slate-400 mt-2 pl-1">This will be available for future {activeTab} entries.</p></div>
                     <div className="flex gap-3"><button onClick={() => setDrawerMode(previousDrawerMode.current)} className="flex-1 py-4 font-bold text-slate-600 dark:text-slate-300 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-lg transition-colors">Cancel</button><button onClick={saveNewCategory} className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg shadow-blue-500/20 uppercase tracking-widest transition-all active:scale-95">Save Category</button></div>
                 </div>
             </div>
         ) : (
            <div className="space-y-6">
                {drawerMode === 'add' && (
                    <div className="flex bg-slate-200 dark:bg-slate-900 p-1 rounded-lg mb-4">
                        <button onClick={() => { setActiveTab('income'); resetActiveItem('income'); setCategorySearch(''); }} className={`flex-1 py-3 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'income' ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-600 dark:text-slate-300'}`}>Income</button>
                        <button onClick={() => { setActiveTab('expense'); resetActiveItem('expense'); setCategorySearch(''); }} className={`flex-1 py-3 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'expense' ? 'bg-white dark:bg-slate-800 text-red-600 dark:text-red-400 shadow-sm' : 'text-slate-600 dark:text-slate-300'}`}>Expense</button>
                        <button onClick={() => { setActiveTab('billing'); resetActiveItem('billing'); setCategorySearch(''); }} className={`flex-1 py-3 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'billing' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-300'}`}>{billingDocType === 'estimate' ? 'Estimate' : 'Invoice'}</button>
                    </div>
                )}

                {drawerMode === 'edit_inv' && activeItem.id && (
                    <div className="bg-slate-100 dark:bg-slate-800/50 p-2 rounded-lg mb-4 border border-slate-200 dark:border-slate-700">
                        <div className="grid grid-cols-3 gap-2 mb-2">
                            <button type="button" onClick={billingDocType === 'estimate' ? handleDirectExportEstimatePDF : handleDirectExportPDF} disabled={billingDocType === 'estimate' ? isGeneratingEstimatePdf : isGeneratingPdf} className={`py-2.5 flex flex-col items-center justify-center gap-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition-all ${(billingDocType === 'estimate' ? isGeneratingEstimatePdf : isGeneratingPdf) ? 'opacity-70 cursor-wait' : ''}`}>{(billingDocType === 'estimate' ? isGeneratingEstimatePdf : isGeneratingPdf) ? <Loader2 size={18} className="animate-spin text-blue-600" /> : <Download size={18} />}<span className="text-[10px] font-bold uppercase tracking-wider">{(billingDocType === 'estimate' ? isGeneratingEstimatePdf : isGeneratingPdf) ? 'Generating...' : 'Export PDF'}</span></button>
                            <button type="button" onClick={() => (billingDocType === 'estimate' ? duplicateEstimate(activeItem as any) : duplicateInvoice(activeItem as Invoice))} className="py-2.5 flex flex-col items-center justify-center gap-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 shadow-sm transition-all"><Copy size={18} /><span className="text-[10px] font-bold uppercase tracking-wider">Duplicate</span></button>
                            <button type="button" onClick={() => (billingDocType === 'estimate' ? null : openBatchDuplicate(activeItem as Invoice))} disabled={billingDocType === 'estimate'} className={`py-2.5 flex flex-col items-center justify-center gap-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 shadow-sm transition-all ${billingDocType === 'estimate' ? 'opacity-50 cursor-not-allowed' : ''}`}><Repeat size={18} /><span className="text-[10px] font-bold uppercase tracking-wider">Batch</span></button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {billingDocType !== 'estimate' ? (
                              <button type="button" onClick={() => toggleInvoicePaidStatus(activeItem)} disabled={activeItem.status === 'void'} className={`py-2.5 flex flex-col items-center justify-center gap-1 rounded-md border shadow-sm transition-all ${activeItem.status === 'void' ? 'opacity-50 cursor-not-allowed bg-slate-200 dark:bg-slate-800 text-slate-500' : activeItem.status === 'paid' ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400 hover:bg-orange-100' : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100'}`}>{activeItem.status === 'paid' ? <X size={18} /> : <CheckCircle size={18} />}<span className="text-[10px] font-bold uppercase tracking-wider">{activeItem.status === 'paid' ? 'Mark Unpaid' : 'Mark Paid'}</span></button>
                            ) : (
                              <div className="py-2.5 flex flex-col items-center justify-center gap-1 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-500">
                                <span className="text-[10px] font-bold uppercase tracking-wider">No payment status</span>
                              </div>
                            )}
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); billingDocType === 'estimate' ? deleteEstimate(activeItem as any) : setInvoiceToDelete(activeItem.id!); }} className="py-2.5 flex flex-col items-center justify-center gap-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 shadow-sm transition-all"><Trash2 size={18} /><span className="text-[10px] font-bold uppercase tracking-wider">Delete</span></button>
                        </div>
                    </div>
                )}

                {activeTab === 'billing' ? (
                   <div className="space-y-4">
                      <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border border-slate-100 dark:border-slate-800">
                          <h4 className="text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider mb-3">Client Details</h4>
                          <div className="space-y-3">
                              <div>
                                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-300 mb-1 block pl-1 uppercase tracking-wider">Select Client</label>
                                <select value={(activeItem as any).clientId || ''} onChange={e => { const id = e.target.value; setActiveItem(p => ({ ...p, clientId: id || undefined })); if (id) fillDocFromClient(id); }} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-3 font-bold text-sm outline-none focus:ring-1 focus:ring-blue-500">
                                  <option value="">New / Not selected</option>
                                  {clients.map(c => (<option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ''}{c.status === 'lead' ? ' (Lead)' : ''}</option>))}
                                </select>
                              </div>
                              <input type="text" value={activeItem.client || ''} onChange={e => setActiveItem(prev => ({ ...prev, client: e.target.value }))} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-3 font-bold text-base outline-none focus:ring-1 focus:ring-blue-500" placeholder="Client Name (Required)" />
                              <input type="text" value={activeItem.clientCompany || ''} onChange={e => setActiveItem(prev => ({ ...prev, clientCompany: e.target.value }))} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500" placeholder="Company Name (Optional)" />
                              <input type="email" value={activeItem.clientEmail || ''} onChange={e => setActiveItem(prev => ({ ...prev, clientEmail: e.target.value }))} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500" placeholder="Client Email (Optional)" />
                              <input type="text" value={activeItem.clientAddress || ''} onChange={e => setActiveItem(prev => ({ ...prev, clientAddress: e.target.value }))} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500" placeholder="Client Address (Optional)" />
                          </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><DateInput label="Date" value={activeItem.date || ''} onChange={v => setActiveItem(prev => ({ ...prev, date: v }))} /><DateInput label={billingDocType === 'estimate' ? "Valid Until" : "Due Date"} value={(billingDocType === 'estimate' ? (activeItem.validUntil as any) : activeItem.due) || ''} onChange={v => setActiveItem(prev => billingDocType === 'estimate' ? ({ ...prev, validUntil: v }) : ({ ...prev, due: v }))} /></div>
                      <div className="bg-slate-50 dark:bg-slate-900 p-1 rounded-lg border border-slate-100 dark:border-slate-800">
                          <div className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-slate-800"><h4 className="text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider">Line Items</h4><button onClick={addInvoiceItem} className="text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline"><PlusCircle size={14}/> Add Item</button></div>
                          <div className="p-2 space-y-2">{(activeItem.items || []).map((item, idx) => (<div key={item.id} className="flex gap-2 items-start animate-in fade-in slide-in-from-left-2"><div className="flex-1 space-y-2"><input type="text" value={item.description} onChange={(e) => updateInvoiceItem(item.id, 'description', e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500" placeholder="Description" /><div className="flex gap-2"><div className="relative w-20"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-300 text-xs">Qty</span><input type="number" value={item.quantity || ''} onChange={(e) => updateInvoiceItem(item.id, 'quantity', Number(e.target.value))} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded pl-8 pr-2 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500 text-center" placeholder="0"/></div><div className="relative flex-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-300 text-xs">$</span><input type="number" value={item.rate || ''} onChange={(e) => updateInvoiceItem(item.id, 'rate', Number(e.target.value))} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded pl-6 pr-2 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500" placeholder="0.00" /></div></div></div><div className="pt-2"><button onClick={() => removeInvoiceItem(item.id)} className="text-slate-400 hover:text-red-500 p-1"><MinusCircle size={18} /></button></div></div>))}{(activeItem.items || []).length === 0 && <div className="text-center py-4 text-xs text-slate-400 italic">No items added. Add at least one item.</div>}</div>
                          <div className="p-3 bg-slate-100 dark:bg-slate-900/50 rounded-b-lg space-y-2">
                              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300"><span>Subtotal</span><span>{formatCurrency.format(activeInvoiceTotals.subtotal)}</span></div>
                              <div className="flex items-center justify-between gap-4"><label className="text-xs text-slate-600 dark:text-slate-300">Discount</label><div className="relative w-24"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-300 text-xs">$</span><input type="number" value={activeItem.discount || ''} onChange={e => setActiveItem(p => ({...p, discount: Number(e.target.value)}))} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded py-1 pl-5 pr-1 text-xs text-right outline-none" placeholder="0" /></div></div>
                              <div className="flex items-center justify-between gap-4"><label className="text-xs text-slate-600 dark:text-slate-300">Tax Rate</label><div className="relative w-24"><input type="number" value={activeItem.taxRate || ''} onChange={e => setActiveItem(p => ({...p, taxRate: Number(e.target.value)}))} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded py-1 pl-1 pr-5 text-xs text-right outline-none" placeholder="0" /><span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-300 text-xs">%</span></div></div>
                              <div className="flex items-center justify-between gap-4"><label className="text-xs text-slate-600 dark:text-slate-300">Shipping</label><div className="relative w-24"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-300 text-xs">$</span><input type="number" value={activeItem.shipping || ''} onChange={e => setActiveItem(p => ({...p, shipping: Number(e.target.value)}))} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded py-1 pl-5 pr-1 text-xs text-right outline-none" placeholder="0" /></div></div>
                              <div className="flex justify-between text-sm font-bold pt-2 border-t border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"><span>Total Due</span><span>{formatCurrency.format(activeInvoiceTotals.total)}</span></div>
                          </div>
                      </div>
                      <div className="space-y-4">
                          <div><label className="text-xs font-bold text-slate-500 dark:text-slate-300 mb-1 block pl-1 uppercase tracking-wider">Internal Category</label>{renderCategoryChips(activeItem.category, (cat) => setActiveItem(prev => ({ ...prev, category: cat })))}</div>
                          <div><label className="text-xs font-bold text-slate-500 dark:text-slate-300 mb-1 block pl-1 uppercase tracking-wider">Notes / Memo</label><textarea value={activeItem.notes || ''} onChange={e => setActiveItem(prev => ({ ...prev, notes: e.target.value }))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-50 min-h-[60px]" placeholder="Thank you for your business..." /></div>
                          <div><label className="text-xs font-bold text-slate-500 dark:text-slate-300 mb-1 block pl-1 uppercase tracking-wider">Terms</label><textarea value={activeItem.terms || ''} onChange={e => setActiveItem(prev => ({ ...prev, terms: e.target.value }))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500 min-h-[60px]" placeholder="Net 30. Late fees apply..." /></div>
                      </div>
                      <button onClick={() => (billingDocType === 'estimate' ? saveEstimate(activeItem) : saveInvoice(activeItem))} className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg shadow-blue-500/20 uppercase tracking-widest transition-all active:scale-95">Save {billingDocType === 'estimate' ? 'Estimate' : 'Invoice'}</button>
                   </div>
                ) : (
                   <div className="space-y-4">
                      {drawerMode === 'edit_tx' && activeItem.id && (
                        <div className="bg-slate-100 dark:bg-slate-800/50 p-2 rounded-lg mb-2 border border-slate-200 dark:border-slate-700">
                          <div className="grid grid-cols-3 gap-2 mb-2">
                            <button type="button" onClick={() => duplicateTransaction(activeItem as Transaction)} className="py-2.5 flex flex-col items-center justify-center gap-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 shadow-sm transition-all">
                              <Copy size={18} />
                              <span className="text-[10px] font-bold uppercase tracking-wider">Duplicate</span>
                            </button>
                            <button type="button" onClick={() => openBatchDuplicate(activeItem as Transaction)} className={`py-2.5 flex flex-col items-center justify-center gap-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 shadow-sm transition-all ${billingDocType === 'estimate' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                              <Repeat size={18} />
                              <span className="text-[10px] font-bold uppercase tracking-wider">Batch</span>
                            </button>
                            <button type="button" onClick={() => openRecurringSetup(activeItem as Transaction)} className="py-2.5 flex flex-col items-center justify-center gap-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 shadow-sm transition-all">
                              <Calendar size={18} />
                              <span className="text-[10px] font-bold uppercase tracking-wider">Recurring</span>
                            </button>
                          </div>
                          <div className="grid grid-cols-1 gap-2">
                            <button type="button" onClick={() => deleteTransaction(activeItem.id)} className="py-2.5 flex flex-col items-center justify-center gap-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 shadow-sm transition-all">
                              <Trash2 size={18} />
                              <span className="text-[10px] font-bold uppercase tracking-wider">Delete</span>
                            </button>
                          </div>
                        </div>
                      )}
                      <div><label className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-2 block pl-1">Description</label><input type="text" value={activeItem.name || ''} onChange={e => setActiveItem(prev => ({ ...prev, name: e.target.value }))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-0 rounded-lg px-4 py-4 font-bold text-lg outline-none focus:ring-2 focus:ring-blue-500/20" placeholder={activeTab === 'income' ? "Client or Source" : "Vendor or Purchase"} /></div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><DateInput label="Date" value={activeItem.date || ''} onChange={v => setActiveItem(prev => ({ ...prev, date: v }))} /><div><label className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-2 block pl-1">Amount</label><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-300 font-bold">{settings.currencySymbol}</span><input type="number" value={activeItem.amount || ''} onChange={e => setActiveItem(prev => ({ ...prev, amount: Number(e.target.value) }))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-0 rounded-lg pl-10 pr-4 py-4 font-bold text-lg outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="0.00" /></div></div></div>
                      <div><label className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-2 block pl-1">Category</label>{renderCategoryChips(activeItem.category, (cat) => setActiveItem(prev => ({ ...prev, category: cat })))}</div>
                      <button onClick={() => saveTransaction(activeItem)} className={`w-full py-4 font-bold rounded-lg shadow-lg uppercase tracking-widest transition-all active:scale-95 text-white ${activeTab === 'income' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20' : 'bg-red-600 hover:bg-red-700 shadow-red-500/20'}`}>Save {activeTab}</button>
                   </div>
                )}
             </div>
         )}
      </Drawer>
      
      

      {/* Client Modal */}
      {isClientModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-lg font-extrabold text-slate-900 dark:text-white">{editingClient.id ? 'Edit Client' : 'New Client'}</div>
                <div className="text-xs text-slate-500">Leads and customers are tied to invoices/estimates.</div>
              </div>
              <button onClick={() => { setIsClientModalOpen(false); setEditingClient({ status: 'lead' }); }} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18} /></button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input value={editingClient.name || ''} onChange={e => setEditingClient(p => ({...p, name: e.target.value}))} placeholder="Client name" className="w-full px-3 py-3 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold" />
                <select value={(editingClient.status as any) || 'lead'} onChange={e => setEditingClient(p => ({...p, status: e.target.value as any}))} className="w-full px-3 py-3 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold">
                  <option value="lead">Lead</option>
                  <option value="client">Client</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <input value={editingClient.company || ''} onChange={e => setEditingClient(p => ({...p, company: e.target.value}))} placeholder="Company (optional)" className="w-full px-3 py-3 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input value={editingClient.email || ''} onChange={e => setEditingClient(p => ({...p, email: e.target.value}))} placeholder="Email (optional)" className="w-full px-3 py-3 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold" />
                <input value={editingClient.phone || ''} onChange={e => setEditingClient(p => ({...p, phone: e.target.value}))} placeholder="Phone (optional)" className="w-full px-3 py-3 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold" />
              </div>
              <input value={editingClient.address || ''} onChange={e => setEditingClient(p => ({...p, address: e.target.value}))} placeholder="Address (optional)" className="w-full px-3 py-3 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold" />
              <textarea value={editingClient.notes || ''} onChange={e => setEditingClient(p => ({...p, notes: e.target.value}))} placeholder="Notes (optional)" className="w-full px-3 py-3 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm min-h-[80px]" />
            </div>

            <div className="flex gap-3 mt-5">
              {editingClient.id && (
                <button
                  onClick={() => {
                    if (!confirm('Delete this client?')) return;
                    setClients(prev => prev.filter(c => c.id !== editingClient.id));
                    setIsClientModalOpen(false);
                    setEditingClient({ status: 'lead' });
                    showToast('Client deleted', 'info');
                  }}
                  className="px-4 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold flex items-center gap-2">
                  <Trash2 size={18}/> Delete
                </button>
              )}
              <button
                onClick={() => {
                  const name = (editingClient.name || '').trim();
                  if (!name) return showToast('Client name is required', 'error');
                  const now = new Date().toISOString();
                  if (editingClient.id) {
                    setClients(prev => prev.map(c => c.id === editingClient.id ? ({
                      ...c,
                      name,
                      company: editingClient.company || '',
                      email: editingClient.email || '',
                      phone: editingClient.phone || '',
                      address: editingClient.address || '',
                      notes: editingClient.notes || '',
                      status: (editingClient.status as any) || 'lead',
                      updatedAt: now,
                    }) : c));
                    showToast('Client updated', 'success');
                  } else {
                    const newClient: Client = {
                      id: generateId('cli'),
                      name,
                      company: editingClient.company || '',
                      email: editingClient.email || '',
                      phone: editingClient.phone || '',
                      address: editingClient.address || '',
                      notes: editingClient.notes || '',
                      status: (editingClient.status as any) || 'lead',
                      createdAt: now,
                      updatedAt: now,
                    };
                    setClients(prev => [newClient, ...prev]);
                    showToast('Client created', 'success');
                  }
                  setIsClientModalOpen(false);
                  setEditingClient({ status: 'lead' });
                }}
                className="flex-1 px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-500/20">
                Save Client
              </button>
            </div>
          </div>
        </div>
      )}

{/* Template Suggestion Modal */}
      {showTemplateSuggestion && templateSuggestionData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-xl p-6 shadow-2xl border border-blue-500/20">
            <div className="flex items-center gap-4 mb-4 text-blue-600 dark:text-blue-400">
              <div className="bg-blue-100 dark:bg-blue-500/10 p-3 rounded-full">
                <Sparkles size={24} strokeWidth={2} />
              </div>
              <h3 className="text-lg sm:text-xl font-bold">Save as Template?</h3>
            </div>
            
            <p className="text-slate-600 dark:text-slate-300 mb-4 font-medium leading-relaxed">
              You've duplicated <span className="font-bold text-slate-900 dark:text-white">"{templateSuggestionData.name}"</span> multiple times.
            </p>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900 dark:text-blue-100">
                  <p className="font-semibold mb-1">Pro tip for future:</p>
                  <p>For truly recurring transactions, try using the <strong>"Batch"</strong> or <strong>"Recurring"</strong> buttons to create multiple entries at once!</p>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={() => setShowTemplateSuggestion(false)} 
                className="flex-1 py-3 font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Not Now
              </button>
              <button 
                onClick={() => {
                  setShowTemplateSuggestion(false);
                  showToast("Tip noted! Check out Batch & Recurring buttons", "success");
                }} 
                className="flex-1 py-3 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-lg shadow-blue-500/20 transition-colors"
              >
                Got It!
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Phase 3: Batch Duplicate Modal */}
      {showBatchDuplicateModal && batchDuplicateData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl p-6 shadow-2xl border border-purple-500/20 my-auto">
            <div className="flex items-center gap-4 mb-4 text-purple-600 dark:text-purple-400">
              <div className="bg-purple-100 dark:bg-purple-500/10 p-3 rounded-full">
                <Repeat size={24} strokeWidth={2} />
              </div>
              <h3 className="text-lg sm:text-xl font-bold">Batch Duplicate</h3>
            </div>
            
            <p className="text-slate-600 dark:text-slate-300 mb-4 font-medium">
              Creating multiple copies of: <span className="font-bold text-slate-900 dark:text-white">{batchDuplicateData.name || (batchDuplicateData as Invoice).client}</span>
            </p>
            
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 mb-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 block uppercase">Quick Presets</label>
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => {
                    const dates: string[] = [];
                    for (let i = 1; i <= 3; i++) {
                      const d = new Date();
                      d.setMonth(d.getMonth() + i);
                      dates.push(d.toISOString().split('T')[0]);
                    }
                    executeBatchDuplicate(dates);
                  }} className="py-2 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors">
                    3 Months
                  </button>
                  <button onClick={() => {
                    const dates: string[] = [];
                    for (let i = 1; i <= 6; i++) {
                      const d = new Date();
                      d.setMonth(d.getMonth() + i);
                      dates.push(d.toISOString().split('T')[0]);
                    }
                    executeBatchDuplicate(dates);
                  }} className="py-2 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors">
                    6 Months
                  </button>
                  <button onClick={() => {
                    const dates: string[] = [];
                    for (let i = 1; i <= 12; i++) {
                      const d = new Date();
                      d.setMonth(d.getMonth() + i);
                      dates.push(d.toISOString().split('T')[0]);
                    }
                    executeBatchDuplicate(dates);
                  }} className="py-2 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors">
                    12 Months
                  </button>
                </div>
              </div>
              
              <div className="text-xs text-slate-500 dark:text-slate-400 italic">
                💡 Each copy will be created for the first day of each month starting next month
              </div>
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setShowBatchDuplicateModal(false);
                  setBatchDuplicateData(null);
                }} 
                className="flex-1 py-3 font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Phase 3: Recurring Transaction Modal */}
      {showRecurringModal && recurringData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl p-6 shadow-2xl border border-emerald-500/20 my-auto">
            <div className="flex items-center gap-4 mb-4 text-emerald-600 dark:text-emerald-400">
              <div className="bg-emerald-100 dark:bg-emerald-500/10 p-3 rounded-full">
                <Calendar size={24} strokeWidth={2} />
              </div>
              <h3 className="text-lg sm:text-xl font-bold">Setup Recurring</h3>
            </div>
            
            <p className="text-slate-600 dark:text-slate-300 mb-4 font-medium">
              Schedule: <span className="font-bold text-slate-900 dark:text-white">{recurringData.name}</span>
            </p>
            
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 mb-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 block uppercase">Frequency</label>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <button onClick={() => setupRecurringTransaction('weekly', 12)} className="py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">
                    <div className="text-sm">Weekly</div>
                    <div className="text-xs text-slate-500 mt-1">Next 12 weeks</div>
                  </button>
                  <button onClick={() => setupRecurringTransaction('biweekly', 12)} className="py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">
                    <div className="text-sm">Bi-weekly</div>
                    <div className="text-xs text-slate-500 mt-1">Next 24 weeks</div>
                  </button>
                  <button onClick={() => setupRecurringTransaction('monthly', 12)} className="py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">
                    <div className="text-sm">Monthly</div>
                    <div className="text-xs text-slate-500 mt-1">Next 12 months</div>
                  </button>
                  <button onClick={() => setupRecurringTransaction('quarterly', 8)} className="py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">
                    <div className="text-sm">Quarterly</div>
                    <div className="text-xs text-slate-500 mt-1">Next 2 years</div>
                  </button>
                </div>
              </div>
              
              <div className="text-xs text-slate-500 dark:text-slate-400 italic">
                💡 All entries will be created immediately. Review them in your ledger.
              </div>
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setShowRecurringModal(false);
                  setRecurringData(null);
                }} 
                className="flex-1 py-3 font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
