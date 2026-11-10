'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import QuickDialModal from '@/components/QuickDialModal';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [quickDialOpen, setQuickDialOpen] = useState(false);

  // Auth pages don't show the dashboard shell
  const isAuthPage = pathname === '/login' || pathname === '/signup' || pathname === '/forgot-password';

  if (isAuthPage) {
    return <main className="min-h-screen bg-base-200">{children}</main>;
  }

  return (
    <div className="drawer lg:drawer-open min-h-screen bg-base-200">
      <input id="app-drawer" type="checkbox" className="drawer-toggle" />
      
      {/* Page Content */}
      <div className="drawer-content flex flex-col min-h-screen">
        <Navbar onOpenQuickDial={() => setQuickDialOpen(true)} />
        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Sidebar Drawer */}
      <div className="drawer-side z-50">
        <label htmlFor="app-drawer" aria-label="close sidebar" className="drawer-overlay"></label>
        <Sidebar />
      </div>

      {/* Global Quick Dial Modal */}
      <QuickDialModal isOpen={quickDialOpen} onClose={() => setQuickDialOpen(false)} />
    </div>
  );
}

