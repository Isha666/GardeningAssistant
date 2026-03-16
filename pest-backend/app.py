import os
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
import tensorflow as tf
import io
import base64
import speech_recognition as sr
import tempfile
from pydub import AudioSegment

app = Flask(__name__)
CORS(app)

# ─── Class names — exact alphabetical order from training ─────────────────────
CLASS_NAMES = [
    "Pepper Bell - Bacterial Spot",
    "Pepper Bell - Healthy",
    "Potato - Early Blight",
    "Potato - Late Blight",
    "Potato - Healthy",
    "Tomato - Bacterial Spot",
    "Tomato - Early Blight",
    "Tomato - Late Blight",
    "Tomato - Leaf Mold",
    "Tomato - Septoria Leaf Spot",
    "Tomato - Spider Mites",
    "Tomato - Target Spot",
    "Tomato - Yellow Leaf Curl Virus",
    "Tomato - Mosaic Virus",
    "Tomato - Healthy",
]

TREATMENTS = {
    "Pepper Bell - Bacterial Spot": "Apply copper-based bactericide. Use disease-free seeds. Avoid overhead irrigation.",
    "Pepper Bell - Healthy": "Your crop looks healthy! Continue regular monitoring.",
    "Potato - Early Blight": "Apply mancozeb or chlorothalonil fungicide. Remove infected leaves. Mulch soil.",
    "Potato - Late Blight": "Apply fungicide (metalaxyl) immediately. Destroy all infected plants to prevent spread.",
    "Potato - Healthy": "Your crop looks healthy! Continue regular monitoring.",
    "Tomato - Bacterial Spot": "Apply copper-based bactericide. Switch to drip irrigation. Remove infected leaves.",
    "Tomato - Early Blight": "Apply mancozeb fungicide. Remove lower infected leaves. Mulch around base of plant.",
    "Tomato - Late Blight": "Apply fungicide immediately. Destroy infected plants. Avoid overhead watering.",
    "Tomato - Leaf Mold": "Improve air circulation. Reduce humidity. Apply chlorothalonil fungicide.",
    "Tomato - Septoria Leaf Spot": "Apply fungicide. Remove and destroy infected leaves. Avoid wetting foliage when watering.",
    "Tomato - Spider Mites": "Spray neem oil or miticide. Increase humidity around plants. Remove heavily infested leaves.",
    "Tomato - Target Spot": "Apply fungicide (azoxystrobin). Ensure proper plant spacing for airflow.",
    "Tomato - Yellow Leaf Curl Virus": "No cure available. Remove infected plants immediately. Control whitefly population with insecticide.",
    "Tomato - Mosaic Virus": "No cure available. Remove and destroy infected plants. Disinfect tools with bleach solution.",
    "Tomato - Healthy": "Your crop looks healthy! Continue regular monitoring and watering.",
}

MODEL_PATH = "plant_disease_model.h5"
model = None
MOCK_MODE = not os.path.exists(MODEL_PATH)

MOCK_RESULTS = [
    {"disease": "Tomato - Early Blight", "confidence": 91.2, "is_healthy": False},
    {"disease": "Tomato - Healthy", "confidence": 96.5, "is_healthy": True},
    {"disease": "Potato - Late Blight", "confidence": 93.1, "is_healthy": False},
    {"disease": "Pepper Bell - Bacterial Spot", "confidence": 85.4, "is_healthy": False},
    {"disease": "Tomato - Spider Mites", "confidence": 88.7, "is_healthy": False},
]

def load_model():
    global model
    if os.path.exists(MODEL_PATH):
        model = tf.keras.models.load_model(MODEL_PATH)
        print(f"Model loaded — {len(CLASS_NAMES)} classes")
    else:
        print("No model found — MOCK MODE")

def preprocess_image(image_bytes):
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize((224, 224))
    arr = np.array(img, dtype=np.float32)
    arr = tf.keras.applications.efficientnet.preprocess_input(arr)
    arr = np.expand_dims(arr, axis=0)
    return arr

@app.route("/", methods=["GET"])
def health():
    return jsonify({"status": "ok", "mode": "mock" if MOCK_MODE else "real", "classes": len(CLASS_NAMES)})

@app.route("/predict", methods=["POST"])
def predict():
    try:
        if "image" in request.files:
            image_bytes = request.files["image"].read()
        elif request.json and "image_base64" in request.json:
            image_bytes = base64.b64decode(request.json["image_base64"])
        else:
            return jsonify({"error": "No image provided"}), 400

        if MOCK_MODE:
            import hashlib
            hash_val = int(hashlib.md5(image_bytes[:100]).hexdigest(), 16)
            r = MOCK_RESULTS[hash_val % len(MOCK_RESULTS)]
            return jsonify({**r, "treatment": TREATMENTS.get(r["disease"], ""), "mock": True})

        img_array = preprocess_image(image_bytes)
        predictions = model.predict(img_array, verbose=0)
        predicted_idx = int(np.argmax(predictions[0]))
        confidence = float(np.max(predictions[0])) * 100
        top3 = [{"disease": CLASS_NAMES[i], "confidence": round(float(predictions[0][i]) * 100, 1)} for i in np.argsort(predictions[0])[-3:][::-1]]

        if confidence < 75.0:
            return jsonify({
                "disease": "Not Recognized",
                "confidence": round(confidence, 1),
                "is_healthy": False,
                "treatment": "Please upload a clear photo of a Tomato, Potato, or Pepper Bell leaf.",
                "mock": False,
                "top_3": top3,
            })

        disease = CLASS_NAMES[predicted_idx]
        return jsonify({
            "disease": disease,
            "confidence": round(confidence, 1),
            "is_healthy": "Healthy" in disease,
            "treatment": TREATMENTS.get(disease, "Consult a local agricultural expert."),
            "mock": False,
            "top_3": top3,
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/transcribe", methods=["POST"])
def transcribe():
    try:
        print("\n--- New Transcription Request ---")
        data = request.get_json(silent=True)
        if not data or "audio_base64" not in data:
            return jsonify({"error": "No audio provided"}), 400

        encoded_data = data["audio_base64"]
        if "," in encoded_data:
            encoded_data = encoded_data.split(",")[1]
        
        audio_bytes = base64.b64decode(encoded_data)
        lang = data.get("lang", "en")

        audio_stream = io.BytesIO(audio_bytes)
        try:
            audio_segment = AudioSegment.from_file(audio_stream)
            audio_segment = audio_segment.set_channels(1).set_frame_rate(16000).normalize()
            
            # CRITICAL FOR ENGLISH: Add padding to BOTH ends
            # This prevents the first syllable of "One" or "Two" from being cut off
            padding = AudioSegment.silent(duration=1000) # 1 second
            audio_segment = padding + audio_segment + padding
            
        except Exception as e:
            print(f"Pydub Error: {e}")
            return jsonify({"error": "Invalid audio format"}), 400

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            audio_segment.export(tmp.name, format="wav")
            tmp_path = tmp.name
            audio_segment.export("debug_last_audio.wav", format="wav")

        try:
            recognizer = sr.Recognizer()
            
            # --- ENGLISH SENSITIVITY BOOST ---
            if lang != "ta":
                recognizer.energy_threshold = 50 
                recognizer.dynamic_energy_threshold = False # Keep it sensitive
            
            with sr.AudioFile(tmp_path) as source:
                # Only adjust for noise if it's NOT a very short English clip
                if lang == "ta":
                    recognizer.adjust_for_ambient_noise(source, duration=0.2)
                else:
                    # For English short words, a tiny adjustment is better
                    recognizer.adjust_for_ambient_noise(source, duration=0.1)
                
                audio_data = recognizer.record(source)
            
            language_code = "ta-IN" if lang == "ta" else "en-IN"
            text = recognizer.recognize_google(audio_data, language=language_code)
            
            print(f"Result ({language_code}): {text}")
            return jsonify({"text": text})

        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

    except sr.UnknownValueError:
        print("Recognize Google: Could not understand audio.")
        return jsonify({"error": "Could not understand audio"}), 400
    except Exception as e:
        print(f"Unexpected Server Error: {str(e)}")
        return jsonify({"error": str(e)}), 500
if __name__ == "__main__":
    load_model()
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
