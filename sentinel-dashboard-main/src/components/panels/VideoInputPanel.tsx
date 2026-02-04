import React, { useState, useRef, useEffect } from "react";
import { Upload, Play, Square, Video, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { getSuspiciousStreamUrl } from "@/lib/utils";

const preloadedVideos = [
  { id: "1", name: "CCTV Camera 1 - Main Entrance" },
  { id: "2", name: "CCTV Camera 2 - Parking Lot" },
  { id: "3", name: "CCTV Camera 3 - Lobby Area" },
  { id: "4", name: "CCTV Camera 4 - Back Gate" },
];

export function VideoInputPanel() {
  const [isDetecting, setIsDetecting] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<string>("");
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [backendVideoPath, setBackendVideoPath] = useState<string | null>(null);

  const [detectionResult, setDetectionResult] = useState<null | {
    people_count?: number;
    mob_alert?: boolean;
    frames_sampled?: number;
    [k: string]: any;
  }>(null);

  const [uploadedFileObject, setUploadedFileObject] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);

  const [isPolling, setIsPolling] = useState(false);
  const sendingRef = useRef(false);

  // ✅ IMPORTANT: create stream URL INSIDE component (because it uses state)
  const backendStreamUrl = getSuspiciousStreamUrl({
    source: "video",
    videoPath: backendVideoPath,
  });

  // dynamic import utilities when needed to avoid bundler/runtime issues
  async function callUploadVideo(file: File) {
    const mod = await import("@/lib/utils"); // ✅ use util.ts (your file)
    return mod.uploadVideo(file);
  }

  async function callStartMobDetection(videoPath: string) {
    const mod = await import("@/lib/utils"); // ✅ use util.ts (your file)
    return mod.startMobDetection(videoPath);
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file.name);
      setUploadedFileObject(file);

      // create preview URL for local playback
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);

      // if user uploads new file, reset backend preview
      setBackendVideoPath(null);
      setDetectionResult(null);
    }
  };

  // cleanup preview URL on unmount or when they change
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Polling: capture frames and send to backend detect endpoint (local preview only)
  useEffect(() => {
    let timer: number | null = null;

    const poll = async () => {
      if (!videoRef.current || !overlayRef.current) return;
      const videoEl = videoRef.current;
      const overlay = overlayRef.current;

      if (videoEl.paused || videoEl.ended) return;
      if (sendingRef.current) return;

      const w = videoEl.videoWidth || videoEl.clientWidth;
      const h = videoEl.videoHeight || videoEl.clientHeight;
      if (w === 0 || h === 0) return;

      const off = document.createElement("canvas");
      off.width = w;
      off.height = h;
      const ctx = off.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(videoEl, 0, 0, w, h);

      sendingRef.current = true;
      off.toBlob(async (blob) => {
        if (!blob) {
          sendingRef.current = false;
          return;
        }
        try {
          const mod = await import("@/lib/utils");
          const resp = await mod.detectImage(blob);

          const octx = overlay.getContext("2d");
          if (!octx) return;

          const dpr = window.devicePixelRatio || 1;
          const cssW = overlay.clientWidth;
          const cssH = overlay.clientHeight;
          overlay.width = Math.max(1, Math.floor(cssW * dpr));
          overlay.height = Math.max(1, Math.floor(cssH * dpr));
          octx.setTransform(dpr, 0, 0, dpr, 0, 0);

          const scaleX = cssW / w;
          const scaleY = cssH / h;

          octx.clearRect(0, 0, cssW, cssH);

          if (resp && Array.isArray(resp.boxes)) {
            for (const b of resp.boxes) {
              if (b.class !== 0) continue;

              const x = b.x1 * scaleX;
              const y = b.y1 * scaleY;
              const bw = (b.x2 - b.x1) * scaleX;
              const bh = (b.y2 - b.y1) * scaleY;

              octx.strokeStyle = "#00FF7F";
              octx.lineWidth = 2;
              octx.strokeRect(x, y, bw, bh);

              octx.fillStyle = "#00FF7F";
              octx.font = "16px sans-serif";
              const label = `person ${Math.round((b.confidence || 0) * 100)}%`;
              octx.fillText(label, x + 4, Math.max(16, y + 16));
            }
          }
        } catch (e) {
          console.error("frame detect failed", e);
        } finally {
          sendingRef.current = false;
        }
      }, "image/jpeg", 0.7);
    };

    // ✅ only run polling overlay when detecting AND local preview mode
    if (isDetecting && previewUrl && !backendStreamUrl) {
      timer = window.setInterval(poll, 1000);
      setIsPolling(true);
    } else {
      setIsPolling(false);
    }

    return () => {
      if (timer) window.clearInterval(timer);
      setIsPolling(false);
      sendingRef.current = false;
      if (overlayRef.current) {
        const c = overlayRef.current.getContext("2d");
        if (c) c.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
      }
    };
  }, [isDetecting, previewUrl, backendStreamUrl]);

  const handleStart = async () => {
    // If backend path exists, run full mob-detect job
    if (backendVideoPath) {
      setIsDetecting(true);
      try {
        const resp = await callStartMobDetection(backendVideoPath);
        setDetectionResult(resp || null);
      } catch (err) {
        console.error("detection failed", err);
      } finally {
        setIsDetecting(false);
      }
      return;
    }

    // Otherwise enable live-frame overlay detection while local video plays
    if (previewUrl) {
      setIsDetecting(true);
    } else {
      console.warn("No video selected for live detection");
    }
  };

  const handleStop = async () => {
    setIsDetecting(false);
    setDetectionResult(null);
  };

  const handleUploadToBackend = async () => {
    if (!uploadedFileObject) return;
    try {
      const res = await callUploadVideo(uploadedFileObject);
      setBackendVideoPath(res?.video_path ?? null);
    } catch (e) {
      console.error("upload failed", e);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h3 className="panel-header">Video Input</h3>
        <p className="text-muted-foreground text-sm">
          Upload video footage or select from preloaded CCTV feeds
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Section */}
        <Card className="stat-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Upload Video
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer">
              <input
                type="file"
                accept=".mp4,.avi,.mov"
                onChange={handleFileUpload}
                className="hidden"
                id="video-upload"
              />
              <label htmlFor="video-upload" className="cursor-pointer">
                <FolderOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-foreground font-medium">Drop video file here</p>
                <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
                <p className="text-xs text-muted-foreground mt-2">Supports MP4, AVI, MOV</p>
              </label>
            </div>
            {uploadedFile && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-3 bg-success/10 rounded-lg">
                  <Video className="w-4 h-4 text-success" />
                  <span className="text-sm text-foreground truncate">{uploadedFile}</span>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleUploadToBackend} className="flex-1">
                    Upload to Backend
                  </Button>
                  <Button
                    onClick={() => {
                      setPreviewUrl(null);
                      setUploadedFile(null);
                      setUploadedFileObject(null);
                      setBackendVideoPath(null);
                      setDetectionResult(null);
                    }}
                    variant="outline"
                  >
                    Clear
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Preloaded Videos */}
        <Card className="stat-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Video className="w-4 h-4" />
              Preloaded CCTV
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedVideo} onValueChange={setSelectedVideo}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Select a camera feed" />
              </SelectTrigger>
              <SelectContent>
                {preloadedVideos.map((video) => (
                  <SelectItem key={video.id} value={video.id}>
                    {video.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="space-y-2">
              <Button
                onClick={handleStart}
                disabled={isDetecting || (!selectedVideo && !uploadedFile && !previewUrl)}
                className="w-full"
              >
                <Play className="w-4 h-4 mr-2" />
                Start Detection
              </Button>
              <Button onClick={handleStop} disabled={!isDetecting} variant="outline" className="w-full">
                <Square className="w-4 h-4 mr-2" />
                Stop Detection
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Status */}
        <Card className="stat-card">
          <CardHeader>
            <CardTitle className="text-base">Detection Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`detection-indicator w-4 h-4 rounded-full ${
                  isDetecting ? "bg-success pulse-active" : "bg-muted-foreground"
                }`}
              />
              <span className="text-sm font-medium text-foreground">
                {isDetecting ? "Detection Running" : "Detection Stopped"}
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Source</span>
                <span className="text-foreground">
                  {uploadedFile ||
                    (selectedVideo
                      ? preloadedVideos.find((v) => v.id === selectedVideo)?.name
                      : "None")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Frame Rate</span>
                <span className="text-foreground">{isDetecting ? "30 FPS" : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Resolution</span>
                <span className="text-foreground">{isDetecting ? "1920x1080" : "—"}</span>
              </div>

              {detectionResult && (
                <div className="mt-2 border-t pt-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">People detected</span>
                    <span className="text-foreground">{detectionResult.people_count ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Mob alert</span>
                    <span
                      className={`text-foreground ${
                        detectionResult.mob_alert ? "text-red-500" : "text-foreground"
                      }`}
                    >
                      {detectionResult.mob_alert ? "Yes" : "No"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Video Preview */}
      <Card className="stat-card">
        <CardHeader>
          <CardTitle className="text-base">Video Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="video-container aspect-video">
            {backendStreamUrl ? (
              // ✅ BACKEND PREVIEW (after uploading)
              <div className="relative overflow-hidden">
                <img
                  src={backendStreamUrl}
                  alt="Backend video preview"
                  className="w-full h-full object-contain rounded"
                />
              </div>
            ) : previewUrl ? (
              // ✅ LOCAL PREVIEW
              <div className="relative overflow-hidden">
                <video
                  ref={(el) => {
                    videoRef.current = el;
                  }}
                  src={previewUrl}
                  controls
                  className="w-full h-full object-contain rounded"
                />
                <canvas
                  ref={overlayRef}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  style={{ width: "100%", height: "100%" }}
                />
              </div>
            ) : (
              <div className="text-center">
                <Video className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">No video feed active</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Upload or select a video to begin
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
