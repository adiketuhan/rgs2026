import React, { useState, useEffect } from "react";
import { User, Billing, Unit, Settings, FinanceTransaction, FundRequest } from "../types";
import { db } from "../db";
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  PieChart, 
  ArrowUpRight, 
  ArrowDownRight,
  Filter,
  Download,
  Plus,
  Trash2,
  History as HistoryIcon,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  AlertCircle,
  Eye,
  Users
} from "lucide-react";
import { formatCurrency, cn } from "../lib/utils";
import { AnimatePresence, motion } from "framer-motion";

interface BendaharaDashboardProps {
  user: User;
  activeTab?: string;
}

export function BendaharaDashboard({ user, activeTab = "keuangan" }: BendaharaDashboardProps) {
  const [billings, setBillings] = useState<Billing[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [finances, setFinances] = useState<FinanceTransaction[]>([]);
  const [fundRequests, setFundRequests] = useState<FundRequest[]>([]);
  const [settings, setSettings] = useState<Settings>({
    waterBaseRate: 25000,
    waterBaseLimit: 10,
    waterExtraRate: 2500,
    trashRate: 10000,
    dueDay: 10
  });
  const [selectedFloor, setSelectedFloor] = useState<number | "ALL">("ALL");

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    const unsubscribeBillings = db.subscribeBillings(setBillings);
    const unsubscribeUnits = db.subscribeUnits(setUnits);
    const unsubscribeSettings = db.subscribeSettings(setSettings);
    const unsubscribeFinances = db.subscribeFinances(setFinances);
    const unsubscribeFundRequests = db.subscribeFundRequests(setFundRequests);
    
    return () => {
      unsubscribeBillings();
      unsubscribeUnits();
      unsubscribeSettings();
      unsubscribeFinances();
      unsubscribeFundRequests();
    };
  }, []);

  const [showAddFinance, setShowAddFinance] = useState(false);
  const [newFinance, setNewFinance] = useState<Partial<FinanceTransaction>>({
    type: "INCOME",
    amount: 0,
    category: "OTHER",
    description: "",
    date: new Date().toISOString().split('T')[0]
  });

  const handleAddFinance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFinance.amount || !newFinance.category || !newFinance.description) return;

    const transaction: FinanceTransaction = {
      id: Math.random().toString(36).substr(2, 9),
      type: newFinance.type as "INCOME" | "EXPENSE",
      amount: Number(newFinance.amount),
      category: newFinance.category as any,
      description: newFinance.description!,
      date: new Date(newFinance.date!).toISOString(),
      recordedBy: user.name,
      status: "APPROVED"
    };

    await db.saveFinanceTransaction(transaction);
    setShowAddFinance(false);
    setNewFinance({
      type: "INCOME",
      amount: 0,
      category: "OTHER",
      description: "",
      date: new Date().toISOString().split('T')[0]
    });
  };

  const handleApproveRequest = async (request: FundRequest) => {
    const updatedRequest: FundRequest = {
      ...request,
      status: "DISBURSED",
      history: [
        ...request.history,
        {
          status: "DISBURSED",
          updatedAt: new Date().toISOString(),
          notes: `Dana dicairkan oleh ${user.name}`,
          updatedBy: user.name
        }
      ]
    };

    // Record as expense in finances
    const transaction: FinanceTransaction = {
      id: Math.random().toString(36).substr(2, 9),
      type: "EXPENSE",
      amount: request.estimatedAmount,
      category: "OTHER",
      description: `Pencairan dana: ${request.title}`,
      date: new Date().toISOString(),
      recordedBy: user.name,
      status: "APPROVED"
    };

    await db.saveFundRequest(updatedRequest);
    await db.saveFinanceTransaction(transaction);
  };

  const handleVerifyReport = async (request: FundRequest) => {
    if (!request.actualAmount) return;

    const updatedRequest: FundRequest = {
      ...request,
      status: "COMPLETED",
      history: [
        ...request.history,
        {
          status: "COMPLETED",
          updatedAt: new Date().toISOString(),
          notes: `Laporan diverifikasi oleh ${user.name}`,
          updatedBy: user.name
        }
      ]
    };

    const diff = request.estimatedAmount - request.actualAmount;
    if (diff !== 0) {
      const transaction: FinanceTransaction = {
        id: Math.random().toString(36).substr(2, 9),
        type: diff > 0 ? "INCOME" : "EXPENSE",
        amount: Math.abs(diff),
        category: "OTHER",
        description: `${diff > 0 ? 'Pengembalian' : 'Kekurangan'} dana: ${request.title}`,
        date: new Date().toISOString(),
        recordedBy: user.name,
        status: "APPROVED"
      };
      await db.saveFinanceTransaction(transaction);
    }

    await db.saveFundRequest(updatedRequest);
  };

  const handleRejectRequest = async (request: FundRequest) => {
    const reason = prompt("Alasan penolakan:");
    if (!reason) return;

    const updatedRequest: FundRequest = {
      ...request,
      status: "REJECTED",
      history: [
        ...request.history,
        {
          status: "REJECTED",
          updatedAt: new Date().toISOString(),
          notes: `Ditolak: ${reason}`,
          updatedBy: user.name
        }
      ]
    };
    await db.saveFundRequest(updatedRequest);
  };

  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);

  const handleDeleteFinance = async (id: string) => {
    if (confirm("Hapus transaksi ini?")) {
      await db.deleteFinanceTransaction(id);
    }
  };

  const handleApproveFinance = async (id: string) => {
    const transaction = finances.find(f => f.id === id);
    if (!transaction) return;
    
    const updated: FinanceTransaction = {
      ...transaction,
      status: "APPROVED",
      approvedBy: user.id,
      approvedAt: new Date().toISOString()
    };
    await db.saveFinanceTransaction(updated);
    alert("Setoran disetujui!");
  };

  const handleRejectFinance = async (id: string) => {
    const reason = prompt("Alasan penolakan:");
    if (reason === null) return;

    const transaction = finances.find(f => f.id === id);
    if (!transaction) return;
    
    const updated: FinanceTransaction = {
      ...transaction,
      status: "REJECTED",
      description: `${transaction.description} (Ditolak: ${reason})`
    };
    await db.saveFinanceTransaction(updated);
    alert("Setoran ditolak!");
  };

  const totalIncome = finances.filter(f => f.type === "INCOME").reduce((acc, curr) => acc + curr.amount, 0);
  const totalExpense = finances.filter(f => f.type === "EXPENSE").reduce((acc, curr) => acc + curr.amount, 0);
  const balance = totalIncome - totalExpense;

  const currentMonthBillings = billings.filter(b => b.month === currentMonth && b.year === currentYear);

  const filteredBillings = selectedFloor === "ALL" 
    ? currentMonthBillings 
    : currentMonthBillings.filter(b => units.find(u => u.id === b.unitId)?.floor === selectedFloor);

  const totalPotential = filteredBillings.reduce((sum, b) => sum + b.totalBill, 0);
  const totalReceived = filteredBillings.filter(b => b.status === "LUNAS").reduce((sum, b) => sum + b.totalBill, 0);
  const totalPending = totalPotential - totalReceived;
  const collectionRate = totalPotential > 0 ? (totalReceived / totalPotential) * 100 : 0;

  const floorStats = [1, 2, 3, 4, 5].map(f => {
    const floorUnits = units.filter(u => u.floor === f);
    const floorBills = billings.filter(b => floorUnits.find(u => u.id === b.unitId));
    const potential = floorBills.reduce((sum, b) => sum + b.totalBill, 0);
    const received = floorBills.filter(b => b.status === "LUNAS").reduce((sum, b) => sum + b.totalBill, 0);
    return { floor: f, potential, received, pending: potential - received };
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {activeTab === "billing" ? "Laporan Tagihan" : 
             activeTab === "keuangan" ? "Kas Paguyuban" : 
             "Persetujuan Dana"}
          </h2>
          <p className="text-gray-500">Periode: {new Date().toLocaleString('id-ID', { month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      {activeTab === "billing" && (
        <>
          <div className="flex justify-end">
            <div className="bg-white p-1 rounded-xl border border-gray-200 flex shadow-sm">
              <button 
                onClick={() => setSelectedFloor("ALL")}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                  selectedFloor === "ALL" ? "bg-blue-600 text-white shadow-md" : "text-gray-600 hover:bg-gray-50"
                )}
              >
                Semua
              </button>
              {[1, 2, 3, 4, 5].map(f => (
                <button 
                  key={f}
                  onClick={() => setSelectedFloor(f)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                    selectedFloor === f ? "bg-blue-600 text-white shadow-md" : "text-gray-600 hover:bg-gray-50"
                  )}
                >
                  Lt {f}
                </button>
              ))}
            </div>
          </div>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SummaryCard 
              icon={<TrendingUp className="text-blue-600" />} 
              label="Potensi Pendapatan" 
              value={formatCurrency(totalPotential)} 
              subValue="Total tagihan terbit"
              color="blue"
            />
            <SummaryCard 
              icon={<Wallet className="text-green-600" />} 
              label="Uang Diterima" 
              value={formatCurrency(totalReceived)} 
              subValue={`${collectionRate.toFixed(1)}% tertagih`}
              color="green"
              trend={<ArrowUpRight size={16} />}
            />
            <SummaryCard 
              icon={<TrendingDown className="text-red-600" />} 
              label="Piutang Berjalan" 
              value={formatCurrency(totalPending)} 
              subValue="Belum dibayar warga"
              color="red"
              trend={<ArrowDownRight size={16} />}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Floor Breakdown */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <BarChart3 className="text-blue-600" />
                Rincian Per Lantai
              </h3>
              <div className="space-y-6">
                {floorStats.map(stat => (
                  <div key={stat.floor} className="space-y-2">
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-sm font-bold text-gray-900">Lantai {stat.floor}</p>
                        <p className="text-xs text-gray-400">Potensi: {formatCurrency(stat.potential)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-green-600">{formatCurrency(stat.received)}</p>
                        <p className="text-xs text-red-400">Sisa: {formatCurrency(stat.pending)}</p>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${stat.potential > 0 ? (stat.received / stat.potential) * 100 : 0}%` }}
                        className="h-full bg-blue-600 rounded-full"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Collection Status */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <PieChart className="text-blue-600" />
                Status Penagihan
              </h3>
              <div className="flex flex-col items-center justify-center py-8">
                <div className="relative w-48 h-48 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90">
                    <circle cx="96" cy="96" r="88" fill="transparent" stroke="#f3f4f6" strokeWidth="16" />
                    <motion.circle 
                      cx="96" cy="96" r="88" fill="transparent" stroke="#2563eb" strokeWidth="16" 
                      strokeDasharray={553}
                      initial={{ strokeDashoffset: 553 }}
                      animate={{ strokeDashoffset: 553 - (553 * collectionRate) / 100 }}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute text-center">
                    <p className="text-3xl font-bold text-gray-900">{collectionRate.toFixed(0)}%</p>
                    <p className="text-xs text-gray-400 uppercase font-bold">Lunas</p>
                  </div>
                </div>
                <div className="mt-8 grid grid-cols-2 gap-8 w-full">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <div className="w-3 h-3 bg-blue-600 rounded-full" />
                      <p className="text-sm font-bold text-gray-700">Lunas</p>
                    </div>
                    <p className="text-lg font-bold text-gray-900">{filteredBillings.filter(b => b.status === "LUNAS").length}</p>
                    <p className="text-xs text-gray-400">Unit</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <div className="w-3 h-3 bg-gray-200 rounded-full" />
                      <p className="text-sm font-bold text-gray-700">Belum</p>
                    </div>
                    <p className="text-lg font-bold text-gray-900">{filteredBillings.filter(b => b.status === "BELUM_LUNAS").length}</p>
                    <p className="text-xs text-gray-400">Unit</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === "keuangan" && (
        <div className="space-y-8">
          {/* Finance Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SummaryCard 
              icon={<Wallet className="text-blue-600" />} 
              label="Total Saldo Paguyuban" 
              value={formatCurrency(balance)} 
              subValue="Saldo kas saat ini"
              color="blue"
            />
            <SummaryCard 
              icon={<TrendingUp className="text-green-600" />} 
              label="Total Pemasukan Kas" 
              value={formatCurrency(totalIncome)} 
              subValue="Semua periode"
              color="green"
            />
            <SummaryCard 
              icon={<TrendingDown className="text-red-600" />} 
              label="Total Pengeluaran Kas" 
              value={formatCurrency(totalExpense)} 
              subValue="Semua periode"
              color="red"
            />
          </div>

          {/* Approval Section */}
          {finances.some(f => f.status === "PENDING") && (
            <div className="bg-yellow-50 p-6 rounded-2xl border border-yellow-100">
              <h3 className="text-lg font-bold text-yellow-800 mb-4 flex items-center gap-2">
                <Clock className="text-yellow-600" />
                Menunggu Persetujuan Setoran
              </h3>
              <div className="space-y-3">
                {finances.filter(f => f.status === "PENDING").map(f => (
                  <div key={f.id} className="bg-white p-4 rounded-xl border border-yellow-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <p className="font-bold text-gray-900">{f.description}</p>
                      <p className="text-xs text-gray-500">
                        Diajukan oleh {f.recordedBy} pada {new Date(f.date).toLocaleString("id-ID")}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-lg font-bold text-blue-600 mr-4">{formatCurrency(f.amount)}</p>
                      <button 
                        onClick={() => handleRejectFinance(f.id)}
                        className="px-4 py-2 text-red-600 font-bold text-xs hover:bg-red-50 rounded-lg transition-all"
                      >
                        Tolak
                      </button>
                      <button 
                        onClick={() => handleApproveFinance(f.id)}
                        className="px-4 py-2 bg-green-600 text-white font-bold text-xs rounded-lg hover:bg-green-700 transition-all shadow-sm"
                      >
                        Setujui & Terima Uang
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Monthly Report Section */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <FileText className="text-blue-600" />
                Laporan Keuangan Per Lantai
              </h2>
              <div className="flex gap-2">
                <select 
                  className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold outline-none"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                >
                  {Array.from({ length: 12 }).map((_, i) => (
                    <option key={i} value={i}>{new Date(2024, i).toLocaleString('id-ID', { month: 'long' })}</option>
                  ))}
                </select>
                <select 
                  className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold outline-none"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                >
                  {[2025, 2026, 2027].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-gray-400 uppercase text-[10px] font-black tracking-widest">
                  <tr>
                    <th className="px-6 py-4">Lantai</th>
                    <th className="px-6 py-4 text-right">Iuran Air (PDAM)</th>
                    <th className="px-6 py-4 text-right">Iuran Sampah</th>
                    <th className="px-6 py-4 text-right">Total Setoran</th>
                    <th className="px-6 py-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {Array.from({ length: 5 }).map((_, i) => {
                    const floor = i + 1;
                    const waterTrans = finances.find(f => f.floor === floor && f.month === selectedMonth && f.year === selectedYear && f.category === "WATER");
                    const trashTrans = finances.find(f => f.floor === floor && f.month === selectedMonth && f.year === selectedYear && f.category === "TRASH");
                    
                    const total = (waterTrans?.amount || 0) + (trashTrans?.amount || 0);
                    const isAllApproved = (waterTrans?.status === "APPROVED" || !waterTrans) && (trashTrans?.status === "APPROVED" || !trashTrans) && (waterTrans || trashTrans);

                    return (
                      <tr key={floor} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-bold text-gray-900">Lantai {floor}</td>
                        <td className="px-6 py-4 text-right text-sm font-medium">
                          {waterTrans ? formatCurrency(waterTrans.amount) : "-"}
                          {waterTrans?.status === "PENDING" && <span className="block text-[8px] text-yellow-600 font-bold uppercase">Pending</span>}
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-medium">
                          {trashTrans ? formatCurrency(trashTrans.amount) : "-"}
                          {trashTrans?.status === "PENDING" && <span className="block text-[8px] text-yellow-600 font-bold uppercase">Pending</span>}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-blue-600">
                          {total > 0 ? formatCurrency(total) : "-"}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {total > 0 ? (
                            <span className={cn(
                              "px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-tighter",
                              isAllApproved ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                            )}>
                              {isAllApproved ? "Diterima" : "Proses"}
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-300 font-bold uppercase italic">Belum Ada</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Transactions */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <HistoryIcon className="text-blue-600" />
                Riwayat Kas Paguyuban
              </h3>
              <button 
                onClick={() => setShowAddFinance(true)}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-md"
              >
                <Plus size={18} />
                Tambah Transaksi
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-gray-400 uppercase text-[10px] font-black tracking-widest">
                  <tr>
                    <th className="px-6 py-4">Tanggal</th>
                    <th className="px-6 py-4">Kategori</th>
                    <th className="px-6 py-4">Keterangan</th>
                    <th className="px-6 py-4">Jenis</th>
                    <th className="px-6 py-4 text-right">Jumlah</th>
                    <th className="px-6 py-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {finances.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((f) => (
                    <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {new Date(f.date).toLocaleDateString("id-ID")}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-lg text-[10px] font-bold uppercase">
                          {f.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{f.description}</td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-1 rounded-lg text-[10px] font-bold uppercase",
                          f.type === "INCOME" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        )}>
                          {f.type === "INCOME" ? "Pemasukan" : "Pengeluaran"}
                        </span>
                      </td>
                      <td className={cn(
                        "px-6 py-4 text-sm font-bold text-right",
                        f.type === "INCOME" ? "text-green-600" : "text-red-600"
                      )}>
                        {f.type === "INCOME" ? "+" : "-"}{formatCurrency(f.amount)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button 
                          onClick={() => handleDeleteFinance(f.id)}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {finances.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-400 font-medium">
                        Belum ada data transaksi kas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "dana" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Persetujuan Dana</h2>
              <p className="text-sm text-gray-500">Kelola pengajuan dana operasional dari koordinator</p>
            </div>
            <div className="flex gap-2">
              <div className="px-4 py-2 bg-amber-50 text-amber-700 rounded-xl border border-amber-100 text-xs font-bold uppercase tracking-wider">
                {fundRequests.filter(r => r.status === "PENDING").length} Menunggu
              </div>
              <div className="px-4 py-2 bg-purple-50 text-purple-700 rounded-xl border border-purple-100 text-xs font-bold uppercase tracking-wider">
                {fundRequests.filter(r => r.status === "REPORTED").length} Perlu Verifikasi
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {fundRequests.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                <FileText className="mx-auto text-gray-200 mb-4" size={48} />
                <p className="text-gray-500 font-medium">Belum ada pengajuan dana yang masuk</p>
              </div>
            ) : (
              fundRequests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(request => (
                <motion.div 
                  key={request.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex gap-4">
                      <div className={cn(
                        "w-14 h-14 rounded-2xl flex items-center justify-center",
                        request.status === "PENDING" ? "bg-amber-50 text-amber-600" :
                        request.status === "DISBURSED" ? "bg-blue-50 text-blue-600" :
                        request.status === "REPORTED" ? "bg-purple-50 text-purple-600" :
                        request.status === "COMPLETED" ? "bg-green-50 text-green-600" :
                        "bg-red-50 text-red-600"
                      )}>
                        {request.status === "PENDING" ? <Clock size={28} /> :
                         request.status === "DISBURSED" ? <Wallet size={28} /> :
                         request.status === "REPORTED" ? <FileText size={28} /> :
                         request.status === "COMPLETED" ? <CheckCircle2 size={28} /> :
                         <AlertCircle size={28} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-gray-900">{request.title}</h3>
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest border",
                            request.status === "PENDING" ? "bg-amber-50 text-amber-600 border-amber-100" :
                            request.status === "DISBURSED" ? "bg-blue-50 text-blue-600 border-blue-100" :
                            request.status === "REPORTED" ? "bg-purple-50 text-purple-600 border-purple-100" :
                            request.status === "COMPLETED" ? "bg-green-50 text-green-600 border-green-100" :
                            "bg-red-50 text-red-600 border-red-100"
                          )}>
                            {request.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{request.description}</p>
                        <div className="flex items-center gap-3 mt-3">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                            <Users size={14} />
                            <span>{request.requesterName} (Lantai {request.floor})</span>
                          </div>
                          <div className="w-1 h-1 bg-gray-300 rounded-full" />
                          <div className="text-xs font-medium text-gray-500">
                            {new Date(request.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Estimasi Dana</p>
                      <p className="text-xl font-bold text-gray-900">{formatCurrency(request.estimatedAmount)}</p>
                      {request.actualAmount && (
                        <div className="mt-3">
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Realisasi</p>
                          <p className="text-xl font-bold text-blue-600">{formatCurrency(request.actualAmount)}</p>
                          {request.estimatedAmount - request.actualAmount > 0 && (
                            <p className="text-[10px] font-bold text-green-600 mt-1">Sisa: {formatCurrency(request.estimatedAmount - request.actualAmount)}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-4 border-t border-gray-50">
                    {request.status === "PENDING" && (
                      <>
                        <button 
                          onClick={() => handleApproveRequest(request)}
                          className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
                        >
                          <CheckCircle2 size={18} />
                          Setujui & Cairkan
                        </button>
                        <button 
                          onClick={() => handleRejectRequest(request)}
                          className="px-6 py-3 bg-red-50 text-red-600 rounded-xl font-bold text-sm hover:bg-red-100 transition-all"
                        >
                          Tolak
                        </button>
                      </>
                    )}

                    {request.status === "REPORTED" && (
                      <>
                        <button 
                          onClick={() => handleVerifyReport(request)}
                          className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 transition-all shadow-lg shadow-green-100 flex items-center justify-center gap-2"
                        >
                          <CheckCircle2 size={18} />
                          Verifikasi Laporan
                        </button>
                        {request.receiptUrl && (
                          <button 
                            onClick={() => setViewingReceipt(request.receiptUrl!)}
                            className="px-6 py-3 bg-purple-50 text-purple-600 rounded-xl font-bold text-sm hover:bg-purple-100 transition-all flex items-center justify-center gap-2"
                          >
                            <Eye size={18} />
                            Lihat Nota
                          </button>
                        )}
                      </>
                    )}

                    {request.status === "COMPLETED" && (
                      <div className="flex-1 p-3 bg-green-50 rounded-xl border border-green-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="text-green-600" size={20} />
                          <p className="text-sm font-bold text-green-700">Pengajuan Selesai & Dana Terverifikasi</p>
                        </div>
                        {request.receiptUrl && (
                          <button 
                            onClick={() => setViewingReceipt(request.receiptUrl!)}
                            className="text-xs font-bold text-green-600 underline"
                          >
                            Lihat Nota
                          </button>
                        )}
                      </div>
                    )}

                    {request.status === "REJECTED" && (
                      <div className="flex-1 p-3 bg-red-50 rounded-xl border border-red-100 flex items-center gap-3">
                        <XCircle className="text-red-600" size={20} />
                        <p className="text-sm font-bold text-red-700">Pengajuan Ditolak</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Add Finance Modal */}
      {showAddFinance && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-xl font-bold text-gray-900">Tambah Transaksi Kas</h3>
              <button onClick={() => setShowAddFinance(false)} className="text-gray-400 hover:text-gray-600">
                <Plus className="rotate-45" size={24} />
              </button>
            </div>
            <form onSubmit={handleAddFinance} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 p-1 bg-gray-100 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setNewFinance({ ...newFinance, type: "INCOME" })}
                  className={cn(
                    "py-2 rounded-xl text-xs font-bold transition-all",
                    newFinance.type === "INCOME" ? "bg-green-600 text-white shadow-md" : "text-gray-500"
                  )}
                >
                  Pemasukan
                </button>
                <button
                  type="button"
                  onClick={() => setNewFinance({ ...newFinance, type: "EXPENSE" })}
                  className={cn(
                    "py-2 rounded-xl text-xs font-bold transition-all",
                    newFinance.type === "EXPENSE" ? "bg-red-600 text-white shadow-md" : "text-gray-500"
                  )}
                >
                  Pengeluaran
                </button>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Kategori</label>
                <select 
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  value={newFinance.category}
                  onChange={(e) => setNewFinance({...newFinance, category: e.target.value as any})}
                  required
                >
                  <option value="WATER">Air (PDAM)</option>
                  <option value="TRASH">Sampah</option>
                  <option value="OTHER">Lain-lain</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Jumlah (Rp)</label>
                <input 
                  type="number" 
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  value={newFinance.amount}
                  onChange={(e) => setNewFinance({...newFinance, amount: Number(e.target.value)})}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Keterangan</label>
                <textarea 
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                  value={newFinance.description}
                  onChange={(e) => setNewFinance({...newFinance, description: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Tanggal</label>
                <input 
                  type="date" 
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  value={newFinance.date}
                  onChange={(e) => setNewFinance({...newFinance, date: e.target.value})}
                  required
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setShowAddFinance(false)}
                  className="flex-1 py-3 border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-all"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                >
                  Simpan Transaksi
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Receipt Viewer Modal */}
      <AnimatePresence>
        {viewingReceipt && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative max-w-4xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl"
            >
              <button 
                onClick={() => setViewingReceipt(null)}
                className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-all z-10"
              >
                <XCircle size={24} />
              </button>
              <div className="p-2 bg-gray-100 flex items-center justify-center min-h-[300px]">
                <img src={viewingReceipt} alt="Nota" className="max-w-full max-h-[80vh] object-contain" />
              </div>
              <div className="p-4 bg-white border-t flex justify-center">
                <button 
                  onClick={() => setViewingReceipt(null)}
                  className="px-8 py-2 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-all"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SummaryCard({ icon, label, value, subValue, color, trend }: { icon: React.ReactNode, label: string, value: string, subValue: string, color: string, trend?: React.ReactNode }) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    red: "bg-red-50 text-red-600"
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      <div className="flex justify-between items-start mb-4">
        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-2xl", colors[color as keyof typeof colors])}>
          {icon}
        </div>
        {trend && (
          <div className={cn("px-2 py-1 rounded-lg flex items-center gap-1 text-xs font-bold", colors[color as keyof typeof colors])}>
            {trend}
            <span>Trend</span>
          </div>
        )}
      </div>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mb-1">{value}</p>
      <p className="text-xs text-gray-500">{subValue}</p>
    </div>
  );
}
