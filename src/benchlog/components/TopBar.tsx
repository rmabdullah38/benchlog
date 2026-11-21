import { FlaskConical } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ReactNode } from "react";
import type { User } from "../types";

export function AccountButton({ user, onSignIn, onSignOut }: { user: User | null; onSignIn?: () => void; onSignOut?: () => void }) {
  if (!user) return <Button size="sm" variant="outline" onClick={onSignIn}>Sign in with Google</Button>;
  const initials = user.name.split(" ").map((p) => p[0]).join("").slice(0, 2);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full" aria-label="Account"><Avatar className="size-7"><AvatarFallback className="text-[11px]">{initials}</AvatarFallback></Avatar></DropdownMenuTrigger>
      <DropdownMenuContent align="end"><DropdownMenuLabel>{user.name}</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem onClick={onSignOut}>Sign out</DropdownMenuItem></DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TopBar({ switcher, pills, account }: { switcher: ReactNode; pills: ReactNode; account: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-[1280px] items-center gap-3 px-4 py-2.5">
        <div className="flex shrink-0 items-center gap-1.5 font-semibold tracking-tight"><FlaskConical className="size-5 text-device" /><span className="hidden sm:inline">BenchLog</span></div>
        <div className="min-w-0 flex-1 sm:flex-none">{switcher}</div>
        <div className="ml-auto shrink-0">{pills}</div>
        <div className="shrink-0">{account}</div>
      </div>
    </header>
  );
}
