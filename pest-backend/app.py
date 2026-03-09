import os
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
import tensorflow as tf
import io
import base64

app = Flask(__name__)
CORS(app)

# ─── PlantVillage class labels ────────────────────────────────────────────────
CLASS_NAMES = [
    "Apple - Apple Scab", "Apple - Black Rot", "Apple - Cedar Apple Rust", "Apple - Healthy",
    "Blueberry - Healthy",
    "Cherry - Powdery Mildew", "Cherry - Healthy",
    "Corn - Cercospora Leaf Spot", "Corn - Common Rust", "Corn - Northern Leaf Blight", "Corn - Healthy",
    "Grape - Black Rot", "Grape - Esca (Black Measles)", "Grape - Leaf Blight", "Grape - Healthy",
    "Orange - Huanglongbing (Citrus Greening)",
    "Peach - Bacterial Spot", "Peach - Healthy",
    "Pepper Bell - Bacterial Spot", "Pepper Bell - Healthy",
    "Potato - Early Blight", "Potato - Late Blight", "Potato - Healthy",
    "Raspberry - Healthy",
    "Soybean - Healthy",
    "Squash - Powdery Mildew",
    "Strawberry - Leaf Scorch", "Strawberry - Healthy",
    "Tomato - Bacterial Spot", "Tomato - Early Blight", "Tomato - Late Blight",
    "Tomato - Leaf Mold", "Tomato - Septoria Leaf Spot",
    "Tomato - Spider Mites", "Tomato - Target Spot",
    "Tomato - Yellow Leaf Curl Virus", "Tomato - Mosaic Virus", "Tomato - Healthy",
]

# Treatment advice per class
TREATMENTS = {
    "Apple - Apple Scab": "Apply fungicides containing captan or myclobutanil. Remove infected leaves.",
    "Apple - Black Rot": "Prune infected branches. Apply copper-based fungicide.",
    "Apple - Cedar Apple Rust": "Apply fungicide in spring. Remove nearby juniper trees if possible.",
    "Apple - Healthy": "Your crop looks healthy! Continue regular monitoring.",
    "Blueberry - Healthy": "Your crop looks healthy! Continue regular monitoring.",
    "Cherry - Powdery Mildew": "Apply sulfur-based fungicide. Ensure good air circulation.",
    "Cherry - Healthy": "Your crop looks healthy! Continue regular monitoring.",
    "Corn - Cercospora Leaf Spot": "Apply strobilurin fungicide. Rotate crops next season.",
    "Corn - Common Rust": "Apply fungicide early. Use rust-resistant varieties next season.",
    "Corn - Northern Leaf Blight": "Apply fungicide at first sign. Ensure proper plant spacing.",
    "Corn - Healthy": "Your crop looks healthy! Continue regular monitoring.",
    "Grape - Black Rot": "Remove mummified fruit. Apply fungicide before and after rain.",
    "Grape - Esca (Black Measles)": "No cure available. Remove infected vines to prevent spread.",
    "Grape - Leaf Blight": "Apply copper fungicide. Improve drainage and airflow.",
    "Grape - Healthy": "Your crop looks healthy! Continue regular monitoring.",
    "Orange - Huanglongbing (Citrus Greening)": "No cure. Remove infected trees immediately to prevent spread.",
    "Peach - Bacterial Spot": "Apply copper-based bactericide. Avoid overhead irrigation.",
    "Peach - Healthy": "Your crop looks healthy! Continue regular monitoring.",
    "Pepper Bell - Bacterial Spot": "Apply copper bactericide. Use disease-free seeds.",
    "Pepper Bell - Healthy": "Your crop looks healthy! Continue regular monitoring.",
    "Potato - Early Blight": "Apply mancozeb or chlorothalonil fungicide. Remove infected leaves.",
    "Potato - Late Blight": "Apply fungicide immediately. Destroy infected plants.",
    "Potato - Healthy": "Your crop looks healthy! Continue regular monitoring.",
    "Raspberry - Healthy": "Your crop looks healthy! Continue regular monitoring.",
    "Soybean - Healthy": "Your crop looks healthy! Continue regular monitoring.",
    "Squash - Powdery Mildew": "Apply potassium bicarbonate or neem oil spray.",
    "Strawberry - Leaf Scorch": "Apply fungicide. Remove old leaves after harvest.",
    "Strawberry - Healthy": "Your crop looks healthy! Continue regular monitoring.",
    "Tomato - Bacterial Spot": "Apply copper bactericide. Use drip irrigation instead of overhead.",
    "Tomato - Early Blight": "Apply fungicide. Remove lower infected leaves. Mulch soil.",
    "Tomato - Late Blight": "Apply fungicide immediately. Destroy infected plants.",
    "Tomato - Leaf Mold": "Improve ventilation. Apply fungicide containing chlorothalonil.",
    "Tomato - Septoria Leaf Spot": "Apply fungicide. Remove infected leaves. Avoid wetting foliage.",
    "Tomato - Spider Mites": "Apply miticide or neem oil. Increase humidity around plants.",
    "Tomato - Target Spot": "Apply fungicide. Ensure proper plant spacing for airflow.",
    "Tomato - Yellow Leaf Curl Virus": "No cure. Remove infected plants. Control whitefly population.",
    "Tomato - Mosaic Virus": "No cure. Remove infected plants. Disinfect tools.",
    "Tomato - Healthy": "Your crop looks healthy! Continue regular monitoring.",
}

# ─── Load model ───────────────────────────────────────────────────────────────
MODEL_PATH = "plant_disease_model.h5"
model = None

MOCK_MODE = not os.path.exists(MODEL_PATH)

MOCK_RESULTS = [
    {"disease": "Tomato - Early Blight", "confidence": 91.2, "is_healthy": False,
     "treatment": "Apply mancozeb or chlorothalonil fungicide. Remove lower infected leaves. Mulch the soil to prevent spore splash."},
    {"disease": "Tomato - Healthy", "confidence": 96.5, "is_healthy": True,
     "treatment": "Your crop looks healthy! Continue regular monitoring and watering."},
    {"disease": "Corn - Common Rust", "confidence": 88.7, "is_healthy": False,
     "treatment": "Apply fungicide early. Use rust-resistant varieties next season. Ensure proper plant spacing."},
    {"disease": "Potato - Late Blight", "confidence": 93.1, "is_healthy": False,
     "treatment": "Apply fungicide immediately. Destroy infected plants to prevent spread."},
    {"disease": "Pepper Bell - Bacterial Spot", "confidence": 85.4, "is_healthy": False,
     "treatment": "Apply copper-based bactericide. Use disease-free seeds next season."},
]

def load_model():
    global model
    if os.path.exists(MODEL_PATH):
        model = tf.keras.models.load_model(MODEL_PATH)
        print("✅ Model loaded from", MODEL_PATH)
    else:
        print("⚠️  No model found — running in MOCK MODE for testing.")

def build_model():
    """Build EfficientNetB0 model fine-tuned for PlantVillage."""
    base = tf.keras.applications.EfficientNetB0(
        include_top=False,
        weights="imagenet",
        input_shape=(224, 224, 3)
    )
    base.trainable = False  # Freeze base layers

    inputs = tf.keras.Input(shape=(224, 224, 3))
    x = tf.keras.applications.efficientnet.preprocess_input(inputs)
    x = base(x, training=False)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.Dropout(0.3)(x)
    outputs = tf.keras.layers.Dense(len(CLASS_NAMES), activation="softmax")(x)

    m = tf.keras.Model(inputs, outputs)
    m.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss="categorical_crossentropy",
        metrics=["accuracy"]
    )
    return m

def preprocess_image(image_bytes):
    """Preprocess image for EfficientNetB0."""
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize((224, 224))
    arr = np.array(img, dtype=np.float32)
    arr = np.expand_dims(arr, axis=0)
    return arr

# ─── Routes ───────────────────────────────────────────────────────────────────
@app.route("/", methods=["GET"])
def health():
    return jsonify({"status": "ok", "message": "Pest Detection API is running"})

@app.route("/predict", methods=["POST"])
def predict():
    try:
        # Accept image as file upload or base64
        if "image" in request.files:
            image_bytes = request.files["image"].read()
        elif request.json and "image_base64" in request.json:
            image_bytes = base64.b64decode(request.json["image_base64"])
        else:
            return jsonify({"error": "No image provided"}), 400

        # MOCK MODE — return rotating realistic results for testing
        if MOCK_MODE:
            import hashlib, time
            hash_val = int(hashlib.md5(image_bytes[:100]).hexdigest(), 16)
            result = MOCK_RESULTS[hash_val % len(MOCK_RESULTS)]
            return jsonify({**result, "mock": True, "top_3": [
                {"disease": result["disease"], "confidence": result["confidence"]},
                {"disease": "Tomato - Healthy", "confidence": round(100 - result["confidence"], 1)},
            ]})

        # REAL MODEL prediction
        img_array = preprocess_image(image_bytes)
        predictions = model.predict(img_array)
        predicted_idx = int(np.argmax(predictions[0]))
        confidence = float(np.max(predictions[0])) * 100

        disease = CLASS_NAMES[predicted_idx]
        treatment = TREATMENTS.get(disease, "Consult a local agricultural expert.")
        is_healthy = "Healthy" in disease

        return jsonify({
            "disease": disease,
            "confidence": round(confidence, 1),
            "is_healthy": is_healthy,
            "treatment": treatment,
            "mock": False,
            "top_3": [
                {
                    "disease": CLASS_NAMES[i],
                    "confidence": round(float(predictions[0][i]) * 100, 1)
                }
                for i in np.argsort(predictions[0])[-3:][::-1]
            ]
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/train", methods=["POST"])
def train():
    """
    Trigger training. Send POST with:
    { "dataset_path": "/path/to/PlantVillage" }
    Dataset should be organized as:
    PlantVillage/
      Apple___Apple_scab/  (image files)
      Apple___Black_rot/
      ...
    """
    try:
        dataset_path = request.json.get("dataset_path", "PlantVillage")
        if not os.path.exists(dataset_path):
            return jsonify({"error": f"Dataset not found at {dataset_path}"}), 400

        # Load dataset
        datagen = tf.keras.preprocessing.image.ImageDataGenerator(
            rescale=1./255,
            validation_split=0.2,
            rotation_range=20,
            horizontal_flip=True,
            zoom_range=0.2,
        )
        train_gen = datagen.flow_from_directory(
            dataset_path, target_size=(224, 224),
            batch_size=32, class_mode="categorical", subset="training"
        )
        val_gen = datagen.flow_from_directory(
            dataset_path, target_size=(224, 224),
            batch_size=32, class_mode="categorical", subset="validation"
        )

        global model
        model = build_model()
        model.fit(train_gen, validation_data=val_gen, epochs=10)
        model.save(MODEL_PATH)

        return jsonify({"status": "Training complete", "model_saved": MODEL_PATH})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    load_model()
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
