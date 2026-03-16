import { useState } from "react";
import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { Button } from "@/components/ui/button";
import { PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen((prev) => !prev)} />

      {!isSidebarOpen && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setIsSidebarOpen(true)}
          className="fixed left-4 top-4 z-50"
          aria-label="Open sidebar"
        >
          <PanelLeft className="h-4 w-4" />
        </Button>
      )}

      <main
        className={cn(
          "min-h-screen transition-[margin] duration-300",
          isSidebarOpen ? "lg:ml-64" : "ml-0"
        )}
      >
        <div className="p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
