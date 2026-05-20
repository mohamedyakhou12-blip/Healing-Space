"use client";

import { useEffect } from "react";
import { useAppStore, type PageName } from "@/lib/store";

/**
 * Wrapper component for SEO route pages.
 * Sets the Zustand store's currentPage on mount so the sidebar
 * highlights correctly, then renders the page component.
 *
 * Uses setState directly instead of navigate() to avoid triggering
 * a URL change (we're already on the correct URL for this route page).
 */
export function SEOPageWrapper({
  page,
  children,
}: {
  page: PageName;
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Directly set currentPage without calling navigate() which would
    // try to change the URL (potentially causing a full page reload)
    useAppStore.setState({ currentPage: page });
    // Also ensure _spaMode is false since we're on a route page
    useAppStore.setState({ _spaMode: false });
  }, [page]);

  return <>{children}</>;
}
