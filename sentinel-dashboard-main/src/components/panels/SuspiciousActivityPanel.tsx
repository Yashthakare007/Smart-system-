import { useEffect, useMemo, useState, useRef } from "react";
import { AlertTriangle, Eye, Clock, MapPin, Play, Square, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type ActivityStatus = "suspicious" | "warning" | "normal";

type SuspiciousActivity = {
  id: string | number;
  type: string;
  description: string;
  location: string;
  time: string;
  status: ActivityStatus;
  confidence: number;
};

const getStatusBadge = (status: ActivityStatus) => {
  switch (status) {
    case "suspicious":
      return <Badge variant="destructive">Suspicious</Badge>;
    case "warning":
      return (
        <Badge className="bg-warning text-warning-foreground hover:bg-warning/90">
          Warning
        </Badge>
      );
    default:
      return <Badge variant="secondary">Normal</Badge>;
  }
};

export function SuspiciousActivityPanel() {
  // ✅ Backend URL
  const BACKEND_URL =
    import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, "") || "http://localhost:5000";

  // ✅ Live events
  const [suspiciousActivities, setSuspiciousActivities] = useState<SuspiciousActivity[]>([]);

  // ✅ Input mode + uploaded path
  const [mode, setMode] = useState<"webcam" | "video">("webcam");
  const [videoPath, setVideoPath] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  // ✅ Detection running state (synced with backend)
  const [running, setRunning] = useState(false);

  // ✅ Stream URL for preview (works for both webcam and uploaded videos)
  const streamUrl = useMemo(() => {
    if (mode === "webcam") {
      return `${BACKEND_URL}/stream/suspicious?source=webcam`;
    }
    if (!videoPath) return "";
    return `${BACKEND_URL}/stream/suspicious?source=video&video_path=${encodeURIComponent(
      videoPath
    )}`;
  }, [BACKEND_URL, mode, videoPath]);

  // ✅ Fetch events (panel becomes live)
  const fetchEvents = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/suspicious/events`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data?.events)) setSuspiciousActivities(data.events);
    } catch {
      // silent
    }
  };

  // ✅ Poll VideoMAE status every 3 seconds
  const fetchStatus = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/videomae/status`);
      if (!res.ok) return;
      const data = await res.json();
      setRunning(data?.running || false);
    } catch {
      // silent
    }
  };

  useEffect(() => {
    fetchEvents();
    const eventInterval = setInterval(fetchEvents, 3000);
    return () => clearInterval(eventInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchStatus();
    const statusInterval = setInterval(fetchStatus, 3000);
    return () => clearInterval(statusInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Upload video -> backend returns video_path -> switch to video mode
  const uploadVideo = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("video", file);

      const res = await fetch(`${BACKEND_URL}/api/upload`, {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      if (data?.video_path) {
        setVideoPath(data.video_path);
        setMode("video");
      }
    } finally {
      setUploading(false);
    }
  };

  // ✅ Start detection (webcam or uploaded video)
  const startDetection = async () => {
    try {
      const body =
        mode === "webcam"
          ? { source: "webcam" }
          : { source: "video", video_path: videoPath };

      const res = await fetch(`${BACKEND_URL}/api/videomae/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("start detection failed", err);
      } else {
        // Update local state immediately, then sync with backend
        setRunning(true);
        await fetchEvents();
        await fetchStatus();
      }
    } catch (e) {
      console.error("start detection failed", e);
    }
  };

  // ✅ Stop detection
  const stopDetection = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/videomae/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("stop detection failed", err);
      } else {
        // Update local state immediately, then sync with backend
        setRunning(false);
        await fetchStatus();
      }
    } catch (e) {
      console.error("stop detection failed", e);
    }
  };

  // ✅ Reset events
  const resetEvents = async () => {
    try {
      await fetch(`${BACKEND_URL}/suspicious/reset`, { method: "POST" });
      await fetchEvents();
    } catch (e) {
      console.error("reset failed", e);
    }
  };

  const suspiciousCount = suspiciousActivities.filter((a) => a.status === "suspicious").length;
  const warningCount = suspiciousActivities.filter((a) => a.status === "warning").length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h3 className="panel-header">Suspicious Activity Detection</h3>
        <p className="text-muted-foreground text-sm">
          AI-powered detection of unusual behavior and potential security threats
        </p>
      </div>

      {/* ✅ Video Input + Live Preview */}
      <Card className="stat-card">
        <CardHeader>
          <CardTitle className="text-base">Video Input & Detection Control</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <Button
              variant={mode === "webcam" ? "default" : "secondary"}
              onClick={() => {
                if (running) stopDetection();
                setMode("webcam");
              }}
              disabled={uploading || running}
            >
              Webcam
            </Button>
            <Button
              variant={mode === "video" ? "default" : "secondary"}
              onClick={() => {
                if (running) stopDetection();
                setMode("video");
              }}
              disabled={uploading || running}
            >
              Upload Video
            </Button>

            <div className="ml-2 flex gap-2">
              {running ? (
                <Button
                  variant="destructive"
                  onClick={stopDetection}
                  disabled={uploading}
                >
                  <Square className="w-4 h-4 mr-2" />
                  Stop Detection
                </Button>
              ) : (
                <Button
                  onClick={startDetection}
                  disabled={uploading || (mode === "video" && !videoPath)}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start Detection
                </Button>
              )}
            </div>

            <div className="ml-auto flex gap-2">
              <Button variant="outline" onClick={resetEvents}>
                <Trash2 className="w-4 h-4 mr-2" />
                Clear Events
              </Button>
            </div>
          </div>

          {/* Detection Status */}
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${running ? "bg-green-500 animate-pulse" : "bg-gray-400"}`}
            />
            <span className="text-sm font-medium text-muted-foreground">
              Detection: {running ? "Running" : "Stopped"}
            </span>
          </div>

          {mode === "video" && (
            <div className="space-y-2">
              <input
                type="file"
                accept="video/*"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadVideo(f);
                }}
              />

              {videoPath && (
                <p className="text-xs text-muted-foreground">
                  Using: <span className="font-mono">{videoPath}</span>
                </p>
              )}
            </div>
          )}

          {mode === "webcam" && (
            <p className="text-xs text-muted-foreground">
              Webcam preview shows live detection overlay with bounding boxes. Events list updates
              in real-time when detection is running.
            </p>
          )}

          {mode === "video" && !videoPath && (
            <p className="text-xs text-muted-foreground">
              Upload a video to enable detection.
            </p>
          )}

          <div className="rounded-xl overflow-hidden border bg-muted/30 w-full max-w-2xl h-64 mx-auto">
            {streamUrl ? (
              <img
                src={streamUrl}
                alt="Suspicious stream preview"
                className="w-full h-full object-contain bg-black"
              />
            ) : (
              <div className="flex items-center justify-center h-full p-6 text-sm text-muted-foreground">
                Select Webcam or upload a video.
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Preview shows detections with bounding boxes. Event list below updates automatically
            when detection is running.
          </p>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="stat-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Suspicious Events</p>
                <p className="text-3xl font-bold text-destructive">{suspiciousCount}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Warnings</p>
                <p className="text-3xl font-bold text-warning">{warningCount}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
                <Eye className="w-6 h-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Monitored</p>
                <p className="text-3xl font-bold text-foreground">
                  {suspiciousActivities.length}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Eye className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity List */}
      <Card className="stat-card">
        <CardHeader>
          <CardTitle className="text-base">Detected Activities</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {suspiciousActivities.map((activity) => (
              <div
                key={activity.id}
                className={`p-4 rounded-xl border transition-all hover:shadow-md ${
                  activity.status === "suspicious"
                    ? "border-destructive/30 bg-destructive/5"
                    : activity.status === "warning"
                    ? "border-warning/30 bg-warning/5"
                    : "border-border bg-muted/30"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-semibold text-foreground">{activity.type}</h4>
                      {getStatusBadge(activity.status)}
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{activity.description}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {activity.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {activity.time}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-muted-foreground mb-1">Confidence</p>
                    <p
                      className={`text-lg font-bold ${
                        activity.confidence >= 80
                          ? "text-destructive"
                          : activity.confidence >= 60
                          ? "text-warning"
                          : "text-muted-foreground"
                      }`}
                    >
                      {activity.confidence}%
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {suspiciousActivities.length === 0 && (
              <div className="text-sm text-muted-foreground">No suspicious events yet.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}