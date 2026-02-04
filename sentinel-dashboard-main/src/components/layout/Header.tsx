import { Activity, Bell, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  systemStatus: "active" | "idle";
}

export function Header({ systemStatus }: HeaderProps) {
  return (
    <header className="h-16 bg-card border-b border-border px-6 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold text-foreground">
          Smart Surveillance System
        </h2>
        <div className={`status-badge ${systemStatus === "active" ? "status-normal" : "status-idle"}`}>
          <span className={`w-2 h-2 rounded-full ${systemStatus === "active" ? "bg-success" : "bg-muted-foreground"}`} />
          {systemStatus === "active" ? "System Active" : "System Idle"}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5 text-muted-foreground" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full" />
        </Button>
        <Button variant="ghost" size="icon">
          <Settings className="w-5 h-5 text-muted-foreground" />
        </Button>
        <div className="w-px h-8 bg-border mx-2" />
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
            <Activity className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Admin</p>
            <p className="text-xs text-muted-foreground">Operator</p>
          </div>
        </div>
      </div>
    </header>
  );
}
