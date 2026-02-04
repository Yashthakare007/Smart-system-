import { useState } from "react";
import { Search, Filter, Download, AlertTriangle, Users, Eye, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const alertLogs = [
  {
    id: 1,
    date: "2024-01-15",
    time: "14:32:45",
    type: "Mob Alert",
    description: "Crowd threshold exceeded in Zone A - 23 persons detected",
    severity: "high" as const,
    icon: Users,
  },
  {
    id: 2,
    date: "2024-01-15",
    time: "14:28:12",
    description: "Suspicious behavior flagged - individual loitering",
    type: "Suspicious Activity",
    severity: "medium" as const,
    icon: AlertTriangle,
  },
  {
    id: 3,
    date: "2024-01-15",
    time: "13:45:00",
    type: "System Alert",
    description: "Camera 3 temporarily offline - reconnecting",
    severity: "low" as const,
    icon: Info,
  },
  {
    id: 4,
    date: "2024-01-15",
    time: "12:15:33",
    type: "Mob Alert",
    description: "Gathering detected near entrance - monitoring",
    severity: "medium" as const,
    icon: Users,
  },
  {
    id: 5,
    date: "2024-01-15",
    time: "11:42:18",
    type: "Detection Event",
    description: "Perimeter movement detected - cleared as authorized",
    severity: "low" as const,
    icon: Eye,
  },
  {
    id: 6,
    date: "2024-01-14",
    time: "23:55:01",
    type: "Suspicious Activity",
    description: "Unattended object detected - security dispatched",
    severity: "high" as const,
    icon: AlertTriangle,
  },
  {
    id: 7,
    date: "2024-01-14",
    time: "22:10:45",
    type: "System Alert",
    description: "Daily backup completed successfully",
    severity: "low" as const,
    icon: Info,
  },
  {
    id: 8,
    date: "2024-01-14",
    time: "19:30:22",
    type: "Mob Alert",
    description: "Peak hour crowd - threshold at 85%",
    severity: "medium" as const,
    icon: Users,
  },
];

const getSeverityBadge = (severity: "high" | "medium" | "low") => {
  switch (severity) {
    case "high":
      return <Badge variant="destructive">High</Badge>;
    case "medium":
      return <Badge className="bg-warning text-warning-foreground hover:bg-warning/90">Medium</Badge>;
    default:
      return <Badge variant="secondary">Low</Badge>;
  }
};

export function AlertsLogsPanel() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  const filteredLogs = alertLogs.filter((log) => {
    const matchesSearch = log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === "all" || log.type === filterType;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h3 className="panel-header">Alerts & Logs</h3>
        <p className="text-muted-foreground text-sm">
          Complete history of all system alerts and detection events
        </p>
      </div>

      {/* Filters */}
      <Card className="stat-card">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search alerts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-background"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full md:w-48 bg-background">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Mob Alert">Mob Alerts</SelectItem>
                <SelectItem value="Suspicious Activity">Suspicious Activity</SelectItem>
                <SelectItem value="System Alert">System Alerts</SelectItem>
                <SelectItem value="Detection Event">Detection Events</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card className="stat-card">
        <CardHeader>
          <CardTitle className="text-base">Alert History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Time</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Type</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Description</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Severity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredLogs.map((log) => {
                  const Icon = log.icon;
                  return (
                    <tr key={log.id} className="hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-4 text-sm text-foreground">{log.date}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground font-mono">{log.time}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${
                            log.severity === "high" ? "text-destructive" :
                            log.severity === "medium" ? "text-warning" : "text-muted-foreground"
                          }`} />
                          <span className="text-sm text-foreground">{log.type}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground max-w-md truncate">
                        {log.description}
                      </td>
                      <td className="py-3 px-4">{getSeverityBadge(log.severity)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredLogs.length === 0 && (
            <div className="text-center py-12">
              <Search className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">No alerts match your search criteria</p>
            </div>
          )}

          {/* Pagination placeholder */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Showing {filteredLogs.length} of {alertLogs.length} entries
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled>Previous</Button>
              <Button variant="outline" size="sm">Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
