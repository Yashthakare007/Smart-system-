
# Custom YOLO Object Detection Model For Suspicious Activity Detection

This repository contains a custom-trained YOLO-based object detection model designed to detect various objects related to safety and surveillance scenarios, such as **Assault**, **Fighting**, **Gun**, **Kidnapping**, and more.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Setup](#setup)
- [Usage](#usage)
- [Model Details](#model-details)
- [Results](#results)
- [Limitations](#limitations)
- [Acknowledgments](#acknowledgments)

---

## Overview

The custom YOLO model is capable of detecting the following classes:

1. **Assault**
2. **Fighting**
3. **Gun**
4. **Kidnapping**
5. **Knife**
6. **People**
7. **Police**
8. **Prisoner**
9. **Theft/Robbery**
10. **Time Bomb**

The model is optimized for real-time inference and is suitable for applications in:

- **Public Safety Monitoring**
- **Surveillance Systems**
- **Security Applications**

---

## Features

- **Real-Time Detection**: Utilizes YOLO’s efficient architecture for quick detection.
- **Custom Classes**: Trained on a tailored dataset specific to safety and surveillance.
- **Confidence Thresholding**: Outputs only high-confidence predictions for accurate results.
- **Visualizations**: Overlay detected objects on video feeds or images.

---

## Setup

### Prerequisites

- Python 3.7+
- `ultralytics` package for YOLO
- A GPU (recommended for faster inference)

### Installation

1. Clone this repository:
   ```bash
   git clone https://huggingface.co/Accurateinfosolution/Suspicious_activity_detection_Yolov11_Custom
   ```

2. Install dependencies:
   ```bash
   pip install ultralytics
   ```

3. Add your trained YOLO model:
   - Place your `Suspicious_Activities_nano.pt` file in the project directory.

---

## Usage

### Running Predictions

Run the detection script on a video or image source:

```bash
python predict.py
```

### Prediction Script: `predict.py`

The script uses the YOLO framework to load the `best.pt` model and detect objects:

```python
from ultralytics import YOLO

# Load the custom YOLO model
model = YOLO("Suspicious_Activities_nano.pt")

# Perform prediction
model.predict(source="0", show=True, conf=0.6)
```

Replace `"0"` with:
- A webcam source (`0` or `1`).
- A path to an image/video file.

---

## Model Details

- **Architecture**: YOLO (You Only Look Once)
- **Classes**: 10 custom classes (see Overview)
- **Confidence Threshold**: 0.6
- **Pre-trained Weights**: Fine-tuned on YOLO’s default weights.

---

## Results

Sample output of the model includes bounding boxes for detected objects with labels and confidence scores. Images or video streams are displayed with real-time overlays.

---

## Limitations

- **Dataset Dependency**: The accuracy is influenced by the quality of the training dataset.
- **Environmental Constraints**: Performance may vary under poor lighting or occlusion.
- **Class Generalization**: May not generalize well to scenarios outside its training scope.

---

## Acknowledgments

- **YOLO Framework**: [Ultralytics](https://github.com/ultralytics/ultralytics)
- **Custom Dataset**: Annotated with bounding boxes for the 10 custom classes.
- **Contributors**: Shreyanth(mailto:shreyanthhg1427@gmail.com)

---
