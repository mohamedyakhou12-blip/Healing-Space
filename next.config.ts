import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Note: "standalone" output is not needed for Vercel deployments.
  // Vercel handles the build output adapter automatically.
  reactStrictMode: true,
  // Only allow specific dev origins — never use wildcards
  allowedDevOrigins: [
    "localhost:3000",
  ],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // ── Security Headers ──
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=()",
          },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
          // Restrict framing to same origin only
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // ── Content Security Policy ──
          // Firebase Auth needs: gstatic.com scripts, googleapis.com styles/fonts,
          // firebaseapp.com frames, identitytoolkit + securetoken connections
          // Google Sign-In popup needs: accounts.google.com frames + connections
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://*.gstatic.com https://www.gstatic.com https://apis.google.com https://accounts.google.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https:",
              "media-src 'self' blob: https:",
              "font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com",
              // Firebase Auth + Google Sign-In + Cloudinary connections
              "connect-src 'self' https: wss: https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://api.cloudinary.com https://oauth2.googleapis.com https://apis.google.com",
              // Firebase auth handler + Google Sign-In popup frames
              "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com blob:",
              "frame-ancestors 'self'",
              "form-action 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "worker-src 'self' blob:",
            ].join("; "),
          },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
          { key: "Pragma", value: "no-cache" },
        ],
      },
    ];
  },
};

export default nextConfig;
