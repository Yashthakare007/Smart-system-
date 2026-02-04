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

// ✅ Upload missing person reference data
export async function uploadMissingPerson(
  personImageFile: File,
  metadata?: { name?: string; age?: string }
) {
  const formData = new FormData();
  formData.append("person_image", personImageFile);
  if (metadata?.name) formData.append("name", metadata.name);
  if (metadata?.age) formData.append("age", metadata.age);

  const response = await fetch(`${BACKEND_URL}/api/missing/upload-person`, {
    method: "POST",
    body: formData,
  });

  return asJson(response);
}

// ✅ Start missing person detection
export async function startMissingPersonDetection(
  videoPath: string,
  personId: string,
  source: "webcam" | "video"
) {
  const response = await fetch(`${BACKEND_URL}/api/missing/detect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      video_path: videoPath,
      person_id: personId,
      source: source,
    }),
  });

  return asJson(response);
}

// ✅ Get missing person stream URL for preview
export function getMissingStreamUrl(params: {
  source: "webcam" | "video";
  videoPath?: string | null;
}) {
  if (params.source === "webcam")
    return `${BACKEND_URL}/stream/missing?source=webcam`;
  if (!params.videoPath) return null;
  return `${BACKEND_URL}/stream/missing?source=video&video_path=${encodeURIComponent(
    params.videoPath
  )}`;
}
