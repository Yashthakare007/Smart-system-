import { Users, AlertTriangle, Bell, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const stats = [
  {
    title: "Total Persons Detected",
    value: "1,247",
    change: "+12%",
    changeType: "positive" as const,
    icon: Users,
  },
  {
    title: "Mob Alert Status",
    value: "Normal",
    status: "normal" as const,
    icon: AlertTriangle,
  },
  {
    title: "Alerts Generated",
    value: "23",
    change: "Today",
    changeType: "neutral" as const,
    icon: Bell,
  },
  {
    title: "System Uptime",
    value: "99.9%",
    change: "Last 30 days",
    changeType: "positive" as const,
    icon: Activity,
  },
];

export function DashboardPanel() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h3 className="panel-header">Dashboard Overview</h3>
        <p className="text-muted-foreground text-sm">
          Real-time monitoring statistics and system status
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="stat-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                {stat.change && (
                  <p className={`text-xs mt-1 ${
                    stat.changeType === "positive" ? "text-success" : "text-muted-foreground"
                  }`}>
                    {stat.change}
                  </p>
                )}
                {stat.status && (
                  <span className="status-badge status-normal mt-2">
                    <span className="w-2 h-2 rounded-full bg-success" />
                    All Clear
                  </span>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="stat-card">
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { time: "2 min ago", event: "Person detected in Zone A", type: "info" },
              { time: "15 min ago", event: "Crowd gathering dispersed", type: "success" },
              { time: "1 hour ago", event: "Suspicious movement flagged", type: "warning" },
              { time: "2 hours ago", event: "System health check completed", type: "info" },
            ].map((activity, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full mt-2 ${
                  activity.type === "success" ? "bg-success" :
                  activity.type === "warning" ? "bg-warning" : "bg-primary"
                }`} />
                <div className="flex-1">
                  <p className="text-sm text-foreground">{activity.event}</p>
                  <p className="text-xs text-muted-foreground">{activity.time}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardHeader>
            <CardTitle className="text-base">System Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Detection Accuracy</span>
                <span className="text-sm font-medium text-foreground">94.5%</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-success rounded-full" style={{ width: "94.5%" }} />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Active Cameras</span>
                <span className="text-sm font-medium text-foreground">8 / 10</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: "80%" }} />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Storage Used</span>
                <span className="text-sm font-medium text-foreground">67%</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-warning rounded-full" style={{ width: "67%" }} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
