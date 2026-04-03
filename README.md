# 🌿 GreenGuide: AI-Powered Plant Management System

GreenGuide is a comprehensive full-stack platform designed for plant enthusiasts, gardeners, and practitioners of herbal medicine. It leverages Artificial Intelligence to identify medicinal plants and detect common plant diseases while providing a robust ecosystem for plant care management.

---

## 🚀 Key Features

- **🔍 AI Plant Identification:** Classify herbal and ayurvedic plants from images using deep learning.
- **🏥 Disease Detection:** Upload images of infected plants to get instant diagnosis and treatment tips.
- **🤖 GreenBot AI Assistant:** A specialized chatbot (powered by Gemini) for all your gardening and plant-related queries.
- **💳 Subscription System:** Flexible plans (Weekly, Monthly, Yearly) integrated with **Razorpay**.
- **📊 Admin Dashboard:** Comprehensive management of users, subscriptions, and platform content.
- **🌱 Plant Database:** A curated collection of plants with detailed care instructions.

---

## 🏗️ Project Architecture

The project is structured into three main components:

### 1. **Client (Frontend)**
- **Tech:** React.js, React Router, CSS3.
- **Purpose:** The primary user interface for discovering plants, using AI tools, and managing user accounts.

### 2. **Admin (Dashboard)**
- **Tech:** React.js, Vite, Lucide Icons.
- **Purpose:** A dedicated portal for administrators to oversee platform operations.

### 3. **Backend (Services)**
- **Node.js/Express Server:** Handles authentication, business logic, payments, and proxies to ML services.
- **Python ML Servers:** Flask-based microservices running TensorFlow/Keras models for computer vision tasks.
- **Database:** MongoDB for persistent data storage.

---

## 📂 Repository Structure

```text
Green_Guide_ML/
├── client/           # React User Frontend
├── admin/            # React Admin Dashboard
├── backend/          # Node.js API Gateway
│   ├── ml_server/    # Python Disease Detection Service (Port 5001)
│   └── plant_server/ # Python Plant Identification Service (Port 5002)
└── uploads/          # Shared storage for processed images
```

---

## 🛠️ Quick Setup

### 1. Prerequisites
- **Node.js** (v18+)
- **Python** (v3.9+)
- **MongoDB** (Local or Atlas)
- **API Keys:** Google Gemini, Razorpay

### 2. Backend Setup
```bash
cd backend
npm install
# Create .env based on backend/README.md
npm run dev
```

### 3. ML Services Setup
```bash
# Terminal 1: Disease Detection
cd backend/ml_server
pip install -r requirements.txt
python app.py

# Terminal 2: Plant Identification
cd backend/plant_server
pip install -r requirements.txt
python app.py
```

### 4. Frontend Setup
```bash
# Terminal 3: User Client
cd client
npm install
npm run start

# Terminal 4: Admin Dashboard
cd admin
npm install
npm run dev
```

---

## 📡 Port Mapping

| Service | Port | Description |
| :--- | :--- | :--- |
| **API Server** | `5000` | Central Node.js API |
| **User Client** | `3000` | Main User Website |
| **Admin Panel** | `5173` | Admin Dashboard (Vite) |
| **ML Disease** | `5001` | Python Flask (Disease Detection) |
| **ML Plant ID** | `5002` | Python Flask (Plant Species) |

---

## 📝 License
ISC License - See individual package files for details.
