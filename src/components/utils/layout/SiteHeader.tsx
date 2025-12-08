import { useConfig } from "@/context/ConfigContext";
import { useAuth } from "@/context/AuthContext";
import { buttonVariants, Button } from "@/components/ui/button";
import { Icons } from "@/components/LucideIcons";
import { MainNav } from "@/components/utils/MainNav";
import { ModeToggle } from "@/components/utils/ModeToggle";
import { DotMenu } from "@/components/utils/nav/dot-menu";
import { LogIn, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SiteHeader() {
  const { mainNav } = useConfig();
  const { lightseed, signIn, signOut } = useAuth();

  return (
    <header className="bg-background/90 sticky top-0 z-40 w-full border-b backdrop-blur-sm">
      <div className="container flex h-16 items-center space-x-4 sm:justify-between sm:space-x-0">
        <MainNav items={mainNav || []} />
        <div className="flex flex-1 items-center justify-end space-x-4">
          <nav className="flex items-center space-x-2">
            {lightseed ? (
               <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <img 
                      src={lightseed.photoURL || `https://ui-avatars.com/api/?name=${lightseed.displayName}`} 
                      alt={lightseed.displayName || "User"}
                      className="h-8 w-8 rounded-full border border-border"
                    />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => {}} disabled>
                    {lightseed.displayName}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sign Out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="ghost" size="sm" onClick={signIn}>
                <LogIn className="mr-2 h-4 w-4" />
                Login
              </Button>
            )}

            <a
              href="https://github.com/zetedi/lightseed.online"
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({
                size: "icon",
                variant: "ghost",
              })}
            >
              <Icons.gitHub className="h-5 w-5" />
              <span className="sr-only">GitHub</span>
            </a>
            <ModeToggle />
            <DotMenu />
          </nav>
        </div>
      </div>
    </header>
  );
}