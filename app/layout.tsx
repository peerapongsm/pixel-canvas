import type { Metadata } from "next";
import { Chakra_Petch, Sarabun } from "next/font/google";
import "./globals.css";

const chakraPetch = Chakra_Petch({
  subsets: ["latin", "thai"],
  weight: ["600", "700"],
  variable: "--font-display",
  display: "swap",
});

const sarabun = Sarabun({
  subsets: ["latin", "thai"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pixel Canvas สองคน",
  description: "canvas 64x64 ที่คุณกับเพื่อนวาดด้วยกันสดๆ ผ่าน WebRTC ตรง ไม่มี server",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${chakraPetch.variable} ${sarabun.variable}`}>
      <head>
        <script
          defer
          src="https://umami-host-peerapongsms-projects.vercel.app/script.js"
          data-website-id="3f09453d-0b39-443e-8845-5e65611cc58a"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
