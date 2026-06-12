'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Menu, X, User, LogOut, Settings, BookOpen } from 'lucide-react';
import { toast } from 'sonner';

export default function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, locale, navigate, setUser: setAppUser } = useAppStore();
  const isLoggedIn = !!user;
  const isAdmin = user?.role === 'admin';
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();

  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  const navLinks = [
    { href: '/', label: t('nav.home') },
    { href: '/courses', label: t('nav.courses') },
    { href: '/articles', label: t('nav.articles') },
    { href: '/podcasts', label: t('nav.podcasts') },
    { href: '/videos', label: t('nav.videos') },
    { href: '/books', label: t('nav.books') },
    { href: '/live', label: t('nav.live') },
    { href: '/coaching', label: t('nav.coaching') },
    { href: '/subscriptions', label: t('nav.subscriptions') },
  ];

  // Check session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        if (data.isLoggedIn) {
          // Get full profile
          const profileRes = await fetch('/api/auth/profile');
          if (profileRes.ok) {
            const profile = await profileRes.json();
            setAppUser({
              id: profile.id || profile.uid,
              email: profile.email,
              name: profile.name,
              avatar: profile.avatar || profile.photoURL,
              phone: profile.phone,
              role: profile.role || 'user',
            });
          }
        }
      } catch {
        // Session check failed, continue as logged out
      }
    };
    checkSession();
  }, [setAppUser]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setAppUser(null);
      router.replace('/');
    } catch {
      toast.error(t('common.error'));
    }
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 shadow-sm" dir={dir}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-teal-600 rounded-full flex items-center justify-center">
              <span className="text-white text-lg font-bold">ف</span>
            </div>
            <span className="text-xl font-bold text-teal-800 dark:text-teal-300 hidden sm:block">فضاء الشفاء</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <LanguageSwitcher />

            {isLoggedIn && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.name} className="h-10 w-10 rounded-full" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                        <span className="text-teal-700 dark:text-teal-300 font-medium">
                          {user.name?.charAt(0) || 'م'}
                        </span>
                      </div>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push('/profile')}>
                    <User className="me-2 h-4 w-4" />
                    {t('profile.title')}
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem onClick={() => router.push('/admin')}>
                      <Settings className="me-2 h-4 w-4" />
                      {t('admin.dashboard')}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => router.push('/subscriptions')}>
                    <BookOpen className="me-2 h-4 w-4" />
                    {t('nav.subscriptions')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="me-2 h-4 w-4" />
                    {t('auth.logout')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login">
                  <Button variant="ghost" size="sm">{t('auth.login')}</Button>
                </Link>
                <Link href="/register">
                  <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white">
                    {t('auth.register')}
                  </Button>
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden pb-4 border-t dark:border-gray-700 mt-2 pt-4">
            <div className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    pathname === link.href
                      ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
