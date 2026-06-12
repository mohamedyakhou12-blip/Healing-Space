'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  BookOpen,
  DollarSign,
  Paintbrush,
  Settings,
  ShoppingBag,
  ChevronRight,
  Menu,
  LogOut,
  Home,
} from 'lucide-react';

const adminLinks = [
  { href: '/admin', label: 'لوحة المعلومات', icon: LayoutDashboard },
  { href: '/admin/content', label: 'إدارة المحتوى', icon: BookOpen },
  { href: '/admin/members', label: 'الأعضاء', icon: Users },
  { href: '/admin/payments', label: 'المدفوعات', icon: CreditCard },
  { href: '/admin/pricing', label: 'الأسعار', icon: DollarSign },
  { href: '/admin/customize', label: 'تخصيص الرئيسية', icon: Paintbrush },
  { href: '/admin/settings', label: 'الإعدادات', icon: Settings },
  { href: '/admin/purchases', label: 'المشتريات', icon: ShoppingBag },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const user = useAppStore((s) => s.user);
  const isAdmin = useAppStore((s) => s.isAdmin);
  const isLoadingAuth = useAppStore((s) => s.isLoadingAuth);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoadingAuth && !user) {
      router.replace('/login');
      return;
    }
    if (!isLoadingAuth && user && !isAdmin) {
      router.replace('/');
      return;
    }
  }, [isLoadingAuth, user, isAdmin, router]);

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-200 border-t-teal-600" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen flex bg-gray-50" dir="rtl">
      {/* Sidebar */}
      <aside
        className={`hidden lg:flex flex-col bg-white border-l border-gray-200 shadow-sm transition-all duration-300 ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
          {!isCollapsed && (
            <span className="text-lg font-bold text-teal-800">لوحة التحكم</span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-8 w-8"
          >
            <ChevronRight className={`h-4 w-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
          </Button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-4 px-2 space-y-1">
          {adminLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-teal-50 text-teal-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                } ${isCollapsed ? 'justify-center' : ''}`}
              >
                <link.icon className="h-5 w-5 flex-shrink-0" />
                {!isCollapsed && link.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-2 border-t border-gray-200">
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            <Home className="h-5 w-5" />
            {!isCollapsed && 'العودة للموقع'}
          </Link>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 right-0 left-0 z-40 bg-white border-b border-gray-200 h-14 flex items-center px-4">
        <Button variant="ghost" size="icon" onClick={() => setIsMobileOpen(!isMobileOpen)}>
          <Menu className="h-5 w-5" />
        </Button>
        <span className="mr-3 text-lg font-bold text-teal-800">لوحة التحكم</span>
      </div>

      {/* Mobile sidebar overlay */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="fixed inset-0 bg-black/50" onClick={() => setIsMobileOpen(false)} />
          <aside className="fixed right-0 top-0 bottom-0 w-64 bg-white shadow-xl z-50">
            <div className="h-14 flex items-center justify-between px-4 border-b">
              <span className="text-lg font-bold text-teal-800">لوحة التحكم</span>
              <Button variant="ghost" size="icon" onClick={() => setIsMobileOpen(false)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <nav className="py-4 px-2 space-y-1">
              {adminLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                    pathname === link.href
                      ? 'bg-teal-50 text-teal-700'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <link.icon className="h-5 w-5" />
                  {link.label}
                </Link>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 lg:mt-0 mt-14">
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
