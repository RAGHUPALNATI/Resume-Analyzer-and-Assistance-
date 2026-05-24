# FitSift: AI-Powered Talent Intelligence

<div align="center">

**Bridging the gap between raw resumes and role readiness using Local Machine Learning and Google Gemini AI.**

[![React](https://img.shields.io/badge/Frontend-React%2018-61DAFB?style=for-the-badge&logo=react&logoColor=06111f)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Build-Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Flask](https://img.shields.io/badge/Backend-Flask-FFFFFF?style=for-the-badge&logo=flask&logoColor=000000)](https://flask.palletsprojects.com/)
[![Python](https://img.shields.io/badge/Model%20Layer-Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Gemini](https://img.shields.io/badge/AI%20Layer-Google%20Gemini-4285F4?style=for-the-badge&logo=googlegemini&logoColor=white)](https://ai.google.dev/)

</div>

---

## 🌟 What is FitSift?

FitSift is a full-stack talent intelligence platform designed to help recruiters and hiring managers move past keyword matching. It uses **unsupervised machine learning** to cluster thousands of resumes into distinct skill profiles and **Generative AI (Gemini)** to provide deep, actionable insights into a candidate's readiness for specific roles.

Instead of scanning resumes one by one, FitSift gives you a "bird's-eye view" of your entire candidate pool.

---

## 🚀 Key Features

### 1. Intelligent Clustering (Local ML)
- **Automatic Grouping**: Resumes are vectorized using `SentenceTransformers` and grouped into 12 distinct clusters (e.g., Information Technology, Finance, Healthcare) using `K-Means`.
- **Dimensionality Reduction**: Uses `UMAP` to map complex skill relationships into a searchable talent map.
- **Data Insights**: Visualize skill density and cluster distributions across your entire database.

### 2. Role Readiness (Powered by Gemini AI)
- **Deep ATS Analysis**: Upload a resume (PDF or Text) and get a comprehensive ATS score.
- **Skill Gap Analysis**: Automatically identifies which skills are present, which are missing, and which are "extra strengths."
- **Bullet Point Rewriter**: Uses AI to identify weak resume bullet points and suggests high-impact alternatives.
- **JD Matching**: Paste a Job Description to get a role-specific match score and "readiness" label.

### 3. Bulk Resume Screening
- **Batch Processing**: Upload multiple resumes at once to see their predicted clusters and scores in a single table.
- **Exportable Data**: Export screening results to CSV for use in other HR tools.

---

## 🛠️ The Tech Stack

### Frontend
- **React 18 & Vite**: For a blazing fast, modern developer experience.
- **Framer Motion**: For smooth, premium UI transitions and sequential animations.
- **Recharts**: For interactive data visualizations (Radial charts, Radar maps, etc.).
- **Lucide React**: For a clean, consistent iconography system.

### Backend
- **Flask**: A lightweight Python API serving both local ML predictions and project statistics.
- **ML Pipeline**: `SentenceTransformers` (Embeddings), `UMAP` (Reduction), and `scikit-learn` (Clustering).
- **Parsers**: `pdfjs-dist` and `mammoth` for client-side document processing.

### AI Layer
- **Google Gemini 1.5 Flash**: Orchestrates the complex Role Readiness analysis, providing expert-level feedback on resume quality and formatting.

---

## 🗺️ Project Structure

```text
FitSift/
├── backend/                # Flask API & ML Logic
│   ├── app.py              # Main API server
│   └── requirements.txt    # Python dependencies
├── frontend/               # React Application
│   ├── src/
│   │   ├── components/     # Reusable UI elements
│   │   ├── pages/          # Dashboard, Analyze, Role Readiness, etc.
│   │   ├── utils/          # API services (Gemini, Backend)
│   │   └── constants/      # API Keys & Configuration
│   └── tailwind.config.js  # Design system configuration
├── models/                 # Pre-trained ML artifacts (.pkl)
├── Resume.csv              # Source data for clustering
└── README.md               # You are here!
```

---

## ⚡ Quick Start

### 1. Set up the Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate      # Windows
# source .venv/bin/activate # Mac/Linux
pip install -r requirements.txt
python app.py
```
*API will run at `http://localhost:5000`*

### 2. Set up the Frontend
```bash
cd frontend
npm install
npm run dev
```
*App will run at `http://localhost:5173`*

### 3. Configure AI (Role Readiness)
Open `frontend/src/constants/apiKeys.js` and add your Google Gemini API Key:
```javascript
export const GEMINI_API_KEY = "YOUR_KEY_HERE";
```

---

## 💡 Why FitSift?

Traditional Applicant Tracking Systems (ATS) often fail because they treat resumes as unstructured text blobs. FitSift turns the recruiting workflow into a structured **talent map**, allowing teams to review candidates by skill density and similarity rather than manual scanning. It bridges the gap between "Keyword Matching" and "Skill Intelligence."
