import { Activity, FileText, Globe, LayoutDashboard, Megaphone, Settings, Wallet } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/", label: "Visão geral", icon: LayoutDashboard },
  { href: "/eventos", label: "Eventos", icon: Activity },
  { href: "/paginas", label: "Páginas", icon: FileText },
  { href: "/faturamento", label: "Faturamento", icon: Wallet },
  { href: "/campanhas", label: "Campanhas", icon: Megaphone },
  { href: "/geo", label: "Geo", icon: Globe },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
] as const;
