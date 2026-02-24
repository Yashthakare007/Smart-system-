import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ✅ normalized backend URL (removes trailing slash)
const RAW_BACKEND_URL = (import.meta as any).env.VITE_BACKEND_URL ?? "http://127.0.0.1:5000";
export const BACKEND_URL = String(RAW_BACKEND_URL).replace(/\/$/, "");

// ✅ small helper: throw on bad responses
async function asJson(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

// Upload video to Flask backend
export async function uploadVideo(file: File) {
  const formData = new FormData();
  formData.append("video", file);

  const response = await fetch(`${BACKEND_URL}/api/upload`, {
    method: "POST",
    body: formData,
  });

  return asJson(response);
}

// Start mob detection
export async function startMobDetection(videoPath: string) {
  const response = await fetch(`${BACKEND_URL}/api/mob-detect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ video_path: videoPath }),
  });

  return asJson(response);
}

// ✅ Start suspicious detection (controls stream detection on/off)
export async function startSuspicious(source: "webcam" | "video", videoPath?: string | null) {
  const body: any = { source };
  if (source === "video" && videoPath) {
    body.video_path = videoPath;
  }

  const response = await fetch(`${BACKEND_URL}/suspicious/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return asJson(response);
}

// ✅ Stop suspicious detection
export async function stopSuspicious() {
  const response = await fetch(`${BACKEND_URL}/suspicious/stop`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  return asJson(response);
}

// ✅ Reset suspicious events
export async function resetSuspicious() {
  const response = await fetch(`${BACKEND_URL}/suspicious/reset`, {
    method: "POST",
  });

  return asJson(response);
}

// ✅ Start suspicious detection (backend already has this)
export async function startSuspiciousDetection(videoPath: string) {
  const response = await fetch(`${BACKEND_URL}/api/suspicious-detect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ video_path: videoPath }),
  });

  return asJson(response);
}

// ✅ Get suspicious events (backend already has this)
export async function getSuspiciousEvents() {
  const response = await fetch(`${BACKEND_URL}/suspicious/events`);
  return asJson(response);
}

// ✅ Reset suspicious events (backend already has this)
export async function resetSuspiciousEvents() {
  const response = await fetch(`${BACKEND_URL}/suspicious/reset`, { method: "POST" });
  return asJson(response);
}

// Send a single image/frame to the backend detect endpoint and return detections
export async function detectImage(frameBlob: Blob) {
  const form = new FormData();
  form.append("image", frameBlob, "frame.jpg");

  const response = await fetch(`${BACKEND_URL}/detect-image`, {
    method: "POST",
    body: form,
  });

  return asJson(response);
}

// ✅ Stream URL helper for preview
export function getSuspiciousStreamUrl(params: { source: "webcam" | "video"; videoPath?: string | null }) {
  if (params.source === "webcam") return `${BACKEND_URL}/stream/suspicious?source=webcam`;
  if (!params.videoPath) return null;
  return `${BACKEND_URL}/stream/suspicious?source=video&video_path=${encodeURIComponent(params.videoPath)}`;
}

// ========================================
// ✅ MISSING PERSON HELPERS
// ========================================

/**
 * Register a missing person with name, age, and multiple face images.
 * Returns { message, person_name, images_saved }
 */
export async function registerMissingPerson(
  name: string,
  age: string,
  imageFiles: File[]
) {
  const formData = new FormData();
  formData.append("name", name);
  formData.append("age", age);
  
  imageFiles.forEach((file) => {
    formData.append("images", file);
  });

  const response = await fetch(`${BACKEND_URL}/api/missing/register`, {
    method: "POST",
    body: formData,
  });

  return asJson(response);
}

/**
 * Train the LBPH face recognizer model on all registered persons.
 * Returns { message, persons_count, images_used }
 */
export async function trainMissingModel() {
  const response = await fetch(`${BACKEND_URL}/api/missing/train`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  return asJson(response);
}

/**
 * Detect a missing person in a given image frame.
 * imageBlob: JPEG/PNG blob
 * Returns { found: boolean, name?: string, age?: string, confidence: number, bbox?: [x,y,w,h] }
 */
export async function detectMissingImage(imageBlob: Blob) {
  const formData = new FormData();
  formData.append("image", imageBlob, "frame.jpg");

  const response = await fetch(`${BACKEND_URL}/api/missing/detect-image`, {
    method: "POST",
    body: formData,
  });

  return asJson(response);
}

/**
 * Start continuous missing person detection on webcam or video.
 * Returns { running: true, source, video_path, message }
 */
export async function startMissingPersonDetection(source: "webcam" | "video", videoPath?: string | null) {
  const body: any = { source };
  if (source === "video" && videoPath) {
    body.video_path = videoPath;
  }

  const response = await fetch(`${BACKEND_URL}/api/missing/start-detection`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return asJson(response);
}

/**
 * Stop continuous missing person detection.
 * Returns { stopped: true, message }
 */
export async function stopMissingPersonDetection() {
  const response = await fetch(`${BACKEND_URL}/api/missing/stop-detection`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  return asJson(response);
}

/**
 * Get missing person detection status.
 * Returns { running: boolean, source: string, video_path: string | null }
 */
export async function getMissingPersonDetectionStatus() {
  const response = await fetch(`${BACKEND_URL}/api/missing/detection-status`);
  return asJson(response);
}

/**
 * Get all missing person detection alerts.
 * Returns { alerts: [...], total: number }
 */
export async function getMissingPersonAlerts() {
  const response = await fetch(`${BACKEND_URL}/api/missing/alerts`);
  return asJson(response);
}

/**
 * Get latest missing person alert.
 * Returns { alert: {...} | null }
 */
export async function getLatestMissingAlert() {
  const response = await fetch(`${BACKEND_URL}/api/missing/alerts/latest`);
  return asJson(response);
}

/**
 * Clear all missing person detection alerts.
 * Returns { message, count }
 */
export async function clearMissingPersonAlerts() {
  const response = await fetch(`${BACKEND_URL}/api/missing/alerts/clear`, {
    method: "POST",
  });

  return asJson(response);
}

