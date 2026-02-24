from ultralytics import YOLO
model = YOLO("Suspicious_Activities_nano.pt")

model.predict(source = "1",show=True,conf=0.6)
