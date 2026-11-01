import cv2
from ultralytics import YOLO

video = r'C:\Users\shrey\OneDrive\Desktop\Boxing Analyzer\demo-videos\boxing video 1.mp4'
cap = cv2.VideoCapture(video)
print('opened', cap.isOpened())
if not cap.isOpened():
    raise SystemExit(1)
ok, frame = cap.read()
print('frame shape', None if not ok else frame.shape)
if not ok:
    raise SystemExit(2)
model = YOLO('yolov8n.pt')
results = model(frame, classes=[0], verbose=False, imgsz=640, conf=0.25)
print('detections', sum(len(r.boxes) for r in results))
print('classes', [r.names.get(int(b.cls[0]), 'unknown') for r in results for b in r.boxes][:10])
cap.release()
