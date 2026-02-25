# Activity Detection Debugging Fix

## Issues Found & Fixed

### 1. **Missing Dependencies** ✓ FIXED
**Problem**: The `requirements.txt` was missing `torch` and `transformers` packages, which are essential for VideoMAE model loading.

**Fix Applied**:
- Added `torch` to requirements.txt
- Added `transformers` to requirements.txt  
- Run: `pip install -r requirements.txt --upgrade`

### 2. **High Confidence Threshold** ✓ FIXED
**Problem**: Confidence threshold was set to 0.70 (70%), which was too strict and filtered out valid detections.

**Fix Applied**:
- Reduced from `CONF_THRESHOLD = 0.70` to `CONF_THRESHOLD = 0.50`
- This allows activities with 50% confidence to trigger events

### 3. **Strict Cooldown Periods** ✓ FIXED
**Problem**: Detection was being throttled too much:
- `ANY_COOLDOWN = 2` - Prevented events within 2 seconds of each other
- `DEDUP_SEC = 10` - Per-activity cooldown was 10 seconds

**Fix Applied**:
- Reduced `ANY_COOLDOWN` from 2 to 1 second
- Reduced `DEDUP_SEC` from 10 to 5 seconds
- Increased `CLIP_INTERVAL_SEC` from 2 to 1 second for faster detection

### 4. **Poor Error Reporting** ✓ FIXED
**Problem**: Inference errors were silently ignored, making it hard to debug.

**Fix Applied**:
- Added debug print statements showing detection results
- Added traceback printing for exceptions
- Added logging events for inference failures

### 5. **Status Classification** ✓ FIXED
**Problem**: `videomae_label_to_status()` was returning "warning" as default instead of "normal".

**Fix Applied**:
- Added more keywords for high/medium risk activities
- Changed default return from "warning" to "normal"
- Added keywords: "violence", "crime", "unusual"

### 6. **Missing Main Entry Point** ✓ FIXED
**Problem**: No clear main entry point or startup information.

**Fix Applied**:
- Added `if __name__ == "__main__":` block with startup info
- Added debug endpoint `/api/debug/config` to check configuration
- Created test script `test_activity_detection.py`

## Testing Activity Detection

### Method 1: Use the Test Script (Recommended)
```bash
cd Backend
python smart_surveillance.py  # Terminal 1
python test_activity_detection.py  # Terminal 2
```

### Method 2: Manual API Testing
```bash
# Check backend
curl http://localhost:5000/api/health

# Check configuration  
curl http://localhost:5000/api/debug/config

# Start detection
curl -X POST http://localhost:5000/api/videomae/start \
  -H "Content-Type: application/json" \
  -d '{"source":"webcam"}'

# Check status
curl http://localhost:5000/api/videomae/status

# Get events
curl http://localhost:5000/suspicious/events

# Stop detection
curl -X POST http://localhost:5000/api/videomae/stop
```

## If Activities Still Not Detected

### Check 1: Verify Dependencies
```python
python -c "import torch; import transformers; print('✓ All dependencies OK')"
```

### Check 2: Check If Model Downloads
The first run downloads the VideoMAE model (~500MB) from HuggingFace. This requires internet and may take time.

### Check 3: Verify Calculation
Run this to test the model locally:
```bash
python -c "
from transformers import AutoImageProcessor, VideoMAEForVideoClassification
processor = AutoImageProcessor.from_pretrained('OPear/videomae-large-finetuned-UCF-Crime')
model = VideoMAEForVideoClassification.from_pretrained('OPear/videomae-large-finetuned-UCF-Crime')
print('✓ Model loads OK')
print(f'Available labels: {list(model.config.id2label.values())}')
"
```

### Check 4: Further Reduce Threshold
Edit `smart_surveillance.py` line ~439 and try:
```python
CONF_THRESHOLD = 0.30  # Even lower - 30%
```

### Check 5: Monitor Console Output
Watch the console where `smart_surveillance.py` is running. You should see:
```
[VideoMAE Clip 1] Detected: Normal (45.23%) | Threshold: 50%
[VideoMAE Clip 2] Detected: Fighting (78.45%) | Threshold: 50%
```

If you see "Normal" activities but not others, the model is working but the threshold may still be too high.

## Configuration Parameters

Located in `smart_surveillance.py` around line 439:

```python
CONF_THRESHOLD = 0.50      # Minimum confidence to trigger event (0.0-1.0)
DEDUP_SEC = 5              # Seconds between same-activity alerts
ANY_COOLDOWN = 1           # Seconds between any two alerts
CLIP_INTERVAL_SEC = 1      # Seconds between processing clips
```

Adjust these to find the sweet spot for your use case.

## Activity Types Detected

The VideoMAE model trained on UCF-Crime dataset recognizes:
- Normal
- Fighting
- Robbery
- Vandalism
- Shooting
- Stealing
- Shoplifting
- Assault
- Burglary
- Kidnapping
- Arson
- And others...

These are mapped to UI status categories:
- **suspicious**: High-risk activities (knife, gun, assault, etc.)
- **warning**: Medium-risk (intrusion, suspicious, threat, etc.)
- **normal**: Regular activity

## Debug Endpoint

Added `/api/debug/config` endpoint that returns:
```json
{
  "videomae_running": false,
  "videomae_source": "webcam",
  "missing_person_running": false,
  "suspicious_events_count": 0,
  "missing_alerts_count": 0,
  "models_loaded": {
    "videomae": false,
    "suspicious": false,
    "person": false
  },
  "dependencies": {
    "cv2": true,
    "numpy": true,
    "torch": true,
    "transformers": true
  }
}
```

Use this to verify all dependencies are installed and models are loading correctly.
