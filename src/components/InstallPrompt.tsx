import React, { useState, useEffect } from 'react';
import { Download, X, Share } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if it's iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;

    if (isStandalone) return;

    const handler = (e: any) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Show the prompt
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // For iOS, we show it after a short delay if not standalone
    if (isIOSDevice && !isStandalone) {
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    // Show the prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
    
    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-20 left-4 right-4 z-50"
      >
        <div className="bg-white rounded-2xl shadow-2xl border border-blue-100 p-5 flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <div className="flex gap-3">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shrink-0">
                <Download size={24} />
              </div>
              <div>
                <h3 className="font-black text-gray-900 text-sm">Pasang Aplikasi</h3>
                <p className="text-[11px] text-gray-500 leading-tight mt-1">
                  Tambahkan shortcut ke layar utama HP Anda agar lebih mudah diakses.
                </p>
              </div>
            </div>
            <button 
              onClick={() => setShowPrompt(false)}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {isIOS ? (
            <div className="bg-blue-50 p-3 rounded-xl space-y-2">
              <p className="text-[10px] font-bold text-blue-800 flex items-center gap-2">
                <Share size={14} /> KHUSUS PENGGUNA IPHONE:
              </p>
              <ol className="text-[10px] text-blue-700 space-y-1 list-decimal ml-4">
                <li>Klik tombol <strong>Share</strong> (kotak dengan panah ke atas) di bawah.</li>
                <li>Gulir ke bawah dan klik <strong>'Add to Home Screen'</strong>.</li>
              </ol>
            </div>
          ) : (
            <button
              onClick={handleInstall}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-200 active:scale-95 transition-transform"
            >
              Instal Sekarang
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
