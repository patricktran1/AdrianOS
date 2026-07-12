import type { Metadata } from "next";
import InstallGuide from "@/components/InstallGuide";

export const metadata: Metadata = {
  title: "Install AdrianOS",
  description: "Add AdrianOS to an iPhone, Android phone, tablet, or computer for one-tap School Mode.",
};

export default function InstallPage() {
  return <InstallGuide />;
}
