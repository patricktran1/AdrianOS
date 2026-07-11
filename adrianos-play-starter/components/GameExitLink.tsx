"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function GameExitLink() {
  const [schoolRoute, setSchoolRoute] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSchoolRoute(params.get("guided") === "1" || params.get("school") === "1");
  }, []);

  return (
    <Link
      href={schoolRoute ? "/daily-session?school=1" : "/"}
      className="home-button"
      aria-label={schoolRoute ? "Back to today’s school session" : "Back to game library"}
    >
      {schoolRoute ? "← Session" : "← Home"}
    </Link>
  );
}
