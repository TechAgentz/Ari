import { useId } from "react";

export function Logo({ size = 36 }: { size?: number }) {
  // Unique per instance: a shared id would point at the gradient in the hidden desktop sidebar.
  const gradientId = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden className="shrink-0">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="13" fill={`url(#${gradientId})`} />
      <path d="M11 22.5c3.2-6.4 14.8-6.4 18 0" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round" opacity="0.95" />
      <path d="M15 27c2.3-2.7 7.7-2.7 10 0" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round" opacity="0.7" />
      <circle cx="20" cy="13.5" r="2.4" fill="white" />
    </svg>
  );
}
