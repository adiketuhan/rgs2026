import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from "react";
import { HashRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { User } from "./types";
import { supabase } from "./lib/supabase";
import { Layout } from "./components/Layout";
import { InstallPrompt } from "./components/InstallPrompt";

// Pages
import { LoginPage } from "./pages/LoginPage";
import { AdminDashboard } from "./pages/AdminDashboard";
import { KoorDashboard } from "./pages/KoorDashboard";
import { BendaharaDashboard } from "./pages/BendaharaDashboard";
import { PengelolaDashboard } from "./pages/PengelolaDashboard";
import { WargaDashboard } from "./pages/WargaDashboard";

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, errorInfo: string }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorInfo: "" };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorInfo: error.message || "Unknown error" };
  }

  componentDidCatch(error: any, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Terjadi Kesalahan</h1>
            <p className="text-gray-600 mb-6">Aplikasi mengalami kendala teknis. Silakan muat ulang halaman.</p>
            <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left overflow-auto max-h-40">
              <code className="text-xs text-red-500">{this.state.errorInfo}</code>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
            >
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminTab, setAdminTab] = useState("dashboard");

  useEffect(() => {
    const localSession = localStorage.getItem("rusun_session");
    if (localSession) {
      const userData = JSON.parse(localSession) as User;
      setUser(userData);
      
      // Set initial tab based on role
      if (userData.role === "KOORDINATOR") {
        setAdminTab("INPUT");
      } else if (userData.role === "BENDAHARA") {
        setAdminTab("keuangan");
      } else if (userData.role === "PENGELOLA") {
        setAdminTab("dashboard");
      } else if (userData.role === "SECURITY") {
        setAdminTab("penunggak");
      }
      
      // Sync session to Supabase if needed
      const syncSession = async () => {
        try {
          await supabase.from("sessions").upsert({
            id: userData.id, // Using user ID as session ID for simplicity in this pseudo-auth
            userId: userData.id,
            username: userData.username,
            role: userData.role,
            floor: userData.floor || null,
            syncedAt: new Date().toISOString()
          });
        } catch (err) {
          console.error("Error syncing session to Supabase:", err);
        }
      };
      syncSession();
    }
    setLoading(false);
  }, []);

  const handleLogout = async () => {
    const localSession = localStorage.getItem("rusun_session");
    if (localSession) {
      const userData = JSON.parse(localSession) as User;
      try {
        await supabase.from("sessions").delete().eq("id", userData.id);
      } catch (err) {
        console.error("Error deleting session:", err);
      }
    }
    localStorage.removeItem("rusun_session");
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 font-medium">Memuat Aplikasi...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Router>
        <InstallPrompt />
        <Routes>
          <Route 
            path="/login" 
            element={user ? <Navigate to="/" /> : <LoginPage onLogin={setUser} />} 
          />
          
          <Route 
            path="/" 
            element={
              user ? (
                <Layout 
                  user={user} 
                  onLogout={handleLogout} 
                  activeTab={adminTab}
                  onTabChange={setAdminTab}
                >
                  <DashboardRouter user={user} adminTab={adminTab} onTabChange={setAdminTab} />
                </Layout>
              ) : (
                <Navigate to="/login" />
              )
            } 
          />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

function DashboardRouter({ user, adminTab, onTabChange }: { user: User, adminTab?: string, onTabChange: (tab: string) => void }) {
  switch (user.role) {
    case "ADMIN":
      return <AdminDashboard user={user} activeTab={adminTab as any} />;
    case "KOORDINATOR":
      return <KoorDashboard user={user} activeTab={adminTab as any} />;
    case "BENDAHARA":
      return <BendaharaDashboard user={user} activeTab={adminTab} />;
    case "PENGELOLA":
    case "SECURITY":
      return <PengelolaDashboard user={user} activeTab={adminTab} onTabChange={onTabChange} />;
    case "WARGA":
      return <WargaDashboard user={user} />;
    default:
      return <Navigate to="/login" />;
  }
}
