import React, { useState } from "react";
import { User } from "../types";
import { supabase } from "../lib/supabase";
import { Droplets, User as UserIcon, Lock, CreditCard, ArrowRight, Loader2 } from "lucide-react";
import { motion } from "motion/react";

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (isWarga) {
        // For Warga, search for the unit with matching KTP
        const { data, error: queryError } = await supabase
          .from("units")
          .select("*")
          .eq("ktpNumber", ktp)
          .maybeSingle();
        
        if (queryError) throw queryError;
        
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
        const { data: userData, error: queryError } = await supabase
          .from("users")
          .select("*")
          .eq("username", username)
          .eq("password", password)
          .maybeSingle();
        
        if (queryError) throw queryError;
        
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
      console.error("Login Error:", err);
      setError("Terjadi kesalahan saat login. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="p-8 text-center bg-white border-b">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
            <Droplets size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Rusunawa Gunungsari</h1>
          <p className="text-gray-500 mt-1">Sistem Tagihan Air Paguyuban</p>
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
      </motion.div>
    </div>
  );
}
