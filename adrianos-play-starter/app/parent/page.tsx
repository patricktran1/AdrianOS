import CloudSyncPanel from "@/components/CloudSyncPanel";
import ParentDashboard from "@/components/ParentDashboard";
import ParentSkillGoals from "@/components/ParentSkillGoals";
import { games } from "@/lib/generated-games";

export default function ParentPage() {
  return (
    <>
      <ParentDashboard games={games} />
      <ParentSkillGoals />
      <CloudSyncPanel />
    </>
  );
}
