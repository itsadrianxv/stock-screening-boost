import "~/styles/globals.css";

import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";

const uiSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ui-sans",
});

const dataMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-data-mono",
});

export const metadata: Metadata = {
  title: "股票筛选增强 · 投资决策终端",
  description:
    "面向专业研究员的投资决策终端，连接机会池、行业判断、公司判断与择时组合。",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className={`${uiSans.variable} ${dataMono.variable} antialiased`}>
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}
