export function JsonViewer({ label, data }: { label: string; data: unknown }) {
  const isEmpty = Array.isArray(data) && data.length === 0;

  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      {isEmpty ? (
        <p className="rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
          Nenhum destino disparado.
        </p>
      ) : (
        <pre className="max-h-64 overflow-auto rounded-md border border-border bg-background p-3 font-mono text-xs">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
