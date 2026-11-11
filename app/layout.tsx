import type { Metadata } from "next";
import "./globals.css";
import "./marketing.css";
import "./application-redesign.css";
import "./application-refinement.css";
import { IncomingVoiceCall } from "@/components/incoming-voice-call";
import { voiceCallsEnabled } from "@/lib/voice-calls-config";

export const metadata: Metadata = {
  title: "Converge — People, Knowledge & Specialist AI",
  description:
    "A connected platform for collaborative thinking, specialist AI research and purpose-built workspaces.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{process.env.NEXT_PUBLIC_CONVERGE_PREVIEW_MODE === "ui-only" && (
          <div role="status" className="relative z-[200] bg-amber-200 px-5 py-2.5 text-center text-xs font-semibold text-amber-950">
            UI-only preview. No live database is connected; sign-in, messaging, research and AI actions are disabled here.
          </div>
        )}
        {children}
        {voiceCallsEnabled && <IncomingVoiceCall />}</body>
    </html>
  );
}
