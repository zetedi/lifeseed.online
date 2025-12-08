import { useConfig } from "@/context/ConfigContext";
import { MainNavProps } from "@/types/Types"
import { cn } from "@/lib/utils"
import Logo from "@/components/Logo"
import { Link, useLocation } from "react-router-dom";

export function MainNav({ items }: MainNavProps) {
  const { appConfig } = useConfig();
  const location = useLocation();

  return (
    <div className="flex gap-6 md:gap-10">
      <Link to="/" className="flex items-center space-x-2">
        <div className="w-8 h-8">
            <Logo width={32} height={32} />
        </div>
        <span className="inline-block font-bold">{appConfig.title}</span>
      </Link>
      {items?.length ? (
        <nav className="flex gap-6">
          {items?.map(
            (item, index) =>
              item.href && (
                <Link
                  key={index}
                  to={item.href}
                  className={cn(
                    "flex items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                    item.href === location.pathname && "text-foreground font-bold",
                    item.disabled && "cursor-not-allowed opacity-80"
                  )}
                >
                  {item.title}
                </Link>
              )
          )}
        </nav>
      ) : null}
    </div>
  )
}