import React, { useState, useEffect } from "react";
import { Billing, Unit, Settings, User, Complaint } from "../types";
import { db } from "../db";
import { 
  AlertTriangle, 
  Search, 
  Download, 
  FileSpreadsheet, 
  Filter, 
  ChevronRight, 
  Clock, 
  UserX, 
  MessageSquare, 
  StickyNote, 
  Droplets, 
  CheckCircle2, 
  XCircle, 
  Edit3, 
  AlertCircle, 
  Save, 
  RefreshCw, 
  Home, 
  Check, 
  Eye,
  LayoutDashboard
} from "lucide-react";
import { formatCurrency, cn } from "../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import { UnitDetailModal } from "../components/UnitDetailModal";

interface PengelolaDashboardProps {
  user: User;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export function PengelolaDashboard({ user, activeTab = "dashboard", onTabChange }: PengelolaDashboardProps) {
  const [billings, setBillings] = useState<Billing[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [settings, setSettings] = useState<Settings>({
    waterBaseRate: 25000,
    waterBaseLimit: 10,
    waterExtraRate: 2500,
    trashRate: 10000,
    dueDay: 10
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFloor, setSelectedFloor] = useState<number | "ALL">("ALL");
  
  // States
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isSaving, setIsSaving] = useState(false);
  const [complaintResponse, setComplaintResponse] = useState<{id: string, text: string} | null>(null);
  const [detailUnit, setDetailUnit] = useState<Unit | null>(null);

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const isAfterDue = new Date().getDate() > settings.dueDay;

  useEffect(() => {
    const unsubscribeBillings = db.subscribeBillings(setBillings);
    const unsubscribeUnits = db.subscribeUnits(setUnits);
    const unsubscribeSettings = db.subscribeSettings(setSettings);
    const unsubscribeComplaints = db.subscribeComplaints(setComplaints);
    
    return () => {
      unsubscribeBillings();
      unsubscribeUnits();
      unsubscribeSettings();
      unsubscribeComplaints();
    };
  }, []);

  const getOverdueMonths = (unitId: string) => {
    return billings.filter(b => b.unitId === unitId && b.status === "BELUM_LUNAS").length;
  };

  const getHousingOverdueMonths = (unitId: string) => {
    return billings.filter(b => b.unitId === unitId && b.housingPaymentStatus === "BELUM_LUNAS").length;
  };

  const currentMonthBillings = billings.filter(b => b.month === currentMonth && b.year === currentYear);

  const waterOverdueList = currentMonthBillings
    .filter(b => b.status === "BELUM_LUNAS")
    .map(b => {
      const unit = units.find(u => u.id === b.unitId);
      return {
        ...b,
        unit,
        overdueCount: getOverdueMonths(b.unitId)
      };
    })
    .filter(item => 
      (selectedFloor === "ALL" || item.unit?.floor === selectedFloor) &&
      (item.unit?.unitNumber.includes(searchTerm) || item.unit?.residentName.toLowerCase().includes(searchTerm.toLowerCase()))
    );

  const housingOverdueList = currentMonthBillings
    .filter(b => b.housingPaymentStatus === "BELUM_LUNAS")
    .map(b => {
      const unit = units.find(u => u.id === b.unitId);
      return {
        ...b,
        unit,
        overdueCount: getHousingOverdueMonths(b.unitId)
      };
    })
    .filter(item => 
      (selectedFloor === "ALL" || item.unit?.floor === selectedFloor) &&
      (item.unit?.unitNumber.includes(searchTerm) || item.unit?.residentName.toLowerCase().includes(searchTerm.toLowerCase()))
    );

  const exportToExcel = () => {
    const data = [...waterOverdueList, ...housingOverdueList].map(item => ({
      "Unit": `${item.unit?.block}${item.unit?.unitNumber}`,
      "Lantai": item.unit?.floor,
      "Nama Penghuni": item.unit?.residentName,
      "No. KTP": item.unit?.ktpNumber,
      "No. HP": item.unit?.phoneNumber,
      "Tagihan Air": item.waterBill + item.trashBill,
      "Tunggakan Air": item.status === "BELUM_LUNAS" ? "YA" : "TIDAK",
      "Tunggakan Hunian": item.housingPaymentStatus === "BELUM_LUNAS" ? "YA" : "TIDAK",
      "Bulan Menunggak Air": getOverdueMonths(item.unitId),
      "Bulan Menunggak Hunian": getHousingOverdueMonths(item.unitId),
      "Total Tagihan": item.totalBill
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Daftar Penunggak");
    XLSX.writeFile(wb, `Daftar_Penunggak_Rusunawa_${new Date().toLocaleDateString()}.xlsx`);
  };

  const getUnitBilling = (unitId: string) => {
    return billings.find(b => b.unitId === unitId && b.month === selectedMonth && b.year === selectedYear);
  };

  const handleResolveComplaint = async (complaintId: string, response: string) => {
    const complaint = complaints.find(c => c.id === complaintId);
    if (!complaint) return;
    
    const updated: Complaint = {
      ...complaint,
      status: "RESOLVED",
      response
    };
    await db.saveComplaint(updated);
    setComplaintResponse(null);
  };

  const toggleHousingStatus = async (unitId: string) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const existingBilling = billings.find(b => b.unitId === unitId && b.month === selectedMonth && b.year === selectedYear);
      
      if (existingBilling) {
        const newStatus = existingBilling.housingPaymentStatus === "LUNAS" ? "BELUM_LUNAS" : "LUNAS";
        const updated: Billing = {
          ...existingBilling,
          housingPaymentStatus: newStatus as any,
          housingUpdatedAt: new Date().toISOString(),
          housingUpdatedBy: user.id
        };
        await db.saveBilling(updated);
      } else {
        const unit = units.find(u => u.id === unitId);
        if (!unit) return;

        const allUnitBillings = billings.filter(b => b.unitId === unitId).sort((a, b) => (b.year * 12 + b.month) - (a.year * 12 + a.month));
        const prevBill = allUnitBillings.find(b => (b.year * 12 + b.month) < (selectedYear * 12 + selectedMonth));
        const meterPrev = prevBill ? prevBill.meterCurrent : unit.initialMeter;
        
        const lastMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
        const lastYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
        const lastMonthBilling = billings.find(b => b.unitId === unitId && b.month === lastMonth && b.year === lastYear);
        const debtPrev = lastMonthBilling && lastMonthBilling.status === "BELUM_LUNAS" ? lastMonthBilling.totalBill : 0;

        const newBilling: Billing = {
          id: Math.random().toString(36).substr(2, 9),
          unitId,
          month: selectedMonth,
          year: selectedYear,
          meterPrev,
          meterCurrent: meterPrev,
          usage: 0,
          waterBill: 0,
          trashBill: 0,
          debtPrev,
          totalBill: debtPrev,
          status: "BELUM_LUNAS",
          housingPaymentStatus: "BELUM_LUNAS",
          isVacant: unit.isVacant,
          updatedAt: new Date().toISOString(),
          updatedBy: user.id,
          housingUpdatedAt: new Date().toISOString(),
          housingUpdatedBy: user.id
        };
        await db.saveBilling(newBilling);
      }
    } catch (err) {
      console.error("Error toggling housing status:", err);
      alert("Gagal merubah status hunian. Pastikan database sudah diupdate dengan SQL yang diberikan.");
    } finally {
      setIsSaving(false);
    }
  };

  const getMonthName = (monthIndex: number) => {
    return new Date(2024, monthIndex).toLocaleString('id-ID', { month: 'long' });
  };

  const filteredUnits = units
    .filter(u => 
      (selectedFloor === "ALL" || u.floor === selectedFloor) &&
      (u.unitNumber.includes(searchTerm) || u.residentName.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => {
      if (a.floor !== b.floor) return a.floor - b.floor;
      return a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true });
    });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            {activeTab === "tagihan" ? <Droplets className="text-blue-600" /> : 
             activeTab === "hunian" ? <Home className="text-indigo-600" /> :
             activeTab === "keluhan" ? <MessageSquare className="text-purple-600" /> :
             <AlertTriangle className="text-red-600" />}
            {activeTab === "tagihan" ? "Monitoring Tagihan Air" : 
             activeTab === "hunian" ? "Input Status Biaya Hunian" :
             activeTab === "keluhan" ? "Keluhan Warga" :
             "Daftar Penunggak (Punishment)"}
          </h2>
          <p className="text-gray-500">
            {activeTab === "tagihan" ? "Data tagihan air dari Koordinator Lantai" : 
             activeTab === "hunian" ? "Kelola status pembayaran biaya hunian warga" :
             activeTab === "keluhan" ? "Lihat dan respon keluhan dari warga" :
             "Warga yang belum melunasi tagihan air & sampah"}
          </p>
        </div>
        {activeTab === "penunggak" && (
          <button 
            onClick={exportToExcel}
            className="bg-green-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-green-700 transition-all shadow-lg shadow-green-100"
          >
            <FileSpreadsheet size={20} />
            Export Excel
          </button>
        )}
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Cari unit atau nama..."
            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200">
          <button 
            onClick={() => setSelectedFloor("ALL")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-bold transition-all",
              selectedFloor === "ALL" ? "bg-white text-blue-600 shadow-sm" : "text-gray-600 hover:bg-gray-50"
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
                selectedFloor === f ? "bg-white text-blue-600 shadow-sm" : "text-gray-600 hover:bg-gray-50"
              )}
            >
              Lt {f}
            </button>
          ))}
        </div>
        {activeTab === "tagihan" && (
          <div className="flex gap-2 bg-gray-100 p-1 rounded-xl border border-gray-200">
            <select 
              className="bg-transparent text-sm font-bold text-gray-700 outline-none px-2"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i}>{getMonthName(i)}</option>
              ))}
            </select>
            <select 
              className="bg-transparent text-sm font-bold text-gray-700 outline-none px-2"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
            >
              {[2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Content */}
      {(activeTab === "tagihan" || activeTab === "penunggak") && (
        <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="text-red-600" size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-red-800">Peringatan Tunggakan</p>
              <p className="text-xs text-red-600">
                Ada {billings.filter(b => b.month === currentMonth && b.year === currentYear && (b.status === "BELUM_LUNAS" || b.housingPaymentStatus === "BELUM_LUNAS")).length} unit yang belum melunasi kewajiban bulan ini.
              </p>
            </div>
          </div>
          <button 
            onClick={() => onTabChange && onTabChange("penunggak")}
            className="text-xs font-bold text-red-700 hover:underline"
          >
            Lihat Detail
          </button>
        </div>
      )}

      {activeTab === "hunian" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Edit3 className="text-blue-600" />
                  Input Status Biaya Hunian
                </h2>
                <p className="text-sm text-gray-500">Centang unit yang sudah bayar, uncheck yang belum bayar.</p>
              </div>
              <div className="flex gap-2 bg-gray-100 p-1 rounded-xl border border-gray-200">
                <select 
                  className="bg-transparent text-sm font-bold text-gray-700 outline-none px-2"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i}>{getMonthName(i)}</option>
                  ))}
                </select>
                <select 
                  className="bg-transparent text-sm font-bold text-gray-700 outline-none px-2"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                >
                  {[2025, 2026, 2027].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {units.sort((a, b) => {
                if (a.floor !== b.floor) return a.floor - b.floor;
                return a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true });
              }).map(unit => {
                const billing = getUnitBilling(unit.id);
                const isPaid = billing ? billing.housingPaymentStatus === "LUNAS" : true;

                return (
                  <button
                    key={unit.id}
                    onClick={() => toggleHousingStatus(unit.id)}
                    disabled={isSaving}
                    className={cn(
                      "p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 text-center relative overflow-hidden",
                      isPaid ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700",
                      isSaving && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className="absolute top-1 right-1">
                      {isSaving ? (
                        <RefreshCw size={14} className="animate-spin text-blue-500" />
                      ) : (
                        isPaid ? <CheckCircle2 size={14} /> : <XCircle size={14} />
                      )}
                    </div>
                    <span className="text-lg font-black">{unit.block}{unit.unitNumber}</span>
                    <span className="text-[10px] font-bold uppercase opacity-70 truncate w-full px-1">{unit.residentName || "KOSONG"}</span>
                    <div className={cn(
                      "mt-1 px-2 py-0.5 rounded text-[8px] font-bold uppercase",
                      isPaid ? "bg-green-600 text-white" : "bg-red-600 text-white"
                    )}>
                      {isPaid ? "LUNAS" : "BELUM"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === "tagihan" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUnits.map(unit => {
            const billing = getUnitBilling(unit.id);
            return (
              <motion.div 
                key={unit.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm border",
                      billing ? "bg-blue-600 text-white border-blue-600" : "bg-gray-50 text-gray-400 border-gray-100"
                    )}>
                      {unit.block}{unit.unitNumber}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{unit.residentName}</h3>
                      <p className="text-[10px] text-gray-400 font-bold uppercase">Lantai {unit.floor}</p>
                    </div>
                  </div>
                  {billing && (
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">{formatCurrency(billing.waterBill + billing.trashBill)}</p>
                      <div className={cn(
                        "text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border mt-1",
                        billing.status === "LUNAS" ? "bg-green-50 text-green-700 border-green-100" : "bg-red-50 text-red-700 border-red-100"
                      )}>
                        {billing.status}
                      </div>
                    </div>
                  )}
                </div>

                {!billing ? (
                  <div className="p-3 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Menunggu Input Koordinator</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase">
                      <span>Pemakaian: {billing.usage} m³</span>
                      <span>Meter: {billing.meterCurrent}</span>
                    </div>
                    <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, (billing.usage / 20) * 100)}%` }} />
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      ) : activeTab === "keluhan" ? (
        <div className="space-y-6">
          {complaints.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {complaints.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(c => {
                const unit = units.find(u => u.id === c.unitId);
                return (
                  <motion.div 
                    key={c.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center font-bold">
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
                        <p className="text-[10px] font-bold text-blue-600 uppercase mb-1">Respon Anda:</p>
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
              })}
            </div>
          ) : (
            <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-100">
              <MessageSquare size={48} className="mx-auto mb-4 text-gray-200" />
              <p className="text-gray-500 font-medium">Belum ada keluhan dari warga</p>
            </div>
          )}
        </div>
      ) : activeTab === "penunggak" ? (
        <div className="space-y-12">
          {/* Penunggak Air Section */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-100 rounded-xl">
                <Droplets className="text-blue-600" size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Tunggakan Air & Sampah</h3>
                <p className="text-sm text-gray-500">Daftar warga yang belum melunasi tagihan air bulan ini.</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {waterOverdueList.length > 0 ? waterOverdueList.map(item => (
                <motion.div 
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "bg-white p-6 rounded-2xl shadow-sm border-2 transition-all relative overflow-hidden",
                    isAfterDue ? "border-red-100" : "border-gray-50"
                  )}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <button 
                        onClick={() => setDetailUnit(item.unit!)}
                        className="text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors"
                      >
                        {item.unit?.block}{item.unit?.unitNumber}
                      </button>
                      <p className="text-sm text-gray-500">Lantai {item.unit?.floor}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-red-600">{formatCurrency(item.totalBill)}</p>
                      <span className="text-[8px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded uppercase">PDAM</span>
                    </div>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <Clock className="text-orange-500" size={18} />
                      <div>
                        <p className="text-xs text-gray-400 uppercase font-bold">Durasi Tunggakan</p>
                        <p className="text-sm font-bold text-gray-900">{item.overdueCount} Bulan</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <UserX className="text-red-500" size={18} />
                      <div>
                        <p className="text-xs text-gray-400 uppercase font-bold">Nama Penghuni</p>
                        <p className="text-sm font-bold text-gray-900">{item.unit?.residentName}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={() => setDetailUnit(item.unit!)}
                      className="flex-1 bg-gray-100 text-gray-600 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-gray-200 transition-all"
                    >
                      <Eye size={16} />
                      Detail
                    </button>
                    <button 
                      onClick={() => window.open(`https://wa.me/${item.unit?.phoneNumber.replace(/\D/g, '')}`, '_blank')}
                      className="w-12 bg-green-500 text-white rounded-xl flex items-center justify-center hover:bg-green-600 transition-all"
                    >
                      <MessageSquare size={18} />
                    </button>
                  </div>
                </motion.div>
              )) : (
                <div className="col-span-full py-12 text-center text-gray-400 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-100">
                  <p className="font-medium">Tidak ada tunggakan air</p>
                </div>
              )}
            </div>
          </section>

          {/* Penunggak Hunian Section */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-orange-100 rounded-xl">
                <Home className="text-orange-600" size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Tunggakan Iuran Hunian</h3>
                <p className="text-sm text-gray-500">Daftar warga yang belum melunasi iuran hunian.</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {housingOverdueList.length > 0 ? housingOverdueList.map(item => (
                <motion.div 
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white p-6 rounded-2xl shadow-sm border-2 border-gray-50 transition-all relative overflow-hidden"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <button 
                        onClick={() => setDetailUnit(item.unit!)}
                        className="text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors"
                      >
                        {item.unit?.block}{item.unit?.unitNumber}
                      </button>
                      <p className="text-sm text-gray-500">Lantai {item.unit?.floor}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[8px] font-bold bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded uppercase">Hunian</span>
                    </div>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <Clock className="text-orange-500" size={18} />
                      <div>
                        <p className="text-xs text-gray-400 uppercase font-bold">Total Piutang</p>
                        <p className="text-sm font-bold text-gray-900">{item.overdueCount} Bulan</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <UserX className="text-red-500" size={18} />
                      <div>
                        <p className="text-xs text-gray-400 uppercase font-bold">Nama Penghuni</p>
                        <p className="text-sm font-bold text-gray-900">{item.unit?.residentName}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={() => setDetailUnit(item.unit!)}
                      className="flex-1 bg-gray-100 text-gray-600 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-gray-200 transition-all"
                    >
                      <Eye size={16} />
                      Detail
                    </button>
                    <button 
                      onClick={() => window.open(`https://wa.me/${item.unit?.phoneNumber.replace(/\D/g, '')}`, '_blank')}
                      className="w-12 bg-green-500 text-white rounded-xl flex items-center justify-center hover:bg-green-600 transition-all"
                    >
                      <MessageSquare size={18} />
                    </button>
                  </div>
                </motion.div>
              )) : (
                <div className="col-span-full py-12 text-center text-gray-400 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-100">
                  <p className="font-medium">Tidak ada tunggakan hunian</p>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}

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
