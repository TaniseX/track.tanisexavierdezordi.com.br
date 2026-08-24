import { ImageResponse } from "next/og";

// Favicon gerado em runtime (sem asset de imagem — trocar por PNG do logo
// real quando tivermos o arquivo, mesmo padrão de fundo dark sólido do
// projeto anterior: favicon transparente some em toolbar clara do navegador).
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 6,
          color: "#1fd693",
          fontSize: 18,
          fontWeight: 700,
        }}
      >
        TX
      </div>
    ),
    size,
  );
}
