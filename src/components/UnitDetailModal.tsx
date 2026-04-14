import React, { useState, useEffect } from "react";
import { Unit, Billing, User } from "../types";
import { db } from "../db";
import { 
  XCircle, 
  Droplets, 
  Trash2, 
  History, 
  FileDown, 
  Printer, 
  AlertCircle,
  Save,
  Edit2,
  CheckCircle2
} from "lucide-react";
import { formatCurrency, cn } from "../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";

interface UnitDetailModalProps {
  unit: Unit;
  user: User;
  onClose: () => void;
}

export function UnitDetailModal({ unit, user, onClose }: UnitDetailModalProps) {
  const [billings, setBillings] = useState<Billing[]>([]);
  const [editingBilling, setEditingBilling] = useState<Billing | null>(null);
  const [editMeter, setEditMeter] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = db.subscribeBillings((all) => {
      const unitBillings = all
        .filter(b => b.unitId === unit.id)
        .sort((a, b) => (b.year * 12 + b.month) - (a.year * 12 + a.month));
      setBillings(unitBillings);
    });
    return () => unsubscribe();
  }, [unit.id]);

  const getMonthName = (monthIndex: number) => {
    return new Date(2024, monthIndex).toLocaleString('id-ID', { month: 'long' });
  };

  const handleExportExcel = () => {
    const data = billings.map(b => ({
      "Bulan": getMonthName(b.month),
      "Tahun": b.year,
      "Meter Lalu": b.meterPrev,
      "Meter Kini": b.meterCurrent,
      "Pemakaian": b.usage,
      "Tagihan Air": b.waterBill,
      "Tagihan Sampah": b.trashBill,
      "Tunggakan": b.debtPrev,
      "Total Bayar": b.totalBill,
      "Status Air": b.status,
      "Status Hunian": b.housingPaymentStatus
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Riwayat Unit");
    XLSX.writeFile(wb, `Riwayat_${unit.block}${unit.unitNumber}_${unit.residentName}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSaveEdit = async () => {
    if (!editingBilling || editMeter === "") return;
    setIsSaving(true);

    const meterCurrent = Number(editMeter);
    const usage = Math.max(0, meterCurrent - editingBilling.meterPrev);
    
    // Simple recalculation (assuming settings are standard)
    // In a real app, we might want to fetch current settings
    const waterBaseLimit = 10;
    const waterBaseRate = 25000;
    const waterExtraRate = 2500;
    const trashRate = 10000;

    let waterBill = 0;
    if (editingBilling.isVacant) {
      waterBill = 0;
    } else if (usage <= waterBaseLimit) {
      waterBill = waterBaseRate;
    } else {
      waterBill = waterBaseRate + (usage - waterBaseLimit) * waterExtraRate;
    }
    const trashBill = editingBilling.isVacant ? 0 : trashRate;

    const updated: Billing = {
      ...editingBilling,
      meterCurrent,
      usage,
      waterBill,
      trashBill,
      totalBill: waterBill + trashBill + editingBilling.debtPrev,
      updatedAt: new Date().toISOString(),
      updatedBy: user.id
    };

    await db.saveBilling(updated);
    setEditingBilling(null);
    setIsSaving(false);
  };

  const toggleStatus = async (billing: Billing, type: 'WATER' | 'HOUSING') => {
    if (user.role !== 'ADMIN' && user.role !== 'PENGELOLA') return;

    try {
      const updated: Billing = {
        ...billing,
        status: type === 'WATER' ? (billing.status === 'LUNAS' ? 'BELUM_LUNAS' : 'LUNAS') : billing.status,
        housingPaymentStatus: type === 'HOUSING' ? (billing.housingPaymentStatus === 'LUNAS' ? 'BELUM_LUNAS' : 'LUNAS') : billing.housingPaymentStatus,
        updatedAt: new Date().toISOString(),
        updatedBy: user.id
      };
      await db.saveBilling(updated);
    } catch (err) {
      console.error("Error toggling status:", err);
      alert("Gagal merubah status. Pastikan database sudah diupdate dengan SQL yang diberikan.");
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm print:p-0 print:bg-white">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:rounded-none"
      >
        {/* Header */}
        <div className="p-6 bg-blue-600 text-white flex justify-between items-center print:bg-white print:text-black print:border-b print:p-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center font-bold text-xl print:border print:text-black">
              {unit.block}{unit.unitNumber}
            </div>
            <div>
              <h3 className="text-xl font-bold leading-tight">{unit.residentName}</h3>
              <p className="text-blue-100 text-xs font-medium print:text-gray-500">Lantai {unit.floor} • {unit.ktpNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <button 
              onClick={handleExportExcel}
              className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-all"
              title="Download Excel"
            >
              <FileDown size={20} />
            </button>
            <button 
              onClick={handlePrint}
              className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-all"
              title="Cetak PDF"
            >
              <Printer size={20} />
            </button>
            <button 
              onClick={onClose}
              className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-all ml-2"
            >
              <XCircle size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 print:overflow-visible">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-4">
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Total Tunggakan Air</p>
              <p className="text-lg font-bold text-red-600">
                {formatCurrency(billings.filter(b => b.status === 'BELUM_LUNAS').reduce((acc, curr) => acc + curr.totalBill, 0))}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Tunggakan Hunian</p>
              <p className="text-lg font-bold text-orange-600">
                {billings.filter(b => b.housingPaymentStatus === 'BELUM_LUNAS').length} Bulan
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Status Unit</p>
              <p className={cn("text-sm font-bold", unit.isVacant ? "text-orange-600" : "text-green-600")}>
                {unit.isVacant ? "KOSONG" : "TERISI"}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">No. WhatsApp</p>
              <p className="text-sm font-bold text-gray-900">{unit.phoneNumber || "-"}</p>
            </div>
          </div>

          {/* History Table */}
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
              <History size={16} className="text-gray-400" />
              <h4 className="text-xs font-bold text-gray-600 uppercase tracking-widest">Riwayat Tagihan & Pemakaian</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                    <th className="px-4 py-3">Bulan/Tahun</th>
                    <th className="px-4 py-3">Meter (L/K)</th>
                    <th className="px-4 py-3 text-center">Pakai</th>
                    <th className="px-4 py-3 text-right">Air + Sampah</th>
                    <th className="px-4 py-3 text-right">Tunggakan</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-center">Status Air</th>
                    <th className="px-4 py-3 text-center">Status Hunian</th>
                    <th className="px-4 py-3 text-center print:hidden">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {billings.map((b) => (
                    <tr key={b.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-4">
                        <p className="text-sm font-bold text-gray-900">{getMonthName(b.month)}</p>
                        <p className="text-[10px] text-gray-400 font-medium">{b.year}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-xs font-medium text-gray-600">{b.meterPrev} → {b.meterCurrent}</p>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold">
                          {b.usage} m³
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <p className="text-xs font-bold text-gray-700">{formatCurrency(b.waterBill + b.trashBill)}</p>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <p className={cn("text-xs font-bold", b.debtPrev > 0 ? "text-red-500" : "text-gray-400")}>
                          {formatCurrency(b.debtPrev)}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <p className="text-sm font-black text-gray-900">{formatCurrency(b.totalBill)}</p>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button 
                          onClick={() => toggleStatus(b, 'WATER')}
                          disabled={user.role !== 'ADMIN' && user.role !== 'PENGELOLA'}
                          className={cn(
                            "px-2 py-1 rounded-full text-[9px] font-bold uppercase border transition-all",
                            b.status === 'LUNAS' ? "bg-green-50 text-green-700 border-green-100" : "bg-red-50 text-red-700 border-red-100"
                          )}
                        >
                          {b.status}
                        </button>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button 
                          onClick={() => toggleStatus(b, 'HOUSING')}
                          disabled={user.role !== 'ADMIN' && user.role !== 'PENGELOLA'}
                          className={cn(
                            "px-2 py-1 rounded-full text-[9px] font-bold uppercase border transition-all",
                            b.housingPaymentStatus === 'LUNAS' ? "bg-green-50 text-green-700 border-green-100" : "bg-red-50 text-red-700 border-red-100"
                          )}
                        >
                          {b.housingPaymentStatus}
                        </button>
                      </td>
                      <td className="px-4 py-4 text-center print:hidden">
                        {user.role === 'ADMIN' && (
                          <button 
                            onClick={() => {
                              setEditingBilling(b);
                              setEditMeter(b.meterCurrent.toString());
                            }}
                            className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                          >
                            <Edit2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 text-center print:hidden">
          <p className="text-[10px] text-gray-400 font-medium">
            Data diperbarui secara otomatis. Hubungi Admin jika terdapat ketidaksesuaian data historis.
          </p>
        </div>

        {/* Edit Modal Overlay */}
        <AnimatePresence>
          {editingBilling && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 space-y-6"
              >
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-gray-900">Edit Meteran {getMonthName(editingBilling.month)}</h4>
                  <button onClick={() => setEditingBilling(null)}><XCircle className="text-gray-400" /></button>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Meteran Baru</label>
                  <input 
                    type="number" 
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl text-xl font-bold outline-none focus:ring-2 focus:ring-blue-500"
                    value={editMeter}
                    onChange={(e) => setEditMeter(e.target.value)}
                  />
                  <p className="text-[10px] text-gray-400 italic">Meteran sebelumnya: {editingBilling.meterPrev}</p>
                </div>

                <button 
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                  Simpan Perubahan
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function Loader2({ className }: { className?: string }) {
  return <Droplets className={cn("animate-bounce", className)} />;
}
