import { useState } from "react";
import { UserSearch, Upload, Play, Square, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  uploadVideo,
  uploadMissingPerson,
  startMissingPersonDetection,
  getMissingStreamUrl,
} from "@/lib/utils";

type PreviewSource = "webcam" | "video";

interface DetectionResult {
  match_found: boolean;
  confidence: number;
  frames_processed: number;
}

export function MissingPersonPanel() {
  const [previewSource, setPreviewSource] = useState<PreviewSource>("webcam");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoFileName, setVideoFileName] = useState<string>("");
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [videoUploadError, setVideoUploadError] = useState<string>("");

  const [personImageFile, setPersonImageFile] = useState<File | null>(null);
  const [personImageFileName, setPersonImageFileName] = useState<string>("");
  const [personName, setPersonName] = useState("");
  const [personAge, setPersonAge] = useState("");
  const [personId, setPersonId] = useState<string>("");
  const [isUploadingPerson, setIsUploadingPerson] = useState(false);
  const [personUploadError, setPersonUploadError] = useState<string>("");

  const [isRunning, setIsRunning] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
  const [detectionError, setDetectionError] = useState<string>("");

  // Handle video file upload
  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      setVideoFileName(file.name);
      setVideoUploadError("");
    }
  };

  // Upload video to backend
  const handleUploadVideo = async () => {
    if (!videoFile) {
      setVideoUploadError("Please select a video file");
      return;
    }

    setIsUploadingVideo(true);
    setVideoUploadError("");
    try {
      const result = await uploadVideo(videoFile);
      setVideoPath(result.video_path);
      setVideoUploadError("");
      setPreviewSource("video");
    } catch (error: any) {
      setVideoUploadError(error.message || "Failed to upload video");
    } finally {
      setIsUploadingVideo(false);
    }
  };

  // Handle person image file change
  const handlePersonImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPersonImageFile(file);
      setPersonImageFileName(file.name);
      setPersonUploadError("");
    }
  };

  // Upload missing person data to backend
  const handleUploadPerson = async () => {
    if (!personImageFile) {
      setPersonUploadError("Please select a person image file");
      return;
    }

    setIsUploadingPerson(true);
    setPersonUploadError("");
    try {
      const metadata = {
        name: personName || undefined,
        age: personAge || undefined,
      };
      const result = await uploadMissingPerson(personImageFile, metadata);
      setPersonId(result.person_id);
      setPersonUploadError("");
    } catch (error: any) {
      setPersonUploadError(error.message || "Failed to upload person data");
    } finally {
      setIsUploadingPerson(false);
    }
  };

  // Start missing person detection
  const handleStartDetection = async () => {
    if (!videoPath) {
      setDetectionError("Please upload a video first");
      return;
    }
    if (!personId) {
      setDetectionError("Please upload missing person data first");
      return;
    }

    setIsDetecting(true);
    setDetectionError("");
    setDetectionResult(null);
    try {
      const result = await startMissingPersonDetection(videoPath, personId, previewSource);
      setDetectionResult(result);
      setIsRunning(true);
    } catch (error: any) {
      setDetectionError(error.message || "Failed to start detection");
    } finally {
      setIsDetecting(false);
    }
  };

  // Stop detection
  const handleStop = () => {
    setIsRunning(false);
    setDetectionResult(null);
  };

  // Get stream URL for preview
  const streamUrl = getMissingStreamUrl({ source: previewSource, videoPath: previewSource === "video" ? videoPath : null });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h3 className="panel-header">Missing Person Search</h3>
        <p className="text-muted-foreground text-sm">
          Search for missing persons in video feeds using reference images
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Video Upload & Preview */}
        <div className="lg:col-span-2 space-y-6">
          {/* Preview Mode Tabs */}
          <Card className="stat-card">
            <CardHeader>
              <CardTitle className="text-base">Preview Source</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button
                  variant={previewSource === "webcam" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPreviewSource("webcam")}
                >
                  Live Webcam
                </Button>
                <Button
                  variant={previewSource === "video" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPreviewSource("video")}
                  disabled={!videoPath}
                >
                  Uploaded Video
                </Button>
              </div>

              {/* Stream Preview */}
              <div className="aspect-video bg-foreground/5 rounded-lg border border-border flex items-center justify-center overflow-hidden">
                {streamUrl ? (
                  <img
                    src={streamUrl}
                    alt={`${previewSource} stream`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      img.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="text-center">
                    <UserSearch className="w-12 h-12 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {previewSource === "video" ? "Upload video to preview" : "Connect to backend for webcam feed"}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Video Upload */}
          <Card className="stat-card">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Video Upload
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="video-upload">Select Video File (.mp4, .avi, .mov)</Label>
                <Input
                  id="video-upload"
                  type="file"
                  accept=".mp4,.avi,.mov"
                  onChange={handleVideoFileChange}
                  disabled={isUploadingVideo}
                />
                {videoFileName && (
                  <p className="text-xs text-muted-foreground">Selected: {videoFileName}</p>
                )}
              </div>
              {videoUploadError && (
                <p className="text-xs text-destructive">{videoUploadError}</p>
              )}
              <Button
                onClick={handleUploadVideo}
                disabled={!videoFile || isUploadingVideo}
                className="w-full"
              >
                {isUploadingVideo ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  "Upload to Backend"
                )}
              </Button>
              {videoPath && (
                <p className="text-xs text-success">✓ Video uploaded: {videoPath}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Person Data & Results */}
        <div className="space-y-6">
          {/* Person Image Upload */}
          <Card className="stat-card">
            <CardHeader>
              <CardTitle className="text-base">Missing Person Data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="person-image">Reference Image (.jpg, .png)</Label>
                <Input
                  id="person-image"
                  type="file"
                  accept=".jpg,.jpeg,.png"
                  onChange={handlePersonImageChange}
                  disabled={isUploadingPerson}
                />
                {personImageFileName && (
                  <p className="text-xs text-muted-foreground">Selected: {personImageFileName}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="person-name">Name (optional)</Label>
                <Input
                  id="person-name"
                  placeholder="Enter name"
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  disabled={isUploadingPerson}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="person-age">Age (optional)</Label>
                <Input
                  id="person-age"
                  placeholder="Enter age"
                  type="number"
                  value={personAge}
                  onChange={(e) => setPersonAge(e.target.value)}
                  disabled={isUploadingPerson}
                />
              </div>

              {personUploadError && (
                <p className="text-xs text-destructive">{personUploadError}</p>
              )}

              <Button
                onClick={handleUploadPerson}
                disabled={!personImageFile || isUploadingPerson}
                className="w-full"
              >
                {isUploadingPerson ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  "Upload Person Data"
                )}
              </Button>

              {personId && (
                <p className="text-xs text-success">✓ Person ID: {personId}</p>
              )}
            </CardContent>
          </Card>

          {/* Results */}
          <Card className="stat-card">
            <CardHeader>
              <CardTitle className="text-base">Search Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge
                  variant={isRunning ? "destructive" : "secondary"}
                >
                  {isRunning ? "Running" : "Stopped"}
                </Badge>
              </div>

              {detectionResult && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Match Found</span>
                    <Badge
                      variant={detectionResult.match_found ? "default" : "secondary"}
                    >
                      {detectionResult.match_found ? "Yes" : "No"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Confidence</span>
                    <span className="text-sm font-medium">
                      {(detectionResult.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Frames Processed</span>
                    <span className="text-sm font-medium">
                      {detectionResult.frames_processed}
                    </span>
                  </div>
                </>
              )}

              {!detectionResult && (isRunning || isDetecting) && (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Processing...</span>
                </div>
              )}

              {detectionError && (
                <p className="text-xs text-destructive">{detectionError}</p>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleStartDetection}
                  disabled={!videoPath || !personId || isRunning || isDetecting}
                  className="flex-1"
                  size="sm"
                >
                  {isDetecting ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3 mr-1" />
                      Start Search
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleStop}
                  disabled={!isRunning}
                  variant="outline"
                  size="sm"
                >
                  <Square className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
