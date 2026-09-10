# KP Scan

A fast, lightweight, and modern document scanner application built with React Native, TypeScript, and native Android CameraX. KP Scan allows users to capture, crop, enhance, compress, merge, and export high-resolution PDF documents directly on their device.

---

## Features

- **Document Scanning**
  - Camera integration using native Android CameraX.
  - Multi-page batch scanning mode with auto-focus and flash controls.
  - Local device import support for both images and existing PDF files.

- **Corner Cropping and Perspective Adjustment**
  - Fine-tune scanned page boundaries with an interactive corner-adjustment overlay.
  - 90-degree fast rotations and orientation adjustment.

- **Document Filters**
  - **Magic Color:** Enhances contrast, balances lighting, and clarifies text.
  - **Grayscale / B&W:** Removes colored shadows for crisp, clean document scans.
  - **Original:** Preserves exact captured photo details.

- **Physical PDF Compression**
  - Byte-level image re-encoding to physically reduce PDF file size on disk without sacrificing readability.
  - High, low, and custom compression presets with live size previews.

- **Merge and Combine Documents**
  - Combine multiple scans, phone photos, and external PDFs into a single unified document.
  - Reorder pages and delete individual items prior to combining.

- **Storage and Export**
  - Export as PDF or JPEG directly to local device storage.
  - Optional Google Drive cloud backup integration for account-level synchronization.
  - **Local Privacy:** All document files and images remain strictly on your local device.

---

## Tech Stack

- **Framework:** [React Native](https://reactnative.dev/) (0.74.5)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Navigation:** [React Navigation](https://reactnavigation.org/) (Native Stack & Bottom Tabs)
- **PDF Engine:** [pdf-lib](https://pdf-lib.js.org/) & [react-native-fs](https://github.com/itinance/react-native-fs)
- **Native Android Modules:** CameraX, Android `PdfRenderer`, custom image crop & compression modules
- **Cloud and Auth:** Google Sign-In & Firebase Integration

---

## Getting Started

### Prerequisites

Ensure the following tools are installed:
- **Node.js** (v18 or higher)
- **JDK 17** (Required for React Native 0.74+)
- **Android Studio** with Android SDK (API 34) and Build Tools

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

4. **Run on Android device or emulator:**
   ```bash
   npm run android
   ```

---

## Building Standalone APK

To generate a standalone Release APK installable on any Android device:

```bash
cd android
./gradlew assembleRelease
```
*(On Windows PowerShell: `.\gradlew assembleRelease`)*

The generated `.apk` file will be located at:
```
android/app/build/outputs/apk/release/app-release.apk
```

---

## Project Structure

```
KP-Scan/
├── android/                 # Native Android project files & CameraX modules
├── ios/                     # iOS project configuration & assets
├── src/
│   ├── assets/              # App branding and vector icons
│   ├── components/          # Reusable UI components (Modals, ActionSheets, Overlays)
│   ├── config/              # Firebase & authentication configurations
│   ├── constants/           # Color palettes and theme tokens
│   ├── context/             # Document, Auth, and Alert React Context providers
│   ├── navigation/          # Navigation stacks and tabs
│   ├── screens/
│   │   ├── auth/            # Sign-in & account authentication screens
│   │   ├── home/            # Main document feed and document actions
│   │   ├── review/          # Document review, crop & filter editor
│   │   ├── scanner/         # Camera document scanning viewfinder
│   │   └── tools/           # File combine and PDF compression tools
│   ├── services/            # File storage, PDF creation, and scanner services
│   ├── types/               # TypeScript interfaces & type definitions
│   └── utils/               # Responsive sizing & permission utilities
├── App.tsx                  # Application entry point
└── package.json             # Dependencies and scripts
```

---

## Privacy and Security

KP Scan stores all scanned pages, processed images, and generated PDFs within private application storage on your local device. No documents are transmitted to external servers without your explicit action.

---

## License

This project is licensed under the MIT License.
