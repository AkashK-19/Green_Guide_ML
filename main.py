import streamlit as st
import tensorflow as tf
import numpy as np

# Handle Keras 3 vs 2 compatibility
try:
    import tf_keras as keras
except ImportError:
    from tensorflow import keras

# Tensorflow Model Prediction
@st.cache_resource
def load_model():
    # Try loading the .h5 model first as it's often more compatible with Keras 2/3 transitions
    model_paths = ["trained_model.h5", "trained_model.keras"]
    for path in model_paths:
        try:
            # compile=False often fixes loading issues when we only need inference
            return keras.models.load_model(path, compile=False)
        except Exception as e:
            st.warning(f"Failed to load {path}: {e}")
            continue
    st.error("Could not load any model file. Please check if they exist.")
    return None

def model_prediction(test_image):
    try:
        model = load_model()
        if model is None:
            return None
        
        # Using keras.preprocessing for compatibility
        # Streamlit's UploadedFile is a file-like object which load_img handles
        image = keras.preprocessing.image.load_img(test_image, target_size=(128, 128))
        input_arr = keras.preprocessing.image.img_to_array(image)
        input_arr = np.array([input_arr])  # convert single image to batch (1, 128, 128, 3)
        
        predictions = model.predict(input_arr)
        
        # Ensure we have a 1D array of predictions
        if len(predictions.shape) > 1:
            predictions = predictions[0]
            
        # Get top 3 indices and their confidence scores
        # argsort gives indices of sorted elements; we take the last 3 and reverse them
        top_3_indices = np.argsort(predictions)[-3:][::-1]
        top_3_results = [(idx, float(predictions[idx]) * 100) for idx in top_3_indices]
        
        return top_3_results
    except Exception as e:
        st.error(f"Error during prediction: {e}")
        return None

# Main Page - Disease Recognition
st.header("PLANT DISEASE RECOGNITION SYSTEM")
st.markdown("""
Welcome to the Plant Disease Recognition System! 🌿🔍
Upload an image of a plant leaf, and our system will analyze it to detect potential diseases.
""")

test_image = st.file_uploader("Choose an Image:")
if test_image is not None:
    if st.button("Show Image"):
        st.image(test_image, use_container_width=True)
    
    # Predict button
    if st.button("Predict"):
        st.snow()
        st.write("Our Top Predictions")
        top_3_predictions = model_prediction(test_image)
        
        if top_3_predictions:
            # Reading Labels
            class_name = [
                'Apple___Apple_scab', 'Apple___Black_rot', 'Apple___Cedar_apple_rust', 'Apple___healthy',
                'Blueberry___healthy', 'Cherry_(including_sour)___Powdery_mildew', 
                'Cherry_(including_sour)___healthy', 'Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot', 
                'Corn_(maize)___Common_rust_', 'Corn_(maize)___Northern_Leaf_Blight', 'Corn_(maize)___healthy', 
                'Grape___Black_rot', 'Grape___Esca_(Black_Measles)', 'Grape___Leaf_blight_(Isariopsis_Leaf_Spot)', 
                'Grape___healthy', 'Orange___Haunglongbing_(Citrus_greening)', 'Peach___Bacterial_spot',
                'Peach___healthy', 'Pepper,_bell___Bacterial_spot', 'Pepper,_bell___healthy', 
                'Potato___Early_blight', 'Potato___Late_blight', 'Potato___healthy', 
                'Raspberry___healthy', 'Soybean___healthy', 'Squash___Powdery_mildew', 
                'Strawberry___Leaf_scorch', 'Strawberry___healthy', 'Tomato___Bacterial_spot', 
                'Tomato___Early_blight', 'Tomato___Late_blight', 'Tomato___Leaf_Mold', 
                'Tomato___Septoria_leaf_spot', 'Tomato___Spider_mites Two-spotted_spider_mite', 
                'Tomato___Target_Spot', 'Tomato___Tomato_Yellow_Leaf_Curl_Virus', 'Tomato___Tomato_mosaic_virus',
                'Tomato___healthy'
            ]
            
            best_match_idx, best_match_confidence = top_3_predictions[0]
            st.success(f"Best Match: **{class_name[best_match_idx]}** ({best_match_confidence:.2f}%)")
            
            if best_match_confidence < 100.0:
                st.write("### Top 3 Confidence Scores:")
                for i, (idx, confidence) in enumerate(top_3_predictions):
                    st.info(f"{i+1}. {class_name[idx]}: {confidence:.2f}%")
else:
    st.info("Please upload an image to proceed.")
