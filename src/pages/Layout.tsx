
import { Outlet } from "react-router-dom";
import { SiteHeader } from "@/components/utils/layout/SiteHeader";

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
