import { ImageResponse } from "next/og";

export function createAdrianOSIcon(size: number): ImageResponse {
  const ring = Math.max(8, Math.round(size * 0.035));
  const innerSize = Math.round(size * 0.72);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#10131b",
          borderRadius: Math.round(size * 0.22),
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            width: innerSize,
            height: innerSize,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "50%",
            border: `${ring}px solid #7fdcff`,
            background: "#181d28",
            color: "white",
          }}
        >
          <div style={{ display: "flex", fontSize: Math.round(size * 0.42), fontWeight: 900, lineHeight: .86 }}>A</div>
          <div
            style={{
              display: "flex",
              marginTop: Math.round(size * 0.025),
              padding: `${Math.round(size * 0.018)}px ${Math.round(size * 0.065)}px`,
              borderRadius: 999,
              background: "#d9ff5b",
              color: "#10131b",
              fontSize: Math.round(size * 0.10),
              fontWeight: 900,
              letterSpacing: ".08em",
            }}
          >
            OS
          </div>
        </div>
      </div>
    ),
    {
      width: size,
      height: size,
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    }
  );
}
