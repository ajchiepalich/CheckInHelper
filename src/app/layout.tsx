import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "@/components/providers/app-providers";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { getEnv, isLocalMockMode } from "@/lib/env";

export const metadata: Metadata = {
  title: "Highlands Documentation Assistant",
  description:
    "Internal AI assistant for Church of the Highlands staff documentation.",
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
