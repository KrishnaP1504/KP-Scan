package com.kp_scan.app;

import android.app.Activity;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import com.facebook.react.bridge.ActivityEventListener;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.BaseActivityEventListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.pdf.PdfRenderer;
import android.os.ParcelFileDescriptor;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;

public class DocScanCameraModule extends ReactContextBaseJavaModule {

    private static final int REQUEST_CODE_DIRECT_SCAN = 8801;
    private static final int REQUEST_CODE_PICK_LOCAL_FILES = 8802;

    private Promise mPickerPromise;
    private Promise mFilePickerPromise;

    private final ActivityEventListener mActivityEventListener = new BaseActivityEventListener() {
        @Override
        public void onActivityResult(Activity activity, int requestCode, int resultCode, Intent data) {
            if (requestCode == REQUEST_CODE_DIRECT_SCAN) {
                if (mPickerPromise != null) {
                    WritableMap resultMap = Arguments.createMap();
                    WritableArray imagesArray = Arguments.createArray();

                    if (resultCode == Activity.RESULT_OK && data != null) {
                        String imagePath = data.getStringExtra("imagePath");
                        if (imagePath != null && !imagePath.isEmpty()) {
                            String formattedPath = imagePath.startsWith("file://") ? imagePath : "file://" + imagePath;
                            imagesArray.pushString(formattedPath);
                            resultMap.putString("status", "SUCCESS");
                        } else {
                            resultMap.putString("status", "CANCELLED");
                        }
                    } else {
                        resultMap.putString("status", "CANCELLED");
                    }

                    resultMap.putArray("scannedImages", imagesArray);
                    mPickerPromise.resolve(resultMap);
                    mPickerPromise = null;
                }
            } else if (requestCode == REQUEST_CODE_PICK_LOCAL_FILES) {
                if (mFilePickerPromise != null) {
                    WritableMap resultMap = Arguments.createMap();
                    WritableArray filesArray = Arguments.createArray();

                    if (resultCode == Activity.RESULT_OK && data != null) {
                        ClipData clipData = data.getClipData();
                        if (clipData != null) {
                            for (int i = 0; i < clipData.getItemCount(); i++) {
                                Uri uri = clipData.getItemAt(i).getUri();
                                WritableMap map = copyAndProcessFile(activity, uri);
                                if (map != null) {
                                    filesArray.pushMap(map);
                                }
                            }
                        } else if (data.getData() != null) {
                            Uri uri = data.getData();
                            WritableMap map = copyAndProcessFile(activity, uri);
                            if (map != null) {
                                filesArray.pushMap(map);
                            }
                        }
                    }

                    resultMap.putString("status", filesArray.size() > 0 ? "SUCCESS" : "CANCELLED");
                    resultMap.putArray("files", filesArray);
                    mFilePickerPromise.resolve(resultMap);
                    mFilePickerPromise = null;
                }
            }
        }
    };

    public DocScanCameraModule(ReactApplicationContext reactContext) {
        super(reactContext);
        reactContext.addActivityEventListener(mActivityEventListener);
    }

    @Override
    public String getName() {
        return "DocScanCamera";
    }

    @ReactMethod
    public void launchDirectScanner(Promise promise) {
        Activity currentActivity = getCurrentActivity();
        if (currentActivity == null) {
            promise.reject("E_ACTIVITY_DOES_NOT_EXIST", "Activity doesn't exist");
            return;
        }

        mPickerPromise = promise;

        try {
            Intent intent = new Intent(currentActivity, DocScanCameraActivity.class);
            currentActivity.startActivityForResult(intent, REQUEST_CODE_DIRECT_SCAN);
        } catch (Exception e) {
            mPickerPromise = null;
            promise.reject("E_FAILED_TO_SHOW_CAMERA", e);
        }
    }

    @ReactMethod
    public void pickLocalFiles(Promise promise) {
        Activity currentActivity = getCurrentActivity();
        if (currentActivity == null) {
            promise.reject("E_ACTIVITY_DOES_NOT_EXIST", "Activity doesn't exist");
            return;
        }

        mFilePickerPromise = promise;

        try {
            Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
            intent.setType("*/*");
            String[] mimeTypes = {"application/pdf", "image/*"};
            intent.putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes);
            intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            currentActivity.startActivityForResult(
                Intent.createChooser(intent, "Select PDF or Image"),
                REQUEST_CODE_PICK_LOCAL_FILES
            );
        } catch (Exception e) {
            mFilePickerPromise = null;
            promise.reject("E_FAILED_TO_PICK_FILE", e);
        }
    }

    private WritableMap copyAndProcessFile(Activity activity, Uri uri) {
        try {
            ContentResolver resolver = activity.getContentResolver();
            String displayName = "file_" + System.currentTimeMillis();
            String mimeType = resolver.getType(uri);

            try (Cursor cursor = resolver.query(uri, null, null, null, null)) {
                if (cursor != null && cursor.moveToFirst()) {
                    int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                    if (nameIndex != -1) {
                        String name = cursor.getString(nameIndex);
                        if (name != null && !name.trim().isEmpty()) {
                            displayName = name.trim();
                        }
                    }
                }
            } catch (Exception ignored) {}

            String lowerName = displayName.toLowerCase();
            boolean isPdf = (mimeType != null && mimeType.contains("pdf")) || lowerName.endsWith(".pdf");
            boolean isImage = (mimeType != null && mimeType.startsWith("image")) ||
                    lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg") ||
                    lowerName.endsWith(".png") || lowerName.endsWith(".webp") ||
                    lowerName.endsWith(".bmp") || lowerName.endsWith(".heic") ||
                    lowerName.endsWith(".heif");

            // Strictly PDF or Image only
            if (!isPdf && !isImage) {
                return null;
            }

            File cacheDir = activity.getCacheDir();
            WritableMap fileMap = Arguments.createMap();
            fileMap.putString("name", displayName);

            if (isPdf) {
                // Ensure filename ends with .pdf
                String safePdfName = displayName.endsWith(".pdf") ? displayName : displayName + ".pdf";
                File destPdf = new File(cacheDir, "imported_" + System.currentTimeMillis() + "_" + safePdfName);

                try (InputStream in = resolver.openInputStream(uri);
                     FileOutputStream out = new FileOutputStream(destPdf)) {
                    if (in == null) return null;
                    byte[] buffer = new byte[8192];
                    int len;
                    while ((len = in.read(buffer)) != -1) {
                        out.write(buffer, 0, len);
                    }
                    out.flush();
                }

                int pageCount = 1;
                WritableArray pagesArray = Arguments.createArray();
                String thumbUri = "";

                try (ParcelFileDescriptor pfd = ParcelFileDescriptor.open(destPdf, ParcelFileDescriptor.MODE_READ_ONLY)) {
                    PdfRenderer renderer = new PdfRenderer(pfd);
                    pageCount = renderer.getPageCount();

                    for (int p = 0; p < pageCount; p++) {
                        PdfRenderer.Page page = renderer.openPage(p);
                        int pw = page.getWidth();
                        int ph = page.getHeight();
                        float scale = Math.min(1600f / Math.max(pw, ph), 2.0f);
                        int rw = Math.max(1, Math.round(pw * scale));
                        int rh = Math.max(1, Math.round(ph * scale));

                        Bitmap bmp = Bitmap.createBitmap(rw, rh, Bitmap.Config.ARGB_8888);
                        bmp.eraseColor(Color.WHITE);
                        page.render(bmp, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);
                        page.close();

                        File pageFile = new File(cacheDir, "pdf_pg_" + System.currentTimeMillis() + "_" + p + ".jpg");
                        try (FileOutputStream imgOut = new FileOutputStream(pageFile)) {
                            bmp.compress(Bitmap.CompressFormat.JPEG, 88, imgOut);
                            imgOut.flush();
                        }
                        bmp.recycle();

                        String pageUri = "file://" + pageFile.getAbsolutePath();
                        pagesArray.pushString(pageUri);
                        if (p == 0) {
                            thumbUri = pageUri;
                        }
                    }
                    renderer.close();
                } catch (Exception renderErr) {
                    renderErr.printStackTrace();
                }

                fileMap.putString("uri", "file://" + destPdf.getAbsolutePath());
                fileMap.putString("type", "pdf");
                fileMap.putDouble("size", destPdf.length());
                fileMap.putInt("pageCount", Math.max(pageCount, 1));
                fileMap.putString("thumbnailUri", thumbUri);
                fileMap.putArray("pages", pagesArray);
                return fileMap;
            } else {
                // Image file: decode and normalize to high-quality JPEG
                File destImg = new File(cacheDir, "imported_" + System.currentTimeMillis() + ".jpg");
                Bitmap bitmap = null;
                try (InputStream in = resolver.openInputStream(uri)) {
                    if (in != null) {
                        bitmap = BitmapFactory.decodeStream(in);
                    }
                } catch (Exception ignored) {}

                if (bitmap != null) {
                    try (FileOutputStream out = new FileOutputStream(destImg)) {
                        bitmap.compress(Bitmap.CompressFormat.JPEG, 92, out);
                        out.flush();
                    }
                    bitmap.recycle();
                } else {
                    // Raw copy fallback
                    try (InputStream in = resolver.openInputStream(uri);
                         FileOutputStream out = new FileOutputStream(destImg)) {
                        if (in == null) return null;
                        byte[] buffer = new byte[8192];
                        int len;
                        while ((len = in.read(buffer)) != -1) {
                            out.write(buffer, 0, len);
                        }
                        out.flush();
                    }
                }

                String imgUri = "file://" + destImg.getAbsolutePath();
                WritableArray pagesArray = Arguments.createArray();
                pagesArray.pushString(imgUri);

                fileMap.putString("uri", imgUri);
                fileMap.putString("type", "image");
                fileMap.putDouble("size", destImg.length());
                fileMap.putInt("pageCount", 1);
                fileMap.putString("thumbnailUri", imgUri);
                fileMap.putArray("pages", pagesArray);
                return fileMap;
            }
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }
}
