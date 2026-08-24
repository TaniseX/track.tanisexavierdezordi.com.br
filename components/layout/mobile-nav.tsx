"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "./logo";
import { NavLinks } from "./nav-links";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="md:hidden"
        onClick={() => setOpen(true)}
        aria-label="Abrir menu"
      >
        <Menu className="h-4 w-4" />
      </Button>

      {open &&
        createPortal(
          // Portal pro body: a Topbar usa backdrop-blur, que cria um novo
          // containing block pra elementos fixed dentro dela (regra do CSS) —
          // sem o portal, este drawer ficaria preso à altura da Topbar.
          <div className="fixed inset-0 z-50 md:hidden">
            <button
              type="button"
              aria-label="Fechar menu"
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-border bg-card p-4 shadow-xl">
              <div className="mb-6 flex items-center justify-between">
                <Logo />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setOpen(false)}
                  aria-label="Fechar menu"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <NavLinks onNavigate={() => setOpen(false)} />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
