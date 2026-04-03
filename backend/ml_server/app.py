import os
import sys
import base64
import numpy as np
import cv2
import tensorflow as tf
from flask import Flask, request, jsonify, send_from_directory

app = Flask(__name__)

MODEL_PATH = 'best_model.keras'

SYMPTOM_NAMES = sorted([
    'healthy', 'early_blight', 'late_blight', 'powdery_mildew',
    'downy_mildew', 'leaf_spot_fungal', 'bacterial_spot', 'rust_disease',
    'mosaic_virus', 'leaf_curl_virus', 'nutrient_deficiency',
    'root_rot_wilting', 'sooty_mold', 'anthracnose'
])

SYMPTOM_INFO = {
    'healthy': 'Your plant is healthy!',
    'early_blight': 'Fungal disease - apply neem oil',
    'late_blight': 'Serious fungal - act immediately',
    'powdery_mildew': 'White powder - improve airflow',
    'downy_mildew': 'Yellow patches - reduce humidity',
    'leaf_spot_fungal': 'Brown spots - remove infected leaves',
    'bacterial_spot': 'Wet lesions - apply copper bactericide',
    'rust_disease': 'Orange pustules - apply sulfur fungicide',
    'mosaic_virus': 'Viral - remove plant, control aphids',
    'leaf_curl_virus': 'Whitefly spread - use sticky traps',
    'nutrient_deficiency': 'Pale yellowing - check soil pH',
    'root_rot_wilting': 'Drooping - improve drainage',
    'sooty_mold': 'Black coating - treat aphids first',
    'anthracnose': 'Dark lesions - apply copper fungicide',
}

model = None


def load_model():
    global model
    if model is None:
        os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
        model = tf.keras.models.load_model(MODEL_PATH)
    return model


@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    return response


@app.route('/predict', methods=['GET', 'POST', 'OPTIONS'])
def predict():
    if request.method == 'OPTIONS':
        return '', 200
        
    if request.method == 'GET':
        return jsonify({'message': 'POST an image to get predictions'}), 200
    
    try:
        data = request.get_json()
        if not data or 'image' not in data:
            return jsonify({'error': 'No image provided'}), 400

        image_data = base64.b64decode(data['image'])
        nparr = np.frombuffer(image_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return jsonify({'error': 'Invalid image data. Please upload a valid image.'}), 400

        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img_resized = cv2.resize(img_rgb, (260, 260))
        input_tensor = np.expand_dims(img_resized.astype(np.float32), axis=0)

        loaded_model = load_model()
        probs = loaded_model.predict(input_tensor, verbose=0)[0]

        top_idx = np.argmax(probs)
        disease = SYMPTOM_NAMES[top_idx]
        confidence = float(probs[top_idx] * 100)

        sorted_indices = np.argsort(probs)[::-1]
        all_predictions = [
            {'disease': SYMPTOM_NAMES[i], 'confidence': float(probs[i] * 100)}
            for i in sorted_indices
        ]

        return jsonify({
            'disease': disease,
            'confidence': confidence,
            'info': SYMPTOM_INFO.get(disease, ''),
            'all_predictions': all_predictions
        })

    except Exception as e:
        print(f"Prediction error: {str(e)}", file=sys.stderr)
        return jsonify({'error': f'Server error: {str(e)}'}), 500


@app.route('/health')
def health():
    return jsonify({'status': 'healthy'})


@app.route('/')
def index():
    return send_from_directory('.', 'index.html')


if __name__ == '__main__':
    print('GreenGuide — Plant Disease Detector ML Server')
    print('=' * 50)
    try:
        print('Loading model...')
        load_model()
        print('Model loaded successfully!')
    except Exception as e:
        print(f'Failed to load model: {e}')
        print('Server will start anyway — model loads on first request.')

    # ⚠️  Changed from 5000 → 5001 to avoid conflict with Node.js backend
    port = int(os.environ.get('ML_PORT', 5001))
    print(f'Starting ML server at http://localhost:{port}')
    print('Press Ctrl+C to stop')
    app.run(host='0.0.0.0', port=port, debug=False)