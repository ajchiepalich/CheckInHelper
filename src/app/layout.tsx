import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "@/components/providers/app-providers";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { getEnv, isLocalMockMode } from "@/lib/env";

// Authenticated pages query Supabase through Prisma and must not run at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: "Highlands Documentation Assistant",
  description:
    "Internal AI assistant for Church of the Highlands staff documentation.",
  openGraph: {
    title: "AI Helper",
    description:
      "Internal AI assistant for Church of the Highlands staff documentation.",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Helper",
    description:
      "Internal AI assistant for Church of the Highlands staff documentation.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  getEnv();

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AppProviders mockMode={isLocalMockMode()}>{children}</AppProviders>
        </ThemeProvider>
      </body>
    </html>
  );
}
