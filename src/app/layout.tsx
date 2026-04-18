import type { Metadata } from "next"
import { Inter, Geist_Mono } from "next/font/google"
import { Sidebar } from "@/components/layout/Sidebar"
import "./globals.css"

const inter     = Inter({ variable: "--font-inter", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export const metadata: Metadata = {
  title: "VaultFlow — Custody Console",
  description: "Digital asset custody operations console",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-screen flex overflow-hidden bg-slate-50">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </body>
    </html>
  )
}
