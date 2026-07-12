import type { Metadata, Viewport } from "next";
import BetaFeedbackLauncher from "@/components/BetaFeedbackLauncher";
import CloudSyncBridge from "@/components/CloudSyncBridge";
import DailyAdventureRemixBridge from "@/components/DailyAdventureRemixBridge";
import ElementaryScopeBridge from "@/components/ElementaryScopeBridge";
import FamilyAccountControl from "@/components/FamilyAccountControl";
import FamilyOnboardingGate from "@/components/FamilyOnboardingGate";
import GradeGameSpotlightBridge from "@/components/GradeGameSpotlightBridge";
import InstallAppPrompt from "@/components/InstallAppPrompt";
import MasteryLoopBridge from "@/components/MasteryLoopBridge";
import MobileAppDock from "@/components/MobileAppDock";
import ParentSessionSecurityBridge from "@/components/ParentSessionSecurityBridge";
import PWARegistrar from "@/components/PWARegistrar";
import QuestWorldsBridge from "@/components/QuestWorldsBridge";
import StoryExpeditionBridge from "@/components/StoryExpeditionBridge";
import WeeklyReportBridge from "@/components/WeeklyReportBridge";
import "./globals.css";
import "./school-mode-controls.css";
import "./mobile-app-shell.css";
import "./learner-profile-setup.css";

export const metadata: Metadata = {
  title: "AdrianOS Elementary Learning",
  description: "A parent-managed TK–5 learning playground with personalized learner profiles, School Mode, and cross-device progress.",
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
        <ElementaryScopeBridge />
        <CloudSyncBridge />
        <ParentSessionSecurityBridge />
        <WeeklyReportBridge />
        <MasteryLoopBridge />
        <FamilyOnboardingGate>{children}</FamilyOnboardingGate>
        <GradeGameSpotlightBridge />
        <DailyAdventureRemixBridge />
        <StoryExpeditionBridge />
        <QuestWorldsBridge />
        <FamilyAccountControl />
        <MobileAppDock />
        <InstallAppPrompt />
        <BetaFeedbackLauncher />
      </body>
    </html>
  );
}
