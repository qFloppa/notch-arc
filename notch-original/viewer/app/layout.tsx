import type { Metadata, Viewport } from "next";
import "./globals.css";

const title = "Notch — a clearing layer for agent micropayments";
const description =
  "Agents accrue hash-committed notches on a shared tab; each cycle nets to one signed statement, and a counterparty disputes the statement rather than the transaction. Live on GenLayer StudioNet.";

/* The card image is app/opengraph-image.jpg, picked up by file convention —
   Next emits its url, type and dimensions, so there is no og:image block here.
   A scraper needs an absolute url for it, which is what metadataBase supplies:
   the stable production domain in preference to the per-deploy one, so a
   preview build does not publish links pointing at itself. */
const origin =
  process.env.VERCEL_PROJECT_PRODUCTION_URL ??
  process.env.VERCEL_URL ??
  "localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(origin.startsWith("http") ? origin : `https://${origin}`),
  title,
  description,
  applicationName: "Notch",
  manifest: "/site.webmanifest",
  openGraph: { title, description, siteName: "Notch", type: "website" },
  // No twitter.images either: the opengraph-image convention fills both
  // og:image and twitter:image, so naming it here would only put a second copy
  // of the same bytes in the repo.
  twitter: { card: "summary_large_image", title, description },
};

export const viewport: Viewport = {
  themeColor: "#0e1116",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
