"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAppStore, type UserSubscription } from "@/lib/store";
import { ALL_CONTENT_TYPES, type ContentType, type ExcludedItem } from "@/lib/content-access";

/**
 * useSubscription — Fetches FRESH subscription data from the API
 *
 * This hook ensures that subscription data is always fetched directly from the server,
 * NOT from the Zustand store's in-memory cache. This prevents subscription data from
 * leaking between different user accounts on the same device.
 *
 * Returns ALL active subscription plans so that multi-subscription users
 * can access all content types they are subscribed to.
 *
 * Also returns fullPlanExcludedItems for per-item access control in the full plan.
 *
 * Usage:
 *   const { subscription, activePlans, fullPlanIncludes, fullPlanExcludedItems, loading } = useSubscription();
 *   if (activePlans.includes('courses')) { ... }
 */

interface UseSubscriptionResult {
  subscription: UserSubscription | null;
  activePlans: string[];
  fullPlanIncludes: ContentType[];
  fullPlanExcludedItems: ExcludedItem[];
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useSubscription(): UseSubscriptionResult {
  const userId = useAppStore((s) => s.user?.id);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [activePlans, setActivePlans] = useState<string[]>([]);
  const [fullPlanIncludes, setFullPlanIncludes] = useState<ContentType[]>(ALL_CONTENT_TYPES);
  const [fullPlanExcludedItems, setFullPlanExcludedItems] = useState<ExcludedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const fetchedForUserIdRef = useRef<string | null>(null);

  // Fetch fullPlanIncludes + fullPlanExcludedItems from public API (doesn't require auth)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/subscription-prices?_t=" + Date.now());
        if (res.ok) {
          const data = await res.json();
          if (data.fullPlanIncludes) {
            setFullPlanIncludes(data.fullPlanIncludes);
          }
          if (data.fullPlanExcludedItems) {
            setFullPlanExcludedItems(data.fullPlanExcludedItems);
          }
        }
      } catch { /* ignore */ }
    })();
  }, []);

  const fetchSubscription = useCallback(async (uid: string) => {
    if (!uid || uid === "admin-1") {
      setSubscription(null);
      setActivePlans([]);
      fetchedForUserIdRef.current = uid;
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/subscriptions?_t=${Date.now()}`);
      if (!res.ok) {
        setSubscription(null);
        setActivePlans([]);
        fetchedForUserIdRef.current = uid;
        return;
      }

      const data = await res.json();
      const now = new Date();
      const activeSubs = (data.subscriptions || []).filter(
        (s: { status: string; endDate: string }) =>
          s.status === "active" && new Date(s.endDate) > now
      );

      if (activeSubs.length > 0) {
        // Collect all active plan types
        const plans = activeSubs.map((s: { type: string }) => s.type);
        setActivePlans(plans);

        // Pick the best single subscription for backward compatibility
        // Priority: "full" > any specific type
        const fullSub = activeSubs.find((s: { type: string }) => s.type === "full");
        const best = fullSub || activeSubs[0];
        setSubscription({
          plan: best.type,
          status: "active",
          expiresAt: best.endDate,
        });
      } else {
        setSubscription(null);
        setActivePlans([]);
      }
      fetchedForUserIdRef.current = uid;
    } catch {
      setSubscription(null);
      setActivePlans([]);
      fetchedForUserIdRef.current = uid;
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch when userId changes (or on first mount)
  useEffect(() => {
    // If userId hasn't changed since last fetch, skip
    if (userId === fetchedForUserIdRef.current) return;

    // If userId changed, immediately clear old subscription
    // This prevents showing old subscription while fetching new one
    if (userId && userId !== fetchedForUserIdRef.current) {
      setSubscription(null);
      setActivePlans([]);
    }

    if (userId) {
      fetchSubscription(userId);
    } else {
      setSubscription(null);
      setActivePlans([]);
      fetchedForUserIdRef.current = null;
    }
  }, [userId, fetchSubscription]);

  return {
    subscription,
    activePlans,
    fullPlanIncludes,
    fullPlanExcludedItems,
    loading,
    refresh: () => fetchSubscription(userId || ""),
  };
}

/**
 * A simpler version that returns a User-like object compatible with canAccessContent()
 * Also exposes activePlans and fullPlanExcludedItems for multi-subscription support
 */
export function useUserWithFreshSubscription() {
  const user = useAppStore((s) => s.user);
  const { subscription, activePlans, fullPlanIncludes, fullPlanExcludedItems, loading } = useSubscription();

  // Return a user object with the FRESH subscription from the API
  // AND the activePlans array for multi-subscription support
  return {
    user: user
      ? { ...user, subscription: subscription || undefined }
      : null,
    activePlans,
    fullPlanIncludes,
    fullPlanExcludedItems,
    loading,
  };
}
