import React, { useState, useEffect } from "react";
import { User, Billing, Unit, Settings, FinanceTransaction, Complaint } from "../types";
import { db } from "../db";
import { 
  Droplets, 
  Trash, 
  Wallet, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  History as HistoryIcon,
  Info,
  Calendar,
  TrendingUp,
  TrendingDown,
  PieChart,
  MessageSquare,
  Send,
  Plus
} from "lucide-react";
import { formatCurrency, cn, getMonthName } from "../lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface WargaDashboardProps {
  user: User;
}

export function WargaDashboard({ user }: WargaDashboardProps) {
  const [activeTab, setActiveTab] = useState<"billing" | "finance" | "complaint">("billing");
  const [billing, setBilling] = useState<Billing | null>(null);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [finances, setFinances] = useState<FinanceTransaction[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [showComplaintForm, setShowComplaintForm] = useState(false);
  const [newComplaint, setNewComplaint] = useState({ title: "", description: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    waterBaseRate: 25000,
    waterBaseLimit: 10,
    waterExtraRate: 2500,
    trashRate: 10000,
    dueDay: 10
  });

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const isAfterDue = new Date().getDate() > settings.dueDay;

  useEffect(() => {
    const unsubscribeUnits = db.subscribeUnits((allUnits) => {
      const myUnit = allUnits.find(u => u.ktpNumber === user.username);
      if (myUnit) {
        setUnit(myUnit);
      }
    });

    const unsubscribeBillings = db.subscribeBillings((allBillings) => {
      if (unit) {
        const myBilling = allBillings.find(b => b.unitId === unit.id && b.month === currentMonth && b.year === currentYear);
        setBilling(myBilling || null);
      }
    });

    const unsubscribeSettings = db.subscribeSettings(setSettings);
    const unsubscribeFinances = db.subscribeFinances((data) => {
      setFinances(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    });
    
    const unsubscribeComplaints = db.subscribeComplaints((data) => {
      if (unit) {
        setComplaints(data.filter(c => c.unitId === unit.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      }
    });
    
    return () => {
      unsubscribeUnits();
      unsubscribeBillings();
      unsubscribeSettings();
      unsubscribeFinances();
      unsubscribeComplaints();
    };
  }, [user.username, unit?.id, currentMonth, currentYear]);

  if (!unit) return <div className="p-8 text-center text-gray-500">Data unit tidak ditemukan.</div>;

  const isOverdue = billing?.status === "BELUM_LUNAS" && isAfterDue;

  const handleComplaintSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComplaint.title || !newComplaint.description) return;
    setIsSubmitting(true);

    const complaint: Complaint = {
      id: Math.random().toString(36).substr(2, 9),
      unitId: unit.id,
      floor: unit.floor,
      residentName: unit.residentName,
      title: newComplaint.title,
      description: newComplaint.description,
      status: "PENDING",
      createdAt: new Date().toISOString()
    };

    await db.saveComplaint(complaint);
    setNewComplaint({ title: "", description: "" });
    setShowComplaintForm(false);
    setIsSubmitting(false);
  };

  const totalIncome = finances.filter(f => f.type === "INCOME").reduce((acc, curr) => acc + curr.amount, 0);
  const totalExpense = finances.filter(f => f.type === "EXPENSE").reduce((acc, curr) => acc + curr.amount, 0);
  const balance = totalIncome - totalExpense;

  return (
    <div className="max-w-md mx-auto space-y-6 pb-24">
      <div className="flex items-center gap-3 mb-2">
        <Droplets className="text-blue-600" size={28} />
        <h1 className="text-2xl font-black text-gray-900">PDAM dan Iuran Sampah</h1>
      </div>

      {/* Tab Switcher */}
      <div className="flex bg-gray-100 p-1 rounded-2xl">
        <button
          onClick={() => setActiveTab("billing")}
          className={cn(
            "flex-1 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2",
            activeTab === "billing" ? "bg-white shadow-sm text-blue-600" : "text-gray-500"
          )}
        >
          <Wallet size={16} />
          Tagihan
        </button>
        <button
          onClick={() => setActiveTab("finance")}
          className={cn(
            "flex-1 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2",
            activeTab === "finance" ? "bg-white shadow-sm text-blue-600" : "text-gray-500"
          )}
        >
          <PieChart size={16} />
          Keuangan
        </button>
        <button
          onClick={() => setActiveTab("complaint")}
          className={cn(
            "flex-1 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2",
            activeTab === "complaint" ? "bg-white shadow-sm text-blue-600" : "text-gray-500"
          )}
        >
          <MessageSquare size={16} />
          Keluhan
        </button>
      </div>

      {activeTab === "billing" ? (
        <>
          {/* Unit Info */}
          <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-8 rounded-3xl shadow-xl text-white relative overflow-hidden">
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-blue-400/20 rounded-full blur-3xl" />
            
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-blue-100 text-xs font-bold uppercase tracking-widest mb-1">Unit Rusunawa</p>
                  <h2 className="text-4xl font-black">{unit.block}{unit.unitNumber}</h2>
                </div>
                <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
                  <Droplets size={24} />
                </div>
              </div>
              
              <div className="space-y-1">
                <p className="text-sm font-medium text-blue-100">{unit.residentName}</p>
                <p className="text-xs text-blue-200 opacity-75">Lantai {unit.floor} • {unit.ktpNumber}</p>
              </div>
            </div>
          </div>

          {/* Bill Card */}
          {billing ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "bg-white p-6 rounded-3xl shadow-sm border transition-all",
                isOverdue ? "border-red-100 bg-red-50/30" : "border-gray-100"
              )}
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                  <Calendar className="text-blue-600" size={20} />
                  <h3 className="font-bold text-gray-900">Tagihan {getMonthName(currentMonth)}</h3>
                </div>
                <span className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                  billing.status === "LUNAS" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                )}>
                  {billing.status}
                </span>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-medium">Pemakaian Air ({billing.usage} m³)</span>
                  <span className="text-gray-900 font-bold">{formatCurrency(billing.waterBill)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-medium">Iuran Sampah</span>
                  <span className="text-gray-900 font-bold">{formatCurrency(billing.trashBill)}</span>
                </div>
                <div className="flex justify-between items-center text-sm pt-2 border-t border-gray-50">
                  <span className="text-gray-500 font-medium">Status Biaya Hunian</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                    billing.housingPaymentStatus === "LUNAS" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  )}>
                    {billing.housingPaymentStatus === "LUNAS" ? "SUDAH BAYAR" : "BELUM BAYAR"}
                  </span>
                </div>
                {billing.debtPrev > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-red-500 font-medium">Tunggakan Bulan Lalu</span>
                    <span className="text-red-600 font-bold">{formatCurrency(billing.debtPrev)}</span>
                  </div>
                )}
                <div className="pt-4 border-t-2 border-dashed border-gray-100 flex justify-between items-center">
                  <span className="text-gray-900 font-black">Total Tagihan</span>
                  <span className="text-2xl font-black text-blue-600">{formatCurrency(billing.totalBill)}</span>
                </div>
              </div>

              {billing.status === "BELUM_LUNAS" || billing.housingPaymentStatus === "BELUM_LUNAS" ? (
                <div className="space-y-4">
                  <div className={cn(
                    "p-4 rounded-2xl flex items-start gap-3",
                    (isOverdue || billing.housingPaymentStatus === "BELUM_LUNAS") ? "bg-red-100 text-red-700" : "bg-blue-50 text-blue-700"
                  )}>
                    {(isOverdue || billing.housingPaymentStatus === "BELUM_LUNAS") ? <AlertTriangle size={20} /> : <Clock size={20} />}
                    <div className="text-xs leading-relaxed">
                      <p className="font-bold mb-1 uppercase tracking-wider">
                        {(isOverdue || billing.housingPaymentStatus === "BELUM_LUNAS") ? "Peringatan Penting!" : "Batas Pembayaran"}
                      </p>
                      <p className="opacity-80">
                        {billing.housingPaymentStatus === "BELUM_LUNAS" && billing.status === "BELUM_LUNAS" 
                          ? "Anda belum membayar PDAM & Biaya Hunian. " 
                          : billing.housingPaymentStatus === "BELUM_LUNAS" 
                            ? "Anda belum membayar Biaya Hunian ke Pengelola. "
                            : "Anda belum membayar tagihan PDAM. "}
                        Sesuai aturan, jika salah satu atau kedua kewajiban belum dibayar, aliran listrik ke unit Anda akan diputus sementara oleh petugas.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-green-50 text-green-700 rounded-2xl flex items-center gap-3">
                  <CheckCircle2 size={24} />
                  <div className="text-xs font-bold uppercase tracking-wider">
                    Terima kasih! Tagihan Anda sudah lunas.
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <div className="bg-white p-12 rounded-3xl shadow-sm border border-gray-100 text-center">
              <Clock size={48} className="mx-auto mb-4 text-gray-200" />
              <p className="text-gray-500 font-medium">Tagihan bulan ini belum diterbitkan.</p>
              <p className="text-xs text-gray-400 mt-1">Silakan hubungi Koordinator Lantai {unit.floor}.</p>
            </div>
          )}

          {/* Quick Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
              <Info className="text-blue-400 mb-2" size={18} />
              <p className="text-[10px] font-bold text-gray-400 uppercase">Meteran Lalu</p>
              <p className="text-lg font-bold text-gray-900">{billing?.meterPrev || unit.initialMeter}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
              <Droplets className="text-blue-400 mb-2" size={18} />
              <p className="text-[10px] font-bold text-gray-400 uppercase">Meteran Baru</p>
              <p className="text-lg font-bold text-gray-900">{billing?.meterCurrent || "-"}</p>
            </div>
          </div>
        </>
      ) : activeTab === "finance" ? (
        <div className="space-y-6">
          {/* Transparency Notice */}
          <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex gap-3">
            <Info className="text-blue-600 shrink-0" size={20} />
            <p className="text-[11px] leading-relaxed text-blue-800 font-medium">
              Laporan ini adalah laporan realtime paguyuban kepada warga secara online, sebagai bentuk transparansi keuangan pengelolaan keuangan warga rusunawa gunungsari. Jika ada pertanyaan bisa menghubungi masing-masing koordinator lantai.
            </p>
          </div>

          {/* Balance Card */}
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 text-center">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Total Saldo Paguyuban</p>
            <h2 className="text-4xl font-black text-blue-600 mb-6">{formatCurrency(balance)}</h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 p-4 rounded-2xl">
                <div className="flex items-center justify-center gap-2 text-green-600 mb-1">
                  <TrendingUp size={14} />
                  <span className="text-[10px] font-black uppercase">Pemasukan</span>
                </div>
                <p className="text-sm font-bold text-green-700">{formatCurrency(totalIncome)}</p>
              </div>
              <div className="bg-red-50 p-4 rounded-2xl">
                <div className="flex items-center justify-center gap-2 text-red-600 mb-1">
                  <TrendingDown size={14} />
                  <span className="text-[10px] font-black uppercase">Pengeluaran</span>
                </div>
                <p className="text-sm font-bold text-red-700">{formatCurrency(totalExpense)}</p>
              </div>
            </div>
          </div>

          {/* Transaction List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h3 className="font-black text-gray-900 text-sm uppercase tracking-wider">Riwayat Transaksi</h3>
              <HistoryIcon size={16} className="text-gray-400" />
            </div>

            <div className="space-y-3">
              {finances.length > 0 ? (
                finances.map((f) => (
                  <div key={f.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className={cn(
                      "p-3 rounded-xl",
                      f.type === "INCOME" ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                    )}>
                      {f.type === "INCOME" ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-gray-900">{f.description}</p>
                      <p className="text-[10px] text-gray-400 font-medium">{f.category} • {new Date(f.date).toLocaleDateString("id-ID")}</p>
                    </div>
                    <div className={cn(
                      "text-sm font-black",
                      f.type === "INCOME" ? "text-green-600" : "text-red-600"
                    )}>
                      {f.type === "INCOME" ? "+" : "-"}{formatCurrency(f.amount)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                  <p className="text-xs text-gray-400 font-bold uppercase">Belum ada transaksi</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center px-2">
            <h3 className="font-black text-gray-900 text-sm uppercase tracking-wider">Keluhan Saya</h3>
            <button 
              onClick={() => setShowComplaintForm(true)}
              className="p-2 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-100"
            >
              <Plus size={20} />
            </button>
          </div>

          <div className="space-y-4">
            {complaints.length > 0 ? (
              complaints.map((c) => (
                <div key={c.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-3">
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-gray-900">{c.title}</h4>
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[8px] font-bold uppercase",
                      c.status === "RESOLVED" ? "bg-green-100 text-green-700" :
                      c.status === "IN_PROGRESS" ? "bg-blue-100 text-blue-700" :
                      "bg-amber-100 text-amber-700"
                    )}>
                      {c.status === "PENDING" ? "MENUNGGU" :
                       c.status === "IN_PROGRESS" ? "DIPROSES" : "SELESAI"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">{c.description}</p>
                  <p className="text-[10px] text-gray-400">{new Date(c.createdAt).toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  
                  {c.response && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <p className="text-[10px] font-bold text-blue-600 uppercase mb-1">Respon Pengelola:</p>
                      <p className="text-xs text-gray-700 italic">"{c.response}"</p>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-12 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                <MessageSquare size={48} className="mx-auto mb-4 text-gray-200" />
                <p className="text-xs text-gray-400 font-bold uppercase">Belum ada keluhan</p>
              </div>
            )}
          </div>

          <AnimatePresence>
            {showComplaintForm && (
              <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/50 backdrop-blur-sm">
                <motion.div 
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  className="bg-white w-full max-w-md rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden"
                >
                  <div className="p-6 border-b flex justify-between items-center bg-blue-600 text-white">
                    <h3 className="text-xl font-bold">Kirim Keluhan</h3>
                    <button onClick={() => setShowComplaintForm(false)} className="p-2 hover:bg-white/10 rounded-full">
                      <Plus size={24} className="rotate-45" />
                    </button>
                  </div>
                  <form onSubmit={handleComplaintSubmit} className="p-6 space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Subjek / Judul</label>
                      <input 
                        type="text"
                        required
                        placeholder="Contoh: Kran Air Bocor"
                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium focus:bg-white focus:border-blue-500 outline-none transition-all"
                        value={newComplaint.title}
                        onChange={(e) => setNewComplaint({...newComplaint, title: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Detail Keluhan</label>
                      <textarea 
                        required
                        rows={4}
                        placeholder="Jelaskan detail keluhan Anda..."
                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium focus:bg-white focus:border-blue-500 outline-none transition-all resize-none"
                        value={newComplaint.description}
                        onChange={(e) => setNewComplaint({...newComplaint, description: e.target.value})}
                      />
                    </div>
                    <button 
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-100 disabled:opacity-50"
                    >
                      <Send size={20} />
                      {isSubmitting ? "MENGIRIM..." : "KIRIM KELUHAN"}
                    </button>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
