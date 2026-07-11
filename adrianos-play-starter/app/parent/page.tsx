import CloudSyncPanel from "@/components/CloudSyncPanel";
import CoachReportPanel from "@/components/CoachReportPanel";
import ParentDashboard from "@/components/ParentDashboard";
import ParentSkillGoals from "@/components/ParentSkillGoals";
import PlacementReportPanel from "@/components/PlacementReportPanel";
import WeeklyReportPanel from "@/components/WeeklyReportPanel";
import { games } from "@/lib/generated-games";

export default function ParentPage() {
  return (
    <>
      <ParentDashboard games={games} />
      <ParentSkillGoals />
      <WeeklyReportPanel games={games} />
      <PlacementReportPanel />
      <CoachReportPanel />
      <CloudSyncPanel />
    </>
  );
}
