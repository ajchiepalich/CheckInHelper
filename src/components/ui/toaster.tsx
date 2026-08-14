"use client";

import { Toaster as Sonner } from "sonner";
import { useTheme } from "next-themes";

export function Toaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="bottom-center"
      offset={24}
      toastOptions={{
        duration: 4000,
        className: "font-sans",
      }}
    />
  );
}
