import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";
import AuthProvider from "@/components/layout/AuthProvider";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: "ASAR.kz - Экстренная помощь и обмен ресурсами",
  description: "Платформа для экстренной помощи и обмена ресурсами в Казахстане",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={inter.className}>
        <AuthProvider>
          <Header />
          <main className="min-h-screen">
            {children}
          </main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}

