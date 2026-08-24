import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  return (
    <form action={signOut}>
      <Button type="submit" variant="outline" size="icon" aria-label="Sair">
        <LogOut className="h-4 w-4" />
      </Button>
    </form>
  );
}
