import { useState } from "react";
import { Camera, Maximize2, Volume2, VolumeX, Grid3X3, LayoutGrid, Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const cameraFeeds = [
  { id: 1, name: "Main Entrance", location: "Zone A", status: "online" as const, persons: 5 },
  { id: 2, name: "Parking Lot", location: "Zone B", status: "online" as const, persons: 12 },
  { id: 3, name: "Lobby Area", location: "Zone A", status: "online" as const, persons: 8 },
  { id: 4, name: "Back Gate", location: "Zone D", status: "offline" as const, persons: 0 },
  { id: 5, name: "Storage Area", location: "Zone B", status: "online" as const, persons: 2 },
  { id: 6, name: "Corridor East", location: "Zone C", status: "online" as const, persons: 3 },
  { id: 7, name: "Corridor West", location: "Zone C", status: "online" as const, persons: 1 },
  { id: 8, name: "Cafeteria", location: "Zone A", status: "online" as const, persons: 15 },
];

export function LiveFeedPanel() {
  const [gridLayout, setGridLayout] = useState<"2x2" | "3x3">("2x2");
  const [selectedCamera, setSelectedCamera] = useState<number | null>(null);
  const [mutedCameras, setMutedCameras] = useState<Set<number>>(new Set());

  const toggleMute = (cameraId: number) => {
    setMutedCameras((prev) => {
      const next = new Set(prev);
      if (next.has(cameraId)) {
        next.delete(cameraId);
      } else {
        next.add(cameraId);
      }
      return next;
    });
  };

  const onlineCount = cameraFeeds.filter((c) => c.status === "online").length;
  const totalPersons = cameraFeeds.reduce((sum, c) => sum + c.persons, 0);

  const displayedFeeds = selectedCamera
    ? cameraFeeds.filter((c) => c.id === selectedCamera)
    : cameraFeeds.slice(0, gridLayout === "2x2" ? 4 : 9);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="panel-header">Live Camera Feeds</h3>
          <p className="text-muted-foreground text-sm">
            Real-time monitoring of all connected surveillance cameras
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={gridLayout === "2x2" ? "default" : "outline"}
            size="sm"
            onClick={() => { setGridLayout("2x2"); setSelectedCamera(null); }}
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
          <Button
            variant={gridLayout === "3x3" ? "default" : "outline"}
            size="sm"
            onClick={() => { setGridLayout("3x3"); setSelectedCamera(null); }}
          >
            <Grid3X3 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex items-center gap-6 p-4 bg-card rounded-xl border border-border">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-success animate-pulse" />
          <span className="text-sm text-foreground font-medium">{onlineCount} Cameras Online</span>
        </div>
        <div className="w-px h-6 bg-border" />
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{cameraFeeds.length} Total Cameras</span>
        </div>
        <div className="w-px h-6 bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Total Persons Detected:</span>
          <span className="text-sm font-bold text-primary">{totalPersons}</span>
        </div>
        {selectedCamera && (
          <>
            <div className="w-px h-6 bg-border" />
            <Button variant="outline" size="sm" onClick={() => setSelectedCamera(null)}>
              Back to Grid
            </Button>
          </>
        )}
      </div>

      {/* Camera Grid */}
      <div className={`grid gap-4 ${
        selectedCamera ? "grid-cols-1" : 
        gridLayout === "2x2" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
      }`}>
        {displayedFeeds.map((camera) => (
          <Card key={camera.id} className="stat-card overflow-hidden">
            <div className={`relative bg-foreground/5 ${selectedCamera ? "aspect-video" : "aspect-video"}`}>
              {/* Video placeholder */}
              <div className="absolute inset-0 flex items-center justify-center">
                {camera.status === "online" ? (
                  <div className="text-center">
                    <Camera className="w-12 h-12 text-primary/30 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Live Feed Active</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <Camera className="w-12 h-12 text-destructive/30 mx-auto mb-2" />
                    <p className="text-xs text-destructive">Camera Offline</p>
                  </div>
                )}
              </div>

              {/* Status indicator */}
              <div className="absolute top-3 left-3">
                <Badge 
                  variant={camera.status === "online" ? "default" : "destructive"}
                  className={camera.status === "online" ? "bg-success hover:bg-success" : ""}
                >
                  <span className={`w-2 h-2 rounded-full mr-1.5 ${
                    camera.status === "online" ? "bg-success-foreground animate-pulse" : "bg-destructive-foreground"
                  }`} />
                  {camera.status === "online" ? "LIVE" : "OFFLINE"}
                </Badge>
              </div>

              {/* Person count */}
              {camera.status === "online" && (
                <div className="absolute top-3 right-3 bg-card/90 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-lg">
                  <span className="text-sm font-bold text-foreground">{camera.persons}</span>
                  <span className="text-xs text-muted-foreground ml-1">persons</span>
                </div>
              )}

              {/* Controls */}
              <div className="absolute bottom-3 right-3 flex gap-2">
                <Button
                  variant="secondary"
                  size="icon"
                  className="w-8 h-8 bg-card/90 backdrop-blur-sm"
                  onClick={() => toggleMute(camera.id)}
                >
                  {mutedCameras.has(camera.id) ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="w-8 h-8 bg-card/90 backdrop-blur-sm"
                  onClick={() => setSelectedCamera(selectedCamera === camera.id ? null : camera.id)}
                >
                  <Maximize2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Camera Info */}
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-foreground">{camera.name}</h4>
                  <p className="text-xs text-muted-foreground">{camera.location}</p>
                </div>
                <Button variant="ghost" size="icon" className="w-8 h-8">
                  <Settings className="w-4 h-4 text-muted-foreground" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Camera List */}
      {!selectedCamera && (
        <Card className="stat-card">
          <CardHeader>
            <CardTitle className="text-base">All Cameras</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {cameraFeeds.map((camera) => (
                <button
                  key={camera.id}
                  onClick={() => setSelectedCamera(camera.id)}
                  className={`p-3 rounded-lg border text-left transition-all hover:shadow-md ${
                    camera.status === "online"
                      ? "border-border hover:border-primary/50 bg-card"
                      : "border-destructive/30 bg-destructive/5"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      camera.status === "online" ? "bg-primary/10" : "bg-destructive/10"
                    }`}>
                      <Camera className={`w-5 h-5 ${
                        camera.status === "online" ? "text-primary" : "text-destructive"
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{camera.name}</p>
                      <p className="text-xs text-muted-foreground">{camera.location}</p>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${
                      camera.status === "online" ? "bg-success" : "bg-destructive"
                    }`} />
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
