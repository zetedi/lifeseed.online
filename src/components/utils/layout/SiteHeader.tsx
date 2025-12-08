import { useState, useRef, useEffect } from "react";
import { useConfig } from "@/context/ConfigContext";
import { useAuth } from "@/context/AuthContext";
import { SimpleButton } from "@/components/SimpleButton";
import { Icons } from "@/components/LucideIcons";
import { MainNav } from "@/components/utils/MainNav";
import { ModeToggle } from "@/components/utils/ModeToggle";
import { DotMenu } from "@/components/utils/nav/dot-menu";
import { LogIn, LogOut } from "lucide-react";

export function SiteHeader() {
  const { mainNav } = useConfig();
  const { lightseed, signIn, signOut } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="bg-background/90 sticky top-0 z-40 w-full border-b backdrop-blur-sm">
      <div className="container flex h-16 items-center space-x-4 sm:justify-between sm:space-x-0">
        <MainNav items={mainNav || []} />
        <div className="flex flex-1 items-center justify-end space-x-4">
          <nav className="flex items-center space-x-2">
            {lightseed ? (
              <div className="relative" ref={menuRef}>
                <button 
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="relative h-8 w-8 rounded-full overflow-hidden border border-border focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                  <img 
                    src={lightseed.photoURL || `https://ui-avatars.com/api/?name=${lightseed.displayName}`} 
                    alt={lightseed.displayName || "User"}
                    className="h-full w-full object-cover"
                  />
                </button>
                
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md shadow-lg py-1 z-50">
                    <div className="px-4 py-2 text-sm font-medium text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800">
                      {lightseed.displayName}
                    </div>
                    <button 
                      onClick={() => { signOut(); setShowUserMenu(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <SimpleButton variant="ghost" size="sm" onClick={signIn}>
                <LogIn className="mr-2 h-4 w-4" />
                Login
              </SimpleButton>
            )}

            <a
              href="https://github.com/zetedi/lightseed.online"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 h-9 w-9"
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
