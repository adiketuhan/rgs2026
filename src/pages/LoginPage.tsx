import React, { useState, useEffect } from "react";
import { User } from "../types";
import { supabase } from "../lib/supabase";
import { Droplets, User as UserIcon, Lock, CreditCard, ArrowRight, Loader2, ShieldCheck, Info, Users } from "lucide-react";
import { motion } from "framer-motion";

interface LoginPageProps {
  onLogin: (user: User) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [isWarga, setIsWarga] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [ktp, setKtp] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [coordinators, setCoordinators] = useState<User[]>([]);

  useEffect(() => {
    const fetchCoordinators = async () => {
      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("role", "KOORDINATOR")
        .order("floor", { ascending: true });
      if (data) setCoordinators(data);
    };
    fetchCoordinators();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (isWarga) {
        // For Warga, search for the unit with matching KTP
        const { data: units, error: queryError } = await supabase
          .from("units")
          .select("*")
          .eq("ktpNumber", ktp)
          .limit(1);
        
        if (queryError) throw queryError;
        
        const data = units && units.length > 0 ? units[0] : null;
        
        if (data) {
          const wargaUser: User = {
            id: data.id,
            username: data.ktpNumber,
            role: "WARGA",
            name: data.residentName
          };
          localStorage.setItem("rusun_session", JSON.stringify(wargaUser));
          onLogin(wargaUser);
        } else {
          setError("Nomor KTP tidak terdaftar");
        }
      } else {
        // For Petugas, search Supabase "users" table for username and password
        const { data: users, error: queryError } = await supabase
          .from("users")
          .select("*")
          .eq("username", username)
          .eq("password", password)
          .limit(1);
        
        if (queryError) throw queryError;
        
        const userData = users && users.length > 0 ? users[0] : null;
        
        if (userData) {
          // Create a session in Supabase
          try {
            await supabase.from("sessions").upsert({
              id: userData.id,
              userId: userData.id,
              username: userData.username,
              role: userData.role,
              floor: userData.floor || null,
              syncedAt: new Date().toISOString()
            });
          } catch (err) {
            console.error("Error creating session:", err);
          }

          localStorage.setItem("rusun_session", JSON.stringify(userData));
          onLogin(userData);
        } else {
          // Special case for first-time admin bootstrap
          if (username === "admin" && password === "admin123") {
            const { count, error: countError } = await supabase
              .from("users")
              .select("*", { count: 'exact', head: true });
            
            if (countError) throw countError;

            if (count === 0) {
              // Bootstrap the first admin
              const adminId = "admin_initial";
              const adminUser: User = {
                id: adminId,
                username: "admin",
                password: "admin123",
                role: "ADMIN",
                name: "Super Admin"
              };
              await supabase.from("users").insert(adminUser);
              localStorage.setItem("rusun_session", JSON.stringify(adminUser));
              onLogin(adminUser);
              return;
            }
          }
          setError("Username atau Password salah");
        }
      }
    } catch (err: any) {
      console.error("Login Error Details:", err);
      const errorMessage = err.message || err.error_description || "Terjadi kesalahan saat login. Silakan coba lagi.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex flex-col items-center justify-center p-4 py-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-8"
      >
        {/* Left Side: Info & Coordinators */}
        <div className="space-y-6 text-white order-2 lg:order-1">
          <div className="bg-white/10 backdrop-blur-md p-8 rounded-3xl border border-white/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-500 rounded-xl">
                <Info size={24} />
              </div>
              <h2 className="text-xl font-bold">Tentang Aplikasi</h2>
            </div>
            <p className="text-blue-50 leading-relaxed text-sm">
              Aplikasi ini adalah murni hasil karya <strong>Paguyuban</strong> yang bekerja sama dengan pihak <strong>Pengelola</strong> agar informasi tagihan dan keluhan warga dapat tersampaikan dengan mudah, transparan, dan cepat.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md p-8 rounded-3xl border border-white/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-500 rounded-xl">
                <ShieldCheck size={24} />
              </div>
              <h2 className="text-xl font-bold">Keamanan Data</h2>
            </div>
            <p className="text-blue-50 leading-relaxed text-sm">
              Aplikasi ini khusus untuk warga Rusunawa Gunungsari. Jangan khawatir, data Anda tidak akan bocor ke warga lain. 
              <span className="block mt-2 font-bold text-amber-300">
                ⚠️ Pastikan Nomor KTP Anda jangan diberikan ke orang lain karena ini adalah kunci akses Anda.
              </span>
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md p-8 rounded-3xl border border-white/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-green-500 rounded-xl">
                <Users size={24} />
              </div>
              <h2 className="text-xl font-bold">Koordinator Lantai</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {coordinators.length > 0 ? coordinators.map((koor) => (
                <div key={koor.id} className="bg-white/5 p-4 rounded-2xl border border-white/10">
                  <p className="text-[10px] font-bold text-blue-300 uppercase tracking-widest">Lantai {koor.floor}</p>
                  <p className="font-bold text-sm mt-1">{koor.name}</p>
                </div>
              )) : (
                <p className="text-xs text-blue-200 italic">Daftar koordinator sedang dimuat...</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden order-1 lg:order-2 self-start">
          <div className="p-8 text-center bg-white border-b">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
              <Droplets size={32} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Rusunawa Gunungsari</h1>
            <p className="text-gray-500 mt-1">Sistem Informasi & Tagihan</p>
          </div>

          <div className="p-8">
            <div className="flex bg-gray-100 p-1 rounded-xl mb-8">
              <button 
                onClick={() => setIsWarga(true)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${isWarga ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                Warga
              </button>
              <button 
                onClick={() => setIsWarga(false)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${!isWarga ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                Petugas
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {isWarga ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Nomor KTP</label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input 
                      type="text" 
                      placeholder="Masukkan 16 digit No. KTP"
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                      value={ktp}
                      onChange={(e) => setKtp(e.target.value)}
                      required
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Username</label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                      <input 
                        type="text" 
                        placeholder="Username petugas"
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                      <input 
                        type="password" 
                        placeholder="••••••••"
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </>
              )}

              {error && (
                <motion.p 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-red-500 text-sm font-medium bg-red-50 p-3 rounded-lg border border-red-100"
                >
                  {error}
                </motion.p>
              )}

              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-200 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Memproses...
                  </>
                ) : (
                  <>
                    Masuk Sekarang
                    <ArrowRight size={20} />
                  </>
                )}
              </button>

              {!isWarga && (
                <div className="mt-4 text-center">
                  <p className="text-xs text-gray-400 italic">
                    Gunakan username & password yang diberikan Admin.
                  </p>
                </div>
              )}
            </form>
          </div>

          <div className="p-6 bg-gray-50 text-center border-t">
            <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">
              Paguyuban Rusunawa Gunungsari
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
