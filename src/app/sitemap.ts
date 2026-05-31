import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site-config";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = SITE_URL;

  // Real route pages (not hash fragments) — these are indexed by Google
  const routes = [
    { path: "", priority: 1.0, changeFrequency: "daily" as const },
    { path: "/courses", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/articles", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/podcasts", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/videos", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/pdfs", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/live", priority: 0.7, changeFrequency: "weekly" as const },
    { path: "/subscriptions", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/coaching", priority: 0.8, changeFrequency: "weekly" as const },
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route.path}`,
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
