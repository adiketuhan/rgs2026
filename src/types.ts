export type Role = "ADMIN" | "KOORDINATOR" | "BENDAHARA" | "PENGELOLA" | "WARGA";

export interface User {
  id: string;
  username: string;
  password?: string;
  role: Role;
  floor?: number; // For Koordinator
  name: string;
  phone?: string;
}

export interface Settings {
  waterBaseRate: number; // 25000
  waterBaseLimit: number; // 10
  waterExtraRate: number; // 2500
  trashRate: number; // 10000
  dueDay: number; // 10
}

export interface Unit {
  id: string;
  block: "A" | "B" | "C";
  floor: number;
  unitNumber: string;
  residentName: string;
  ktpNumber: string;
  phoneNumber: string;
  initialMeter: number;
  isVacant: boolean;
  createdAt: string;
}

export interface Billing {
  id: string;
  unitId: string;
  month: number; // 0-11
  year: number;
  meterPrev: number;
  meterCurrent: number;
  usage: number;
  waterBill: number;
  trashBill: number;
  debtPrev: number;
  totalBill: number;
  status: "LUNAS" | "BELUM_LUNAS";
  housingPaymentStatus: "LUNAS" | "BELUM_LUNAS";
  isVacant: boolean;
  updatedAt: string;
  updatedBy: string;
  housingUpdatedAt?: string;
  housingUpdatedBy?: string;
  notes?: string;
}

export type FinanceTransactionStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface FinanceTransaction {
  id: string;
  type: "INCOME" | "EXPENSE";
  amount: number;
  category: "WATER" | "TRASH" | "OTHER";
  description: string;
  date: string;
  recordedBy: string;
  status: FinanceTransactionStatus;
  approvedBy?: string;
  approvedAt?: string;
  floor?: number;
  month?: number;
  year?: number;
  fundRequestId?: string;
}

export type FundRequestStatus = "PENDING" | "DISBURSED" | "REPORTED" | "COMPLETED" | "REJECTED";

export interface FundRequestHistory {
  status: FundRequestStatus;
  updatedAt: string;
  updatedBy: string;
  notes?: string;
}

export interface FundRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  floor: number;
  title: string;
  description: string;
  estimatedAmount: number;
  actualAmount?: number;
  status: FundRequestStatus;
  receiptUrl?: string;
  createdAt: string;
  history: FundRequestHistory[];
}
