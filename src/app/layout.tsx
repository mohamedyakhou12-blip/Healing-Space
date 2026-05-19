import type { Metadata } from "next";
import { Geist, Geist_Mono, Cairo } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

import { SITE_URL } from "@/lib/site-config";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "فضاء الشفاء | Espace de Guérison | Healing Space",
    template: "%s | فضاء الشفاء",
  },
  description:
    "فضاء الشفاء - منصة الدكتورة نسرين التعليمية. اكتشف الدورات التعليمية والمقالات المتخصصة والبودكاست والفيديوهات في مجال العلاج النفسي والتطوير الذاتي. Espace de Guérison - Plateforme éducative de Dr. Ness.",
  keywords: [
    // Arabic
    "فضاء الشفاء",
    "العلاج النفسي",
    "التطوير الذاتي",
    "الدورات التعليمية",
    "البودكاست",
    "الصحة النفسية",
    "دكتورة نسرين",
    "منصة تعليمية",
    "كتب نفسية",
    "استشارات نفسية",
    // French
    "espace de guérison",
    "thérapie",
    "développement personnel",
    "cours en ligne",
    "santé mentale",
    "podcast thérapie",
    "Dr. Ness",
    // English
    "healing space",
    "therapy",
    "personal development",
    "online courses",
    "mental health",
    "psychotherapy",
    "self improvement",
    "wellness",
  ],
  authors: [{ name: "الدكتورة نسرين - Dr. Ness" }],
  creator: "فضاء الشفاء",
  publisher: "فضاء الشفاء",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "1024x1024", type: "image/png" },
      { url: "/logo.svg", type: "image/svg+xml" },
    ],
    apple: "/favicon.png",
  },
  alternates: {
    canonical: SITE_URL,
    languages: {
      "ar": SITE_URL,
      "fr": SITE_URL,
      "en": SITE_URL,
    },
  },
  openGraph: {
    title: "فضاء الشفاء | Espace de Guérison | Healing Space",
    description: "منصة الدكتورة نسرين التعليمية - اكتشف الدورات والمقالات والبودكاست في مجال العلاج النفسي والتطوير الذاتي",
    url: SITE_URL,
    siteName: "فضاء الشفاء",
    locale: "ar_DZ",
    alternateLocale: ["fr_DZ", "en_US"],
    type: "website",
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "فضاء الشفاء - Healing Space",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "فضاء الشفاء | Espace de Guérison | Healing Space",
    description: "منصة الدكتورة نسرين التعليمية للعلاج النفسي والتطوير الذاتي",
    images: [`${SITE_URL}/og-image.png`],
  },
  verification: {
    google: process.env.GOOGLE_VERIFICATION_CODE || "your-google-verification-code",
  },
};

// JSON-LD structured data for the organization
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "فضاء الشفاء",
      alternateName: ["Espace de Guérison", "Healing Space"],
      description: "منصة الدكتورة نسرين التعليمية للعلاج النفسي والتطوير الذاتي",
      inLanguage: ["ar", "fr", "en"],
      potentialAction: {
        "@type": "SearchAction",
        target: `${SITE_URL}/?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "EducationalOrganization",
      "@id": `${SITE_URL}/#organization`,
      name: "فضاء الشفاء",
      alternateName: ["Espace de Guérison", "Healing Space"],
      url: SITE_URL,
      logo: `${SITE_URL}/logo.svg`,
      sameAs: [],
      founder: {
        "@type": "Person",
        name: "الدكتورة نسرين",
        alternateName: "Dr. Ness",
      },
    },
    {
      "@type": "WebPage",
      "@id": `${SITE_URL}/#webpage`,
      url: SITE_URL,
      name: "فضاء الشفاء - منصة العلاج والتعليم",
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: { "@id": `${SITE_URL}/#organization` },
      inLanguage: ["ar", "fr", "en"],
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        {/* JSON-LD Structured Data for Google */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {/* Preconnect to external resources */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://images.unsplash.com" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${cairo.variable} antialiased bg-background text-foreground`}
      >
        <AppShell>{children}</AppShell>
        <Toaster
          position="top-center"
          richColors
          closeButton
          toastOptions={{
            className: "font-[family-name:var(--font-cairo)]",
          }}
        />
      </body>
    </html>
  );
}
