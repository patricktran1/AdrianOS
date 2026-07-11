import type { Metadata, Viewport } from "next";
import CloudSyncBridge from "@/components/CloudSyncBridge";
import WeeklyReportBridge from "@/components/WeeklyReportBridge";
import "./globals.css";
import "./school-mode-controls.css";

export const metadata: Metadata = {
  title: "AdrianOS Play",
  description: "A private shelf of games built for Adrian.",
  applicationName: "AdrianOS Play",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#10131b",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <CloudSyncBridge />
        <WeeklyReportBridge />
        {children}
      </body>
    </html>
  );
}
