import { ThemeToggle } from "./theme-toggle";
import { MobileNav } from "./mobile-nav";
import { LogoutButton } from "./logout-button";
import { DateRangeFilter } from "./date-range-filter";
import { RefreshButton } from "./refresh-button";

export function Topbar({ userEmail }: { userEmail?: string }) {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-2 border-b border-border bg-background/80 px-4 backdrop-blur md:px-8">
      <MobileNav />
      <div className="hidden truncate font-mono text-sm text-muted-foreground lg:block">
        {userEmail}
      </div>
      {/* overflow-x-auto: em telas estreitas o filtro de data (5 botões) +
          atualizar + tema + sair não cabem numa linha só — em vez de
          quebrar/estourar a altura fixa da topbar, o grupo rola
          horizontalmente. shrink-0 nos itens evita que eles se espremam. */}
      <div className="flex flex-1 items-center justify-end gap-2 overflow-x-auto">
        <DateRangeFilter />
        <div className="flex shrink-0 items-center gap-2">
          <RefreshButton />
          <ThemeToggle />
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
