import React, { useState, useEffect } from "react";
import { Billing, Unit, Settings, User } from "../types";
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
  RefreshCw
} from "lucide-react";
import { formatCurrency, cn } from "../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";

interface PengelolaDashboardProps {
  user: User;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export function PengelolaDashboard({ user, activeTab = "dashboard", onTabChange }: PengelolaDashboardProps) {
  const [billings, setBillings] = useState<Billing[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [settings, setSettings] = useState<Settings>({
    waterBaseRate: 25000,
    waterBaseLimit: 10,
    waterExtraRate: 2500,
    trashRate: 10000,
    dueDay: 10
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFloor, setSelectedFloor] = useState<number | "ALL">("ALL");
  
  // Meter Input States
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [meterInput, setMeterInput] = useState("");
  const [isVacantInput, setIsVacantInput] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const isAfterDue = new Date().getDate() > settings.dueDay;

  useEffect(() => {
    const unsubscribeBillings = db.subscribeBillings(setBillings);
    const unsubscribeUnits = db.subscribeUnits(setUnits);
    const unsubscribeSettings = db.subscribeSettings(setSettings);
    
    return () => {
      unsubscribeBillings();
      unsubscribeUnits();
      unsubscribeSettings();
    };
  }, []);

  const getOverdueMonths = (unitId: string) => {
    return billings.filter(b => b.unitId === unitId && b.status === "BELUM_LUNAS").length;
  };

  const currentMonthBillings = billings.filter(b => b.month === currentMonth && b.year === currentYear);

  const overdueList = currentMonthBillings
    .filter(b => b.status === "BELUM_LUNAS" || b.housingPaymentStatus === "BELUM_LUNAS")
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

  const exportToExcel = () => {
    const data = overdueList.map(item => ({
      "Unit": `${item.unit?.block}${item.unit?.unitNumber}`,
      "Lantai": item.unit?.floor,
      "Nama Penghuni": item.unit?.residentName,
      "No. KTP": item.unit?.ktpNumber,
      "No. HP": item.unit?.phoneNumber,
      "Tagihan Bulan Ini": item.waterBill + item.trashBill,
      "Tunggakan Lalu": item.debtPrev,
      "Total Tagihan": item.totalBill,
      "Bulan Menunggak": item.overdueCount,
      "Status": item.status
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Daftar Penunggak");
    XLSX.writeFile(wb, `Daftar_Penunggak_Rusunawa_${new Date().toLocaleDateString()}.xlsx`);
  };

  // Meter Input Logic
  const getUnitBilling = (unitId: string) => {
    return billings.find(b => b.unitId === unitId && b.month === selectedMonth && b.year === selectedYear);
  };

  const calculateBill = (usage: number, isVacant: boolean) => {
    if (isVacant) return { water: 0, trash: 0 };
    let waterBill = usage <= settings.waterBaseLimit ? settings.waterBaseRate : settings.waterBaseRate + (usage - settings.waterBaseLimit) * settings.waterExtraRate;
    return { water: waterBill, trash: settings.trashRate };
  };

  const recalculateUnitBillings = (unitId: string, currentBillings: Billing[]) => {
    let updatedBillings = [...currentBillings];
    const unitBillings = updatedBillings.filter(b => b.unitId === unitId).sort((a, b) => (a.year * 12 + a.month) - (b.year * 12 + b.month));
    unitBillings.forEach((b, index) => {
      if (index === 0) return;
      const prev = unitBillings[index - 1];
      const debtPrev = prev.status === "BELUM_LUNAS" ? prev.totalBill : 0;
      updatedBillings = updatedBillings.map(mainB => {
        if (mainB.id === b.id) return { ...mainB, debtPrev, totalBill: mainB.waterBill + mainB.trashBill + debtPrev };
        return mainB;
      });
    });
    return updatedBillings;
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
    if (meterCurrent < currentPrevMeter && !isVacantInput) {
      alert(`Meteran baru (${meterCurrent}) tidak boleh lebih kecil dari meteran sebelumnya (${currentPrevMeter})`);
      return;
    }
    setIsSaving(true);
    const usage = Math.max(0, meterCurrent - currentPrevMeter);
    const { water, trash } = calculateBill(usage, isVacantInput);
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
    let updatedBillings = [...billings];
    if (existingIndex > -1) updatedBillings[existingIndex] = newBilling;
    else updatedBillings.push(newBilling);
    updatedBillings = recalculateUnitBillings(selectedUnit.id, updatedBillings);
    await db.saveBilling(newBilling);
    
    setTimeout(() => {
      setIsSaving(false);
      setSelectedUnit(null);
      setMeterInput("");
    }, 500);
  };

  const toggleStatus = async (billingId: string) => {
    const billing = billings.find(b => b.id === billingId);
    if (!billing) return;
    const newStatus = billing.status === "LUNAS" ? "BELUM_LUNAS" : "LUNAS";
    const updatedBilling = { ...billing, status: newStatus as any };
    await db.saveBilling(updatedBilling);
  };

  const toggleHousingStatus = async (unitId: string) => {
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
            {activeTab === "tagihan" ? <Droplets className="text-blue-600" /> : <AlertTriangle className="text-red-600" />}
            {activeTab === "tagihan" ? "Catat Meter / Tagihan" : "Daftar Penunggak (Punishment)"}
          </h2>
          <p className="text-gray-500">
            {activeTab === "tagihan" ? "Input meteran air dan kelola status tagihan warga" : "Warga yang belum melunasi tagihan air & sampah"}
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
                    className={cn(
                      "p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 text-center relative overflow-hidden",
                      isPaid ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"
                    )}
                  >
                    <div className="absolute top-1 right-1">
                      {isPaid ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
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
                      <p className="text-sm font-bold text-gray-900">{formatCurrency(billing.totalBill)}</p>
                      <button 
                        onClick={() => toggleStatus(billing.id)}
                        className={cn(
                          "text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border mt-1",
                          billing.status === "LUNAS" ? "bg-green-50 text-green-700 border-green-100" : "bg-red-50 text-red-700 border-red-100"
                        )}
                      >
                        {billing.status}
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  {!billing ? (
                    <button 
                      onClick={() => {
                        setSelectedUnit(unit);
                        setIsVacantInput(unit.isVacant);
                        const allUnitBillings = billings.filter(b => b.unitId === unit.id).sort((a, b) => (b.year * 12 + b.month) - (a.year * 12 + a.month));
                        const prevBill = allUnitBillings.find(b => (b.year * 12 + b.month) < (selectedYear * 12 + selectedMonth));
                        setMeterInput(prevBill ? prevBill.meterCurrent.toString() : unit.initialMeter.toString());
                      }}
                      className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-bold text-xs hover:bg-blue-700 transition-all"
                    >
                      Catat Meteran
                    </button>
                  ) : (
                    <>
                      <button 
                        onClick={() => toggleStatus(billing.id)}
                        className={cn(
                          "flex-1 py-2.5 rounded-xl font-bold text-xs transition-all border",
                          billing.status === "LUNAS" ? "bg-green-50 text-green-700 border-green-100" : "bg-red-50 text-red-700 border-red-100"
                        )}
                      >
                        {billing.status === "LUNAS" ? "Tandai Belum Lunas" : "Tandai Lunas"}
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedUnit(unit);
                          setMeterInput(billing.meterCurrent.toString());
                          setIsVacantInput(billing.isVacant);
                        }}
                        className="w-10 h-10 bg-gray-50 text-gray-400 rounded-xl flex items-center justify-center hover:bg-gray-100 border border-gray-200"
                      >
                        <Edit3 size={16} />
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {overdueList.length > 0 ? overdueList.map(item => (
            <motion.div 
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "bg-white p-6 rounded-2xl shadow-sm border-2 transition-all relative overflow-hidden",
                isAfterDue ? "border-red-100" : "border-gray-50"
              )}
            >
              {isAfterDue && (
                <div className="absolute top-0 right-0 bg-red-600 text-white px-3 py-1 rounded-bl-xl text-[10px] font-bold uppercase tracking-widest">
                  Jatuh Tempo
                </div>
              )}

              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{item.unit?.block}{item.unit?.unitNumber}</h3>
                  <p className="text-sm text-gray-500">Lantai {item.unit?.floor}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-red-600">{formatCurrency(item.totalBill)}</p>
                  <div className="flex flex-col items-end gap-1 mt-1">
                    {item.status === "BELUM_LUNAS" && (
                      <span className="text-[8px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded uppercase">Nunggak PDAM</span>
                    )}
                    {item.housingPaymentStatus === "BELUM_LUNAS" && (
                      <span className="text-[8px] font-bold bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded uppercase">Nunggak Hunian</span>
                    )}
                  </div>
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
                <button className="flex-1 bg-gray-100 text-gray-600 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-gray-200 transition-all">
                  <StickyNote size={16} />
                  Catat Tindakan
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
            <div className="col-span-full py-20 text-center text-gray-400">
              <UserX size={64} className="mx-auto mb-4 opacity-10" />
              <p className="text-lg font-medium">Tidak ada warga yang menunggak</p>
              <p className="text-sm">Semua warga telah melunasi tagihan bulan ini.</p>
            </div>
          )}
        </div>
      )}

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
                      autoFocus
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
    </div>
  );
}
