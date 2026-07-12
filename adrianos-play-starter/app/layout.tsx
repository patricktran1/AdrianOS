import type { Metadata, Viewport } from "next";
import BetaFeedbackLauncher from "@/components/BetaFeedbackLauncher";
import CloudSyncBridge from "@/components/CloudSyncBridge";
import FamilyOnboardingGate from "@/components/FamilyOnboardingGate";
import InstallAppPrompt from "@/components/InstallAppPrompt";
import MobileAppDock from "@/components/MobileAppDock";
import PWARegistrar from "@/components/PWARegistrar";
import WeeklyReportBridge from "@/components/WeeklyReportBridge";
import "./globals.css";
import "./school-mode-controls.css";
import "./mobile-app-shell.css";

export const metadata: Metadata = {
  title: "AdrianOS Learning",
  description: "A parent-managed learning playground with personalized child profiles, School Mode, and cross-device progress.",
  applicationName: "AdrianOS Learning",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/adrianos-192", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "AdrianOS",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#10131b",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <PWARegistrar />
        <CloudSyncBridge />
        <WeeklyReportBridge />
        <FamilyOnboardingGate>{children}</FamilyOnboardingGate>
        <MobileAppDock />
        <InstallAppPrompt />
        <BetaFeedbackLauncher />
      </body>
    </html>
  );
}
