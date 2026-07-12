import { createAdrianOSIcon } from "@/lib/pwa-icon";

export const dynamic = "force-static";

export function GET() {
  return createAdrianOSIcon(512);
}
