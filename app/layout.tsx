import type { Metadata } from "next"
import { Newsreader, Inter } from "next/font/google"
import "./globals.css"

const serif = Newsreader({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  weight: ["400", "500"],
  style: ["normal", "italic"],
})

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500"],
})

export const metadata: Metadata = {
  title: "lens",
  description: "Reveal the shape of an AI answer.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body className="font-serif">{children}</body>
    </html>
  )
}
