"use client";

import { useEffect } from "react";
import { useAppStore, type PageName } from "@/lib/store";

/**
 * Wrapper component for SEO route pages.
 * Sets the Zustand store's currentPage on mount so the sidebar
 * highlights correctly, then renders the page component.
 */
export function SEOPageWrapper({
  page,
  children,
}: {
  page: PageName;
  children: React.ReactNode;
}) {
  const navigate = useAppStore((s) => s.navigate);

  useEffect(() => {
    navigate(page);
  }, [page, navigate]);

  return <>{children}</>;
}
