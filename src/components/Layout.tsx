import React, { useState } from "react";
import { User, Role } from "../types";
import { 
  LogOut, 
  Menu, 
  X, 
  Home, 
  Users, 
  Droplets, 
  FileText, 
  Settings as SettingsIcon, 
  AlertCircle, 
  Wallet,
  LayoutDashboard,
  UserPlus,
  History as HistoryIcon,
  MessageSquare
} from "lucide-react";
import { cn } from "../lib/utils";

interface LayoutProps {
  user: User;
  onLogout: () => void;
  children: React.ReactNode;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export function Layout({ user, onLogout, children, activeTab, onTabChange }: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const getRoleLabel = (role: Role) => {
    switch (role) {
      case "ADMIN": return "Administrator";
      case "KOORDINATOR": return `Koordinator Lt ${user.floor}`;
      case "BENDAHARA": return "Bendahara";
      case "PENGELOLA": return "Pengelola";
      case "WARGA": return "Warga";
      default: return "";
    }
  };

  const handleTabClick = (tab: string) => {
    if (onTabChange) {
      onTabChange(tab);
      setIsSidebarOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden bg-blue-600 text-white p-4 flex justify-between items-center sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-2">
          <Droplets className="w-6 h-6" />
          <h1 className="font-bold text-lg">PDAM dan Iuran Sampah</h1>
        </div>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
          {isSidebarOpen ? <X /> : <Menu />}
        </button>
      </header>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-0 z-40 bg-white md:relative md:flex md:flex-col md:w-64 border-r transition-transform duration-300 ease-in-out",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="p-6 border-b hidden md:flex items-center gap-2 text-blue-600">
          <Droplets className="w-8 h-8" />
          <h1 className="font-bold text-xl">PDAM dan Iuran Sampah</h1>
        </div>

        <div className="p-6 bg-blue-50 md:bg-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
              {user.name.charAt(0)}
            </div>
            <div>
              <p className="font-semibold text-gray-900 truncate w-32">{user.name}</p>
              <p className="text-xs text-blue-600 font-medium">{getRoleLabel(user.role)}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          <SidebarLink 
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
            active={activeTab === "dashboard" || !activeTab} 
            onClick={() => handleTabClick("dashboard")}
          />
          
          {user.role === "ADMIN" && (
            <>
              <SidebarLink 
                icon={<Users size={20} />} 
                label="Data Warga" 
                active={activeTab === "warga"} 
                onClick={() => handleTabClick("warga")}
              />
              <SidebarLink 
                icon={<Droplets size={20} />} 
                label="Catat Meter / Tagihan" 
                active={activeTab === "tagihan"} 
                onClick={() => handleTabClick("tagihan")}
              />
              <SidebarLink 
                icon={<Home size={20} />} 
                label="Biaya Hunian" 
                active={activeTab === "hunian"} 
                onClick={() => handleTabClick("hunian")}
              />
              <SidebarLink 
                icon={<UserPlus size={20} />} 
                label="Manajemen Petugas" 
                active={activeTab === "petugas"} 
                onClick={() => handleTabClick("petugas")}
              />
              <SidebarLink 
                icon={<Wallet size={20} />} 
                label="Laporan Keuangan" 
                active={activeTab === "keuangan"} 
                onClick={() => handleTabClick("keuangan")}
              />
              <SidebarLink 
                icon={<FileText size={20} />} 
                label="Persetujuan Dana" 
                active={activeTab === "dana"} 
                onClick={() => handleTabClick("dana")}
              />
              <SidebarLink 
                icon={<SettingsIcon size={20} />} 
                label="Pengaturan" 
                active={activeTab === "pengaturan"} 
                onClick={() => handleTabClick("pengaturan")}
              />
            </>
          )}

          {user.role === "KOORDINATOR" && (
            <>
              <SidebarLink 
                icon={<Droplets size={20} />} 
                label="Catat Meter" 
                active={activeTab === "INPUT" || !activeTab} 
                onClick={() => handleTabClick("INPUT")}
              />
              <SidebarLink 
                icon={<HistoryIcon size={20} />} 
                label="Riwayat" 
                active={activeTab === "HISTORY"} 
                onClick={() => handleTabClick("HISTORY")}
              />
              <SidebarLink 
                icon={<Wallet size={20} />} 
                label="Setoran" 
                active={activeTab === "SETORAN"} 
                onClick={() => handleTabClick("SETORAN")}
              />
              <SidebarLink 
                icon={<FileText size={20} />} 
                label="Pengajuan Dana" 
                active={activeTab === "DANA"} 
                onClick={() => handleTabClick("DANA")}
              />
            </>
          )}

          {user.role === "BENDAHARA" && (
            <>
              <SidebarLink 
                icon={<Wallet size={20} />} 
                label="Laporan Keuangan" 
                active={activeTab === "keuangan" || !activeTab} 
                onClick={() => handleTabClick("keuangan")}
              />
              <SidebarLink 
                icon={<FileText size={20} />} 
                label="Persetujuan Dana" 
                active={activeTab === "dana"} 
                onClick={() => handleTabClick("dana")}
              />
            </>
          )}

          {user.role === "PENGELOLA" && (
            <>
              <SidebarLink 
                icon={<LayoutDashboard size={20} />} 
                label="Dashboard" 
                active={activeTab === "dashboard" || !activeTab} 
                onClick={() => handleTabClick("dashboard")}
              />
              <SidebarLink 
                icon={<Droplets size={20} />} 
                label="Monitoring Tagihan" 
                active={activeTab === "tagihan"} 
                onClick={() => handleTabClick("tagihan")}
              />
              <SidebarLink 
                icon={<Home size={20} />} 
                label="Biaya Hunian" 
                active={activeTab === "hunian"} 
                onClick={() => handleTabClick("hunian")}
              />
              <SidebarLink 
                icon={<MessageSquare size={20} />} 
                label="Keluhan Warga" 
                active={activeTab === "keluhan"} 
                onClick={() => handleTabClick("keluhan")}
              />
              <SidebarLink 
                icon={<AlertCircle size={20} />} 
                label="Daftar Penunggak" 
                active={activeTab === "penunggak"} 
                onClick={() => handleTabClick("penunggak")}
              />
            </>
          )}
        </nav>

        <div className="p-4 border-t">
          <button 
            onClick={onLogout}
            className="flex items-center gap-3 w-full px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut size={20} />
            <span className="font-medium">Keluar</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-x-hidden">
        {children}
      </main>

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}

function SidebarLink({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 w-full px-4 py-2.5 rounded-lg transition-all duration-200",
        active ? "bg-blue-600 text-white shadow-md" : "text-gray-600 hover:bg-gray-100"
      )}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );
}
