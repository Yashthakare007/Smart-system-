from flask import Flask, request, jsonify
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = "videos"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "Backend running"})

@app.route("/api/upload", methods=["POST"])
def upload_video():
    if "video" not in request.files:
        return jsonify({"error": "No video file"}), 400

    video = request.files["video"]
    path = os.path.join(UPLOAD_FOLDER, video.filename)
    video.save(path)

    return jsonify({
        "message": "Video uploaded successfully",
        "video_path": path
    })

if __name__ == "__main__":
    app.run(debug=True)
