# code ka end padhane jaisa hai...
import sys
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from flask import Flask, request, jsonify, render_template
from PIL import Image
import numpy as np
import io as io_module
import os
import traceback
import logging
import threading
from pathlib import Path
from typing import List, Dict, Any, Optional
from dataclasses import dataclass


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

#CORS headers =! CORS headache ==
@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Accept'
    response.headers['Access-Control-Max-Age'] = '3600'
    return response


BASE_DIR =Path(__file__).parent.resolve()
MODEL_DIR =  BASE_DIR / "ayurvedic_plant_classifier"


def get_resource_path(filename: str) -> Path:
    """Get the full path to resource file in model directory"""
    return MODEL_DIR / filename


def safe_path_str(path: Path) -> str:
    """
    Convert Path to string with workaround for Unicode paths on Windows
    beacuse sometimes terepass \OneDrive\ドキュメント\ ye headache bhi hota hai...
    
    TensorFlow's TF Lite interpreter can have issues with Unicode paths on Windows
    If the path contains non-ASCII characters, we copy to a temp directory samzaha karo!
    """
    path_str = str(path)
    # Check if path has non-ASCII characters
    if any(ord(c) > 127 for c in path_str):
        import tempfile
        # Create temp directory with ASCII path
        temp_dir = Path(tempfile.gettempdir()) / "plant_api_model"
        temp_dir.mkdir(exist_ok=True)
        # Copy file to temp location
        temp_path = temp_dir / path.name
        if not temp_path.exists() or temp_path.stat().st_size != path.stat().st_size:
            import shutil
            shutil.copy2(path, temp_path)
        return str(temp_path)
    return path_str


# multiple formats supported, but only if content-type matches and magic bytes check out koi nahi samz jayega
ALLOWED_EXTENSIONS: set = {"png", "jpg", "jpeg", "gif", "webp"}
ALLOWED_CONTENT_TYPES: set = {"image/jpeg", "image/png", "image/gif", "image/webp"}

IMAGE_SIZE: int = 224
MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB
MAX_IMAGE_DIMENSION: int = 4096
CONFIDENCE_HIGH: float = 60.0
CONFIDENCE_MEDIUM: float = 40.0
TOP_K: int = 3
INFERENCE_TIMEOUT: int = 30  # sec
PORT: int = int(os.environ.get("PLANT_PORT", 5002))

#Magic Bytes for Image Validation - to prevent fake files with correct extensions
IMAGE_SIGNATURES: dict = {
    b'\xff\xd8\xff': 'jpeg',
    b'\x89PNG\r\n\x1a\n': 'png',
    b'GIF87a': 'gif',
    b'GIF89a': 'gif',
    b'RIFF': 'webp',
}


#ye resampling mode ka headache bhi hota hai PIL ke version ke hisab se, toh compatibility ke liye try-except lagaya hai
RESAMPLE_MODE = getattr(Image.Resampling, 'LANCZOS', None)  
if RESAMPLE_MODE is None:
    RESAMPLE_MODE = getattr(Image, 'LANCZOS', Image.BILINEAR)  # type: ignore[attr-defined]


def allowed_file(filename: Optional[str]) -> bool:
    """
    Check if the file extension is allowed.
    
    Args:
        filename: The filename to check (can be None or empty string)
        
    Returns:
        True if the file extension is allowed, False otherwise
    """
    if not filename:
        return False
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def validate_image_content(image_bytes: bytes) -> bool:
    """
    Verify file is actually an image by checking magic bytes.
    
    Args:
        image_bytes: Raw bytes of the uploaded file
        
    Returns:
        True if the file starts with a known image magic bytes signature
    """
    for sig in IMAGE_SIGNATURES:
        if image_bytes.startswith(sig):
            return True
    return False


def validate_image_dimensions(img: Image.Image, max_dimension: int = MAX_IMAGE_DIMENSION) -> None:
    """
    Validate that image dimensions are within acceptable limits.
    
    Args:
        img: PIL Image object to validate
        max_dimension: Maximum allowed width or height in pixels
        
    Raises:
        ValueError: If image exceeds maximum dimensions
    """
    if img.width > max_dimension or img.height > max_dimension:
        raise ValueError(f"Image too large. Max dimension: {max_dimension}px")


#Load model and class names 
MODEL_PATH = get_resource_path("model_final.tflite")
CLASS_NAMES_PATH = get_resource_path("class_names_final.txt")

#Convert Path to string for TensorFlow compatibility(with Unicode workaround) this is must guys
MODEL_PATH_STR = safe_path_str(MODEL_PATH)
CLASS_NAMES_PATH_STR = safe_path_str(CLASS_NAMES_PATH)

if not MODEL_PATH.exists():
    raise FileNotFoundError(f"Model not found at {MODEL_PATH_STR}")
if not CLASS_NAMES_PATH.exists():
    raise FileNotFoundError(f"Class names file not found at {CLASS_NAMES_PATH_STR}")

logger.info(f"Loading model from {MODEL_PATH}")

#Load interpreter - prefer tensorflow.lite (works with Python 3.13) 
#tflite_runtime has no Python 3.13 wheel available toh ye silly mistake ho sakti hai agar tflite_runtime import karne ki koshish karte ho toh, isliye tensorflow.lite ka fallback lagaya hai
#you can also try installing tflite_runtime with pip install tflite-runtime --index-url https://google-coral.github.io/py-repo/ if you want a smaller package without full TensorFlow, but it may not have Python 3.13 support yet

import tensorflow as tf
interpreter = tf.lite.Interpreter(model_path=MODEL_PATH_STR)
logger.info("Loaded via tensorflow.lite")

interpreter.allocate_tensors()
input_details = interpreter.get_input_details()
output_details = interpreter.get_output_details()

logger.info(f"Input shape  : {input_details[0]['shape']}")
logger.info(f"Output shape : {output_details[0]['shape']}")

#Load class names
with open(CLASS_NAMES_PATH_STR, encoding="utf-8") as f:
    CLASS_NAMES: List[str] = [l.strip() for l in f if l.strip()]

logger.info(f"Classes loaded: {len(CLASS_NAMES)}")
for i, name in enumerate(CLASS_NAMES):
    logger.info(f"  {i:2d}: {name}")


# yaha timeout handle kiya hai inference ke liye, kyunki kabhi kabhi model inference me kuch time lag sakta hai, especially agar koi unexpected input aa jaye ya model me koi issue ho toh, isliye ek custom exception banaya hai timeout ke liye aur threading ka use karke inference ko ek separate thread me run kar rahe hain taaki agar wo timeout exceed kar jaye toh hum usko handle kar sakein gracefully without crashing the server
class InferenceTimeoutError(Exception):
    """Raised when model inference exceeds the timeout threshold."""
    pass


@dataclass
class InferenceResult:
    """Container for inference result or error."""
    probs: Optional[np.ndarray] = None
    error: Optional[Exception] = None


def run_inference_with_timeout(tensor: np.ndarray) -> np.ndarray:
    """
    Run model inference with timeout protection (cross-platform).
    
    Args:
        tensor: Preprocessed image tensor
        
    Returns:
        Model output probabilities
        
    Raises:
        InferenceTimeoutError: If inference exceeds INFERENCE_TIMEOUT seconds
        Exception: If inference fails with any other error
    """
    result = InferenceResult()
    
    def inference_worker() -> None:
        try:
            interpreter.set_tensor(input_details[0]["index"], tensor)
            interpreter.invoke()
            result.probs = interpreter.get_tensor(output_details[0]["index"])[0]
        except Exception as e:
            result.error = e
    
    thread = threading.Thread(target=inference_worker)
    thread.daemon = True
    thread.start()
    thread.join(timeout=INFERENCE_TIMEOUT)
    
    if thread.is_alive():
        raise InferenceTimeoutError("Inference exceeded timeout threshold")
    
    if result.error is not None:
        raise result.error
    
    if result.probs is None:
        raise RuntimeError("Inference returned no results")
    
    return result.probs


#Preprocessing 
def preprocess(image_bytes: bytes) -> np.ndarray:
    """
    Preprocess image bytes for EfficientNetB0 model input
    
    EfficientNetB0 expects [0, 255] float32.
    No scaling to [-1, 1] needed — different from MobileNetV2
    
    Args:
        image_bytes: Raw bytes of the uploaded image
        
    Returns:
        Preprocessed image tensor of shape (1, IMAGE_SIZE, IMAGE_SIZE, 3)
        
    Raises:
        ValueError: If image dimensions are too large
    """
    img = Image.open(io_module.BytesIO(image_bytes)).convert("RGB")
    validate_image_dimensions(img, MAX_IMAGE_DIMENSION)
    img = img.resize((IMAGE_SIZE, IMAGE_SIZE), RESAMPLE_MODE)
    arr = np.array(img, dtype=np.float32)
    # Keep as [0, 255] — EfficientNetB0 handles normalization internally
    return np.expand_dims(arr, axis=0)  #shape: (1, IMAGE_SIZE, IMAGE_SIZE, 3)


#Routes
@app.route("/")
def index() -> str:
    """
    Serve the main application page
    
    Returns:
        Rendered HTML template for the plant identifier UI
    """
    return render_template("index.html")


@app.route("/predict", methods=["OPTIONS"])
def predict_options():
    """
    Handle CORS preflight requests.
    """
    return "", 204


@app.route("/ping")
def ping():
    """
    Health check endpoint to verify service and model status.
    
    Returns:
        JSON response containing service status, model info, and capabilities
    """
    return jsonify({
        "status": "ok",
        "model": "EfficientNetB0",
        "version": "1.0.0",
        "classes": len(CLASS_NAMES),
        "input_size": f"{IMAGE_SIZE}x{IMAGE_SIZE}"
    })


@app.route("/predict", methods=["POST", "OPTIONS"])
@app.route("/predict", methods=["OPTIONS"])
def predict():
    """
    Process plant identification request from uploaded image.
    
    Accepts multipart/form-data with an 'image' field containing
    the plant photo. Returns top 3 predictions with confidence scores.
    Also handles OPTIONS preflight requests for CORS.
    
    Returns:
        Tuple of (JSON response, HTTP status code)
    """
    # Handle CORS preflight jaruri hai bhai.... warna browser se request block ho jayegi especially jab frontend aur backend alag ports pe ho toh
    if request.method == "OPTIONS":
        return "", 204
    
    try:
        logger.info("REQUEST: /predict")

        if "image" not in request.files:
            logger.warning("REQUEST: No image in request")
            return jsonify({"error": "No image uploaded"}), 400

        file = request.files["image"]
        filename = file.filename
        
        if not filename or not allowed_file(filename):
            logger.warning(f"REQUEST: Invalid filename '{filename}'")
            return jsonify({
                "error": "Invalid file type. Allowed: PNG, JPG, JPEG, GIF, WEBP"
            }), 400

        #Content-Type validation is important to prevent fake files with correct extensions, but we also check magic bytes for extra security
        if file.content_type not in ALLOWED_CONTENT_TYPES:
            logger.warning(f"REQUEST: Invalid content-type '{file.content_type}'")
            return jsonify({"error": "Invalid content type"}), 400

        image_bytes = file.read()
        logger.info(f"FILE: {filename}  Size: {len(image_bytes)} bytes")

        if len(image_bytes) == 0:
            logger.warning("REQUEST: Empty file received")
            return jsonify({"error": "Empty file received"}), 400

        if len(image_bytes) > MAX_FILE_SIZE:
            logger.warning(f"REQUEST: File too large ({len(image_bytes)} bytes)")
            return jsonify({
                "error": f"File too large. Maximum size: {MAX_FILE_SIZE // (1024*1024)}MB"
            }), 400

        #Magic bytes validation to ensure file content matches expected image format, not just based on extension or content-type which can be fakedS
        if not validate_image_content(image_bytes):
            logger.warning("REQUEST: Invalid file content (magic bytes mismatch)")
            return jsonify({"error": "File content does not match a valid image format"}), 400

        #Preprocess
        tensor = preprocess(image_bytes)
        logger.info(f"TENSOR: shape={tensor.shape} range=[{tensor.min():.1f}, {tensor.max():.1f}]")

       
        try:
            probs = run_inference_with_timeout(tensor)
        except InferenceTimeoutError:
            logger.error("INFERENCE: Timeout exceeded")
            return jsonify({
                "error": "Inference timeout - please try again",
                "status": "timeout"
            }), 504
        
        logger.info(f"PROBS: sum={probs.sum():.4f}")

        #Top K results ekdum tumhare jaisa hai na! results
        top_indices = np.argsort(probs)[::-1][:TOP_K]
        top_results = [
            {
                "plant": CLASS_NAMES[i],
                "confidence": round(float(probs[i]) * 100, 1)
            }
            for i in top_indices
        ]

        top_conf = top_results[0]["confidence"]

        #mere trained models mere se jyada confident hote hai -- by gaurav mahajan
        if top_conf >= CONFIDENCE_HIGH:
            message = "confident"
        elif top_conf >= CONFIDENCE_MEDIUM:
            message = "uncertain — try a clearer photo"
        else:
            message = "low confidence — please retake photo"

        response: Dict[str, Any] = {
            "plant": top_results[0]["plant"],
            "confidence": top_conf,
            "top3": top_results,
            "message": message,
            "status": "success"
        }

        logger.info(f"RESULT: {top_results[0]}")
        return jsonify(response), 200

    except Exception as e:
        logger.error(f"ERROR: {traceback.format_exc()}")
        return jsonify({
            "error": "An internal error occurred",
            "status": "error"
        }), 500


if __name__ == "__main__":
    app.run(debug=False, port=PORT, host="0.0.0.0")

#chalo kuch sikh liya majak mai btw sirg=f frontend part vibecode to nahi but ai se likhvake edit karvaya tha as per my knowledge 
#and this code his written by my beautiful hands only, ai ne sirf help kiya thoda sa polish karne mai, but main logic, structure, error handling, comments sab maine hi likha hai ha ab ye mat kehana yt tutorial dekha ha mai hu campusx ka fan
#waise ye dl model train karne mai ek dost ne bahot help ki MrNikhil Chauhan aur model architecture aur training tips ke liye main EfficientNetB0 ka original paper bhi refer kiya tha by Mingxing Tan and Quoc V. Le, Google Research. Aur ha, model ko TensorFlow Lite me convert karne ke liye TensorFlow ki official documentation bhi dekhi thi. Overall, ye project ek combination hai mere apne efforts ka, kuch help from Nikhil and AI for polishing and debugging, aur inspiration from existing research and tutorials...
