import { 
  LayoutDashboard, 
  Video, 
  Users, 
  AlertTriangle, 
  FileText,
  Shield,
  Camera,
  UserSearch
} from "lucide-react";

interface SidebarProps {
  activePanel: string;
  onPanelChange: (panel: string) => void;
}

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "live-feed", label: "Live Feed", icon: Camera },
  { id: "video-input", label: "Video Input", icon: Video },
  { id: "mob-detection", label: "Mob Detection", icon: Users },
  { id: "suspicious-activity", label: "Suspicious Activity", icon: AlertTriangle },
  { id: "missing-person", label: "Missing Person", icon: UserSearch },
  { id: "alerts-logs", label: "Alerts & Logs", icon: FileText },
];

export function Sidebar({ activePanel, onPanelChange }: SidebarProps) {
  return (
    <aside className="w-64 bg-sidebar min-h-screen flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <Shield className="w-6 h-6 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sidebar-foreground font-bold text-sm">Smart Surveillance</h1>
            <p className="text-sidebar-muted text-xs">Security System</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <p className="text-sidebar-muted text-xs font-medium uppercase tracking-wider mb-4 px-4">
          Navigation
        </p>
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePanel === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onPanelChange(item.id)}
                  className={`nav-item w-full ${isActive ? "nav-item-active" : ""}`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="px-4 py-3 rounded-lg bg-sidebar-accent">
          <p className="text-sidebar-foreground text-xs font-medium">System Version</p>
          <p className="text-sidebar-muted text-xs">v1.0.0 - Beta</p>
        </div>
      </div>
    </aside>
  );
}
