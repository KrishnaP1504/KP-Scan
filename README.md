# KP Scan

A modern, fast, and feature-rich document scanner application built with **React Native**, **TypeScript**, and native Android **CameraX**. KP Scan turns your phone into a portable document scanner with edge cropping, filters, physical PDF compression, and file merging.

---

## Features

- 📸 **High-Quality Document Scanner**
  - Custom camera integration powered by Android CameraX.
  - Multi-page batch scanning mode with auto-focus and flash controls.
  - Gallery import support for both images and existing PDF files.

-  **Interactive Corner Cropping & Rotation**
  - Fine-tune scanned page boundaries with an interactive corner-adjustment overlay.
  - 90-degree fast rotations and orientation adjustment.

-  **Smart Document Filters**
  - **Magic Color:** Enhances contrast, balances lighting, and clarifies text.
  - **Grayscale / B&W:** Removes colored shadows for crisp, clean office scans.
  - **Original:** Keeps true photo fidelity.

-  **Physical PDF Compression**
  - Real byte-level compression that reduces physical PDF size on disk without sacrificing readability.
  - High, low, and custom compression presets with live size previews.

-  **Merge & Combine Documents**
  - Combine multiple scans, imported phone photos, and external PDFs into a single master document.
  - Easy reordering of pages and individual file removal.

-  **Local & Cloud Storage Options**
  - Save as PDF or high-resolution JPEG directly to your phone's storage.
  - Google Drive cloud backup integration for seamless cross-device synchronization.
  - **Privacy First:** All scans stay private on your local device storage.

---

##  Tech Stack

- **Framework:** [React Native](https://reactnative.dev/) (v0.74.5)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Navigation:** [React Navigation](https://reactnavigation.org/) (Native Stack & Bottom Tabs)
- **PDF Engine:** [pdf-lib](https://pdf-lib.js.org/) & [react-native-fs](https://github.com/itinance/react-native-fs)
- **Native Android Modules:** CameraX, Android `PdfRenderer`, and native image crop & compression modules.
- **Cloud & Auth:** Google Sign-In & Firebase Integration

---

##  Getting Started

### Prerequisites

Ensure you have the following installed on your development machine:
- **Node.js** (v18 or newer recommended)
- **JDK 17** (Required for React Native 0.74+)
- **Android Studio** with Android SDK (API 34) & Build Tools

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/KrishnaP1504/KP-Scan.git
   cd KP-Scan
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the Metro Bundler:**
   ```bash
   npm start
   ```

4. **Run on Android device / emulator:**
   ```bash
   npm run android
   ```

---

##  Building Standalone APK

To generate a standalone Release APK installable on any Android device:

```bash
cd android
./gradlew assembleRelease
```
*(On Windows PowerShell: `.\gradlew assembleRelease`)*

The generated `.apk` will be available at:
```
android/app/build/outputs/apk/release/app-release.apk
```

---

##  Project Structure

```
KP-Scan/
├── android/                 # Native Android project files & CameraX modules
├── ios/                     # iOS project files and assets
├── src/
│   ├── assets/              # Logos and custom iconography
│   ├── components/          # Reusable UI components (Modals, ActionSheets, etc.)
│   ├── config/              # Firebase & authentication configuration
│   ├── constants/           # Color palettes and typography design tokens
│   ├── context/             # Document, Auth, and Alert React Context providers
│   ├── navigation/          # Navigation stacks and tabs
│   ├── screens/
│   │   ├── auth/            # Sign-in & authentication screens
│   │   ├── home/            # Home document feed and management
│   │   ├── review/          # Document review, crop & filter editor
│   │   ├── scanner/         # Camera document scanning viewfinder
│   │   └── tools/           # Combine files & PDF compression tools
│   ├── services/            # File storage, PDF creation, and scanner services
│   ├── types/               # TypeScript interfaces & type definitions
│   └── utils/               # Responsive sizing & device permission helpers
├── App.tsx                  # App entry point
└── package.json             # Dependencies and scripts
```

---

##  Security & Privacy

KP Scan is designed with privacy at its core. Scanned documents are stored in private application storage on your local device. No document data or image files are transmitted to external third-party servers without explicit user consent (such as connecting to Google Drive).

---

##  License

This project is licensed under the MIT License.
