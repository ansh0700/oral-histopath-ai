# Oral Histopathology AI Analyzer (OPMD / OSCC Research Prototype)

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Netlify-brightgreen?style=for-the-badge&logo=netlify)](https://melodic-panda-b78522.netlify.app)
**🌐 Live Web Application**: [https://melodic-panda-b78522.netlify.app](https://melodic-panda-b78522.netlify.app)

An interactive, research-grade computational histopathology system designed for the analysis of Oral Potentially Malignant Disorders (OPMD) and Oral Squamous Cell Carcinoma (OSCC) H&E images.

> **Medical Disclaimer**: This application is strictly a research and educational prototype, **NOT** a clinical diagnostic tool. The system does not provide automated clinical diagnoses.

---

## Key Features

1. **Multi-Layer Interactive Histopathology Canvas**:
   - Layer 1: Original high-resolution H&E RGB image (never modified)
   - Layer 2: Free-form positive (ADD) and negative (ERASE) brush strokes
   - Layer 3: AI-predicted segmentation mask with adjustable alpha opacity
   - Layer 4: Mathematical polygon boundary contours and bounding box overlays
   - Precision coordinate transforms mapping screen $\rightarrow$ canvas $\rightarrow$ original image coordinates across 0.1x to 20x zoom and infinite panning.

2. **Modular Multi-Model Segmentation Adapters**:
   - **ScribblePrompt** (Primary target: Free-form brush/scribble interactive segmentation with iterative refinement)
   - **PathoSAM** (Histopathology SAM adapter)
   - **VISTA-PATH** (Interactive pathology foundation model adapter)
   - **MedSAM** (Medical SAM bounding box adapter)
   - **CellViT** (Nuclear instance segmentation & pan-cancer classification adapter)
   - **HoVer-Net** (Simultaneous nuclear segmentation & distance map classification adapter)
   - **Honest Status Policy**: Models with missing checkpoints report `NOT CONFIGURED` with explicit capability flags.

3. **Dual-Output Original-Color Region Extraction**:
   - **Output 1 (RGB Bounding Box Crop)**: Original color H&E image cropped around the selected region with padding.
   - **Output 2 (Object Cutout)**: High-resolution RGBA cutout preserving original cellular and nuclear H&E staining colors while rendering non-mask background transparent.

4. **Grounded Morphological Analysis & Explanation Engine**:
   - Geometric measurements: Area ($\text{px}^2$ and $\mu\text{m}^2$), Perimeter, Circularity, Solidity, Eccentricity, Aspect Ratio, Equivalent Diameter.
   - Optical Stain Quantification: Hematoxylin Optical Density (nuclear hyperchromasia proxy), Eosin Optical Density, Stain Ratio.
   - Feature Classification Layer: Grounded categorizations (Nuclear Hyperchromasia, Nuclear Enlargement, Pleomorphism, Keratinization).
   - Educational Explanations with WHO histopathology context and mandatory medical safety warnings.

5. **Multi-Model Benchmark Comparison**:
   - "COMPARE THIS REGION": Runs identical brush ROI through all candidate models.
   - Compares masks, color crops, inference latencies ($\text{ms}$), and Dice/IoU metrics when ground truth annotations are present.

6. **Multi-Region Selection Manager & Audit Logging**:
   - Independent tracking for multiple regions (e.g. Region 1: Hyperchromatic Nucleus, Region 2: Dysplastic Cell, Region 3: Keratin Pearl).
   - Complete JSON experiment logging for reproducible benchmarks.

---

## Quick Start

### 1. Backend Setup

```bash
cd backend
py -3.14 -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

API is available at `http://127.0.0.1:8000` with Swagger docs at `http://127.0.0.1:8000/docs`.

### 2. Frontend Setup

```bash
cd frontend
npm run dev
```

Frontend application will open at `http://localhost:5173`.

### 3. Running Automated Tests

```bash
cd backend
py -3.14 -m pytest -v
```
