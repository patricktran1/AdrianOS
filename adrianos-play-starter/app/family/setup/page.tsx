import { Suspense } from "react";
import ElementaryFamilySetup from "@/components/ElementaryFamilySetup";

export default function FamilySetupPage() {
  return (
    <Suspense fallback={<main className="family-setup-page" aria-live="polite" /> }>
      <ElementaryFamilySetup />
    </Suspense>
  );
}
