import cv2
import numpy as np
import requests
from pathlib import Path
import time

BASE = Path(__file__).parent
VIDEOS_DIR = BASE / "videos"
VIDEOS_DIR.mkdir(parents=True, exist_ok=True)

video_file = VIDEOS_DIR / "test_smoke.mp4"

# create a short synthetic video (30 frames)
fourcc = cv2.VideoWriter_fourcc(*"mp4v")
out = cv2.VideoWriter(str(video_file), fourcc, 10.0, (640, 480))
for i in range(30):
    frame = np.full((480, 640, 3), 255, dtype=np.uint8)
    # draw a moving rectangle to exercise processing
    x = 50 + (i * 10) % 500
    cv2.rectangle(frame, (x, 100), (x + 80, 300), (0, 128, 255), -1)
    cv2.putText(frame, f"Frame {i}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0,0,0), 2)
    out.write(frame)
out.release()

print("Created video:", video_file)

# short sleep to ensure file flush
time.sleep(0.5)

BACKEND = "http://127.0.0.1:5000"

# Upload
with open(video_file, "rb") as f:
    files = {"video": (video_file.name, f, "video/mp4")}
    print("Uploading...")
    r = requests.post(f"{BACKEND}/api/upload", files=files)
    print("Upload status:", r.status_code)
    print(r.text)
    resp = r.json()

video_path = resp.get("video_path")
if not video_path:
    print("Upload did not return video_path, aborting")
    raise SystemExit(1)

# Trigger detection
print("Calling mob-detect with:", video_path)
rd = requests.post(f"{BACKEND}/api/mob-detect", json={"video_path": video_path}, timeout=600)
print("mob-detect status:", rd.status_code)
print(rd.text)
