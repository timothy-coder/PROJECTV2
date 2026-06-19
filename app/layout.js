import localFont from "next/font/local";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const montserrat = localFont({
  src: [
    {
      path: "../public/fonts/Montserrat-VariableFont_wght.ttf",
      style: "normal",
      weight: "100 900",
    },
  ],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata = {
  title: "One Solution",
  description: "One Solution",
  icons: {
    icon: "/logonew.png",
    shortcut: "/logonew.png",
    apple: "/logonew.png",
  },
  other: {
    google: "notranslate",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" translate="no" className={`${montserrat.variable} h-full antialiased notranslate`}>
      <body translate="no" className="notranslate min-h-full flex flex-col font-sans">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
