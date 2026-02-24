# Quick User Guide - Enhanced Missing Person Detection

## 🎯 What's New

### 1. Visual Box Detection (Green & Red Boxes)
When you start detection, you'll see colored boxes around detected faces:
- 🟢 **GREEN BOX** = Normal face (not a match)
- 🔴 **RED BOX** = **MISSING PERSON DETECTED** (with name label)

A legend appears in the bottom-left showing what each color means.

### 2. Smart Detection Updates
When multiple missing persons are in the frame:
- Only the **current best match** is displayed
- When a **new person enters**, the info **automatically updates**
- No stale/old data shown

### 3. Better Image Upload
When registering a missing person:
- UI clearly shows: "📸 Upload Multiple Face Images"
- Recommends: "Select 3+ clear facial images for best results"
- Shows selected files: "✅ 5 images selected" with file names
- Displays helpful tip about angles/lighting

---

## 📋 Step-by-Step Usage

### Register a Missing Person

```
1. Go to "Register Missing Person" section
2. Enter: Name and Age
3. Click: "📸 Upload Multiple Face Images"
   → Select 3-5 photos (different angles, lighting)
   → You'll see: "✅ 3 images selected"
   → Files show: "📄 photo1.jpg", "📄 photo2.jpg", etc.
4. Click: "Register Person"
5. Wait for: "✅ Person registered!" message
```

### Train the Model

```
1. Go to "Train Recognition Model"
2. Click: "Train Model"
3. Wait for: "✅ Model trained (2 persons, 12 faces)"
```

### Start Live Detection

```
1. Go to "Real-Time Detection"
2. Click: "Start Detection"
3. Webcam shows live feed with:
   - Legend: shows color meanings
   - 🟢 Green boxes around normal faces
   - 🔴 Red boxes around missing persons
```

### View Detection Results

```
When missing person detected:
┌─────────────────────────────┐
│ ✅ MISSING PERSON DETECTED  │
│ Name: John                  │
│ Age: 30                     │
│ Confidence: 85%             │
└─────────────────────────────┘

Below that:
"Faces detected: 3 (1 match, 2 normal)"
```

---

## 🎬 Visual Example

### Before (Old Way)
```
Video Feed                    Detection Info
[video]                       Person Found: John
no boxes shown                Age: 30
                             Confidence: 85%
                             
Person leaves, another        PROBLEM: Still shows John!
enters frame:                 (Stale data)
[different video]
```

### After (New Way)
```
Video Feed                    Detection Info

[face1] ——>🟢                 (no match)
[face2] ——>🔴JOHN            ✅ MISSING PERSON: JOHN
                              Age: 30, Confidence: 85%

Person JOHN leaves:           
[new_face] ——>🟢              (Clears automatically)
                              (Shows face count: 1)
                              
New PERSON JANE enters:       ✅ MISSING PERSON: JANE
[face1] ——>🟢                 Age: 28, Confidence: 92%
[face2] ——>🔴JANE            (Info UPDATED immediately!)
```

---

## ✅ Checklist for Best Results

- [ ] Upload **3+ clear photos** per person
- [ ] Photos show **different angles** (front, 3/4 views)
- [ ] Photos have **good lighting** (not too dark)
- [ ] Face is **clearly visible** (not obstructed)
- [ ] Train model **after registering** all persons
- [ ] Ensure **good webcam lighting** during detection
- [ ] Keep **face centered** in camera during detection

---

## 🔧 If Something Goes Wrong

### No boxes appearing on video?
- Check: Is webcam working?
- Try: Refresh page or restart detection
- Check: Are there faces in the frame?

### Wrong person shown?
- Solution: This is now FIXED! Each person gets their own correct info
- Try: Clear the detection and start again

### Same person keeps showing?
- This means they're still in frame
- When person leaves, info clears instantly
- When new person enters, new info shows

### No matches detected?
- Check: Is model trained? (should show persons count)
- Check: Are registered persons in frame?
- Try: Adjust lighting or face angle
- Try: Retrain with more photos

### File upload not working?
- Check: Browser permissions
- Try: Different browser
- Check: File size (keep under 5MB per image)

---

## 📊 Box Drawing Legend

```
During Detection:
┌──────────────────────────────┐
│ 🟢 Normal Face               │  ← Bottom-left corner
│ 🔴 Missing Person            │  ← Shows box meanings
└──────────────────────────────┘

Green Box (Normal):            Red Box (Missing Person):
┌─────┐                        ┌─────────────────────┐
│ X,Y │ Person not matched    │ 🚨 MISSING: JOHN  │
│ W,H │ to any registered     │ 🔴 RED BOX        │
└─────┘ person                └─────────────────────┘
```

---

## 🎯 Advanced Tips

1. **Accuracy**: More diverse photos = better detection
   - Different ages/lighting in photos = better results

2. **Performance**: System processes every 5 frames
   - Smooth operation even with multiple detection threads

3. **Alerts**: All detections logged in "Detection History"
   - Use "Clear" button to reset history

4. **Re-training**: If you add new persons:
   - Register new person
   - Click "Train Model" again
   - Start new detection

---

## 📞 Support

If boxes don't draw:
- Check browser console for errors
- Verify canvas element exists
- Try: Stop and restart detection

If detection doesn't work:
- Ensure good lighting
- Train model with 3+ images per person
- Check: Model trained message shows "persons_count > 0"

