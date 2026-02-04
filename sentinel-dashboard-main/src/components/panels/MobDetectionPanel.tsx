import { useState, useEffect } from "react";
import { Users, AlertTriangle, Eye, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

export function MobDetectionPanel() {
  const [personCount, setPersonCount] = useState(12);
  const [threshold, setThreshold] = useState([15]);
  const [isMonitoring, setIsMonitoring] = useState(true);

  const isMobDetected = personCount >= threshold[0];

  // Simulate live count changes
  useEffect(() => {
    if (!isMonitoring) return;
    const interval = setInterval(() => {
      setPersonCount((prev) => {
        const change = Math.floor(Math.random() * 5) - 2;
        return Math.max(0, Math.min(25, prev + change));
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [isMonitoring]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h3 className="panel-header">Mob Detection</h3>
        <p className="text-muted-foreground text-sm">
          Monitor crowd density and detect potential mob gatherings
        </p>
      </div>

      {/* Alert Banner */}
      {isMobDetected && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex items-center gap-4 animate-pulse">
          <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>
          <div className="flex-1">
            <h4 className="text-destructive font-semibold">Mob Alert Detected!</h4>
            <p className="text-sm text-destructive/80">
              Person count ({personCount}) exceeds threshold ({threshold[0]}). Immediate attention required.
            </p>
          </div>
          <Button variant="destructive" size="sm">
            Acknowledge
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Feed */}
        <Card className="stat-card lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Live Video Feed
            </CardTitle>
            <span className={`status-badge ${isMonitoring ? "status-normal" : "status-idle"}`}>
              <span className={`w-2 h-2 rounded-full ${isMonitoring ? "bg-success animate-pulse" : "bg-muted-foreground"}`} />
              {isMonitoring ? "Live" : "Paused"}
            </span>
          </CardHeader>
          <CardContent>
            <div className="video-container aspect-video relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <Users className="w-16 h-16 text-primary/50 mx-auto mb-4" />
                  <p className="text-muted-foreground">Live feed visualization</p>
                  <p className="text-sm text-muted-foreground">
                    Connect to backend for real video stream
                  </p>
                </div>
              </div>
              {/* Person count overlay */}
              <div className="absolute top-4 left-4 bg-card/90 backdrop-blur-sm rounded-lg px-4 py-2 shadow-lg">
                <div className="flex items-center gap-2">
                  <Users className={`w-5 h-5 ${isMobDetected ? "text-destructive" : "text-primary"}`} />
                  <span className={`text-2xl font-bold ${isMobDetected ? "text-destructive" : "text-foreground"}`}>
                    {personCount}
                  </span>
                  <span className="text-sm text-muted-foreground">persons</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                onClick={() => setIsMonitoring(!isMonitoring)}
                variant={isMonitoring ? "outline" : "default"}
                className="flex-1"
              >
                {isMonitoring ? "Pause Monitoring" : "Resume Monitoring"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Controls & Stats */}
        <div className="space-y-6">
          <Card className="stat-card">
            <CardHeader>
              <CardTitle className="text-base">Detection Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex justify-between mb-3">
                  <label className="text-sm text-muted-foreground">Mob Threshold</label>
                  <span className="text-sm font-medium text-foreground">{threshold[0]} persons</span>
                </div>
                <Slider
                  value={threshold}
                  onValueChange={setThreshold}
                  min={5}
                  max={30}
                  step={1}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Alert triggers when count exceeds this value
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Statistics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Current Count</span>
                <span className={`text-lg font-bold ${isMobDetected ? "text-destructive" : "text-foreground"}`}>
                  {personCount}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Peak Today</span>
                <span className="text-lg font-bold text-foreground">28</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Average</span>
                <span className="text-lg font-bold text-foreground">14</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Status</span>
                <span className={`status-badge ${isMobDetected ? "status-alert" : "status-normal"}`}>
                  {isMobDetected ? "Alert" : "Normal"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
