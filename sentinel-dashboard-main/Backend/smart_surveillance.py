from flask import Flask, jsonify, request
from flask_cors import CORS
import os
import time
import uuid
import threading
import json
import shutil
from datetime import datetime
from pathlib import Path

# Note: heavy computer-vision libraries (cv2, transformers, torch) are imported lazily
# inside the endpoints that need them so lightweight endpoints (health/test)
# can run without installing them during development.

app = Flask(__name__)
CORS(app)  # VERY IMPORTANT for frontend connection

BASE_DIR = os.path.dirname(__file__)

# YOLO models loaded on demand (kept for other endpoints like mob-detect)
model = None              # yolov8n.pt (person detection / mob)
suspicious_model = None   # Suspicious_Activities_nano.pt (legacy - still used by /api/suspicious-detect)

# VideoMAE model (lazy-loaded cache)
videomae_model = None
videomae_processor = None
videomae_device = None

# VideoMAE detection thread control (global state)
VIDEOMAE_RUNNING = False
VIDEOMAE_STOP_EVENT = threading.Event()
VIDEOMAE_THREAD = None
VIDEOMAE_SOURCE = "webcam"  # "webcam" | "video"
VIDEOMAE_VIDEO_PATH = None
VIDEOMAE_LOCK = threading.Lock()

# Missing Person model (lazy-loaded cache)
mp_face_cascade = None
mp_lbph_model = None
mp_label_mapping = None  # {0: "John", 1: "Jane", ...}

# Ensure uploads folder exists for saved videos
UPLOAD_FOLDER = os.path.join(BASE_DIR, "videos")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

MOB_THRESHOLD = 6

# ----------------------------
# Suspicious Activity (in-memory)
# ----------------------------
SUSPICIOUS_EVENTS = []  # list of dicts (most recent last)
MAX_EVENTS = 200

# ----------------------------
# Missing Person Alerts (in-memory)
# ----------------------------
MISSING_PERSON_ALERTS = []  # list of dicts (most recent last)
MAX_ALERTS = 200

# Missing Person Detection Thread Control
MISSING_PERSON_RUNNING = False
MISSING_PERSON_STOP_EVENT = threading.Event()
MISSING_PERSON_THREAD = None
MISSING_PERSON_SOURCE = "webcam"  # "webcam" | "video"
MISSING_PERSON_VIDEO_PATH = None
MISSING_PERSON_LOCK = threading.Lock()


def _now_iso():
    return datetime.now().isoformat(timespec="seconds")


def clean_label(label: str):
    # remove common prefixes like V, video_, etc.
    s = (label or "").replace("-", "_").replace(" ", "_")
    # Example: VMan_with_Knife -> Man_with_Knife
    if len(s) > 1 and s[0] == "V" and s[1].isalpha():
        s = s[1:]
    return s


def add_event(event_type, description, location="Unknown", status="warning", confidence=60):
    evt = {
        "id": str(uuid.uuid4())[:8],
        "type": event_type,
        "description": description,
        "location": location,
        "time": _now_iso(),
        "status": status,        # "suspicious" | "warning" | "normal"
        "confidence": int(confidence),
    }
    SUSPICIOUS_EVENTS.append(evt)
    if len(SUSPICIOUS_EVENTS) > MAX_EVENTS:
        del SUSPICIOUS_EVENTS[: len(SUSPICIOUS_EVENTS) - MAX_EVENTS]
    return evt


def add_missing_person_alert(name, age, confidence, person_id=None):
    """Add a missing person detection alert (high priority)."""
    alert = {
        "id": str(uuid.uuid4())[:8],
        "type": "Missing Person Detected",
        "name": name,
        "age": age,
        "person_id": person_id,
        "confidence": int(confidence),
        "time": _now_iso(),
        "status": "suspicious",  # Always high priority
    }
    MISSING_PERSON_ALERTS.append(alert)
    if len(MISSING_PERSON_ALERTS) > MAX_ALERTS:
        del MISSING_PERSON_ALERTS[: len(MISSING_PERSON_ALERTS) - MAX_ALERTS]
    
    # Also log as general event
    add_event(
        event_type=f"Missing Person: {name}",
        description=f"Missing person '{name}' detected with {confidence}% confidence",
        location="Detection System",
        status="suspicious",
        confidence=confidence
    )
    return alert


# ========================================
# Missing Person Module Helpers
# ========================================

def mp_paths():
    """Return missing person folder paths (relative to BASE_DIR)."""
    return {
        "dataset": os.path.join(BASE_DIR, "missing_person", "dataset"),
        "trainer": os.path.join(BASE_DIR, "missing_person", "trainer"),
        "data": os.path.join(BASE_DIR, "missing_person", "data"),
        "haarcascade": os.path.join(BASE_DIR, "missing_person", "haarcascade"),
    }


def mp_ensure_dirs():
    """Ensure all missing person directories exist."""
    for path in mp_paths().values():
        os.makedirs(path, exist_ok=True)


def load_face_cascade():
    """Load Haar cascade for face detection."""
    global mp_face_cascade
    if mp_face_cascade is not None:
        return mp_face_cascade
    
    try:
        import cv2
    except ImportError:
        raise ImportError("Missing opencv-python")
    
    cascade_path = os.path.join(mp_paths()["haarcascade"], "haarcascade_frontalface_default.xml")
    
    # If cascade doesn't exist, try to copy from opencv package
    if not os.path.isfile(cascade_path):
        try:
            # Get cascade from opencv installation
            import cv2.data
            default_cascade = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            if os.path.isfile(default_cascade):
                os.makedirs(mp_paths()["haarcascade"], exist_ok=True)
                shutil.copy(default_cascade, cascade_path)
        except Exception:
            pass
    
    # Load cascade
    if os.path.isfile(cascade_path):
        mp_face_cascade = cv2.CascadeClassifier(cascade_path)
        return mp_face_cascade
    else:
        raise FileNotFoundError(f"Haar cascade not found at {cascade_path}")


def load_persons_json():
    """Load missing persons metadata from JSON."""
    data_path = os.path.join(mp_paths()["data"], "persons.json")
    if os.path.isfile(data_path):
        try:
            with open(data_path, "r") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def save_persons_json(data):
    """Save missing persons metadata to JSON."""
    os.makedirs(mp_paths()["data"], exist_ok=True)
    data_path = os.path.join(mp_paths()["data"], "persons.json")
    with open(data_path, "w") as f:
        json.dump(data, f, indent=2)


def load_lbph_model():
    """Load trained LBPH face recognizer model and labels."""
    global mp_lbph_model, mp_label_mapping
    
    if mp_lbph_model is not None and mp_label_mapping is not None:
        return mp_lbph_model, mp_label_mapping
    
    try:
        import cv2
        import numpy as np
    except ImportError:
        raise ImportError("Missing opencv-contrib-python or numpy")
    
    trainer_path = os.path.join(mp_paths()["trainer"], "face_trainer.yml")
    labels_path = os.path.join(mp_paths()["trainer"], "labels.npy")
    
    if not os.path.isfile(trainer_path) or not os.path.isfile(labels_path):
        return None, None
    
    try:
        recognizer = cv2.face.LBPHFaceRecognizer_create()
        recognizer.read(trainer_path)
        
        labels_dict = np.load(labels_path, allow_pickle=True).item()
        
        mp_lbph_model = recognizer
        mp_label_mapping = labels_dict
        
        return recognizer, labels_dict
    except Exception as e:
        print(f"Failed to load LBPH model: {e}")
        return None, None


def invalidate_lbph_cache():
    """Invalidate LBPH model cache after training."""
    global mp_lbph_model, mp_label_mapping
    mp_lbph_model = None
    mp_label_mapping = None


def load_person_model():
    """Load yolov8n.pt (used for person/mob detection)"""
    global model
    if model is not None:
        return model
    from ultralytics import YOLO
    model = YOLO(os.path.join(BASE_DIR, "yolov8n.pt"))
    return model


def load_suspicious_model():
    """Load custom suspicious activity model (legacy YOLO suspicious model)

    NOTE: This model is still used by `/api/suspicious-detect` (batch analysis).
    VideoMAE is used for live detection and event creation.
    """
    global suspicious_model
    if suspicious_model is not None:
        return suspicious_model

    from ultralytics import YOLO

    # Recommended path: Backend/models/Suspicious_Activities_nano.pt
    path_a = os.path.join(BASE_DIR, "models", "Suspicious_Activities_nano.pt")
    # Fallback path: Backend/Suspicious_Activities_nano.pt
    path_b = os.path.join(BASE_DIR, "Suspicious_Activities_nano.pt")

    if os.path.isfile(path_a):
        suspicious_model = YOLO(path_a)
    elif os.path.isfile(path_b):
        suspicious_model = YOLO(path_b)
    else:
        raise FileNotFoundError(
            "Suspicious model file not found. Put it at:\n"
            f"  {path_a}\nor\n  {path_b}"
        )

    return suspicious_model


def load_videomae_model():
    """Lazy-load VideoMAE model from HuggingFace and cache it globally."""
    global videomae_model, videomae_processor, videomae_device

    if videomae_model is not None and videomae_processor is not None and videomae_device is not None:
        return videomae_model, videomae_processor, videomae_device

    try:
        import torch
        from transformers import AutoImageProcessor, VideoMAEForVideoClassification
    except ImportError as e:
        raise ImportError(f"VideoMAE requires transformers and torch: {e}")

    try:
        device = "cuda" if torch.cuda.is_available() else "cpu"
        processor = AutoImageProcessor.from_pretrained("OPear/videomae-large-finetuned-UCF-Crime")
        model = VideoMAEForVideoClassification.from_pretrained("OPear/videomae-large-finetuned-UCF-Crime")
        model = model.to(device)
        model.eval()

        videomae_model = model
        videomae_processor = processor
        videomae_device = device

        return model, processor, device
    except Exception as e:
        raise RuntimeError(f"Failed to load VideoMAE model: {e}")


def get_videomae_clip(cap, frame_count=16):
    """
    Extract exactly `frame_count` frames from video capture.
    Convert BGR->RGB and resize to 224x224. Pads with last frame if necessary.
    Returns list of frames (numpy arrays) or None if capture failed to return any frame.
    """
    try:
        import cv2
        import numpy as np
    except ImportError:
        return None

    frames = []
    last_frame = None

    for _ in range(frame_count):
        ret, frame = cap.read()
        if not ret:
            # Pad with last_frame if available
            if last_frame is not None:
                frames.append(last_frame)
            else:
                # Try a short wait and one more read for webcams
                time.sleep(0.05)
                ret2, frame2 = cap.read()
                if ret2:
                    frame_rgb = cv2.cvtColor(frame2, cv2.COLOR_BGR2RGB)
                    frame_resized = cv2.resize(frame_rgb, (224, 224))
                    frames.append(frame_resized)
                    last_frame = frame_resized
                else:
                    # No frames at all
                    return None
        else:
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            frame_resized = cv2.resize(frame_rgb, (224, 224))
            frames.append(frame_resized)
            last_frame = frame_resized

    # Ensure exact length
    if len(frames) < frame_count:
        # pad with last frame
        while len(frames) < frame_count and last_frame is not None:
            frames.append(last_frame)

    return frames


def videomae_label_to_status(label_str):
    s = (label_str or "").lower().replace("-", "_").replace(" ", "_")
    HIGH_RISK_KEYWORDS = [
        "knife", "gun", "weapon", "bomb", "explosive",
        "assault", "fight", "fighting", "attack", "shoot", "shooting",
        "kidnap", "kidnapping", "robbery", "theft", "snatch"
    ]
    MID_RISK_KEYWORDS = ["suspicious", "intrusion", "trespass", "perimeter", "threat", "anomaly"]
    if any(k in s for k in HIGH_RISK_KEYWORDS):
        return "suspicious"
    if any(k in s for k in MID_RISK_KEYWORDS):
        return "warning"
    return "warning"


def videomae_worker(source="webcam", video_path=None):
    """
    Background worker for VideoMAE. Reads clips (16 frames) from the source,
    runs VideoMAE inference, and creates events via `add_event` when suspicious
    labels are detected.

    The worker stops when `VIDEOMAE_STOP_EVENT` is set. It ensures capture is
    released on exit so the webcam/video file is freed for other endpoints.
    """
    global VIDEOMAE_RUNNING, VIDEOMAE_STOP_EVENT

    try:
        import cv2
        import torch
        import numpy as np
    except ImportError as e:
        add_event("Error", f"VideoMAE worker missing libraries: {e}", status="warning")
        VIDEOMAE_RUNNING = False
        return

    # Load model (lazy)
    try:
        model, processor, device = load_videomae_model()
    except Exception as e:
        add_event("Error", f"VideoMAE failed to load: {e}", status="warning")
        VIDEOMAE_RUNNING = False
        return

    # Open capture
    cap = None
    try:
        if source == "webcam":
            # Prefer DirectShow on Windows for better release behavior
            try:
                cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
            except Exception:
                cap = cv2.VideoCapture(0)
        elif source == "video":
            if not video_path:
                add_event("Error", "VideoMAE video source requires video_path", status="warning")
                VIDEOMAE_RUNNING = False
                return
            abs_path = os.path.join(BASE_DIR, video_path)
            if not os.path.isfile(abs_path):
                add_event("Error", f"Video file not found: {abs_path}", status="warning")
                VIDEOMAE_RUNNING = False
                return
            cap = cv2.VideoCapture(abs_path)
        else:
            add_event("Error", f"Unknown source for VideoMAE: {source}", status="warning")
            VIDEOMAE_RUNNING = False
            return

        if cap is None or not cap.isOpened():
            add_event("Error", "Could not open source for VideoMAE", status="warning")
            VIDEOMAE_RUNNING = False
            return
    except Exception as e:
        add_event("Error", f"Failed to open capture: {e}", status="warning")
        VIDEOMAE_RUNNING = False
        return

    # Detection parameters
    CONF_THRESHOLD = 0.70  # only emit when >= 70%
    DEDUP_SEC = 10         # per-label cooldown
    ANY_COOLDOWN = 2       # overall cooldown between any two events
    CLIP_INTERVAL_SEC = 2  # classify roughly every 2 seconds

    last_clip_time = 0
    last_label_emit = {}  # label -> timestamp
    last_any_emit = 0

    try:
        while not VIDEOMAE_STOP_EVENT.is_set():
            now = time.time()

            if now - last_clip_time >= CLIP_INTERVAL_SEC:
                frames = get_videomae_clip(cap, frame_count=16)
                last_clip_time = now

                if frames is None:
                    # No frames available. For video source, end; for webcam, continue.
                    if source == "video":
                        break
                    else:
                        time.sleep(0.2)
                        continue

                # inference
                try:
                    inputs = processor(list(frames), return_tensors="pt")

                    # move tensors to device if available
                    for k in list(inputs.keys()):
                        v = inputs[k]
                        if hasattr(v, "to"):
                            inputs[k] = v.to(device)

                    with torch.no_grad():
                        outputs = model(**inputs)

                    logits = outputs.logits
                    probs = torch.softmax(logits, dim=-1)
                    top_prob, top_idx = torch.max(probs, dim=-1)
                    top_prob = float(top_prob[0])
                    top_idx = int(top_idx[0])

                    label = model.config.id2label.get(top_idx, str(top_idx))

                    # Skip Normal or low confidence
                    if label.lower() == "normal" or top_prob < CONF_THRESHOLD:
                        # no event
                        pass
                    else:
                        # dedup checks
                        if now - last_any_emit < ANY_COOLDOWN:
                            # overall cooldown
                            pass
                        else:
                            last_label_time = last_label_emit.get(label, 0)
                            if now - last_label_time >= DEDUP_SEC:
                                # map status
                                status = videomae_label_to_status(label)
                                location = "Webcam" if source == "webcam" else "Uploaded Video"
                                add_event(
                                    event_type=label,
                                    description=f"VideoMAE: {label} detected with {top_prob:.2%} confidence",
                                    location=location,
                                    status=status,
                                    confidence=int(top_prob * 100),
                                )
                                last_label_emit[label] = now
                                last_any_emit = now

                except Exception as e:
                    # keep worker alive on inference errors
                    print(f"VideoMAE inference error: {e}")

            # short sleep to be responsive to stop event
            time.sleep(0.1)

    except Exception as e:
        print(f"VideoMAE worker exception: {e}")
    finally:
        try:
            if cap is not None:
                cap.release()
        except Exception:
            pass
        # Ensure stop flags are consistent
        VIDEOMAE_STOP_EVENT.clear()
        VIDEOMAE_RUNNING = False


def label_to_status(label: str):
    """
    Convert model label -> UI status based on keywords.
    Works even if label is like 'VMan_with_Knife' or 'Knife_Attack'.
    """
    s = (label or "").lower().replace("-", "_").replace(" ", "_")

    # HIGH risk keywords
    high_kw = [
        "knife", "gun", "weapon", "bomb", "explosive",
        "assault", "fight", "fighting", "attack", "shoot", "shooting",
        "kidnap", "kidnapping", "robbery", "theft", "snatch"
    ]

    # MED risk keywords
    mid_kw = [
        "suspicious", "intrusion", "trespass", "perimeter", "threat"
    ]

    if any(k in s for k in high_kw):
        return "suspicious"
    if any(k in s for k in mid_kw):
        return "warning"
    return "normal"


def missing_person_worker(source="webcam", video_path=None):
    """
    Background worker for continuous missing person detection.
    Reads frames from the source, detects faces, and matches against trained model.
    """
    global MISSING_PERSON_RUNNING, MISSING_PERSON_STOP_EVENT

    try:
        import cv2
        import numpy as np
    except ImportError as e:
        add_event("Error", f"Missing person worker missing libraries: {e}", status="warning")
        MISSING_PERSON_RUNNING = False
        return

    try:
        cascade = load_face_cascade()
    except Exception as e:
        add_event("Error", f"Missing person: failed to load cascade: {e}", status="warning")
        MISSING_PERSON_RUNNING = False
        return

    recognizer, label_mapping = load_lbph_model()
    if recognizer is None or label_mapping is None:
        add_event("Error", "Missing person model not trained. Please train first.", status="warning")
        MISSING_PERSON_RUNNING = False
        return

    persons = load_persons_json()

    # Open capture
    cap = None
    try:
        if source == "webcam":
            try:
                cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
            except Exception:
                cap = cv2.VideoCapture(0)
        elif source == "video":
            if not video_path:
                add_event("Error", "Missing person video source requires video_path", status="warning")
                MISSING_PERSON_RUNNING = False
                return
            abs_path = os.path.join(BASE_DIR, video_path)
            if not os.path.isfile(abs_path):
                add_event("Error", f"Video file not found: {abs_path}", status="warning")
                MISSING_PERSON_RUNNING = False
                return
            cap = cv2.VideoCapture(abs_path)
        else:
            add_event("Error", f"Unknown source for missing person: {source}", status="warning")
            MISSING_PERSON_RUNNING = False
            return

        if cap is None or not cap.isOpened():
            add_event("Error", "Could not open source for missing person detection", status="warning")
            MISSING_PERSON_RUNNING = False
            return
    except Exception as e:
        add_event("Error", f"Failed to open capture for missing person: {e}", status="warning")
        MISSING_PERSON_RUNNING = False
        return

    # Detection parameters
    DISTANCE_THRESHOLD = 110  # face match threshold
    DEDUP_SEC = 300  # per-person cooldown (5 minutes)
    FRAME_SKIP = 5  # process every 5th frame for speed
    
    last_person_emit = {}  # person_name -> timestamp
    frame_counter = 0

    try:
        while not MISSING_PERSON_STOP_EVENT.is_set():
            ret, frame = cap.read()
            if not ret:
                if source == "video":
                    break  # end of video
                else:
                    time.sleep(0.2)
                    continue

            frame_counter += 1
            if frame_counter % FRAME_SKIP != 0:
                continue  # skip frames for performance

            try:
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                faces = cascade.detectMultiScale(gray, 1.2, 5, minSize=(80, 80))

                if len(faces) > 0:
                    for (x, y, w, h) in faces:
                        face_roi = gray[y:y+h, x:x+w]
                        face_roi = cv2.resize(face_roi, (200, 200))

                        label, distance = recognizer.predict(face_roi)

                        if distance < DISTANCE_THRESHOLD:
                            person_key = label_mapping.get(label, "unknown")
                            person_meta = persons.get(person_key, {})
                            person_name = person_meta.get("name", person_key)
                            person_age = person_meta.get("age", "N/A")
                            confidence = int(100 - distance)

                            # Dedup: don't spam alerts for same person
                            now = time.time()
                            last_emit_time = last_person_emit.get(person_name, 0)
                            if now - last_emit_time >= DEDUP_SEC:
                                add_missing_person_alert(
                                    name=person_name,
                                    age=person_age,
                                    confidence=confidence,
                                    person_id=person_key
                                )
                                last_person_emit[person_name] = now

            except Exception as e:
                print(f"Missing person detection error: {e}")
                continue

            # short sleep to be responsive to stop event
            time.sleep(0.01)

    except Exception as e:
        print(f"Missing person worker exception: {e}")
    finally:
        try:
            if cap is not None:
                cap.release()
        except Exception:
            pass
        MISSING_PERSON_STOP_EVENT.clear()
        MISSING_PERSON_RUNNING = False


# ========================================
# Existing Endpoints (unchanged)
# ========================================

@app.route("/test-detection")
def test_detection():
    return jsonify({
        "people_count": 8,
        "mob_alert": True,
        "message": "Mob detected!"
    })


@app.route("/")
def home():
    return jsonify({"status": "Smart Surveillance Backend Running"})


@app.route("/detect-image", methods=["POST"])
def detect_image():
    # used by your frontend overlay polling
    try:
        import cv2
        import numpy as np
    except Exception as e:
        return jsonify({"error": "Required CV libraries not installed", "detail": str(e)}), 500

    file = request.files.get("image")
    if not file:
        return jsonify({"error": "No image provided"}), 400

    img = cv2.imdecode(
        np.frombuffer(file.read(), np.uint8),
        cv2.IMREAD_COLOR
    )

    try:
        person_model = load_person_model()
    except Exception as e:
        return jsonify({"error": "Failed to load person model", "detail": str(e)}), 500

    results = person_model(img)
    people = 0
    boxes_out = []

    for r in results:
        for box in r.boxes:
            cls_id = int(box.cls[0])
            conf = float(box.conf[0]) if hasattr(box, 'conf') else 1.0

            try:
                x1, y1, x2, y2 = [float(v) for v in box.xyxy[0]]
            except Exception:
                continue

            boxes_out.append({
                "class": cls_id,
                "confidence": conf,
                "x1": x1,
                "y1": y1,
                "x2": x2,
                "y2": y2,
            })

            if cls_id == 0:
                people += 1

    alert = people >= MOB_THRESHOLD

    return jsonify({
        "people_count": people,
        "mob_alert": alert,
        "boxes": boxes_out
    })


@app.route("/api/upload", methods=["POST"])
def upload_video():
    if "video" not in request.files:
        return jsonify({"error": "No video file"}), 400

    video = request.files["video"]
    filename = video.filename
    save_path = os.path.join(UPLOAD_FOLDER, filename)
    video.save(save_path)

    rel_path = os.path.relpath(save_path, BASE_DIR)

    return jsonify({
        "message": "Video uploaded successfully",
        "video_path": rel_path
    })


@app.route("/api/mob-detect", methods=["POST"])
def mob_detect():
    data = request.get_json() or {}
    video_path = data.get("video_path")
    if not video_path:
        return jsonify({"error": "video_path is required"}), 400

    abs_path = os.path.join(BASE_DIR, video_path)
    if not os.path.isfile(abs_path):
        return jsonify({"error": "video file not found", "path": abs_path}), 404

    try:
        import cv2
    except Exception as e:
        return jsonify({"error": "Required CV libs not installed", "detail": str(e)}), 500

    cap = cv2.VideoCapture(abs_path)
    if not cap.isOpened():
        return jsonify({"error": "failed to open video"}), 500

    fps = float(cap.get(cv2.CAP_PROP_FPS) or 1.0)
    sample_rate = max(1, int(fps * 2))  # sample every ~2 seconds

    max_people = 0
    frames_processed = 0
    max_samples = 300
    sample_idx = 0

    try:
        person_model = load_person_model()
    except Exception as e:
        cap.release()
        return jsonify({"error": "Failed to load model", "detail": str(e)}), 500

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if sample_idx % sample_rate == 0:
            frames_processed += 1

            try:
                results = person_model(frame)
            except Exception:
                results = []

            people_in_frame = 0
            for r in results:
                for box in r.boxes:
                    if int(box.cls[0]) == 0:
                        people_in_frame += 1

            max_people = max(max_people, people_in_frame)

            if frames_processed >= max_samples:
                break

        sample_idx += 1

    cap.release()

    alert = max_people >= MOB_THRESHOLD

    return jsonify({
        "people_count": max_people,
        "mob_alert": alert,
        "frames_sampled": frames_processed,
        "video_path": video_path
    })


@app.route("/api/suspicious-detect", methods=["POST"])
def suspicious_detect():
    """
    Uses legacy YOLO suspicious model to analyze an uploaded video (batch mode).
    This endpoint is left intact and unchanged in purpose; VideoMAE is used
    for live detection/event creation.
    """
    data = request.get_json() or {}
    video_path = data.get("video_path")
    if not video_path:
        return jsonify({"error": "video_path is required"}), 400

    abs_path = os.path.join(BASE_DIR, video_path)
    if not os.path.isfile(abs_path):
        return jsonify({"error": "video file not found", "path": abs_path}), 404

    try:
        import cv2
    except Exception as e:
        return jsonify({"error": "Required CV libs not installed", "detail": str(e)}), 500

    cap = cv2.VideoCapture(abs_path)
    if not cap.isOpened():
        return jsonify({"error": "failed to open video"}), 500

    fps = float(cap.get(cv2.CAP_PROP_FPS) or 15.0)
    sample_rate = max(1, int(fps * 2))  # sample every ~2 seconds

    try:
        s_model = load_suspicious_model()
        names = s_model.names
    except Exception as e:
        cap.release()
        return jsonify({"error": "Failed to load suspicious model", "detail": str(e)}), 500

    # ✅ NORMAL SETTINGS (avoid spam)
    CONF_TH = 0.60
    COOLDOWN_SEC = 30

    frames_processed = 0
    max_samples = 300
    sample_idx = 0
    start_wall = time.time()

    last_emit = {}  # label -> timestamp

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if sample_idx % sample_rate == 0:
            frames_processed += 1

            try:
                results = s_model(frame, verbose=False)
            except Exception:
                results = []

            for r in results:
                for b in getattr(r, "boxes", []):
                    cls_id = int(b.cls[0])
                    conf = float(b.conf[0]) if hasattr(b, "conf") else 1.0
                    if conf < CONF_TH:
                        continue

                    raw_label = names.get(cls_id, str(cls_id))
                    label = clean_label(raw_label)

                    if label == "People":
                        continue

                    now_t = time.time()
                    if (label in last_emit) and (now_t - last_emit[label] < COOLDOWN_SEC):
                        continue

                    add_event(
                        event_type=label,
                        description=f"{label} detected by suspicious YOLO model",
                        location="Uploaded Video",
                        status=label_to_status(label),
                        confidence=int(conf * 100),
                    )
                    last_emit[label] = now_t

            if frames_processed >= max_samples:
                break

        sample_idx += 1

    cap.release()
    runtime_sec = round(time.time() - start_wall, 2)

    return jsonify({
        "message": "Suspicious detection completed (YOLO suspicious model)",
        "video_path": video_path,
        "frames_sampled": frames_processed,
        "runtime_sec": runtime_sec,
        "events_total": len(SUSPICIOUS_EVENTS),
        "latest_events": list(reversed(SUSPICIOUS_EVENTS))[:10],
    })


@app.route("/api/videomae/start", methods=["POST"])
def videomae_start():
    """
    Start VideoMAE detection on webcam or uploaded video.
    Body:
      { "source": "webcam" }
    or:
      { "source": "video", "video_path": "videos/xxx.mp4" }
    """
    global VIDEOMAE_RUNNING, VIDEOMAE_STOP_EVENT, VIDEOMAE_THREAD, VIDEOMAE_SOURCE, VIDEOMAE_VIDEO_PATH

    with VIDEOMAE_LOCK:
        if VIDEOMAE_RUNNING:
            return jsonify({"running": True, "message": "VideoMAE detection already running"})

        data = request.get_json() or {}
        source = data.get("source")

        if source not in ["webcam", "video"]:
            return jsonify({"error": "source must be 'webcam' or 'video'"}), 400

        if source == "video":
            video_path = data.get("video_path")
            if not video_path:
                return jsonify({"error": "video_path required when source=video"}), 400
            abs_path = os.path.join(BASE_DIR, video_path)
            if not os.path.isfile(abs_path):
                return jsonify({"error": "video file not found", "path": abs_path}), 404
            VIDEOMAE_VIDEO_PATH = video_path
        else:
            VIDEOMAE_VIDEO_PATH = None

        # Try to load model first (fail fast if dependencies missing)
        try:
            load_videomae_model()
        except Exception as e:
            return jsonify({
                "error": "VideoMAE model not available",
                "detail": str(e)
            }), 500

        VIDEOMAE_SOURCE = source
        VIDEOMAE_STOP_EVENT.clear()
        VIDEOMAE_RUNNING = True
        VIDEOMAE_THREAD = threading.Thread(target=videomae_worker, args=(VIDEOMAE_SOURCE, VIDEOMAE_VIDEO_PATH), daemon=True)
        VIDEOMAE_THREAD.start()

        return jsonify({"running": True, "source": VIDEOMAE_SOURCE, "video_path": VIDEOMAE_VIDEO_PATH})


@app.route("/api/videomae/stop", methods=["POST"])
def videomae_stop():
    """Stop VideoMAE detection reliably and release video/webcam resources."""
    global VIDEOMAE_RUNNING, VIDEOMAE_THREAD, VIDEOMAE_STOP_EVENT

    with VIDEOMAE_LOCK:
        if not VIDEOMAE_RUNNING:
            return jsonify({"running": False, "message": "VideoMAE already stopped"})

        # signal worker to stop
        VIDEOMAE_STOP_EVENT.set()
        VIDEOMAE_RUNNING = False

        # Attempt to join the worker (short timeout to avoid hanging)
        if VIDEOMAE_THREAD and VIDEOMAE_THREAD.is_alive():
            try:
                VIDEOMAE_THREAD.join(timeout=3)
            except Exception:
                pass

        VIDEOMAE_THREAD = None

    return jsonify({"stopped": True})


@app.route("/api/videomae/status", methods=["GET"])
def videomae_status():
    """Get VideoMAE detection status."""
    return jsonify({
        "running": VIDEOMAE_RUNNING,
        "source": VIDEOMAE_SOURCE,
        "video_path": VIDEOMAE_VIDEO_PATH
    })


@app.route("/suspicious/events", methods=["GET"])
def get_suspicious_events():
    return jsonify({"events": list(reversed(SUSPICIOUS_EVENTS))})


@app.route("/suspicious/reset", methods=["POST"])
def reset_suspicious_events():
    SUSPICIOUS_EVENTS.clear()
    return jsonify({"message": "Suspicious events cleared", "count": 0})


@app.route("/stream/suspicious")
def stream_suspicious():
    """
    MJPEG preview stream (preview-only, no detection/events).
    /stream/suspicious?source=webcam
    /stream/suspicious?source=video&video_path=videos/xxx.mp4

    The stream is intentionally a preview-only endpoint and MUST NOT create
    events. It releases the capture when the client disconnects.
    """
    source = request.args.get("source", "webcam")
    video_path = request.args.get("video_path")

    try:
        import cv2
    except Exception as e:
        return jsonify({"error": "Required CV libraries not installed", "detail": str(e)}), 500

    # open capture
    cap = None
    try:
        if source == "video":
            if not video_path:
                return jsonify({"error": "video_path is required when source=video"}), 400
            abs_path = os.path.join(BASE_DIR, video_path)
            if not os.path.isfile(abs_path):
                return jsonify({"error": "video file not found", "path": abs_path}), 404
            cap = cv2.VideoCapture(abs_path)
        else:
            # webcam
            try:
                cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
            except Exception:
                cap = cv2.VideoCapture(0)

        if cap is None or not cap.isOpened():
            return jsonify({"error": "Could not open source", "source": source}), 500
    except Exception as e:
        return jsonify({"error": "Failed to open capture", "detail": str(e)}), 500

    def gen_frames():
        try:
            while True:
                ok, frame = cap.read()
                if not ok:
                    break

                ok2, buffer = cv2.imencode(".jpg", frame)
                if not ok2:
                    continue

                yield (b"--frame\r\n"
                       b"Content-Type: image/jpeg\r\n\r\n" + buffer.tobytes() + b"\r\n")
        finally:
            try:
                cap.release()
            except Exception:
                pass

    return app.response_class(
        gen_frames(),
        mimetype="multipart/x-mixed-replace; boundary=frame"
    )


# ========================================
# NEW Missing Person Endpoints
# ========================================

@app.route("/api/missing/register", methods=["POST"])
def missing_register():
    """
    Register a missing person with face images.
    multipart/form-data fields: name, age, images (multiple files)
    """
    try:
        import cv2
        import numpy as np
    except Exception as e:
        return jsonify({"error": "opencv-contrib-python required", "detail": str(e)}), 500

    name = request.form.get("name", "").strip()
    age = request.form.get("age", "").strip()
    images = request.files.getlist("images")

    if not name:
        return jsonify({"error": "name is required"}), 400
    if not images or len(images) == 0:
        return jsonify({"error": "at least one image is required"}), 400

    # Ensure directories
    mp_ensure_dirs()

    # Create safe folder name
    safe_name = "".join(c if c.isalnum() or c in "-_" else "_" for c in name.lower())
    person_dir = os.path.join(mp_paths()["dataset"], safe_name)
    os.makedirs(person_dir, exist_ok=True)

    images_saved = 0
    for img_file in images:
        if not img_file or img_file.filename == "":
            continue

        try:
            img_data = img_file.read()
            img_array = np.frombuffer(img_data, np.uint8)
            img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)

            if img is None:
                continue

            # Save with unique name
            filename = f"{safe_name}_{uuid.uuid4().hex[:8]}.jpg"
            filepath = os.path.join(person_dir, filename)
            cv2.imwrite(filepath, img)
            images_saved += 1
        except Exception:
            continue

    if images_saved == 0:
        return jsonify({"error": "Failed to save any images"}), 400

    # Update persons.json
    persons = load_persons_json()
    persons[safe_name] = {"name": name, "age": age}
    save_persons_json(persons)

    return jsonify({
        "message": f"Person '{name}' registered successfully",
        "person_name": name,
        "images_saved": images_saved
    })


@app.route("/api/missing/train", methods=["POST"])
def missing_train():
    """
    Train LBPH face recognizer on all registered persons.
    """
    try:
        import cv2
        import numpy as np
    except Exception as e:
        return jsonify({"error": "opencv-contrib-python required", "detail": str(e)}), 500

    mp_ensure_dirs()

    # Load cascade
    try:
        cascade = load_face_cascade()
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    # Collect images and labels
    faces_list = []
    labels_list = []
    label_mapping = {}
    label_counter = 0

    dataset_dir = mp_paths()["dataset"]
    if not os.path.isdir(dataset_dir):
        return jsonify({"error": "No dataset directory found"}), 400

    for person_folder in os.listdir(dataset_dir):
        person_path = os.path.join(dataset_dir, person_folder)
        if not os.path.isdir(person_path):
            continue

        label_mapping[label_counter] = person_folder
        image_count = 0

        for img_file in os.listdir(person_path):
            img_path = os.path.join(person_path, img_file)
            try:
                img = cv2.imread(img_path)
                if img is None:
                    continue

                gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                faces = cascade.detectMultiScale(gray, 1.3, 5)

                for (x, y, w, h) in faces:
                    face_roi = gray[y:y+h, x:x+w]
                    face_roi = cv2.resize(face_roi, (200, 200))
                    faces_list.append(face_roi)
                    labels_list.append(label_counter)
                    image_count += 1
            except Exception:
                continue

        if image_count > 0:
            label_counter += 1

    if len(faces_list) == 0:
        return jsonify({
            "error": "No faces found in dataset. Ensure images contain clear frontal faces."
        }), 400

    # Train LBPH recognizer
    try:
        recognizer = cv2.face.LBPHFaceRecognizer_create()
        recognizer.train(np.array(faces_list), np.array(labels_list))

        # Save model
        trainer_dir = mp_paths()["trainer"]
        model_path = os.path.join(trainer_dir, "face_trainer.yml")
        labels_path = os.path.join(trainer_dir, "labels.npy")

        recognizer.write(model_path)
        np.save(labels_path, label_mapping)

        # Invalidate cache so next detect loads new model
        invalidate_lbph_cache()

        return jsonify({
            "message": "Model trained successfully",
            "persons_count": label_counter,
            "images_used": len(faces_list)
        })
    except Exception as e:
        return jsonify({"error": f"Training failed: {str(e)}"}), 500


@app.route("/api/missing/detect-image", methods=["POST"])
def missing_detect_image():
    """
    Detect missing persons in a frame.
    Returns all detected faces with their match status and info.
    multipart/form-data field: image
    """
    try:
        import cv2
        import numpy as np
    except Exception as e:
        return jsonify({"error": "opencv-contrib-python required", "detail": str(e)}), 500

    file = request.files.get("image")
    if not file:
        return jsonify({"error": "image field required"}), 400

    img_array = np.frombuffer(file.read(), np.uint8)
    frame = cv2.imdecode(img_array, cv2.IMREAD_COLOR)

    if frame is None:
        return jsonify({"error": "Invalid image"}), 400

    # Load models
    try:
        cascade = load_face_cascade()
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    recognizer, label_mapping = load_lbph_model()
    if recognizer is None:
        return jsonify({
            "error": "Model not trained. Train first.",
            "found": False,
            "detections": []
        }), 400

    persons = load_persons_json()

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    # Better detection settings
    faces = cascade.detectMultiScale(
        gray,
        scaleFactor=1.2,
        minNeighbors=5,
        minSize=(80, 80)
    )

    DISTANCE_THRESHOLD = 100   # face match threshold

    detections = []  # List of all detected faces
    best_match = None
    best_distance = 999

    # Analyze each detected face
    for (x, y, w, h) in faces:
        face_roi = gray[y:y+h, x:x+w]
        face_roi = cv2.resize(face_roi, (200, 200))

        label, distance = recognizer.predict(face_roi)

        is_match = distance < DISTANCE_THRESHOLD
        
        if is_match:
            key = label_mapping.get(label, "unknown")
            meta = persons.get(key, {})
            person_name = meta.get("name", key)
            person_age = meta.get("age", "N/A")
            confidence = int(100 - distance)

            detection_info = {
                "found": True,
                "name": person_name,
                "age": person_age,
                "confidence": confidence,
                "bbox": [int(x), int(y), int(w), int(h)],
                "person_id": key
            }
            detections.append(detection_info)

            # Track best match
            if distance < best_distance:
                best_distance = distance
                best_match = detection_info
        else:
            # Face detected but no match (normal face)
            detections.append({
                "found": False,
                "confidence": int(max(0, 100 - distance)),
                "bbox": [int(x), int(y), int(w), int(h)]
            })

    # If we have matches, create alert for best match only
    if best_match:
        add_missing_person_alert(
            name=best_match["name"],
            age=best_match["age"],
            confidence=best_match["confidence"],
            person_id=best_match["person_id"]
        )

    # Return all detections (frontend will show current matches)
    return jsonify({
        "found": len([d for d in detections if d.get("found")]) > 0,
        "detections": detections,
        "best_match": best_match
    })

# ========================================
# Missing Person Detection Endpoints
# ========================================

@app.route("/api/missing/start-detection", methods=["POST"])
def missing_start_detection():
    """
    Start continuous missing person detection on webcam or video.
    Body: { "source": "webcam" } or { "source": "video", "video_path": "..." }
    """
    global MISSING_PERSON_RUNNING, MISSING_PERSON_STOP_EVENT, MISSING_PERSON_THREAD, MISSING_PERSON_SOURCE, MISSING_PERSON_VIDEO_PATH

    with MISSING_PERSON_LOCK:
        if MISSING_PERSON_RUNNING:
            return jsonify({"running": True, "message": "Missing person detection already running"})

        data = request.get_json() or {}
        source = data.get("source", "webcam")

        if source not in ["webcam", "video"]:
            return jsonify({"error": "source must be 'webcam' or 'video'"}), 400

        if source == "video":
            video_path = data.get("video_path")
            if not video_path:
                return jsonify({"error": "video_path required when source=video"}), 400
            abs_path = os.path.join(BASE_DIR, video_path)
            if not os.path.isfile(abs_path):
                return jsonify({"error": "video file not found", "path": abs_path}), 404
            MISSING_PERSON_VIDEO_PATH = video_path
        else:
            MISSING_PERSON_VIDEO_PATH = None

        MISSING_PERSON_SOURCE = source
        MISSING_PERSON_STOP_EVENT.clear()
        MISSING_PERSON_RUNNING = True
        MISSING_PERSON_THREAD = threading.Thread(
            target=missing_person_worker, 
            args=(MISSING_PERSON_SOURCE, MISSING_PERSON_VIDEO_PATH), 
            daemon=True
        )
        MISSING_PERSON_THREAD.start()

        return jsonify({
            "running": True,
            "source": MISSING_PERSON_SOURCE,
            "video_path": MISSING_PERSON_VIDEO_PATH,
            "message": f"Missing person detection started on {source}"
        })


@app.route("/api/missing/stop-detection", methods=["POST"])
def missing_stop_detection():
    """Stop missing person detection."""
    global MISSING_PERSON_RUNNING, MISSING_PERSON_THREAD, MISSING_PERSON_STOP_EVENT

    with MISSING_PERSON_LOCK:
        if not MISSING_PERSON_RUNNING:
            return jsonify({"running": False, "message": "Detection already stopped"})

        MISSING_PERSON_STOP_EVENT.set()
        MISSING_PERSON_RUNNING = False

        if MISSING_PERSON_THREAD and MISSING_PERSON_THREAD.is_alive():
            try:
                MISSING_PERSON_THREAD.join(timeout=3)
            except Exception:
                pass

        MISSING_PERSON_THREAD = None

    return jsonify({"stopped": True, "message": "Missing person detection stopped"})


@app.route("/api/missing/detection-status", methods=["GET"])
def missing_detection_status():
    """Get missing person detection status."""
    return jsonify({
        "running": MISSING_PERSON_RUNNING,
        "source": MISSING_PERSON_SOURCE,
        "video_path": MISSING_PERSON_VIDEO_PATH
    })


@app.route("/api/missing/alerts", methods=["GET"])
def get_missing_alerts():
    """Get all missing person detection alerts."""
    return jsonify({
        "alerts": list(reversed(MISSING_PERSON_ALERTS)),
        "total": len(MISSING_PERSON_ALERTS)
    })


@app.route("/api/missing/alerts/clear", methods=["POST"])
def clear_missing_alerts():
    """Clear all missing person alerts."""
    MISSING_PERSON_ALERTS.clear()
    return jsonify({"message": "Missing person alerts cleared", "count": 0})


@app.route("/api/missing/alerts/latest", methods=["GET"])
def get_latest_missing_alert():
    """Get latest missing person alert (if any)."""
    if MISSING_PERSON_ALERTS:
        return jsonify({"alert": MISSING_PERSON_ALERTS[-1]})
    return jsonify({"alert": None})


if __name__ == "__main__":
    app.run(debug=True)
