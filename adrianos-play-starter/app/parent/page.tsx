import CloudSyncPanel from "@/components/CloudSyncPanel";
import CoachReportPanel from "@/components/CoachReportPanel";
import ParentCommandCenterPortal from "@/components/ParentCommandCenterPortal";
import ParentDashboard from "@/components/ParentDashboard";
import ParentMasteryLoopPortal from "@/components/ParentMasteryLoopPortal";
import ParentPortfolioLauncher from "@/components/ParentPortfolioLauncher";
import ParentProjectLauncher from "@/components/ParentProjectLauncher";
import ParentSkillGoals from "@/components/ParentSkillGoals";
import ParentWritingLauncher from "@/components/ParentWritingLauncher";
import LearningEvidencePanel from "@/components/LearningEvidencePanel";
import PlacementBanner from "@/components/PlacementBanner";
import PlacementReportPanel from "@/components/PlacementReportPanel";
import SkillMap from "@/components/SkillMap";
import WeeklyReportPanel from "@/components/WeeklyReportPanel";
import { games } from "@/lib/generated-games";

export default function ParentPage() {
  return (
    <>
      <ParentDashboard games={games} />
      <LearningEvidencePanel games={games} />
      <ParentCommandCenterPortal games={games} />
      <ParentMasteryLoopPortal />
      <ParentWritingLauncher />
      <ParentProjectLauncher />
      <ParentPortfolioLauncher />
      <ParentSkillGoals />
      <WeeklyReportPanel games={games} />
      <PlacementBanner />
      <PlacementReportPanel />
      <SkillMap games={games} />
      <CoachReportPanel />
      <CloudSyncPanel />
    </>
  );
}
