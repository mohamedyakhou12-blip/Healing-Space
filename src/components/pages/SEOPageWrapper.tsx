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
 *
 * NOTE: We no longer force _spaMode to false. Since vercel.json rewrites
 * ALL routes to the SPA root, SPA mode should always be active for
 * smooth client-side navigation.
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
  }, [page]);

  return <>{children}</>;
}
