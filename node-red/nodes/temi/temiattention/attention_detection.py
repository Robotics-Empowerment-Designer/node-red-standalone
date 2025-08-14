import os
import cv2
import numpy as np
import mediapipe as mp
import time
import json
import paho.mqtt.client as mqtt

# TensorFlow-Optimierungen deaktivieren
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

# Mediapipe initialisieren
mp_face_detection = mp.solutions.face_detection
mp_drawing = mp.solutions.drawing_utils
# Mediapipe-Gesichtserkennung initialisieren
face_detection = mp_face_detection.FaceDetection(min_detection_confidence=0.5)

# MQTT-Konfiguration
broker_address = "iot-i.ostfalia.de"
broker_port = 1883
username = "iot"
password = "iotbroker"
camera_topic = "temi/camera_open"
frame_topic = "temi/cameraPic"
result_topic = "temi/attention_result"

# Konzentrationsschwelle
concentration_threshold = 5  # Sekunden bis "Not Concentrated"
last_concentration_time = None
previous_gaze_status = None

# MQTT-Client einrichten
client = mqtt.Client()

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("Mit dem MQTT-Broker verbunden")
        client.subscribe(frame_topic)
        #client.publish(camera_topic, "true")  # Kamera von Temi aktivieren
    else:
        print(f"Verbindung zum MQTT-Broker fehlgeschlagen, Rückgabecode: {rc}")

def is_looking_at_camera(landmarks):
    # Dummy-Logik: Prüfen, ob das Gesicht zentral ausgerichtet ist
    if landmarks:
        return "center"
    return "not_center"

def process_frame(payload):
    global last_concentration_time, previous_gaze_status

    try:
        # JSON-Payload dekodieren
        bitlist = json.loads(payload)

        # Bilddaten konvertieren und umformen
        npArr = np.array(bitlist[::-1])
        width = npArr[1]
        height = npArr[0]
        npArr = npArr[2:].reshape((height * 10, width * 10)).astype(np.uint8)

        # Graustufenbild in BGR konvertieren
        frame = cv2.cvtColor(npArr, cv2.COLOR_GRAY2BGR)
   
        results = face_detection.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        gaze_status = None

        if results.detections:
            for detection in results.detections:
                bboxC = detection.location_data.relative_bounding_box
                ih, iw, _ = frame.shape
                bbox = (int(bboxC.xmin * iw), int(bboxC.ymin * ih),
                        int(bboxC.width * iw), int(bboxC.height * ih))

                # Rechteck um das Gesicht zeichnen
                cv2.rectangle(frame, (bbox[0], bbox[1]),
                                (bbox[0] + bbox[2], bbox[1] + bbox[3]),
                                (255, 0, 0), 2)

                # Aufmerksamkeit überprüfen
                gaze_direction = is_looking_at_camera(detection.location_data)

                if gaze_direction == "center":
                    gaze_status = "Concentrated"
                    last_concentration_time = None
                else:
                    if last_concentration_time is None:
                        last_concentration_time = time.time()
                    elif time.time() - last_concentration_time >= concentration_threshold:
                        gaze_status = "False"                   
        else:
            if last_concentration_time is None:
                last_concentration_time = time.time()
            elif time.time() - last_concentration_time >= concentration_threshold:
                gaze_status = "False"
                
        print(f"Detected gaze status: {gaze_status} | Previous: {previous_gaze_status}")
        
        # if no update ti gaze_status, keep previous
        if gaze_status is None:
            gaze_status = previous_gaze_status

        # publish on state change
        if gaze_status != previous_gaze_status:
            client.publish(result_topic,gaze_status)
            print(f"Published {gaze_status}")

        # save gaze_Status for enxt frame
        previous_gaze_status = gaze_status


        # Text auf dem Frame anzeigen
        cv2.putText(frame, gaze_status, (50, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0) if gaze_status == "Concentrated" else (0, 0, 255), 2)

        # Frame anzeigen
        cv2.imshow("Aufmerksamkeitsüberwachung", frame)
        cv2.waitKey(1)

    except Exception as e:
        print(f"Fehler beim Verarbeiten des Frames: {e}")

# MQTT-Callback für eingehende Nachrichten
def on_message(client, userdata, message):
    if message.topic == frame_topic:
        process_frame(message.payload.decode("utf-8"))

# MQTT-Konfiguration
client.on_connect = on_connect
client.on_message = on_message
client.username_pw_set(username, password)
client.connect(broker_address, broker_port)
client.loop_start()

try:
    print("Warte auf Frames von Temis Kamera...")
    while True:
        time.sleep(0.1)  # Reduzierte Wartezeit
except KeyboardInterrupt:
    print("Programm unterbrochen.")
finally:
    #client.publish(camera_topic, "false")  # Kamera von Temi deaktivieren
    client.loop_stop()
    client.disconnect()
    cv2.destroyAllWindows()
