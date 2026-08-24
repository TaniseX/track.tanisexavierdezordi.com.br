import { Logo } from "./logo";
import { NavLinks } from "./nav-links";

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-border bg-card/40 md:flex">
      <div className="flex h-16 items-center border-b border-border px-6">
        <Logo />
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <NavLinks />
      </div>
    </aside>
  );
}
