from flask import Flask, jsonify, request
from flask_cors import CORS
import os
import time
import math
import uuid
from datetime import datetime

# Note: heavy computer-vision libraries (cv2, ultralytics) are imported lazily
# inside the endpoints that need them so lightweight endpoints (health/test)
# can run without installing them during development.

app = Flask(__name__)
CORS(app)  # VERY IMPORTANT for frontend connection

BASE_DIR = os.path.dirname(__file__)
model = None  # YOLO model loaded on demand

# Ensure uploads folder exists for saved videos
UPLOAD_FOLDER = os.path.join(BASE_DIR, "videos")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

MOB_THRESHOLD = 6

# ----------------------------
# Suspicious Activity (in-memory)
# ----------------------------
SUSPICIOUS_EVENTS = []  # list of dicts (most recent last)
MAX_EVENTS = 200

# Tunable thresholds
LOITER_SECONDS = 12
RUN_SPEED_PX_PER_SEC = 220
PERIMETER_MARGIN = 40
CLOSE_DISTANCE_PX = 80
ALTERCATION_MIN_HITS = 3

UNATTENDED_CLASSES = {24: "Backpack", 26: "Handbag", 28: "Suitcase"}
UNATTENDED_SECONDS = 12


def _now_iso():
    return datetime.now().isoformat(timespec="seconds")


def add_event(event_type, description, location="Unknown", status="warning", confidence=60):
    evt = {
        "id": str(uuid.uuid4())[:8],
        "type": event_type,
        "description": description,
        "location": location,
        "time": _now_iso(),
        "status": status,
        "confidence": int(confidence),
    }
    SUSPICIOUS_EVENTS.append(evt)
    if len(SUSPICIOUS_EVENTS) > MAX_EVENTS:
        del SUSPICIOUS_EVENTS[: len(SUSPICIOUS_EVENTS) - MAX_EVENTS]
    return evt


def _centroid(x1, y1, x2, y2):
    return ((x1 + x2) / 2.0, (y1 + y2) / 2.0)


def _dist(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


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
    try:
        import cv2
        import numpy as np
        from ultralytics import YOLO
    except Exception as e:
        return jsonify({"error": "Required CV libraries not installed", "detail": str(e)}), 500

    file = request.files.get("image")
    if not file:
        return jsonify({"error": "No image provided"}), 400

    img = cv2.imdecode(
        np.frombuffer(file.read(), np.uint8),
        cv2.IMREAD_COLOR
    )

    global model
    if model is None:
        try:
            model = YOLO(os.path.join(BASE_DIR, "yolov8n.pt"))
        except Exception as e:
            return jsonify({"error": "Failed to load model", "detail": str(e)}), 500

    results = model(img)
    people = 0
    boxes_out = []

    for r in results:
        for box in r.boxes:
            cls_id = int(box.cls[0])
            conf = float(box.conf[0]) if hasattr(box, 'conf') else 1.0
            try:
                x1, y1, x2, y2 = [float(v) for v in box.xyxy[0]]
            except Exception:
                try:
                    cx, cy, w, h = [float(v) for v in box.xywh[0]]
                    x1 = cx - w / 2
                    y1 = cy - h / 2
                    x2 = cx + w / 2
                    y2 = cy + h / 2
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
        from ultralytics import YOLO
    except Exception as e:
        return jsonify({"error": "Required CV/model libraries not installed", "detail": str(e)}), 500

    cap = cv2.VideoCapture(abs_path)
    if not cap.isOpened():
        return jsonify({"error": "failed to open video"}), 500

    fps = float(cap.get(cv2.CAP_PROP_FPS) or 1.0)
    sample_rate = max(1, int(fps * 2))  # sample every ~2 seconds

    max_people = 0
    frames_processed = 0
    max_samples = 300
    sample_idx = 0

    global model
    if model is None:
        try:
            model = YOLO(os.path.join(BASE_DIR, "yolov8n.pt"))
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
                results = model(frame)
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
    data = request.get_json() or {}
    video_path = data.get("video_path")
    if not video_path:
        return jsonify({"error": "video_path is required"}), 400

    abs_path = os.path.join(BASE_DIR, video_path)
    if not os.path.isfile(abs_path):
        return jsonify({"error": "video file not found", "path": abs_path}), 404

    try:
        import cv2
        from ultralytics import YOLO
    except Exception as e:
        return jsonify({"error": "Required CV/model libraries not installed", "detail": str(e)}), 500

    cap = cv2.VideoCapture(abs_path)
    if not cap.isOpened():
        return jsonify({"error": "failed to open video"}), 500

    fps = float(cap.get(cv2.CAP_PROP_FPS) or 15.0)
    sample_rate = max(1, int(fps * 2))  # sample every ~2 seconds

    global model
    if model is None:
        try:
            model = YOLO(os.path.join(BASE_DIR, "yolov8n.pt"))
        except Exception as e:
            cap.release()
            return jsonify({"error": "Failed to load model", "detail": str(e)}), 500

    tracks = {}
    next_tid = 1

    obj_tracks = {}
    next_oid = 1

    altercation_hits = 0

    frames_processed = 0
    max_samples = 300
    sample_idx = 0
    start_wall = time.time()

    def assign_tracks(detections, now_t):
        nonlocal next_tid
        assigned = []
        used = set()

        for det in detections:
            best_tid = None
            best_d = 1e18
            for tid, tr in tracks.items():
                if tid in used:
                    continue
                d = _dist(det, tr["pos"])
                if d < best_d:
                    best_d = d
                    best_tid = tid

            if best_tid is not None and best_d < 90:
                used.add(best_tid)
                tr = tracks[best_tid]
                tr["pos"] = det
                tr["last_t"] = now_t
                assigned.append(best_tid)
            else:
                tid = next_tid
                next_tid += 1
                tracks[tid] = {
                    "pos": det,
                    "start_t": now_t,
                    "last_t": now_t,
                    "prev_pos": det,
                    "running": False,
                    "loitered": False,
                }
                used.add(tid)
                assigned.append(tid)

        stale = [tid for tid, tr in tracks.items() if (now_t - tr["last_t"]) > 10]
        for tid in stale:
            tracks.pop(tid, None)

        return assigned

    def assign_objects(obj_dets, now_t):
        nonlocal next_oid
        used = set()

        for det_pos, label in obj_dets:
            best_oid = None
            best_d = 1e18
            for oid, tr in obj_tracks.items():
                if oid in used:
                    continue
                d = _dist(det_pos, tr["pos"])
                if d < best_d:
                    best_d = d
                    best_oid = oid

            if best_oid is not None and best_d < 80:
                used.add(best_oid)
                tr = obj_tracks[best_oid]
                tr["pos"] = det_pos
                tr["last_t"] = now_t
            else:
                oid = next_oid
                next_oid += 1
                obj_tracks[oid] = {
                    "pos": det_pos,
                    "start_t": now_t,
                    "last_t": now_t,
                    "label": label,
                    "flagged": False,
                }
                used.add(oid)

        stale = [oid for oid, tr in obj_tracks.items() if (now_t - tr["last_t"]) > 10]
        for oid in stale:
            obj_tracks.pop(oid, None)

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if sample_idx % sample_rate == 0:
            frames_processed += 1
            now_t = time.time()

            h, w = frame.shape[:2]

            try:
                results = model(frame)
            except Exception:
                results = []

            people_centroids = []
            obj_centroids = []

            for r in results:
                for box in r.boxes:
                    cls_id = int(box.cls[0])
                    conf = float(box.conf[0]) if hasattr(box, "conf") else 1.0
                    if conf < 0.35:
                        continue

                    try:
                        x1, y1, x2, y2 = [float(v) for v in box.xyxy[0]]
                    except Exception:
                        continue

                    cx, cy = _centroid(x1, y1, x2, y2)

                    if cls_id == 0:
                        people_centroids.append((cx, cy))
                    elif cls_id in UNATTENDED_CLASSES:
                        obj_centroids.append(((cx, cy), UNATTENDED_CLASSES[cls_id]))

            assigned_tids = assign_tracks(people_centroids, now_t)
            assign_objects(obj_centroids, now_t)

            # 1) Perimeter breach
            for tid in assigned_tids:
                tr = tracks.get(tid)
                if not tr:
                    continue
                x, y = tr["pos"]
                near_edge = (x < PERIMETER_MARGIN or y < PERIMETER_MARGIN or
                             x > (w - PERIMETER_MARGIN) or y > (h - PERIMETER_MARGIN))
                if near_edge:
                    add_event("Perimeter Breach Attempt",
                              "Movement detected near boundary perimeter",
                              location="Zone D - Perimeter",
                              status="warning",
                              confidence=60)

            # 2) Running
            approx_dt = max(0.5, (sample_rate / max(1.0, fps)))
            for tid in assigned_tids:
                tr = tracks.get(tid)
                if not tr:
                    continue
                prev = tr.get("prev_pos", tr["pos"])
                spd = _dist(tr["pos"], prev) / approx_dt
                tr["prev_pos"] = tr["pos"]

                if spd > RUN_SPEED_PX_PER_SEC and not tr["running"]:
                    tr["running"] = True
                    add_event("Running Detection",
                              "Individual moving at unusually high speed (possible running)",
                              location="Zone A - Corridor",
                              status="suspicious",
                              confidence=85)

            # 3) Loitering
            for tid, tr in list(tracks.items()):
                if tr["loitered"]:
                    continue
                dwell = now_t - tr["start_t"]
                if dwell >= LOITER_SECONDS:
                    tr["loitered"] = True
                    add_event("Abnormal Behavior",
                              "Unusual loitering detected for extended duration",
                              location="Zone B - Storage",
                              status="suspicious",
                              confidence=80)

            # 4) Altercation heuristic
            if len(people_centroids) >= 2:
                close_pairs = 0
                for i in range(len(people_centroids)):
                    for j in range(i + 1, len(people_centroids)):
                        if _dist(people_centroids[i], people_centroids[j]) < CLOSE_DISTANCE_PX:
                            close_pairs += 1

                if close_pairs > 0:
                    altercation_hits += 1
                else:
                    altercation_hits = max(0, altercation_hits - 1)

                if altercation_hits >= ALTERCATION_MIN_HITS:
                    altercation_hits = 0
                    add_event("Possible Altercation",
                              "Two or more individuals remain in close proximity (potential conflict)",
                              location="Zone A - Main Hall",
                              status="warning",
                              confidence=72)

            # 5) Unattended object
            for oid, tr in list(obj_tracks.items()):
                if tr["flagged"]:
                    continue
                dwell = now_t - tr["start_t"]
                if dwell >= UNATTENDED_SECONDS:
                    tr["flagged"] = True
                    add_event("Unattended Object",
                              f"Stationary {tr['label']} detected for extended period",
                              location="Zone C - Entrance",
                              status="suspicious",
                              confidence=70)

            if frames_processed >= max_samples:
                break

        sample_idx += 1

    cap.release()

    runtime_sec = round(time.time() - start_wall, 2)

    return jsonify({
        "message": "Suspicious detection completed",
        "video_path": video_path,
        "frames_sampled": frames_processed,
        "runtime_sec": runtime_sec,
        "events_total": len(SUSPICIOUS_EVENTS),
        "latest_events": list(reversed(SUSPICIOUS_EVENTS))[:10],
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
    MJPEG stream:
      /stream/suspicious?source=webcam
      /stream/suspicious?source=video&video_path=videos/your.mp4
    """
    source = request.args.get("source", "webcam")
    video_path = request.args.get("video_path")

    try:
        import cv2
        from ultralytics import YOLO
    except Exception as e:
        return jsonify({"error": "Required CV/model libraries not installed", "detail": str(e)}), 500

    global model
    if model is None:
        try:
            model = YOLO(os.path.join(BASE_DIR, "yolov8n.pt"))
        except Exception as e:
            return jsonify({"error": "Failed to load model", "detail": str(e)}), 500

    # open capture
    if source == "video":
        if not video_path:
            return jsonify({"error": "video_path is required when source=video"}), 400
        abs_path = os.path.join(BASE_DIR, video_path)
        if not os.path.isfile(abs_path):
            return jsonify({"error": "video file not found", "path": abs_path}), 404
        cap = cv2.VideoCapture(abs_path)
    else:
        # Windows sometimes needs CAP_DSHOW:
        # cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
        cap = cv2.VideoCapture(0)

    if not cap.isOpened():
        return jsonify({"error": "Could not open source", "source": source}), 500

    def gen_frames():
        try:
            while True:
                ok, frame = cap.read()
                if not ok:
                    break

                # draw persons (so preview is visible)
                try:
                    results = model(frame)
                    for r in results:
                        for b in r.boxes:
                            cls_id = int(b.cls[0])
                            conf = float(b.conf[0]) if hasattr(b, "conf") else 1.0
                            if cls_id != 0 or conf < 0.35:
                                continue
                            x1, y1, x2, y2 = [float(v) for v in b.xyxy[0]]
                            cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), (0, 255, 0), 2)
                            cv2.putText(
                                frame, f"person {conf:.2f}",
                                (int(x1), max(20, int(y1) - 10)),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2
                            )
                except Exception:
                    pass

                ok2, buffer = cv2.imencode(".jpg", frame)
                if not ok2:
                    continue

                yield (b"--frame\r\n"
                       b"Content-Type: image/jpeg\r\n\r\n" + buffer.tobytes() + b"\r\n")
        finally:
            cap.release()

    return app.response_class(
        gen_frames(),
        mimetype="multipart/x-mixed-replace; boundary=frame"
    )


if __name__ == "__main__":
    app.run(debug=True)
