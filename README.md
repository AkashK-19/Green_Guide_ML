# Plant Disease Recognition System 🌿🔍

An AI-powered web application that identifies 38 different classes of plant diseases from leaf images. Built with **Streamlit** and **TensorFlow/Keras**.

## Features
- **38 Disease Classes:** Covers a wide range of crops including Apple, Corn, Grape, Potato, Tomato, and more.
- **Accurate Predictions:** Uses state-of-the-art Deep Learning models.
- **User-Friendly Dashboard:** Simple sidebar navigation for Home, About, and Disease Recognition.
- **Real-time Feedback:** Provides confidence scores for each prediction.

## How to Run locally

### 1. Clone the repository
```bash
git clone https://github.com/your-username/plant-disease-detection.git
cd plant-disease-detection
```

### 2. Set up a Virtual Environment (Optional but Recommended)
```bash
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Run the Streamlit App
```bash
streamlit run main.py
```

## Dataset Information
This project utilizes a dataset of approximately 87K RGB images of healthy and diseased crop leaves, categorized into 38 different classes. The dataset is split into training (80%) and validation (20%) sets.

## Technologies Used
- **Python**
- **Streamlit** (Web UI)
- **TensorFlow / Keras** (Deep Learning)
- **NumPy & Pillow** (Image Processing)

## Project Structure
- `main.py`: The main Streamlit application script.
- `trained_model.h5` / `trained_model.keras`: Pre-trained models.
- `requirements.txt`: List of required Python packages.
- `Train_plant_disease.ipynb`: Notebook for model training.
- `Test_plant_disease.ipynb`: Notebook for model testing.
- `home_page.jpeg`: Application landing page image.

---
*Created with ❤️ to help farmers and gardeners protect their crops.*
