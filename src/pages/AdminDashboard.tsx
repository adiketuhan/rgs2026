import React, { useState, useEffect, useRef } from "react";
import { Unit, Settings, User, Billing, FinanceTransaction, FundRequest, FundRequestStatus, Complaint } from "../types";
import { db } from "../db";
import * as XLSX from "xlsx";
import { MIGRATION_DATA } from "../data/migrationData";
import { 
  Users, 
  Plus, 
  Search, 
  Trash2, 
  Edit2, 
  Settings as SettingsIcon, 
  Droplets, 
  Trash, 
  RefreshCw,
  Save,
  UserPlus,
  FileUp,
  Download,
  Wallet,
  History as HistoryIcon,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  AlertCircle,
  Eye,
  Edit3,
  MessageSquare
} from "lucide-react";
import { formatCurrency, cn } from "../lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { UnitDetailModal } from "../components/UnitDetailModal";

export function AdminDashboard({ user, activeTab = "dashboard" }: { user: User, activeTab?: string }) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [billings, setBillings] = useState<Billing[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [finances, setFinances] = useState<FinanceTransaction[]>([]);
  const [fundRequests, setFundRequests] = useState<FundRequest[]>([]);
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
  const [isAddingUnit, setIsAddingUnit] = useState(false);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [newUnit, setNewUnit] = useState<Partial<Unit>>({
    block: "A",
    floor: 1,
    unitNumber: "",
    residentName: "",
    ktpNumber: "",
    phoneNumber: "",
    initialMeter: 0,
    isVacant: false
  });
  const [newUser, setNewUser] = useState<Partial<User>>({
    username: "",
    password: "",
    name: "",
    role: "PENGELOLA",
    floor: 1
  });

  const [detailUnit, setDetailUnit] = useState<Unit | null>(null);

  useEffect(() => {
    const unsubscribeUnits = db.subscribeUnits(setUnits);
    const unsubscribeBillings = db.subscribeBillings(setBillings);
    const unsubscribeSettings = db.subscribeSettings(setSettings);
    const unsubscribeUsers = db.subscribeUsers(setUsers);
    const unsubscribeFinances = db.subscribeFinances(setFinances);
    const unsubscribeFundRequests = db.subscribeFundRequests(setFundRequests);
    const unsubscribeComplaints = db.subscribeComplaints(setComplaints);
    
    return () => {
      unsubscribeUnits();
      unsubscribeBillings();
      unsubscribeSettings();
      unsubscribeUsers();
      unsubscribeFinances();
      unsubscribeFundRequests();
      unsubscribeComplaints();
    };
  }, []);

  // Auto-create billings for current month if they don't exist (Auto-Lunas Housing)
  useEffect(() => {
    if (units.length > 0 && billings.length > 0) {
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      
      const missingUnits = units.filter(u => !billings.some(b => b.unitId === u.id && b.month === currentMonth && b.year === currentYear));
      
      if (missingUnits.length > 0) {
        const createMissingBillings = async () => {
          const newBillings: Billing[] = missingUnits.map(u => {
            const allUnitBillings = billings.filter(b => b.unitId === u.id).sort((a, b) => (b.year * 12 + b.month) - (a.year * 12 + a.month));
            const prevBill = allUnitBillings.find(b => (b.year * 12 + b.month) < (currentYear * 12 + currentMonth));
            const meterPrev = prevBill ? prevBill.meterCurrent : u.initialMeter;
            
            const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
            const lastYear = currentMonth === 0 ? currentYear - 1 : currentYear;
            const lastMonthBilling = billings.find(b => b.unitId === u.id && b.month === lastMonth && b.year === lastYear);
            const debtPrev = lastMonthBilling && lastMonthBilling.status === "BELUM_LUNAS" ? lastMonthBilling.totalBill : 0;

            return {
              id: Math.random().toString(36).substr(2, 9),
              unitId: u.id,
              month: currentMonth,
              year: currentYear,
              meterPrev,
              meterCurrent: meterPrev,
              usage: 0,
              waterBill: 0,
              trashBill: 0,
              debtPrev,
              totalBill: debtPrev,
              status: "BELUM_LUNAS",
              housingPaymentStatus: "LUNAS", // Default to LUNAS
              isVacant: u.isVacant,
              updatedAt: new Date().toISOString(),
              updatedBy: "system"
            };
          });
          
          for (const b of newBillings) {
            await db.saveBilling(b);
          }
        };
        createMissingBillings();
      }
    }
  }, [units, billings]);

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

  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    const unit: Unit = {
      ...newUnit as Unit,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString()
    };
    await db.saveUnit(unit);
    setIsAddingUnit(false);
    setNewUnit({ block: "A", floor: 1, unitNumber: "", residentName: "", ktpNumber: "", phoneNumber: "", initialMeter: 0, isVacant: false });
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const user: User = {
      ...newUser as User,
      id: Math.random().toString(36).substr(2, 9)
    };
    await db.saveUser(user);
    setIsAddingUser(false);
    setNewUser({ username: "", password: "", name: "", role: "PENGELOLA", floor: 1 });
    alert("Petugas berhasil ditambahkan!");
  };

  const handleDeleteUser = async (id: string) => {
    const userToDelete = users.find(u => u.id === id);
    if (userToDelete?.username === "admin") return alert("Akun admin utama tidak bisa dihapus!");
    if (confirm("Hapus petugas ini?")) {
      await db.deleteUser(id);
    }
  };

  const handleEditUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUnit) return;
    
    await db.saveUnit(editingUnit);
    setEditingUnit(null);
    alert("Data unit berhasil diperbarui!");
  };

  const handleDeleteUnit = async (id: string) => {
    if (confirm("Hapus data unit ini? Semua riwayat tagihan unit ini juga akan dihapus.")) {
      await db.deleteUnit(id);
    }
  };

  const handleRunMigration = async () => {
    if (confirm("Jalankan migrasi data? Ini akan mensinkronisasi status pembayaran hunian.")) {
      setIsMigrating(true);
      try {
        // Migration logic: Ensure all current month billings have housingPaymentStatus
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        
        const affectedBillings = billings.filter(b => b.month === currentMonth && b.year === currentYear && !b.housingPaymentStatus);
        
        for (const b of affectedBillings) {
          await db.saveBilling({
            ...b,
            housingPaymentStatus: b.housingPaymentStatus || "LUNAS"
          });
        }
        alert("Migrasi selesai!");
      } catch (err) {
        console.error("Migration error:", err);
        alert("Migrasi gagal.");
      } finally {
        setIsMigrating(false);
      }
    }
  };

  const handleFixComplaints = async () => {
    if (complaints.length === 0 || units.length === 0) return;
    
    setIsMigrating(true);
    let fixedCount = 0;
    
    try {
      for (const complaint of complaints) {
        const unit = units.find(u => u.id === complaint.unitId);
        if (unit && complaint.floor !== unit.floor) {
          const updated: Complaint = {
            ...complaint,
            floor: unit.floor
          };
          await db.saveComplaint(updated);
          fixedCount++;
        }
      }
      alert(`Berhasil memperbaiki ${fixedCount} data keluhan.`);
    } catch (err) {
      console.error("Error fixing complaints:", err);
      alert("Terjadi kesalahan saat memperbaiki data keluhan.");
    } finally {
      setIsMigrating(false);
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await db.updateSettings(settings);
    alert("Pengaturan berhasil disimpan!");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];
        
        const newUnits: Unit[] = [];
        const newBillings: Billing[] = [];

        data.forEach((row, index) => {
          if (!row["No Unit"] || !row["Nama Penghuni"]) return;

          const block = (row.Blok || "A") as any;
          const floor = Number(row.Lantai || 1);
          const unitNumber = String(row["No Unit"] || "");
          
          // Check if unit already exists in current state
          const existingUnit = units.find(u => u.block === block && u.unitNumber === unitNumber);
          const unitId = existingUnit ? existingUnit.id : (Math.random().toString(36).substr(2, 9) + index);
          
          const residentName = String(row["Nama Penghuni"] || "");
          const ktpNumber = String(row["No KTP"] || "");
          const phoneNumber = String(row["No WA"] || "");
          const initialMeter = Number(row["Meter Awal"] || 0);
          const isVacant = String(row.Status).toLowerCase() === "kosong";

          newUnits.push({
            id: unitId,
            block,
            floor,
            unitNumber,
            residentName,
            ktpNumber,
            phoneNumber,
            initialMeter,
            isVacant,
            createdAt: existingUnit ? existingUnit.createdAt : new Date().toISOString()
          });

          // Process Historical Data (Jan, Feb, Mar)
          const months = [
            { name: "Januari", index: 0 },
            { name: "Februari", index: 1 },
            { name: "Maret", index: 2 }
          ];

          let runningMeterPrev = initialMeter;
          let runningDebt = 0;

          months.forEach(m => {
            const meterKey = `Meter ${m.name}`;
            const statusKey = `Status ${m.name}`;
            
            if (row[meterKey] !== undefined) {
              const meterCurrent = Number(row[meterKey]);
              const usage = Math.max(0, meterCurrent - runningMeterPrev);
              const isLunas = String(row[statusKey]).toLowerCase() === "lunas";
              
              let waterBill = 0;
              if (!isVacant) {
                waterBill = usage <= settings.waterBaseLimit 
                  ? settings.waterBaseRate 
                  : settings.waterBaseRate + (usage - settings.waterBaseLimit) * settings.waterExtraRate;
              }
              const trashBill = isVacant ? 0 : settings.trashRate;
              
              const totalBill = waterBill + trashBill + runningDebt;
              
              newBillings.push({
                id: Math.random().toString(36).substr(2, 9),
                unitId,
                month: m.index,
                year: 2026,
                meterPrev: runningMeterPrev,
                meterCurrent,
                usage,
                waterBill,
                trashBill,
                debtPrev: runningDebt,
                totalBill,
                status: isLunas ? "LUNAS" : "BELUM_LUNAS",
                housingPaymentStatus: "LUNAS",
                isVacant,
                updatedAt: new Date().toISOString(),
                updatedBy: "admin"
              });

              runningMeterPrev = meterCurrent;
              runningDebt = isLunas ? 0 : totalBill;
            }
          });
        });

        if (newUnits.length === 0) {
          alert("Tidak ada data valid yang ditemukan.");
          return;
        }

        if (confirm(`Ditemukan ${newUnits.length} unit dan data historis. Apakah Anda ingin mengupdate/menambahkan data ini ke database?`)) {
          const savePromises = [
            ...newUnits.map(u => db.saveUnit(u)),
            ...newBillings.map(b => db.saveBilling(b))
          ];
          await Promise.all(savePromises);
          alert("Data unit dan riwayat berhasil diimport!");
        }
      } catch (error) {
        console.error(error);
        alert("Gagal membaca file. Pastikan format sesuai template.");
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsBinaryString(file);
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
    const affectedBillings: Billing[] = [];
    unitBillings.forEach((b, index) => {
      if (index === 0) return;
      const prev = unitBillings[index - 1];
      const debtPrev = prev.status === "BELUM_LUNAS" ? prev.totalBill : 0;
      if (b.debtPrev !== debtPrev) {
        const updatedB = { ...b, debtPrev, totalBill: b.waterBill + b.trashBill + debtPrev };
        affectedBillings.push(updatedB);
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
    let updatedBillingsList = [...billings];
    if (existingIndex > -1) updatedBillingsList[existingIndex] = newBilling;
    else updatedBillingsList.push(newBilling);
    const { affectedBillings } = recalculateUnitBillings(selectedUnit.id, updatedBillingsList);
    
    const savePromises = [
      db.saveBilling(newBilling),
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
    const newStatus = billing.status === "LUNAS" ? "BELUM_LUNAS" : "LUNAS";
    const updatedBilling = { ...billing, status: newStatus as any };
    
    let updatedBillingsList = billings.map(b => b.id === billingId ? updatedBilling : b);
    const { affectedBillings } = recalculateUnitBillings(billing.unitId, updatedBillingsList);
    
    const savePromises = [
      db.saveBilling(updatedBilling),
      ...affectedBillings.map(b => db.saveBilling(b))
    ];
    await Promise.all(savePromises);
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
      // Create a skeleton billing record if it doesn't exist
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
        meterCurrent: meterPrev, // No usage yet
        usage: 0,
        waterBill: 0,
        trashBill: 0,
        debtPrev,
        totalBill: debtPrev,
        status: "BELUM_LUNAS",
        housingPaymentStatus: "BELUM_LUNAS", // Default to unpaid if toggled from non-existent
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

  const filteredUnitsForBilling = units
    .filter(u => 
      (selectedFloor === "ALL" || u.floor === selectedFloor) &&
      (u.unitNumber.includes(searchTerm) || u.residentName.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => {
      if (a.floor !== b.floor) return a.floor - b.floor;
      return a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true });
    });

  const downloadTemplate = () => {
    const template = [
      {
        "Blok": "A",
        "Lantai": 1,
        "No Unit": "101",
        "Nama Penghuni": "Budi Santoso",
        "No KTP": "3501234567890001",
        "No WA": "08123456789",
        "Meter Awal": 100,
        "Status": "Terisi",
        "Meter Januari": 110,
        "Status Januari": "Lunas",
        "Meter Februari": 125,
        "Status Februari": "Lunas",
        "Meter Maret": 145,
        "Status Maret": "Belum Lunas"
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Data Warga");
    XLSX.writeFile(wb, "Template_Data_Rusun_Lengkap.xlsx");
  };

  const runMigration = async () => {
    if (!confirm("Apakah Anda yakin ingin melakukan migrasi data? Ini akan menimpa data yang ada.")) return;
    setIsImporting(true);
    try {
      const lines = MIGRATION_DATA.split('\n');
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Handle potential commas inside quotes if any (though this data looks simple)
        const values = line.split(',');
        
        const block = values[0];
        const floor = parseInt(values[1]);
        const unitNumber = values[2];
        const residentName = values[3];
        const ktpNumber = values[4];
        const phoneNumber = values[5];
        const initialMeter = parseFloat(values[6]) || 0;
        const isVacant = values[7].toLowerCase() === 'kosong';
        
        const unitId = `${block}-${unitNumber}`;
        const unit: Unit = {
          id: unitId,
          block: block as any,
          floor,
          unitNumber,
          residentName: residentName || (isVacant ? "Kosong" : ""),
          ktpNumber: ktpNumber || "",
          phoneNumber: phoneNumber || "",
          initialMeter,
          isVacant,
          createdAt: new Date().toISOString()
        };
        
        await db.saveUnit(unit);
        
        // Handle Billings for Jan, Feb, Mar 2026 if meter data exists
        const months = [
          { index: 0, meterIdx: 8, statusIdx: 9 }, // Jan
          { index: 1, meterIdx: 10, statusIdx: 11 }, // Feb
          { index: 2, meterIdx: 12, statusIdx: 13 } // Mar
        ];
        
        let prevMeter = initialMeter;
        let cumulativeDebt = 0;
        
        for (const m of months) {
          const meterVal = values[m.meterIdx];
          const statusVal = values[m.statusIdx];
          
          if (!meterVal && !statusVal) continue;

          const meterCurrent = parseFloat(meterVal) || prevMeter;
          const usage = Math.max(0, meterCurrent - prevMeter);
          const { water, trash } = calculateBill(usage, isVacant);
          const status = statusVal === 'Lunas' ? 'LUNAS' : 'BELUM_LUNAS';
          
          const billing: Billing = {
            id: `${unitId}-2026-${m.index}`,
            unitId,
            month: m.index,
            year: 2026,
            meterPrev: prevMeter,
            meterCurrent,
            usage,
            waterBill: water,
            trashBill: trash,
            debtPrev: cumulativeDebt,
            totalBill: water + trash + cumulativeDebt,
            status,
            housingPaymentStatus: "LUNAS",
            isVacant,
            updatedAt: new Date().toISOString(),
            updatedBy: user.id
          };
          
          await db.saveBilling(billing);
          
          prevMeter = meterCurrent;
          cumulativeDebt = status === 'BELUM_LUNAS' ? billing.totalBill : 0;
        }
      }
      alert("Migrasi data berhasil!");
    } catch (error) {
      console.error(error);
      alert("Terjadi kesalahan saat migrasi data.");
    } finally {
      setIsImporting(false);
    }
  };

  const filteredUnitsForWarga = units.filter(u => 
    u.unitNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.residentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.ktpNumber.includes(searchTerm)
  );

  return (
    <div className="space-y-8">
      {/* Stats - Always visible on relevant tabs */}
      {(activeTab === "dashboard" || activeTab === "warga" || activeTab === "petugas") && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard icon={<Droplets className="text-blue-600" />} label="Total Unit" value={units.length} />
          <StatCard icon={<Users className="text-green-600" />} label="Penghuni Aktif" value={units.filter(u => !u.isVacant).length} />
          <StatCard icon={<Trash className="text-orange-600" />} label="Unit Kosong" value={units.filter(u => u.isVacant).length} />
          <StatCard icon={<SettingsIcon className="text-purple-600" />} label="Tarif Air / m³" value={formatCurrency(settings.waterExtraRate)} />
        </div>
      )}

      <div className="space-y-8">
        {/* Dashboard / Warga Tab */}
        {(activeTab === "dashboard" || activeTab === "warga") && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Users className="text-blue-600" />
                    Data Warga & Unit
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input 
                        type="text" 
                        placeholder="Cari unit, nama, KTP..."
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept=".xlsx, .xls, .csv" 
                        onChange={handleFileUpload}
                      />
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isImporting}
                        className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-gray-50 transition-all font-bold text-sm"
                        title="Import dari Excel/CSV"
                      >
                        {isImporting ? <RefreshCw className="animate-spin" size={18} /> : <FileUp size={18} />}
                        <span className="hidden xl:inline">Import</span>
                      </button>
                      <button 
                        onClick={downloadTemplate}
                        className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-gray-50 transition-all font-bold text-sm"
                        title="Download Template Excel"
                      >
                        <Download size={18} />
                        <span className="hidden xl:inline">Template</span>
                      </button>
                      <button 
                        onClick={runMigration}
                        disabled={isImporting}
                        className="bg-purple-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-purple-700 transition-all shadow-lg shadow-purple-100 font-bold text-sm"
                        title="Jalankan Migrasi Data dari Chat"
                      >
                        <RefreshCw className={isImporting ? "animate-spin" : ""} size={18} />
                        <span className="hidden xl:inline">Migrasi Data</span>
                      </button>
                      <button 
                        onClick={() => setIsAddingUnit(true)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 font-bold text-sm"
                      >
                        <Plus size={20} />
                        <span className="hidden md:inline">Tambah Unit</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="py-4 px-2 font-semibold text-gray-600 text-sm">Unit</th>
                        <th className="py-4 px-2 font-semibold text-gray-600 text-sm">Nama Penghuni</th>
                        <th className="py-4 px-2 font-semibold text-gray-600 text-sm">No. KTP</th>
                        <th className="py-4 px-2 font-semibold text-gray-600 text-sm">Status</th>
                        <th className="py-4 px-2 font-semibold text-gray-600 text-sm text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredUnitsForWarga.length > 0 ? filteredUnitsForWarga.map(unit => (
                        <tr key={unit.id} className="hover:bg-gray-50 transition-colors group">
                          <td className="py-4 px-2">
                            <button 
                              onClick={() => setDetailUnit(unit)}
                              className="font-bold text-gray-900 hover:text-blue-600 transition-colors text-left"
                            >
                              {unit.block}{unit.unitNumber}
                            </button>
                            <p className="text-xs text-gray-400">Lantai {unit.floor}</p>
                          </td>
                          <td className="py-4 px-2">
                            <p className="font-medium text-gray-800">{unit.residentName}</p>
                            <p className="text-xs text-gray-400">{unit.phoneNumber}</p>
                          </td>
                          <td className="py-4 px-2 text-sm text-gray-600">{unit.ktpNumber}</td>
                          <td className="py-4 px-2">
                            {unit.isVacant ? (
                              <span className="px-2.5 py-0.5 bg-orange-50 text-orange-700 text-[10px] font-bold rounded-full border border-orange-100 uppercase tracking-wider">Kosong</span>
                            ) : (
                              <span className="px-2.5 py-0.5 bg-green-50 text-green-700 text-[10px] font-bold rounded-full border border-green-100 uppercase tracking-wider">Terisi</span>
                            )}
                          </td>
                          <td className="py-4 px-2 text-right">
                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => setDetailUnit(unit)}
                                className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                                title="Lihat Riwayat"
                              >
                                <Eye size={16} />
                              </button>
                              <button 
                                onClick={() => setEditingUnit(unit)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button 
                                onClick={() => handleDeleteUnit(unit.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-gray-400">
                            <Users size={48} className="mx-auto mb-2 opacity-20" />
                            <p>Belum ada data unit</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Quick Settings & Cycle - Only on dashboard */}
            {activeTab === "dashboard" && (
              <div className="space-y-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-6">
                    <SettingsIcon className="text-blue-600" />
                    Pengaturan Tarif
                  </h2>
                  <form onSubmit={handleUpdateSettings} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tarif Dasar</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">Rp</span>
                        <input 
                          type="number" 
                          className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                          value={settings.waterBaseRate}
                          onChange={(e) => setSettings({...settings, waterBaseRate: Number(e.target.value)})}
                        />
                      </div>
                    </div>
                    <button 
                      type="submit"
                      className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-100"
                    >
                      <Save size={20} />
                      Simpan
                    </button>
                  </form>
                </div>

                <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-6 rounded-2xl shadow-lg text-white">
                  <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                    <RefreshCw size={20} />
                    Siklus Bulanan
                  </h3>
                  <p className="text-blue-100 text-sm mb-4">
                    Sistem otomatis berpindah ke bulan baru setiap tanggal 1.
                  </p>
                  <div className="bg-white/10 p-4 rounded-xl border border-white/20">
                    <p className="text-xs text-blue-200 uppercase font-bold mb-1">Periode Aktif</p>
                    <p className="text-xl font-bold">April 2026</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Biaya Hunian Tab */}
        {activeTab === "hunian" && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Plus className="text-blue-600" />
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
                  const isPaid = billing ? billing.housingPaymentStatus === "LUNAS" : true; // Default to true (checked)

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

        {/* Keuangan Tab */}
        {activeTab === "keuangan" && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard icon={<Wallet className="text-blue-600" />} label="Total Saldo Paguyuban" value={formatCurrency(balance)} />
              <StatCard icon={<TrendingUp className="text-green-600" />} label="Total Pemasukan Kas" value={formatCurrency(totalIncome)} />
              <StatCard icon={<TrendingDown className="text-red-600" />} label="Total Pengeluaran Kas" value={formatCurrency(totalExpense)} />
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
                          Diajukan oleh {users.find(u => u.id === f.recordedBy)?.name || "Petugas"} pada {new Date(f.date).toLocaleString("id-ID")}
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
          </div>
        )}

        {/* Peringatan Tunggakan Section */}
        {activeTab === "dashboard" && (
          <div className="bg-red-50 p-6 rounded-2xl border border-red-100 mb-8">
            <h3 className="text-lg font-bold text-red-800 mb-4 flex items-center gap-2">
              <AlertCircle className="text-red-600" />
              Peringatan Tunggakan (PDAM & Hunian)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {billings
                .filter(b => b.month === selectedMonth && b.year === selectedYear && (b.status === "BELUM_LUNAS" || b.housingPaymentStatus === "BELUM_LUNAS"))
                .map(b => {
                  const unit = units.find(u => u.id === b.unitId);
                  if (!unit) return null;
                  return (
                    <div key={b.id} className="bg-white p-4 rounded-xl border border-red-200 shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-black text-gray-900">{unit.block}{unit.unitNumber}</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase">{unit.residentName}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {b.status === "BELUM_LUNAS" && (
                            <span className="text-[8px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded uppercase">PDAM</span>
                          )}
                          {b.housingPaymentStatus === "BELUM_LUNAS" && (
                            <span className="text-[8px] font-bold bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded uppercase">Hunian</span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-red-600 font-bold">Total: {formatCurrency(b.totalBill)}</p>
                    </div>
                  );
                })}
            </div>
            {billings.filter(b => b.month === selectedMonth && b.year === selectedYear && (b.status === "BELUM_LUNAS" || b.housingPaymentStatus === "BELUM_LUNAS")).length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">Tidak ada tunggakan bulan ini.</p>
            )}
          </div>
        )}

        {/* Keuangan Tab */}
        {activeTab === "keuangan" && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard icon={<Wallet className="text-blue-600" />} label="Total Saldo Paguyuban" value={formatCurrency(balance)} />
              <StatCard icon={<TrendingUp className="text-green-600" />} label="Total Pemasukan Kas" value={formatCurrency(totalIncome)} />
              <StatCard icon={<TrendingDown className="text-red-600" />} label="Total Pengeluaran Kas" value={formatCurrency(totalExpense)} />
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
                          Diajukan oleh {users.find(u => u.id === f.recordedBy)?.name || "Petugas"} pada {new Date(f.date).toLocaleString("id-ID")}
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

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <HistoryIcon className="text-blue-600" />
                  Riwayat Kas Paguyuban
                </h2>
                <button 
                  onClick={() => setShowAddFinance(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 font-bold text-sm"
                >
                  <Plus size={20} />
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

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Jumlah (Rp)</label>
                  <input 
                    type="number"
                    required
                    value={newFinance.amount || ""}
                    onChange={(e) => setNewFinance({ ...newFinance, amount: Number(e.target.value) })}
                    className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600 font-bold text-lg"
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Kategori</label>
                  <select 
                    required
                    value={newFinance.category}
                    onChange={(e) => setNewFinance({ ...newFinance, category: e.target.value as any })}
                    className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600 font-bold"
                  >
                    <option value="WATER">Air (PDAM)</option>
                    <option value="TRASH">Sampah</option>
                    <option value="OTHER">Lain-lain</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Keterangan</label>
                  <textarea 
                    required
                    value={newFinance.description}
                    onChange={(e) => setNewFinance({ ...newFinance, description: e.target.value })}
                    className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600 h-24"
                    placeholder="Detail transaksi..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Tanggal</label>
                  <input 
                    type="date"
                    required
                    value={newFinance.date}
                    onChange={(e) => setNewFinance({ ...newFinance, date: e.target.value })}
                    className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 mt-4"
                >
                  Simpan Transaksi
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {/* Petugas Management Tab */}
        {activeTab === "petugas" && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <UserPlus className="text-blue-600" />
                Manajemen Petugas
              </h2>
              <button 
                onClick={() => setIsAddingUser(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 font-bold text-sm"
              >
                <Plus size={20} />
                Tambah Petugas
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="py-4 px-2 font-semibold text-gray-600 text-sm">Nama</th>
                    <th className="py-4 px-2 font-semibold text-gray-600 text-sm">Username</th>
                    <th className="py-4 px-2 font-semibold text-gray-600 text-sm">Role</th>
                    <th className="py-4 px-2 font-semibold text-gray-600 text-sm text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.map(user => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="py-4 px-2">
                        <p className="font-bold text-gray-900">{user.name}</p>
                      </td>
                      <td className="py-4 px-2 text-sm text-gray-600">{user.username}</td>
                      <td className="py-4 px-2">
                        <span className={cn(
                          "px-2.5 py-0.5 text-[10px] font-bold rounded-full border uppercase tracking-wider",
                          user.role === "ADMIN" ? "bg-purple-50 text-purple-700 border-purple-100" :
                          user.role === "KOORDINATOR" ? "bg-blue-50 text-blue-700 border-blue-100" :
                          "bg-gray-50 text-gray-700 border-gray-100"
                        )}>
                          {user.role}
                        </span>
                      </td>
                      <td className="py-4 px-2 text-right">
                        {user.username !== "admin" && (
                          <button 
                            onClick={() => handleDeleteUser(user.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pengaturan Tab */}
        {activeTab === "pengaturan" && (
          <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-8">
              <SettingsIcon className="text-blue-600" />
              Pengaturan Sistem & Tarif
            </h2>
            <form onSubmit={handleUpdateSettings} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tarif Dasar (10m³ Pertama)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">Rp</span>
                    <input 
                      type="number" 
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      value={settings.waterBaseRate}
                      onChange={(e) => setSettings({...settings, waterBaseRate: Number(e.target.value)})}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tarif Progresif (per m³)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">Rp</span>
                    <input 
                      type="number" 
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      value={settings.waterExtraRate}
                      onChange={(e) => setSettings({...settings, waterExtraRate: Number(e.target.value)})}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Iuran Sampah</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">Rp</span>
                    <input 
                      type="number" 
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      value={settings.trashRate}
                      onChange={(e) => setSettings({...settings, trashRate: Number(e.target.value)})}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Batas Jatuh Tempo (Tanggal)</label>
                  <input 
                    type="number" 
                    min="1" max="28"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={settings.dueDay}
                    onChange={(e) => setSettings({...settings, dueDay: Number(e.target.value)})}
                  />
                </div>
              </div>
              <button 
                type="submit"
                className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-100"
              >
                <Save size={20} />
                Simpan Semua Pengaturan
              </button>
            </form>

            <div className="mt-12 pt-8 border-t border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Pemeliharaan Data</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button 
                  onClick={handleRunMigration}
                  disabled={isMigrating}
                  className="flex items-center justify-center gap-2 p-4 bg-gray-50 text-gray-600 rounded-2xl font-bold hover:bg-gray-100 transition-all border border-gray-200 disabled:opacity-50"
                >
                  <RefreshCw size={20} className={isMigrating ? "animate-spin" : ""} />
                  Migrasi Data Lama
                </button>
                <button 
                  onClick={handleFixComplaints}
                  disabled={isMigrating}
                  className="flex items-center justify-center gap-2 p-4 bg-gray-50 text-gray-600 rounded-2xl font-bold hover:bg-gray-100 transition-all border border-gray-200 disabled:opacity-50"
                >
                  <MessageSquare size={20} />
                  Perbaiki Data Keluhan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Persetujuan Dana Tab */}
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

        {activeTab === "tagihan" && (
          <div className="space-y-6">
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredUnitsForBilling.map(unit => {
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
                          {billing.debtPrev > 0 && (
                            <p className="text-[8px] font-bold text-red-500">
                              Hutang: {formatCurrency(billing.debtPrev)}
                            </p>
                          )}
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
          </div>
        )}
      </div>

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

      {/* Add User Modal */}
      {isAddingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-900">Tambah Petugas Baru</h3>
              <button onClick={() => setIsAddingUser(false)} className="text-gray-400 hover:text-gray-600"><Plus className="rotate-45" /></button>
            </div>
            <form onSubmit={handleAddUser} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Nama Lengkap</label>
                <input 
                  type="text" 
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  value={newUser.name}
                  onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Username</label>
                <input 
                  type="text" 
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  value={newUser.username}
                  onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Password</label>
                <input 
                  type="password" 
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  value={newUser.password}
                  onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Role</label>
                <select 
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  value={newUser.role}
                  onChange={(e) => setNewUser({...newUser, role: e.target.value as any})}
                >
                  <option value="KOORDINATOR">KOORDINATOR</option>
                  <option value="PENGELOLA">PENGELOLA</option>
                  <option value="BENDAHARA">BENDAHARA</option>
                </select>
              </div>
              {newUser.role === "KOORDINATOR" && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Lantai Tanggung Jawab</label>
                  <select 
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    value={newUser.floor}
                    onChange={(e) => setNewUser({...newUser, floor: Number(e.target.value)})}
                  >
                    {[1, 2, 3, 4, 5].map(f => <option key={f} value={f}>Lantai {f}</option>)}
                  </select>
                </div>
              )}
              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsAddingUser(false)}
                  className="flex-1 py-3 border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-all"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                >
                  Simpan Petugas
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Add Unit Modal */}
      {isAddingUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-900">Tambah Unit Baru</h3>
              <button onClick={() => setIsAddingUnit(false)} className="text-gray-400 hover:text-gray-600"><Plus className="rotate-45" /></button>
            </div>
            <form onSubmit={handleAddUnit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Blok</label>
                  <select 
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    value={newUnit.block}
                    onChange={(e) => setNewUnit({...newUnit, block: e.target.value as any})}
                  >
                    <option value="A">Blok A</option>
                    <option value="B">Blok B</option>
                    <option value="C">Blok C</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Lantai</label>
                  <select 
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    value={newUnit.floor}
                    onChange={(e) => setNewUnit({...newUnit, floor: Number(e.target.value)})}
                  >
                    {[1, 2, 3, 4, 5].map(f => <option key={f} value={f}>Lantai {f}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Nomor Unit (Contoh: 101)</label>
                <input 
                  type="text" 
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  value={newUnit.unitNumber}
                  onChange={(e) => setNewUnit({...newUnit, unitNumber: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Nama Penghuni</label>
                <input 
                  type="text" 
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  value={newUnit.residentName}
                  onChange={(e) => setNewUnit({...newUnit, residentName: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Nomor KTP</label>
                <input 
                  type="text" 
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  value={newUnit.ktpNumber}
                  onChange={(e) => setNewUnit({...newUnit, ktpNumber: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Nomor WhatsApp</label>
                <input 
                  type="text" 
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  value={newUnit.phoneNumber}
                  onChange={(e) => setNewUnit({...newUnit, phoneNumber: e.target.value})}
                  required
                />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox" 
                  id="isVacant"
                  checked={newUnit.isVacant}
                  onChange={(e) => setNewUnit({...newUnit, isVacant: e.target.checked})}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isVacant" className="text-sm font-medium text-gray-700">Hunian Kosong</label>
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsAddingUnit(false)}
                  className="flex-1 py-3 border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-all"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                >
                  Simpan Unit
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Edit Unit Modal */}
      {editingUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b flex justify-between items-center bg-blue-600 text-white">
              <h3 className="text-xl font-bold">Edit Unit {editingUnit.block}{editingUnit.unitNumber}</h3>
              <button onClick={() => setEditingUnit(null)} className="text-white/80 hover:text-white"><Plus className="rotate-45" /></button>
            </div>
            <form onSubmit={handleEditUnit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Blok</label>
                  <select 
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    value={editingUnit.block}
                    onChange={(e) => setEditingUnit({...editingUnit, block: e.target.value as any})}
                  >
                    <option value="A">Blok A</option>
                    <option value="B">Blok B</option>
                    <option value="C">Blok C</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Lantai</label>
                  <select 
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    value={editingUnit.floor}
                    onChange={(e) => setEditingUnit({...editingUnit, floor: Number(e.target.value)})}
                  >
                    {[1, 2, 3, 4, 5].map(f => <option key={f} value={f}>Lantai {f}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Nomor Unit</label>
                <input 
                  type="text" 
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  value={editingUnit.unitNumber}
                  onChange={(e) => setEditingUnit({...editingUnit, unitNumber: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Nama Penghuni</label>
                <input 
                  type="text" 
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  value={editingUnit.residentName}
                  onChange={(e) => setEditingUnit({...editingUnit, residentName: e.target.value})}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Nomor KTP</label>
                  <input 
                    type="text" 
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    value={editingUnit.ktpNumber}
                    onChange={(e) => setEditingUnit({...editingUnit, ktpNumber: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Nomor WA</label>
                  <input 
                    type="text" 
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    value={editingUnit.phoneNumber}
                    onChange={(e) => setEditingUnit({...editingUnit, phoneNumber: e.target.value})}
                    required
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Meteran Awal (m³)</label>
                <input 
                  type="number" 
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                  value={editingUnit.initialMeter}
                  onChange={(e) => setEditingUnit({...editingUnit, initialMeter: Number(e.target.value)})}
                  required
                />
                <p className="text-[10px] text-orange-600 font-bold">Hati-hati: Mengubah meteran awal akan mempengaruhi perhitungan tagihan pertama.</p>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox" 
                  id="editIsVacant"
                  checked={editingUnit.isVacant}
                  onChange={(e) => setEditingUnit({...editingUnit, isVacant: e.target.checked})}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="editIsVacant" className="text-sm font-medium text-gray-700">Hunian Kosong</label>
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setEditingUnit(null)}
                  className="flex-1 py-3 border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-all"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
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

function StatCard({ icon, label, value }: { icon: React.ReactNode, label: string, value: string | number }) {
  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
      <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-xl font-bold text-gray-900 leading-tight">{value}</p>
      </div>
    </div>
  );
}
