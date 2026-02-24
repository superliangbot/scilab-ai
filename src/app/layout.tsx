import type { Metadata } from "next";
import "@/styles/globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "SciLab AI — Interactive Science Simulations",
  description:
    "AI-enhanced interactive science simulation platform with physics, chemistry, astronomy, biology, and mathematics simulations.",
  openGraph: {
    title: "SciLab AI — Interactive Science Simulations",
    description:
      "Explore 10+ interactive science simulations with AI tutoring.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
