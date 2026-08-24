import { Card } from "@/components/ui/card";

export function ComingSoon({
  title,
  description,
  phase,
}: {
  title: string;
  description: string;
  phase: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Card className="flex h-48 items-center justify-center p-8 text-center text-sm text-muted-foreground">
        Em construção — chega na {phase}.
      </Card>
    </div>
  );
}
