import { cn } from "@/lib/utils"
import Logo from "@/components/Logo"
import { Link, useLocation } from "react-router-dom";

export function MainNav() {
  const location = useLocation();

  const items = [
    { title: "Forest", href: "/forest" },
    { title: "Pulses", href: "/pulses" },
    { title: "Visions", href: "/visions" },
    { title: "Secret Sun", href: "/thesecretsun" },
    { title: "White Paper", href: "/white" },
  ];

  return (
    <div className="flex gap-6 md:gap-10">
      <Link to="/" className="flex items-center space-x-2">
        <div className="w-8 h-8">
            <Logo width={32} height={32} />
        </div>
        <span className="inline-block font-bold hidden sm:inline-block">lifeseed</span>
      </Link>
      <nav className="flex gap-6 overflow-x-auto no-scrollbar">
        {items.map((item, index) => (
            <Link
              key={index}
              to={item.href}
              className={cn(
                "flex items-center text-sm font-medium transition-colors hover:text-foreground whitespace-nowrap",
                item.href === location.pathname ? "text-foreground font-bold text-emerald-500" : "text-muted-foreground"
              )}
            >
              {item.title}
            </Link>
          )
        )}
      </nav>
    </div>
  )
}