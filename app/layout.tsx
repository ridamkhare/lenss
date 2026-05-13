import type { Metadata } from "next"
import { Newsreader, Inter } from "next/font/google"
import Script from "next/script"
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
  const clarityId = process.env.NEXT_PUBLIC_CLARITY_ID

  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body className="font-serif">
        {children}
        {clarityId && (
          <Script id="clarity" strategy="afterInteractive">
            {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${clarityId}");`}
          </Script>
        )}
      </body>
    </html>
  )
}
