# Local setup and run instructions (Frontend + Backend)

This file describes how to run the frontend and backend locally for development.

## Ports
- Frontend (Vite dev server): 8080
- Backend (Flask): 5000

## Backend (Python)
Recommended: create and activate a virtual environment inside `Backend`.

PowerShell commands:

```powershell
cd Backend
python -m venv .venv; .\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
python smart_surveillance.py
```

Notes:
- `requirements.txt` lives in `Backend/requirements.txt` and includes `ultralytics` which may pull `torch`. If you need a specific torch wheel (CPU vs GPU), install it prior to `ultralytics`.
- If you don't want to install heavy CV/model libs, the server exposes a lightweight test endpoint `/test-detection` that doesn't require them.

## Frontend (Node)
From the project root:

```powershell
npm install
npm run dev
```

The frontend reads the backend URL from `VITE_BACKEND_URL` via `import.meta.env`; a development env file `.env.development` pointing to `http://127.0.0.1:5000` is included.

## API endpoints
- GET `/test-detection` — test JSON response (fast, no heavy deps).
- POST `/api/upload` — multipart form field `video`. Saves file to `Backend/videos` and returns `{ message, video_path }`.
- POST `/api/mob-detect` — JSON body `{ "video_path": "videos/yourfile.mp4" }`. Runs sampled detection and returns `{ people_count, mob_alert, frames_sampled, video_path }`.

## Quick smoke test (already executed)
A small smoke-test script `Backend/test_smoke.py` was added and executed during development. It:
- creates `Backend/videos/test_smoke.mp4` (synthetic frames),
- uploads it to `/api/upload`,
- calls `/api/mob-detect` and prints the result.

Results from the smoke test (example):

```
Upload status: 200
{
  "message": "Video uploaded successfully",
  "video_path": "videos\\test_smoke.mp4"
}

mob-detect status: 200
{
  "frames_sampled": 2,
  "mob_alert": false,
  "people_count": 0,
  "video_path": "videos\\test_smoke.mp4"
}
```

## Next recommended improvements
- Add UI to display detection results in the dashboard instead of console logs.
- Add authentication and validation if exposing the API beyond local dev.
- Consider running expensive detection tasks asynchronously (Celery / background worker) for large videos.

