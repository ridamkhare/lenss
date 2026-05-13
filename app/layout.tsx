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
  metadataBase: new URL("https://lenss.one"),
  title: "lenss",
  description:
    "Paste an AI answer. See what shaped it, and where it leads.",
  openGraph: {
    title: "lenss",
    description:
      "Paste an AI answer. See what shaped it, and where it leads.",
    url: "https://lenss.one",
    siteName: "lenss",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "lenss",
    description:
      "Paste an AI answer. See what shaped it, and where it leads.",
  },
  robots: {
    index: false,
    follow: false,
  },
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
