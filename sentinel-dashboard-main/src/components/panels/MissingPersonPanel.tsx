import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Brain, Play, Square, CheckCircle, AlertCircle, Clock, Trash2 } from "lucide-react";
import { 
  registerMissingPerson, 
  trainMissingModel, 
  detectMissingImage,
  startMissingPersonDetection,
  stopMissingPersonDetection,
  getMissingPersonDetectionStatus,
  getMissingPersonAlerts,
  clearMissingPersonAlerts
} from "@/lib/utils";

interface DetectionResult {
  found: boolean;
  name?: string;
  age?: string | number;
  confidence?: number;
  bbox?: [number, number, number, number];
  alert_id?: string;
  best_match?: {
    found: boolean;
    name: string;
    age: string;
    confidence: number;
    bbox: [number, number, number, number];
    person_id: string;
  };
  detections?: Array<{
    found: boolean;
    name?: string;
    age?: string;
    confidence: number;
    bbox: [number, number, number, number];
    person_id?: string;
  }>;
}

interface MissingAlert {
  id: string;
  type: string;
  name: string;
  age: string;
  confidence: number;
  time: string;
  status: string;
}

export function MissingPersonPanel() {
  // Registration form state
  const [registerName, setRegisterName] = useState("");
  const [registerAge, setRegisterAge] = useState("");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [registering, setRegistering] = useState(false);
  const [registerMessage, setRegisterMessage] = useState("");
  const [registerError, setRegisterError] = useState("");

  // Training state
  const [training, setTraining] = useState(false);
  const [trainMessage, setTrainMessage] = useState("");
  const [trainError, setTrainError] = useState("");

  // Detection state
  const [detecting, setDetecting] = useState(false);
  const [detectionRunning, setDetectionRunning] = useState(false);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Continuous detection state
  const [continuousDetecting, setContinuousDetecting] = useState(false);
  const [continuousError, setContinuousError] = useState("");
  const continuousCheckInterval = useRef<NodeJS.Timeout | null>(null);

  // Detection results
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
  const [detectionHistory, setDetectionHistory] = useState<DetectionResult[]>([]);
  const [detectionError, setDetectionError] = useState("");

  // Alerts state
  const [alerts, setAlerts] = useState<MissingAlert[]>([]);
  const [latestAlert, setLatestAlert] = useState<MissingAlert | null>(null);
  const alertsCheckInterval = useRef<NodeJS.Timeout | null>(null);

  // ✅ Handle image selection
  const handleImageSelect = (files: FileList | null) => {
    if (files) {
      setSelectedImages(Array.from(files));
      setRegisterError("");
    }
  };

  // ✅ Register missing person
  const handleRegister = async () => {
    if (!registerName.trim()) return setRegisterError("Name is required");
    if (!registerAge.trim()) return setRegisterError("Age is required");
    if (selectedImages.length === 0) return setRegisterError("Upload at least one image");

    setRegistering(true);
    setRegisterMessage("");
    setRegisterError("");

    try {
      const result = await registerMissingPerson(registerName, registerAge, selectedImages);
      setRegisterMessage(`✅ ${result.message} (${result.images_saved} images saved)`);
      setRegisterName("");
      setRegisterAge("");
      setSelectedImages([]);
    } catch (e: any) {
      setRegisterError(e.message || "Registration failed");
    } finally {
      setRegistering(false);
    }
  };

  // ✅ Train model
  const handleTrain = async () => {
    setTraining(true);
    setTrainMessage("");
    setTrainError("");

    try {
      const result = await trainMissingModel();
      setTrainMessage(`✅ ${result.message} (${result.persons_count} persons, ${result.images_used} faces)`);
    } catch (e: any) {
      setTrainError(e.message || "Training failed");
    } finally {
      setTraining(false);
    }
  };

  // ✅ Capture + detect with box drawing
  const captureAndDetect = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const displayCanvas = document.getElementById("display-canvas") as HTMLCanvasElement;

    if (!video || !canvas || video.readyState < 2) return;

    try {
      const ctx = canvas.getContext("2d");
      const displayCtx = displayCanvas?.getContext("2d");
      if (!ctx || !displayCtx) return;

      // draw frame to hidden canvas for detection
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // draw frame to display canvas
      displayCtx.drawImage(video, 0, 0, displayCanvas.width, displayCanvas.height);

      const frameBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Failed to create blob from canvas"));
        }, "image/jpeg", 0.8);
      });

      const result = await detectMissingImage(frameBlob);

      // Draw boxes on display canvas
      if (result.detections && result.detections.length > 0) {
        result.detections.forEach((det: any) => {
          if (det.bbox && det.bbox.length === 4) {
            const [x, y, w, h] = det.bbox;
            const lineWidth = 3;
            const scale = displayCanvas.width / canvas.width;

            if (det.found) {
              // Red box for missing person
              displayCtx.strokeStyle = "#FF0000";
              displayCtx.lineWidth = lineWidth;
              displayCtx.strokeRect(x * scale, y * scale, w * scale, h * scale);

              // Draw red label
              displayCtx.fillStyle = "#FF0000";
              displayCtx.font = "bold 14px Arial";
              displayCtx.fillText(`🚨 MISSING: ${det.name}`, x * scale + 5, y * scale - 10);
            } else {
              // Green box for normal face
              displayCtx.strokeStyle = "#00AA00";
              displayCtx.lineWidth = lineWidth;
              displayCtx.strokeRect(x * scale, y * scale, w * scale, h * scale);
            }
          }
        });
      }

      setDetectionResult(result);

      // ✅ FIX: functional update (no stale closure)
      setDetectionHistory((prev) => [result, ...prev.slice(0, 9)]);

      setDetectionError("");
    } catch (e: any) {
      console.error("Detection error:", e);
      setDetectionError(e.message || "Detection failed");
    }
  };

  // ✅ Start detection
  const startDetection = async () => {
    try {
      setDetectionError("");
      setDetectionRunning(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        videoRef.current.onloadedmetadata = async () => {
          try {
            await videoRef.current?.play();
          } catch (e) {
            console.error("Failed to play video:", e);
            setDetectionError("Failed to start video playback");
            setDetectionRunning(false);
            return;
          }

          setDetecting(true);

          // run immediately once, then loop
          captureAndDetect();

          detectionIntervalRef.current = setInterval(() => {
            captureAndDetect();
          }, 1000);
        };
      }
    } catch (e: any) {
      console.error("Failed to access webcam:", e);
      setDetectionError(e.message || "Failed to access webcam. Check permissions.");
      setDetectionRunning(false);
    }
  };

  // ✅ Stop detection
  const stopDetection = () => {
    setDetecting(false);
    setDetectionRunning(false);

    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    setDetectionResult(null);
    setDetectionError("");
  };

  // ✅ Start continuous detection on webcam
  const startContinuousDetection = async () => {
    setContinuousDetecting(true);
    setContinuousError("");

    try {
      await startMissingPersonDetection("webcam");
      
      // Poll for alerts every 2 seconds
      continuousCheckInterval.current = setInterval(async () => {
        try {
          const result = await getMissingPersonAlerts();
          if (result.alerts && result.alerts.length > 0) {
            setAlerts(result.alerts);
            setLatestAlert(result.alerts[0]);
          }
        } catch (e) {
          console.error("Failed to fetch alerts:", e);
        }
      }, 2000);
    } catch (e: any) {
      setContinuousError(e.message || "Failed to start continuous detection");
      setContinuousDetecting(false);
    }
  };

  // ✅ Stop continuous detection
  const stopContinuousDetection = async () => {
    try {
      await stopMissingPersonDetection();
      setContinuousDetecting(false);
      
      if (continuousCheckInterval.current) {
        clearInterval(continuousCheckInterval.current);
        continuousCheckInterval.current = null;
      }
    } catch (e: any) {
      setContinuousError(e.message || "Failed to stop detection");
    }
  };

  // ✅ Clear alerts
  const handleClearAlerts = async () => {
    try {
      await clearMissingPersonAlerts();
      setAlerts([]);
      setLatestAlert(null);
    } catch (e: any) {
      console.error("Failed to clear alerts:", e);
    }
  };

  // ✅ Cleanup
  useEffect(() => {
    return () => {
      if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
      if (continuousCheckInterval.current) clearInterval(continuousCheckInterval.current);
      if (alertsCheckInterval.current) clearInterval(alertsCheckInterval.current);
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h3 className="panel-header">Missing Person Identification</h3>
        <p className="text-muted-foreground text-sm">
          Register missing persons and use facial recognition to identify them in real-time
        </p>
      </div>

      {/* Registration */}
      <Card className="stat-card">
        <CardHeader>
          <CardTitle className="text-base">Register Missing Person</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <input
                type="text"
                placeholder="Person's name"
                value={registerName}
                onChange={(e) => setRegisterName(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Age</label>
              <input
                type="text"
                placeholder="Age or age range"
                value={registerAge}
                onChange={(e) => setRegisterAge(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium block mb-2">
              📸 Upload Multiple Face Images
              <span className="text-xs text-muted-foreground ml-2">(Select 3+ clear facial images for best results)</span>
            </label>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => handleImageSelect(e.target.files)}
              disabled={registering}
              className="w-full"
            />
            {selectedImages.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-sm font-medium text-green-700">
                  ✅ {selectedImages.length} image{selectedImages.length !== 1 ? 's' : ''} selected
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedImages.map((file, idx) => (
                    <div key={idx} className="text-xs bg-blue-50 px-2 py-1 rounded border border-blue-200 text-blue-700">
                      📄 {file.name.substring(0, 20)}...
                    </div>
                  ))}
                </div>
              </div>
            )}
            {selectedImages.length === 0 && (
              <p className="text-xs text-muted-foreground mt-2">💡 Tip: Select multiple images (different angles/lighting) for accurate detection</p>
            )}
          </div>

          <Button
            onClick={handleRegister}
            disabled={registering || !registerName || !registerAge || selectedImages.length === 0}
            className="w-full"
          >
            <Upload className="w-4 h-4 mr-2" />
            {registering ? "Registering..." : "Register Person"}
          </Button>

          {registerMessage && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
              {registerMessage}
            </div>
          )}
          {registerError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              {registerError}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Training */}
      <Card className="stat-card">
        <CardHeader>
          <CardTitle className="text-base">Train Recognition Model</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Train the facial recognition model using all registered persons. Run this after registering or updating persons.
          </p>
          <Button onClick={handleTrain} disabled={training} className="w-full">
            <Brain className="w-4 h-4 mr-2" />
            {training ? "Training..." : "Train Model"}
          </Button>

          {trainMessage && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
              {trainMessage}
            </div>
          )}
          {trainError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              {trainError}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Continuous Detection */}
      <Card className="stat-card">
        <CardHeader>
          <CardTitle className="text-base">Live Monitoring</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Monitor webcam continuously for missing persons. Detections will be logged as alerts.
          </p>
          <div className="flex gap-2">
            {continuousDetecting ? (
              <Button onClick={stopContinuousDetection} variant="destructive" className="flex-1">
                <Square className="w-4 h-4 mr-2" />
                Stop Monitoring
              </Button>
            ) : (
              <Button onClick={startContinuousDetection} className="flex-1">
                <Play className="w-4 h-4 mr-2" />
                Start Live Monitoring
              </Button>
            )}
          </div>

          {continuousDetecting && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700 flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
              Live monitoring active
            </div>
          )}

          {continuousError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              {continuousError}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detection Alerts */}
      {latestAlert && (
        <Card className="stat-card border-2 border-red-500 bg-red-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-red-800 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              🚨 MISSING PERSON DETECTED
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-3 rounded-lg">
                <p className="text-xs text-gray-600">Name</p>
                <p className="font-bold text-lg text-red-700">{latestAlert.name}</p>
              </div>
              <div className="bg-white p-3 rounded-lg">
                <p className="text-xs text-gray-600">Confidence</p>
                <p className="font-bold text-lg text-red-700">{latestAlert.confidence}%</p>
              </div>
            </div>
            <div className="bg-white p-3 rounded-lg">
              <p className="text-xs text-gray-600">Age</p>
              <p className="font-bold">{latestAlert.age}</p>
            </div>
            <div className="bg-white p-2 rounded-lg text-xs text-gray-600 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {new Date(latestAlert.time).toLocaleTimeString()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Alerts */}
      {alerts.length > 0 && (
        <Card className="stat-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Detection History ({alerts.length})</CardTitle>
              <Button
                onClick={handleClearAlerts}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Clear
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {alerts.map((alert) => (
                <div key={alert.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-red-700">{alert.name}</p>
                      <p className="text-xs text-gray-600">Age: {alert.age} | Confidence: {alert.confidence}%</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(alert.time).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detection */}
      <Card className="stat-card">
        <CardHeader>
          <CardTitle className="text-base">Real-Time Detection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative w-full bg-gray-900 rounded-lg overflow-hidden" style={{ paddingBottom: "75%", position: "relative" }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                backgroundColor: "#000",
              }}
              className="w-full h-full"
            />

            {/* Display canvas - shows detected faces with boxes */}
            <canvas
              id="display-canvas"
              width={640}
              height={480}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
              }}
            />

            {detectionRunning && (
              <div className="absolute top-2 right-2 flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-full text-xs font-medium">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                LIVE
              </div>
            )}

            {!detecting && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="text-center text-white">
                  <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-75" />
                  <p className="text-sm">Click Start Detection to begin</p>
                </div>
              </div>
            )}

            {/* Legend for box colors */}
            {detecting && (
              <div className="absolute bottom-2 left-2 text-xs text-white bg-black/60 p-2 rounded">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 border-2 border-red-600"></div>
                  <span>Missing Person</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-green-500"></div>
                  <span>Normal Face</span>
                </div>
              </div>
            )}
          </div>

          <canvas ref={canvasRef} width={640} height={480} className="hidden" />

          <div className="flex gap-2">
            {detecting ? (
              <Button onClick={stopDetection} variant="destructive" disabled={!detectionRunning} className="flex-1">
                <Square className="w-4 h-4 mr-2" />
                Stop Detection
              </Button>
            ) : (
              <Button onClick={startDetection} disabled={detectionRunning} className="flex-1">
                <Play className="w-4 h-4 mr-2" />
                Start Detection
              </Button>
            )}
          </div>

          {detectionError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              <AlertCircle className="w-4 h-4 inline mr-2" />
              {detectionError}
            </div>
          )}

          {/* Display only the current best match (if any) */}
          {detectionResult && detectionResult.best_match && (
            <div className="p-4 rounded-lg border-2 border-green-500 bg-green-50 animate-pulse">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-6 h-6 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-green-900">✅ MISSING PERSON DETECTED</h3>
                  <div className="mt-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-green-700">Name:</span>
                      <span className="text-base font-bold text-green-900">{detectionResult.best_match.name}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-green-700">Age:</span>
                      <span className="text-base font-bold text-green-900">{detectionResult.best_match.age}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-green-700">Confidence:</span>
                      <span className="text-base font-bold text-green-900">{detectionResult.best_match.confidence}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Show face count stats */}
          {detectionResult && detectionResult.detections && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm">
              <p className="text-blue-700">
                Faces detected: {detectionResult.detections.length} 
                {detectionResult.detections.length > 0 && ` (${detectionResult.detections.filter((d: any) => d.found).length} match${detectionResult.detections.filter((d: any) => d.found).length !== 1 ? 'es' : ''}, ${detectionResult.detections.filter((d: any) => !d.found).length} normal)`}
              </p>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            💡 Detection updates every 1 second. Green box = normal face, Red box = missing person
          </p>
        </CardContent>
      </Card>
    </div>
  );
}