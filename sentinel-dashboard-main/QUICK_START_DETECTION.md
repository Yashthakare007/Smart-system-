# Quick Start - Activity Detection Testing

## Setup (One-time)
```bash
cd Backend
pip install -r requirements.txt --upgrade  # Install torch & transformers
```

## Start the Backend
```bash
cd Backend
python smart_surveillance.py
```

You should see:
```
Starting Smart Surveillance Backend...
Available endpoints:
  GET  /api/health - Health check
  POST /api/videomae/start - Start VideoMAE detection
  ...
 * Running on http://0.0.0.0:5000
```

## Test Activity Detection (New Terminal)
```bash
cd Backend
python test_activity_detection.py
```

## What Was Fixed

| Issue | Before | After |
|-------|--------|-------|
| **Dependencies** | Missing torch/transformers | ✓ Added to requirements.txt |
| **Confidence** | 70% - Too strict | 50% - More sensitive |
| **Event Cooldown** | 2 seconds between events | 1 second |
| **Dedup Period** | 10 seconds per activity | 5 seconds |
| **Error Reporting** | Silent failures | ✓ Logged with debug info |
| **Status Mapping** | "warning" as default | ✓ "normal" as default |
| **UI Labels** | Limited keywords | ✓ Added "violence", "crime" |

## Key Changes in Code

### 1. requirements.txt
```diff
+ torch
+ transformers
```

### 2. smart_surveillance.py
```diff
- CONF_THRESHOLD = 0.70
+ CONF_THRESHOLD = 0.50

- DEDUP_SEC = 10
+ DEDUP_SEC = 5

- ANY_COOLDOWN = 2
+ ANY_COOLDOWN = 1

- CLIP_INTERVAL_SEC = 2
+ CLIP_INTERVAL_SEC = 1
```

### 3. New Debug Endpoint
- Added `/api/debug/config` to verify configuration
- Shows model loading status
- Lists available dependencies

### 4. Test Script
- Created `test_activity_detection.py`
- Tests detection pipeline end-to-end
- Provides clear success/failure feedback

## Troubleshooting

### Still not detecting?
1. Check configuration: `curl http://localhost:5000/api/debug/config`
2. Watch console for `[VideoMAE Clip X]` debug messages
3. Further reduce threshold to 0.30 if needed
4. Ensure webcam is working and not in use by other apps

### Model download slow?
- First run downloads ~500MB model from HuggingFace
- Requires internet connection
- Model is cached after download

### "Too many events"?
Increase cooldown values in `smart_surveillance.py`:
```python
CONF_THRESHOLD = 0.70      # Higher = less sensitive
DEDUP_SEC = 15             # Longer = fewer duplicates
ANY_COOLDOWN = 3           # Longer = slower events
```

## How It Works

```
Webcam/Video → Extract 16 frames every 1 second
    ↓
VideoMAE Model → Classify activity (50%+ confidence)
    ↓
Is it "Normal"? → Yes: Skip
    ↓ No
Is it in cooldown? → Yes: Skip  
    ↓ No
Create Event → Add to suspicious_events list
    ↓
Frontend → Display in dashboard
```

## Files Modified

1. `Backend/requirements.txt` - Added dependencies
2. `Backend/smart_surveillance.py` - Adjusted thresholds, added logging
3. `Backend/test_activity_detection.py` - NEW: Test script
4. `ACTIVITY_DETECTION_FIX.md` - Detailed explanation
5. `QUICK_START_DETECTION.md` - This file
