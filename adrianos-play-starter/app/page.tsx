import HomeExperience from "@/components/HomeExperience";
import { games } from "@/lib/generated-games";

export default function Home() {
  return <HomeExperience games={games} />;
}
