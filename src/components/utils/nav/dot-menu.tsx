import { useState, useRef, useEffect } from "react";
import { MoreVertical } from "lucide-react";
import { Link } from "react-router-dom";
import { SimpleButton } from "@/components/SimpleButton";

export function DotMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const close = () => setIsOpen(false);

  return (
    <div className="relative" ref={menuRef}>
      <SimpleButton variant="ghost" size="icon" onClick={() => setIsOpen(!isOpen)}>
        <MoreVertical className="h-4 w-4" />
        <span className="sr-only">More</span>
      </SimpleButton>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md shadow-lg py-1 z-50">
          <Link to="/" onClick={close} className="block px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">The Vision</Link>
          <Link to="/phoenix" onClick={close} className="block px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">Phoenix</Link>
          <Link to="/thesecretsun" onClick={close} className="block px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">The Secret Sun</Link>
          <Link to="/photos" onClick={close} className="block px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">Images</Link>
          <Link to="/white" onClick={close} className="block px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">The White Paper</Link>
        </div>
      )}
    </div>
  );
}
