import React, { useState, useEffect } from "react";
import { User, Unit, Billing, Settings, FundRequest, FundRequestStatus, FinanceTransaction, Complaint, AuditLog } from "../types";
import { db } from "../db";
import { 
  Droplets, 
  Search, 
  CheckCircle2, 
  XCircle, 
  MessageSquare, 
  Edit3, 
  Save, 
  ChevronRight,
  AlertTriangle,
  Info,
  RefreshCw,
  Camera,
  Plus,
  FileText,
  Wallet,
  ImageIcon,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertCircle,
  ArrowRight,
  Trash2,
  Check,
  Eye
} from "lucide-react";
import { formatCurrency, cn, compressImage } from "../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { UnitDetailModal } from "../components/UnitDetailModal";

interface KoorDashboardProps {
  user: User;
  activeTab?: "INPUT" | "HISTORY" | "DANA" | "SETORAN";
}

export function KoorDashboard({ user, activeTab: propActiveTab }: KoorDashboardProps) {
  const [activeTab, setActiveTab] = useState<"INPUT" | "HISTORY" | "DANA" | "SETORAN" | "KELUHAN">("INPUT");

  useEffect(() => {
    if (propActiveTab) {
      setActiveTab(propActiveTab as any);
    }
  }, [propActiveTab]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [units, setUnits] = useState<Unit[]>([]);
  const [billings, setBillings] = useState<Billing[]>([]);
  const [finances, setFinances] = useState<FinanceTransaction[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [complaintResponse, setComplaintResponse] = useState<{ id: string, text: string } | null>(null);
  const [settings, setSettings] = useState<Settings>({
    waterBaseRate: 25000,
    waterBaseLimit: 10,
    waterExtraRate: 2500,
    trashRate: 10000,
    dueDay: 10
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [meterInput, setMeterInput] = useState("");
  const [isVacantInput, setIsVacantInput] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [detailUnit, setDetailUnit] = useState<Unit | null>(null);
  const [isMobileMode, setIsMobileMode] = useState(false);

  const [fundRequests, setFundRequests] = useState<FundRequest[]>([]);
  const [showAddRequest, setShowAddRequest] = useState(false);
  const [showReportModal, setShowReportModal] = useState<FundRequest | null>(null);
  const [newRequest, setNewRequest] = useState({ title: '', description: '', amount: 0 });
  const [reportData, setReportData] = useState({ actualAmount: 0, receiptUrl: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const realMonth = new Date().getMonth();
  const realYear = new Date().getFullYear();
  const isAfterDue = new Date().getDate() > settings.dueDay && selectedMonth === realMonth && selectedYear === realYear;

  useEffect(() => {
    const unsubscribeUnits = db.subscribeUnits((allUnits) => {
      const floorUnits = allUnits.filter(u => u.floor === user.floor);
      setUnits(floorUnits);
    });
    const unsubscribeBillings = db.subscribeBillings(setBillings);
    const unsubscribeSettings = db.subscribeSettings(setSettings);
    
    const unsubscribeFundRequests = db.subscribeFundRequests((requests) => {
      setFundRequests(requests.filter(r => r.requesterId === user.id));
    });
    const unsubscribeFinances = db.subscribeFinances(setFinances);
    const unsubscribeComplaints = db.subscribeComplaints((all) => {
      setComplaints(all.filter(c => c.floor === user.floor));
    });

    return () => {
      unsubscribeUnits();
      unsubscribeBillings();
      unsubscribeSettings();
      unsubscribeFundRequests();
      unsubscribeFinances();
      unsubscribeComplaints();
    };
  }, [user.floor, user.id]);

  const handleAddRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRequest.title || !newRequest.amount) return;
    setIsSubmitting(true);

    const request: FundRequest = {
      id: Math.random().toString(36).substr(2, 9),
      requesterId: user.id,
      requesterName: user.name,
      floor: user.floor!,
      title: newRequest.title,
      description: newRequest.description,
      estimatedAmount: Number(newRequest.amount),
      status: "PENDING",
      createdAt: new Date().toISOString(),
      history: [{
        status: "PENDING",
        updatedAt: new Date().toISOString(),
        updatedBy: user.name,
        notes: "Pengajuan baru dibuat"
      }]
    };

    try {
      await db.saveFundRequest(request);
      setShowAddRequest(false);
      setNewRequest({ title: '', description: '', amount: 0 });
    } catch (err) {
      console.error("Error saving fund request:", err);
      alert("Gagal mengajukan dana. Silakan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file);
        setReportData(prev => ({ ...prev, receiptUrl: compressed }));
      } catch (err) {
        console.error("Compression error:", err);
      }
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showReportModal || !reportData.actualAmount || !reportData.receiptUrl) return;
    setIsSubmitting(true);

    const updatedRequest: FundRequest = {
      ...showReportModal,
      actualAmount: Number(reportData.actualAmount),
      receiptUrl: reportData.receiptUrl,
      status: "REPORTED",
      history: [
        ...showReportModal.history,
        {
          status: "REPORTED",
          updatedAt: new Date().toISOString(),
          updatedBy: user.name,
          notes: `Laporan pemakaian dana: ${formatCurrency(Number(reportData.actualAmount))}`
        }
      ]
    };

    try {
      await db.saveFundRequest(updatedRequest);
      setShowReportModal(null);
      setReportData({ actualAmount: 0, receiptUrl: '' });
    } catch (err) {
      console.error("Error submitting report:", err);
      alert("Gagal mengirim laporan. Silakan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitSetoran = async (category: "WATER" | "TRASH") => {
    const floorBillings = billings.filter(b => 
      units.some(u => u.id === b.unitId) && 
      b.month === selectedMonth && 
      b.year === selectedYear && 
      b.status === "LUNAS"
    );

    const amount = floorBillings.reduce((sum, b) => sum + (category === "WATER" ? b.waterBill : b.trashBill), 0);
    if (amount <= 0) {
      alert("Tidak ada dana yang terkumpul untuk kategori ini.");
      return;
    }

    const existing = finances.find(f => 
      f.floor === user.floor && 
      f.month === selectedMonth && 
      f.year === selectedYear && 
      f.category === category &&
      f.type === "INCOME"
    );

    if (existing) {
      alert(`Setoran ${category} untuk bulan ini sudah diajukan.`);
      return;
    }

    const transaction: FinanceTransaction = {
      id: Math.random().toString(36).substr(2, 9),
      type: "INCOME",
      amount,
      category,
      description: `Setoran ${category} Lantai ${user.floor} - ${getMonthName(selectedMonth)} ${selectedYear}`,
      date: new Date().toISOString(),
      recordedBy: user.id,
      status: "PENDING",
      floor: user.floor,
      month: selectedMonth,
      year: selectedYear
    };

    try {
      await db.saveFinanceTransaction(transaction);
      alert("Setoran berhasil diajukan!");
    } catch (err) {
      console.error("Error submitting setoran:", err);
      alert("Gagal mengajukan setoran. Silakan coba lagi.");
    }
  };

  const handleResolveComplaint = async (complaintId: string, response: string) => {
    const complaint = complaints.find(c => c.id === complaintId);
    if (!complaint) return;
    
    const updated: Complaint = {
      ...complaint,
      status: "RESOLVED",
      response
    };
    try {
      await db.saveComplaint(updated);
      setComplaintResponse(null);
    } catch (err) {
      console.error("Error resolving complaint:", err);
      alert("Gagal memproses keluhan. Silakan coba lagi.");
    }
  };

  const getMonthName = (monthIndex: number) => {
    return new Date(2024, monthIndex).toLocaleString('id-ID', { month: 'long' });
  };

  const getUnitBilling = (unitId: string) => {
    return billings.find(b => b.unitId === unitId && b.month === selectedMonth && b.year === selectedYear);
  };

  const calculateBill = (usage: number, isVacant: boolean) => {
    if (isVacant) return { water: 0, trash: 0 };
    
    let waterBill = 0;
    if (usage <= settings.waterBaseLimit) {
      waterBill = settings.waterBaseRate;
    } else {
      waterBill = settings.waterBaseRate + (usage - settings.waterBaseLimit) * settings.waterExtraRate;
    }
    
    return { water: waterBill, trash: settings.trashRate };
  };

  const recalculateUnitBillings = (unitId: string, currentBillings: Billing[]) => {
    let updatedBillings = [...currentBillings];
    
    // Get all billings for this unit sorted by time
    const unitBillings = updatedBillings
      .filter(b => b.unitId === unitId)
      .sort((a, b) => (a.year * 12 + a.month) - (b.year * 12 + b.month));

    const affectedBillings: Billing[] = [];

    unitBillings.forEach((b, index) => {
      if (index === 0) return; // Skip the very first record
      
      const prev = unitBillings[index - 1];
      const debtPrev = prev.status === "BELUM_LUNAS" ? prev.totalBill : 0;
      
      if (b.debtPrev !== debtPrev) {
        const updatedB = { 
          ...b, 
          debtPrev, 
          totalBill: b.waterBill + b.trashBill + debtPrev 
        };
        affectedBillings.push(updatedB);
        // Update the record in the main array
        updatedBillings = updatedBillings.map(mainB => mainB.id === b.id ? updatedB : mainB);
      }
    });

    return { updatedBillings, affectedBillings };
  };

  const currentPrevMeter = selectedUnit ? (
    billings
      .filter(b => b.unitId === selectedUnit.id)
      .sort((a, b) => (b.year * 12 + b.month) - (a.year * 12 + a.month))
      .find(b => (b.year * 12 + b.month) < (selectedYear * 12 + selectedMonth))?.meterCurrent || selectedUnit.initialMeter
  ) : 0;

  const handleSaveMeter = async () => {
    if (!selectedUnit || meterInput === "") return;
    
    const meterCurrent = Number(meterInput);
    
    // Validation
    if (meterCurrent < currentPrevMeter && !isVacantInput) {
      alert(`Meteran baru (${meterCurrent}) tidak boleh lebih kecil dari meteran sebelumnya (${currentPrevMeter})`);
      return;
    }

    const usage = Math.max(0, meterCurrent - currentPrevMeter);
    if (usage > 100) {
      if (!confirm(`Peringatan: Pemakaian air sangat tinggi (${usage} m³). Apakah Anda yakin data ini benar?`)) {
        return;
      }
    }

    setIsSaving(true);
    const { water, trash } = calculateBill(usage, isVacantInput);
    
    // Calculate debt from previous month relative to SELECTED month
    const lastMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
    const lastYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
    const lastMonthBilling = billings.find(b => b.unitId === selectedUnit.id && b.month === lastMonth && b.year === lastYear);
    const debtPrev = lastMonthBilling && lastMonthBilling.status === "BELUM_LUNAS" ? lastMonthBilling.totalBill : 0;

    const newBilling: Billing = {
      id: Math.random().toString(36).substr(2, 9),
      unitId: selectedUnit.id,
      month: selectedMonth,
      year: selectedYear,
      meterPrev: currentPrevMeter,
      meterCurrent,
      usage,
      waterBill: water,
      trashBill: trash,
      debtPrev,
      totalBill: water + trash + debtPrev,
      status: "BELUM_LUNAS",
      housingPaymentStatus: "LUNAS",
      isVacant: isVacantInput,
      updatedAt: new Date().toISOString(),
      updatedBy: user.id
    };

    const existingIndex = billings.findIndex(b => b.unitId === selectedUnit.id && b.month === selectedMonth && b.year === selectedYear);
    let updatedBillingsList = [...billings];
    if (existingIndex > -1) {
      updatedBillingsList[existingIndex] = newBilling;
    } else {
      updatedBillingsList.push(newBilling);
    }

    // Recalculate subsequent months to sync debt
    const { affectedBillings } = recalculateUnitBillings(selectedUnit.id, updatedBillingsList);

    // Audit Log
    const auditLog: AuditLog = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: "INPUT_METER",
      targetId: selectedUnit.id,
      details: JSON.stringify({
        unit: `${selectedUnit.block}${selectedUnit.unitNumber}`,
        month: selectedMonth,
        year: selectedYear,
        meterPrev: currentPrevMeter,
        meterCurrent,
        usage
      })
    };

    // Save the new/updated billing and all affected subsequent billings
    const savePromises = [
      db.saveBilling(newBilling),
      db.saveAuditLog(auditLog),
      ...affectedBillings.map(b => db.saveBilling(b))
    ];
    await Promise.all(savePromises);
    
    setTimeout(() => {
      setIsSaving(false);
      setSelectedUnit(null);
      setMeterInput("");
    }, 500);
  };

  const toggleStatus = async (billingId: string) => {
    const billing = billings.find(b => b.id === billingId);
    if (!billing) return;
    const unit = units.find(u => u.id === billing.unitId);
    const newStatus = billing.status === "LUNAS" ? "BELUM_LUNAS" : "LUNAS";
    const updatedBilling = { ...billing, status: newStatus as any };
    
    let updatedBillingsList = billings.map(b => b.id === billingId ? updatedBilling : b);
    const { affectedBillings } = recalculateUnitBillings(billing.unitId, updatedBillingsList);
    
    // Audit Log
    const auditLog: AuditLog = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: "UPDATE_STATUS_AIR",
      targetId: billing.unitId,
      details: JSON.stringify({
        unit: unit ? `${unit.block}${unit.unitNumber}` : 'Unknown',
        month: billing.month,
        year: billing.year,
        oldStatus: billing.status,
        newStatus: newStatus
      })
    };

    const savePromises = [
      db.saveBilling(updatedBilling),
      db.saveAuditLog(auditLog),
      ...affectedBillings.map(b => db.saveBilling(b))
    ];
    await Promise.all(savePromises);
  };

  const sendWhatsApp = (unit: Unit, billing: Billing) => {
    const message = `Halo Bapak/Ibu ${unit.residentName}, tagihan air Unit ${unit.block}${unit.unitNumber} bulan ${new Date().toLocaleString('id-ID', { month: 'long' })} adalah ${formatCurrency(billing.totalBill)}. Rincian: Air ${formatCurrency(billing.waterBill)}, Sampah ${formatCurrency(billing.trashBill)}${billing.debtPrev > 0 ? `, Tunggakan ${formatCurrency(billing.debtPrev)}` : ''}. Mohon segera bayar ke Koordinator Lantai ${user.floor}. Terima kasih.`;
    window.open(`https://wa.me/${unit.phoneNumber.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const filteredUnits = units
    .filter(u => 
      u.unitNumber.includes(searchTerm) || u.residentName.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (a.block !== b.block) return a.block.localeCompare(b.block);
      return a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true });
    });

  const pendingUnits = filteredUnits.filter(u => !getUnitBilling(u.id));
  const completedUnits = filteredUnits.filter(u => !!getUnitBilling(u.id));

  return (
    <div className="max-w-xl mx-auto pb-32 px-4">
      {/* Sticky Top Navigation */}
      <div className="sticky top-0 z-40 bg-gray-50/95 backdrop-blur-md pt-6 pb-4 -mx-4 px-4 space-y-4 border-b border-gray-200/50">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
            <p className="text-xs font-semibold text-gray-500">Lantai {user.floor}</p>
          </div>
          <div className="flex p-1 bg-gray-200/50 rounded-xl w-full max-w-[400px] border border-gray-200/50 overflow-x-auto no-scrollbar">
            <button 
              onClick={() => setActiveTab("INPUT")}
              className={cn(
                "flex-1 py-1.5 px-3 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap",
                activeTab === "INPUT" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
              )}
            >
              Input
            </button>
            <button 
              onClick={() => setActiveTab("HISTORY")}
              className={cn(
                "flex-1 py-1.5 px-3 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap",
                activeTab === "HISTORY" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
              )}
            >
              Riwayat
            </button>
            <button 
              onClick={() => setActiveTab("DANA")}
              className={cn(
                "flex-1 py-1.5 px-3 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap",
                activeTab === "DANA" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
              )}
            >
              Dana
            </button>
            <button 
              onClick={() => setActiveTab("SETORAN")}
              className={cn(
                "flex-1 py-1.5 px-3 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap",
                activeTab === "SETORAN" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
              )}
            >
              Setoran
            </button>
            <button 
              onClick={() => setActiveTab("KELUHAN")}
              className={cn(
                "flex-1 py-1.5 px-3 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap",
                activeTab === "KELUHAN" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
              )}
            >
              Keluhan
            </button>
          </div>
        </div>

        {activeTab === "INPUT" && (
          <div className="flex flex-col gap-3">
            <div className="relative group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={16} />
              <input 
                type="text" 
                placeholder="Cari unit atau nama..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium shadow-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2 bg-white p-1 rounded-xl shadow-sm border border-gray-100">
              <div className="flex-1 flex items-center px-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase mr-2">Bulan</span>
                <select 
                  className="flex-1 bg-transparent text-xs font-bold text-gray-700 outline-none cursor-pointer py-1.5"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i}>{new Date(2024, i).toLocaleString('id-ID', { month: 'long' })}</option>
                  ))}
                </select>
              </div>
              <div className="w-[1px] h-4 bg-gray-100 self-center" />
              <div className="flex-1 flex items-center px-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase mr-2">Tahun</span>
                <select 
                  className="flex-1 bg-transparent text-xs font-bold text-gray-700 outline-none cursor-pointer py-1.5"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                >
                  {[2025, 2026, 2027].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {activeTab === "INPUT" ? (
        <div className="mt-4 space-y-4">
          <div className="px-1 flex justify-between items-center">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Daftar Unit ({filteredUnits.length})</p>
            <button 
              onClick={() => setIsMobileMode(!isMobileMode)}
              className={cn(
                "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border",
                isMobileMode ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-500 border-gray-200"
              )}
            >
              Mode Mobile: {isMobileMode ? "ON" : "OFF"}
            </button>
          </div>
          {filteredUnits.map(unit => {
            const billing = getUnitBilling(unit.id);
            const isOverdue = isAfterDue && billing?.status === "BELUM_LUNAS";

            if (isMobileMode) {
              return (
                <motion.div 
                  key={unit.id}
                  layout
                  className={cn(
                    "bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center justify-between gap-4",
                    billing ? "border-green-100 bg-green-50/10" : "border-blue-100 bg-blue-50/10"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-[80px]">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm border",
                      billing ? "bg-green-600 text-white border-green-600" : "bg-blue-600 text-white border-blue-600"
                    )}>
                      {unit.block}{unit.unitNumber}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-[10px] font-bold text-gray-400 uppercase truncate leading-none mb-1">{unit.residentName}</p>
                      <p className="text-[9px] text-gray-500 leading-none">Prev: {billing?.meterPrev || unit.initialMeter}</p>
                    </div>
                  </div>

                  <div className="flex-1 flex items-center gap-2">
                    <input 
                      type="number"
                      placeholder="Meteran"
                      className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
                      defaultValue={billing?.meterCurrent || ""}
                      onBlur={(e) => {
                        const val = e.target.value;
                        if (val && (!billing || parseFloat(val) !== billing.meterCurrent)) {
                          setSelectedUnit(unit);
                          setMeterInput(val);
                          setIsVacantInput(unit.isVacant);
                          // Trigger save logic if needed or just set state to show modal
                          // For mobile mode, maybe we should have a direct save button or just use the existing modal
                        }
                      }}
                    />
                    {!billing ? (
                      <button 
                        onClick={() => {
                          setSelectedUnit(unit);
                          setIsVacantInput(unit.isVacant);
                          const allUnitBillings = billings
                            .filter(b => b.unitId === unit.id)
                            .sort((a, b) => (b.year * 12 + b.month) - (a.year * 12 + a.month));
                          const prevBill = allUnitBillings.find(b => (b.year * 12 + b.month) < (selectedYear * 12 + selectedMonth));
                          setMeterInput(prevBill ? prevBill.meterCurrent.toString() : unit.initialMeter.toString());
                        }}
                        className="p-2 bg-blue-600 text-white rounded-lg shadow-sm"
                      >
                        <Save size={16} />
                      </button>
                    ) : (
                      <button 
                        onClick={() => {
                          setSelectedUnit(unit);
                          setMeterInput(billing.meterCurrent.toString());
                          setIsVacantInput(billing.isVacant);
                        }}
                        className="p-2 bg-gray-100 text-gray-400 rounded-lg border border-gray-200"
                      >
                        <Edit3 size={16} />
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            }

            return (
              <motion.div 
                key={unit.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "bg-white rounded-2xl p-5 shadow-sm border border-gray-100 transition-all hover:shadow-md",
                  billing ? "bg-white" : "bg-white/50",
                  isOverdue && "border-red-200 bg-red-50/30"
                )}
              >
                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center font-bold text-base transition-all border cursor-pointer hover:scale-105",
                      billing ? "bg-blue-600 text-white border-blue-600" : "bg-gray-50 text-gray-400 border-gray-100"
                    )} onClick={() => setDetailUnit(unit)}>
                      {unit.block}{unit.unitNumber}
                    </div>
                    <div>
                      <button 
                        onClick={() => setDetailUnit(unit)}
                        className="font-bold text-gray-900 text-base tracking-tight leading-tight hover:text-blue-600 transition-colors text-left"
                      >
                        {unit.residentName}
                      </button>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Lantai {unit.floor}</span>
                        {unit.isVacant && (
                          <span className="px-1.5 py-0.5 bg-orange-50 text-orange-600 text-[8px] font-bold rounded uppercase border border-orange-100">Kosong</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {billing && (
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900 leading-none">{formatCurrency(billing.totalBill)}</p>
                      {billing.debtPrev > 0 && (
                        <p className="text-[9px] font-bold text-red-500 mt-1">
                          Hutang: {formatCurrency(billing.debtPrev)}
                        </p>
                      )}
                      <p className={cn(
                        "text-[9px] font-bold uppercase tracking-wider mt-2 px-2.5 py-1 rounded-full inline-block border",
                        billing.status === "LUNAS" ? "bg-green-50 text-green-700 border-green-100" : "bg-red-50 text-red-700 border-red-100"
                      )}>
                        {billing.status === "LUNAS" ? "Lunas" : "Belum Lunas"}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {!billing ? (
                    <button 
                      onClick={() => {
                        setSelectedUnit(unit);
                        setIsVacantInput(unit.isVacant);
                        const allUnitBillings = billings
                          .filter(b => b.unitId === unit.id)
                          .sort((a, b) => (b.year * 12 + b.month) - (a.year * 12 + a.month));
                        const prevBill = allUnitBillings.find(b => (b.year * 12 + b.month) < (selectedYear * 12 + selectedMonth));
                        setMeterInput(prevBill ? prevBill.meterCurrent.toString() : unit.initialMeter.toString());
                      }}
                      className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold text-xs hover:bg-blue-700 active:scale-[0.98] transition-all shadow-md shadow-blue-100"
                    >
                      Catat Meteran
                    </button>
                  ) : (
                    <>
                      <button 
                        onClick={() => toggleStatus(billing.id)}
                        className={cn(
                          "flex-1 py-3 rounded-xl font-bold text-xs transition-all border",
                          billing.status === "LUNAS" 
                            ? "bg-green-50/50 text-green-700 border-green-100 hover:bg-green-50" 
                            : "bg-red-50/50 text-red-700 border-red-100 hover:bg-red-50"
                        )}
                      >
                        {billing.status === "LUNAS" ? "Lunas" : "Belum Lunas"}
                      </button>
                      <button 
                        onClick={() => sendWhatsApp(unit, billing)}
                        className="w-11 h-11 bg-green-500 text-white rounded-xl flex items-center justify-center hover:bg-green-600 transition-all shadow-md shadow-green-100"
                      >
                        <MessageSquare size={18} />
                      </button>
                      <button 
                        onClick={() => setDetailUnit(unit)}
                        className="w-11 h-11 bg-white text-gray-400 rounded-xl flex items-center justify-center hover:bg-gray-50 transition-all border border-gray-200"
                      >
                        <Eye size={18} />
                      </button>
                      <button 
                        onClick={() => {
                          const isPastMonth = (selectedYear * 12 + selectedMonth) < (realYear * 12 + realMonth);
                          if (isPastMonth && user.role !== "ADMIN") {
                            alert("Data terkunci.");
                            return;
                          }
                          setSelectedUnit(unit);
                          setMeterInput(billing.meterCurrent.toString());
                          setIsVacantInput(billing.isVacant);
                        }}
                        className="w-11 h-11 bg-white text-gray-400 rounded-xl flex items-center justify-center hover:bg-gray-50 transition-all border border-gray-200"
                      >
                        <Edit3 size={18} />
                      </button>
                    </>
                  )}
                </div>
                
                {isOverdue && (
                  <div className="mt-3.5 flex items-center gap-2 text-red-500 bg-red-50/50 p-2 rounded-lg border border-red-100/50">
                    <AlertTriangle size={12} />
                    <span className="text-[9px] font-bold uppercase tracking-widest">Tunggakan Terdeteksi</span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      ) : activeTab === "HISTORY" ? (
        <div className="mt-4 space-y-4">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 leading-tight">Riwayat Tagihan</h2>
            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mt-1">Lantai {user.floor}</p>
          </div>

          <div className="space-y-3">
            {billings
              .filter(b => units.find(u => u.id === b.unitId))
              .sort((a, b) => (b.year * 12 + b.month) - (a.year * 12 + a.month))
              .map(b => {
                const unit = units.find(u => u.id === b.unitId);
                if (!unit) return null;
                
                return (
                  <motion.div 
                    key={b.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 font-bold text-xs">
                        {unit.block}{unit.unitNumber}
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-blue-500 uppercase tracking-widest">{getMonthName(b.month)} {b.year}</p>
                        <p className="text-sm font-bold text-gray-900 leading-none mt-1">{unit.residentName}</p>
                        <p className="text-[10px] text-gray-400 font-medium mt-1.5">{b.usage} m³ • {b.meterCurrent} m³</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">{formatCurrency(b.totalBill)}</p>
                      <div className={cn(
                        "mt-1 text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full inline-block",
                        b.status === "LUNAS" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                      )}>
                        {b.status}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-gray-900 leading-tight">Pengajuan Dana</h2>
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mt-1">Lantai {user.floor}</p>
            </div>
            <button 
              onClick={() => setShowAddRequest(true)}
              className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all"
            >
              <Plus size={20} />
            </button>
          </div>

          <div className="space-y-4">
            {fundRequests.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-gray-200">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Wallet className="text-gray-300" size={24} />
                </div>
                <p className="text-gray-500 font-medium">Belum ada pengajuan dana</p>
                <button 
                  onClick={() => setShowAddRequest(true)}
                  className="mt-4 text-blue-600 font-bold text-sm"
                >
                  Buat Pengajuan Baru
                </button>
              </div>
            ) : (
              fundRequests.map(request => (
                <motion.div 
                  key={request.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center",
                        request.status === "PENDING" ? "bg-amber-50 text-amber-600" :
                        request.status === "DISBURSED" ? "bg-blue-50 text-blue-600" :
                        request.status === "REPORTED" ? "bg-purple-50 text-purple-600" :
                        request.status === "COMPLETED" ? "bg-green-50 text-green-600" :
                        "bg-red-50 text-red-600"
                      )}>
                        {request.status === "PENDING" ? <Clock size={24} /> :
                         request.status === "DISBURSED" ? <Wallet size={24} /> :
                         request.status === "REPORTED" ? <FileText size={24} /> :
                         request.status === "COMPLETED" ? <CheckCircle2 size={24} /> :
                         <AlertCircle size={24} />}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">{request.title}</h3>
                        <p className="text-[10px] text-gray-500 font-medium mt-0.5">
                          {new Date(request.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                        <div className={cn(
                          "mt-2 px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest inline-block",
                          request.status === "PENDING" ? "bg-amber-50 text-amber-600" :
                          request.status === "DISBURSED" ? "bg-blue-50 text-blue-600" :
                          request.status === "REPORTED" ? "bg-purple-50 text-purple-600" :
                          request.status === "COMPLETED" ? "bg-green-50 text-green-600" :
                          "bg-red-50 text-red-600"
                        )}>
                          {request.status === "PENDING" ? "Menunggu Persetujuan" :
                           request.status === "DISBURSED" ? "Dana Sudah Cair" :
                           request.status === "REPORTED" ? "Laporan Terkirim" :
                           request.status === "COMPLETED" ? "Selesai" : "Ditolak"}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Estimasi</p>
                      <p className="text-sm font-bold text-gray-900">{formatCurrency(request.estimatedAmount)}</p>
                      {request.actualAmount && (
                        <div className="mt-2">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Terpakai</p>
                          <p className="text-sm font-bold text-blue-600">{formatCurrency(request.actualAmount)}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {request.status === "DISBURSED" && (
                    <button 
                      onClick={() => setShowReportModal(request)}
                      className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                    >
                      <Camera size={18} />
                      Lapor Pemakaian Dana
                    </button>
                  )}

                  {request.status === "REPORTED" && (
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-3">
                      <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-purple-600 shadow-sm">
                        <Clock size={16} />
                      </div>
                      <p className="text-[10px] font-medium text-gray-500">Menunggu verifikasi laporan oleh Admin/Bendahara</p>
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === "SETORAN" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <Wallet className="text-blue-600" size={20} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Setoran Dana Kolektif</h3>
                <p className="text-xs text-gray-400">Lantai {user.floor} • {getMonthName(selectedMonth)} {selectedYear}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {["WATER", "TRASH"].map((cat) => {
                const category = cat as "WATER" | "TRASH";
                const floorBillings = billings.filter(b => 
                  units.some(u => u.id === b.unitId) && 
                  b.month === selectedMonth && 
                  b.year === selectedYear && 
                  b.status === "LUNAS"
                );
                const collected = floorBillings.reduce((sum, b) => sum + (category === "WATER" ? b.waterBill : b.trashBill), 0);
                const transaction = finances.find(f => 
                  f.floor === user.floor && 
                  f.month === selectedMonth && 
                  f.year === selectedYear && 
                  f.category === category &&
                  f.type === "INCOME"
                );

                return (
                  <div key={category} className="p-4 rounded-2xl border border-gray-100 bg-gray-50/50">
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        {category === "WATER" ? "Iuran Air (PDAM)" : "Iuran Sampah"}
                      </span>
                      {transaction && (
                        <span className={cn(
                          "text-[8px] font-bold uppercase px-2 py-0.5 rounded-full",
                          transaction.status === "APPROVED" ? "bg-green-100 text-green-700" :
                          transaction.status === "PENDING" ? "bg-yellow-100 text-yellow-700" :
                          "bg-red-100 text-red-700"
                        )}>
                          {transaction.status}
                        </span>
                      )}
                    </div>
                    <p className="text-xl font-bold text-gray-900 mb-4">{formatCurrency(collected)}</p>
                    <button
                      onClick={() => handleSubmitSetoran(category)}
                      disabled={collected <= 0 || !!transaction}
                      className={cn(
                        "w-full py-2.5 rounded-xl font-bold text-xs transition-all",
                        transaction ? "bg-gray-100 text-gray-400 cursor-not-allowed" :
                        "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                      )}
                    >
                      {transaction ? "Sudah Diajukan" : "Ajukan Setoran"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-4">Riwayat Setoran</h3>
            <div className="space-y-3">
              {finances
                .filter(f => f.floor === user.floor && f.recordedBy === user.id)
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map(f => (
                  <div key={f.id} className="flex items-center justify-between p-4 rounded-2xl border border-gray-50 hover:border-gray-100 transition-all">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        f.status === "APPROVED" ? "bg-green-50 text-green-600" : "bg-yellow-50 text-yellow-600"
                      )}>
                        {f.category === "WATER" ? <Droplets size={20} /> : <Trash2 size={20} />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{f.description}</p>
                        <p className="text-[10px] text-gray-400">{new Date(f.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">{formatCurrency(f.amount)}</p>
                      <p className={cn(
                        "text-[9px] font-bold uppercase",
                        f.status === "APPROVED" ? "text-green-600" : "text-yellow-600"
                      )}>{f.status}</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "KELUHAN" && (
        <div className="mt-4 space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 leading-tight">Keluhan Warga</h2>
            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mt-1">Lantai {user.floor}</p>
          </div>

          <div className="space-y-4">
            {complaints.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-gray-200">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="text-gray-300" size={24} />
                </div>
                <p className="text-gray-500 font-medium">Belum ada keluhan di lantai ini</p>
              </div>
            ) : (
              complaints.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(c => {
                const unit = units.find(u => u.id === c.unitId);
                return (
                  <motion.div 
                    key={c.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center font-bold text-xs">
                          {unit?.block}{unit?.unitNumber}
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900">{c.title}</h4>
                          <p className="text-[10px] text-gray-400 font-bold uppercase">{c.residentName} • {new Date(c.createdAt).toLocaleDateString("id-ID")}</p>
                        </div>
                      </div>
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
                    <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-xl italic">"{c.description}"</p>
                    
                    {c.response ? (
                      <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                        <p className="text-[10px] font-bold text-blue-600 uppercase mb-1">Respon:</p>
                        <p className="text-sm text-gray-700">{c.response}</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <textarea 
                          placeholder="Tulis respon atau tindakan..."
                          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                          rows={2}
                          value={complaintResponse?.id === c.id ? complaintResponse.text : ""}
                          onChange={(e) => setComplaintResponse({ id: c.id, text: e.target.value })}
                        />
                        <button 
                          onClick={() => handleResolveComplaint(c.id, complaintResponse?.text || "Keluhan telah ditindaklanjuti.")}
                          className="w-full bg-purple-600 text-white py-2 rounded-xl font-bold text-xs hover:bg-purple-700 transition-all flex items-center justify-center gap-2"
                        >
                          <Check size={16} />
                          Tandai Selesai
                        </button>
                      </div>
                    )}
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      )}
      <AnimatePresence>
        {showAddRequest && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-white w-full max-w-md rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b flex justify-between items-center bg-blue-600 text-white">
                <h3 className="text-xl font-bold">Pengajuan Dana Baru</h3>
                <button onClick={() => setShowAddRequest(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <XCircle size={24} />
                </button>
              </div>
              <form onSubmit={handleAddRequest} className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Judul Pengajuan</label>
                  <input 
                    type="text" 
                    placeholder="Misal: Ganti Lampu Lantai 5"
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium focus:bg-white focus:border-blue-500 outline-none transition-all"
                    value={newRequest.title}
                    onChange={(e) => setNewRequest({ ...newRequest, title: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Keterangan</label>
                  <textarea 
                    placeholder="Jelaskan detail kebutuhan dana..."
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium focus:bg-white focus:border-blue-500 outline-none transition-all h-24 resize-none"
                    value={newRequest.description}
                    onChange={(e) => setNewRequest({ ...newRequest, description: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Estimasi Dana (Rp)</label>
                  <input 
                    type="number" 
                    placeholder="0"
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:bg-white focus:border-blue-500 outline-none transition-all"
                    value={newRequest.amount || ""}
                    onChange={(e) => setNewRequest({ ...newRequest, amount: Number(e.target.value) })}
                    required
                  />
                </div>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-100"
                >
                  {isSubmitting ? <RefreshCw className="animate-spin" size={20} /> : <Plus size={20} />}
                  KIRIM PENGAJUAN
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Report Modal */}
      <AnimatePresence>
        {showReportModal && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-white w-full max-w-md rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b flex justify-between items-center bg-blue-600 text-white">
                <h3 className="text-xl font-bold">Lapor Pemakaian Dana</h3>
                <button onClick={() => setShowReportModal(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <XCircle size={24} />
                </button>
              </div>
              <form onSubmit={handleSubmitReport} className="p-6 space-y-6">
                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Dana Cair</p>
                  <p className="text-xl font-bold text-blue-900">{formatCurrency(showReportModal.estimatedAmount)}</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Total Terpakai (Rp)</label>
                  <input 
                    type="number" 
                    placeholder="0"
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:bg-white focus:border-blue-500 outline-none transition-all"
                    value={reportData.actualAmount || ""}
                    onChange={(e) => setReportData({ ...reportData, actualAmount: Number(e.target.value) })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Bukti Nota (Foto)</label>
                  <div className="relative">
                    <input 
                      type="file" 
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      id="receipt-upload"
                      onChange={handleFileChange}
                    />
                    <label 
                      htmlFor="receipt-upload"
                      className="w-full p-8 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all"
                    >
                      {reportData.receiptUrl ? (
                        <div className="relative w-full aspect-video rounded-xl overflow-hidden">
                          <img src={reportData.receiptUrl} alt="Nota" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                            <Camera className="text-white" size={32} />
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-gray-400">
                            <Camera size={24} />
                          </div>
                          <p className="text-xs font-bold text-gray-500">Ambil Foto Nota</p>
                        </>
                      )}
                    </label>
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={isSubmitting || !reportData.receiptUrl}
                  className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-100"
                >
                  {isSubmitting ? <RefreshCw className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                  KIRIM LAPORAN
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Meter Input Modal */}
      <AnimatePresence>
        {selectedUnit && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-white w-full max-w-md rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b flex justify-between items-center bg-blue-600 text-white">
                <div>
                  <h3 className="text-xl font-bold">Catat Meteran Air</h3>
                  <p className="text-xs text-blue-100 font-medium">Unit {selectedUnit.block}{selectedUnit.unitNumber} • {selectedUnit.residentName}</p>
                </div>
                <button onClick={() => setSelectedUnit(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <XCircle size={24} />
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Bulan</p>
                    <p className="text-sm font-bold text-gray-900">{getMonthName(selectedMonth)} {selectedYear}</p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">Meteran Lalu</p>
                    <p className="text-sm font-bold text-blue-900">{currentPrevMeter} m³</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Angka Meteran Baru</label>
                  <div className="relative">
                    <Droplets className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500" size={20} />
                    <input 
                      type="number" 
                      placeholder="0"
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-xl text-2xl font-black focus:bg-white focus:border-blue-500 outline-none transition-all"
                      value={meterInput}
                      onChange={(e) => setMeterInput(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-orange-50 rounded-2xl border border-orange-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-orange-500 shadow-sm">
                      <Clock size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-orange-800 uppercase tracking-wider">Status Unit</p>
                      <p className="text-xs font-medium text-orange-700">Tandai jika unit kosong</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsVacantInput(!isVacantInput)}
                    className={cn(
                      "w-12 h-6 rounded-full transition-all relative",
                      isVacantInput ? "bg-orange-500" : "bg-gray-200"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                      isVacantInput ? "right-1" : "left-1"
                    )} />
                  </button>
                </div>

                <div className="pt-2">
                  <button 
                    onClick={handleSaveMeter}
                    disabled={isSaving || meterInput === ""}
                    className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-100 disabled:opacity-50"
                  >
                    {isSaving ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
                    SIMPAN DATA METERAN
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Unit Detail Modal */}
      {detailUnit && (
        <UnitDetailModal 
          unit={detailUnit} 
          user={user} 
          onClose={() => setDetailUnit(null)} 
        />
      )}
    </div>
  );
}
