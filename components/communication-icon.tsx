import type { ReactNode } from "react";

type CommunicationIconName = "phone" | "video" | "send" | "more" | "people" | "arrow-left" | "check" | "search" | "refresh";

export function CommunicationIcon({
  name,
  className = "size-4",
}: { name: CommunicationIconName; className?: string }) {
  const icon: Record<CommunicationIconName, ReactNode> = {
    phone: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.7 19.7 0 0 1-8.6-3.07 19.5 19.5 0 0 1-6-6 19.7 19.7 0 0 1-3.07-8.63A2 2 0 0 1 4.14 2h3a2 2 0 0 1 2 1.72c.12.96.35 1.9.69 2.8a2 2 0 0 1-.45 2.11L8.1 9.9a16 16 0 0 0 6 6l1.27-1.28a2 2 0 0 1 2.1-.44c.9.33 1.84.56 2.8.68A2 2 0 0 1 22 16.92Z" />,
    video: <><rect x="3" y="5" width="13" height="14" rx="2" /><path d="m16 10 5-3v10l-5-3" /></>,
    send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
    more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    people: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    "arrow-left": <><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></>,
    check: <path d="m20 6-11 11-5-5"/>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    refresh: <><path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M5.3 9a7 7 0 0 1 12.4-2L20 12M4 12l2.3 4a7 7 0 0 0 12.4-1"/></>,
  };
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >{icon[name]}</svg>
  );
}
