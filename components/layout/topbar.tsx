import { ThemeToggle } from "./theme-toggle";
import { MobileNav } from "./mobile-nav";
import { LogoutButton } from "./logout-button";
import { DateRangeFilter } from "./date-range-filter";

export function Topbar({ userEmail }: { userEmail?: string }) {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-2 border-b border-border bg-background/80 px-4 backdrop-blur md:px-8">
      <MobileNav />
      <div className="hidden truncate font-mono text-sm text-muted-foreground lg:block">
        {userEmail}
      </div>
      <div className="flex flex-1 items-center justify-end gap-2">
        <DateRangeFilter />
        <ThemeToggle />
        <LogoutButton />
      </div>
    </header>
  );
}
