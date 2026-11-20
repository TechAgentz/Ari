import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon for iPhone (iOS doesn't use SVG icons). Same mark as icon.svg. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "linear-gradient(135deg, #0f766e, #6553c9)" }}>
        <svg width="180" height="180" viewBox="0 0 40 40">
          <path d="M11 22.5c3.2-6.4 14.8-6.4 18 0" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M15 27c2.3-2.7 7.7-2.7 10 0" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" opacity=".7" />
          <circle cx="20" cy="13.5" r="2.4" fill="#fff" />
        </svg>
      </div>
    ),
    size,
  );
}
