"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { ComposableMap, Geographies, Geography, createCoordinates } from "@vnedyalk0v/react19-simple-maps";

type GeographyData = ComponentProps<typeof Geographies>["geography"];

const GEO_URL = "/br-states.json";
const BRAZIL_CENTER = createCoordinates(-53, -15);

function colorFor(count: number, max: number): string {
  if (count === 0) return "hsl(var(--secondary))";
  const intensity = 0.15 + (count / max) * 0.85;
  return `hsl(var(--primary) / ${intensity})`;
}

export function BrazilMap({ data }: { data: { region: string; visitor_count: number | string }[] }) {
  // Busca e faz o parse do topojson manualmente (em vez de passar a URL pro
  // `geography` da lib): a validação de fetch interna dela (proteção SSRF,
  // HTTPS-only por padrão) bloqueia http://localhost em dev de um jeito não
  // documentado direito. Passar o objeto já parseado pula essa camada.
  const [topology, setTopology] = useState<GeographyData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(GEO_URL)
      .then((res) => res.json())
      .then(setTopology)
      .catch(() => setError(true));
  }, []);

  const counts = new Map(data.map((d) => [d.region, Number(d.visitor_count)]));
  const max = Math.max(1, ...counts.values());

  if (error) {
    return <p className="p-8 text-center text-sm text-destructive">Erro ao carregar o mapa.</p>;
  }
  if (!topology) {
    return <p className="p-8 text-center text-sm text-muted-foreground">Carregando mapa...</p>;
  }

  return (
    <ComposableMap
      projection="geoMercator"
      projectionConfig={{ center: BRAZIL_CENTER, scale: 700 }}
      width={500}
      height={480}
      className="mx-auto max-h-[480px] w-full"
    >
      <Geographies geography={topology}>
        {({ geographies }) =>
          geographies.map((geo) => {
            const stateId = geo.id as string;
            const count = counts.get(stateId) ?? 0;
            const name = (geo.properties as { nome?: string })?.nome ?? stateId;
            return (
              <Geography
                key={stateId}
                geography={geo}
                fill={colorFor(count, max)}
                stroke="hsl(var(--border))"
                strokeWidth={0.5}
                style={{
                  default: { outline: "none" },
                  hover: { outline: "none", fill: "hsl(var(--primary))" },
                  pressed: { outline: "none" },
                }}
              >
                <title>{`${name}: ${count}`}</title>
              </Geography>
            );
          })
        }
      </Geographies>
    </ComposableMap>
  );
}
