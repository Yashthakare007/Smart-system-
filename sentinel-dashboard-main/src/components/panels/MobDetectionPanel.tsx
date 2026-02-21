import { useState, useEffect, useRef } from "react";
import { Users, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function MobDetectionPanel() {
  const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:5000";
  const [activeSource, setActiveSource] = useState<"webcam" | "video" | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [personCount, setPersonCount] = useState<number>(0);
  const [personIds, setPersonIds] = useState<number[]>([]);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (!activeSource) {
      setStreamUrl(null);
      setPersonCount(0);
      setPersonIds([]);
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    const url = `${BACKEND}/stream/mob?source=${activeSource}`;
    setStreamUrl(url);

    // poll status
    const iv = window.setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND}/mob-status?source=${activeSource}`);
        if (!res.ok) return;
        const data = await res.json();
        setPersonCount(data.person_count || 0);
        setPersonIds(Array.isArray(data.person_ids) ? data.person_ids : []);
      } catch (e) {
        // ignore
      }
    }, 500);
    pollRef.current = iv;

    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [activeSource, BACKEND]);

  const startWebcam = async () => {
    try {
      await fetch(`${BACKEND}/start-webcam`, { method: "POST" });
      setActiveSource("webcam");
    } catch (e) {
      console.error(e);
    }
  };

  const stopWebcam = async () => {
    try {
      await fetch(`${BACKEND}/stop-webcam`, { method: "POST" });
    } catch (e) {
      console.error(e);
    }
    setActiveSource(null);
  };

  const uploadVideo = async (file: File | null) => {
    if (!file) return;
    const fd = new FormData();
    fd.append("video", file);
    try {
      const res = await fetch(`${BACKEND}/upload-video`, { method: "POST", body: fd });
      if (!res.ok) return;
      const data = await res.json();
      // start showing stream from video
      setActiveSource("video");
    } catch (e) {
      console.error(e);
    }
  };

  const stopVideo = async () => {
    try {
      await fetch(`${BACKEND}/stop-video`, { method: "POST" });
    } catch (e) {
      console.error(e);
    }
    setActiveSource(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h3 className="panel-header">Mob Detection</h3>
        <p className="text-muted-foreground text-sm"></p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="stat-card lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Live Feed Visualization
            </CardTitle>
            <div />
          </CardHeader>
          <CardContent>
            <div className="video-container aspect-video relative">
              {streamUrl ? (
                <img src={streamUrl} alt="mob-stream" className="w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <Users className="w-16 h-16 text-primary/50 mx-auto mb-4" />
                    <p className="text-muted-foreground">No active detection</p>
                  </div>
                </div>
              )}

              <div className="absolute top-4 left-4 bg-card/90 backdrop-blur-sm rounded-lg px-4 py-2 shadow-lg">
                <div className="flex items-center gap-2">
                  <Users className={`w-5 h-5 text-primary`} />
                  <span className={`text-2xl font-bold`}>{personCount}</span>
                  <span className="text-sm text-muted-foreground">persons</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">IDs: {personIds.join(", ")}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="stat-card">
            <CardHeader>
              <CardTitle className="text-base">Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col gap-2">
                <Button onClick={startWebcam}>Start Webcam</Button>
                <Button variant="outline" onClick={stopWebcam}>Stop Webcam Detection</Button>

                <div className="flex items-center gap-2">
                  <input
                    id="video-upload"
                    type="file"
                    accept="video/*"
                    onChange={(e) => uploadVideo(e.target.files ? e.target.files[0] : null)}
                    className="flex-1"
                  />
                </div>
                <Button variant="outline" onClick={stopVideo}>Stop Uploaded Video Detection</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
