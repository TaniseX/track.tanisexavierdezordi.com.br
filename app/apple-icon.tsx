import { ImageResponse } from "next/og";

// Mesmo monograma do favicon (app/icon.tsx), em tamanho maior pro apple-icon.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#09090b",
          color: "#1fd693",
          fontSize: 88,
          fontWeight: 700,
        }}
      >
        TX
      </div>
    ),
    size,
  );
}
