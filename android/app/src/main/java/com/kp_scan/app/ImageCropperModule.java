package com.kp_scan.app;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.io.File;
import java.io.FileOutputStream;

public class ImageCropperModule extends ReactContextBaseJavaModule {
    public ImageCropperModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "ImageCropper";
    }

    @ReactMethod
    public void cropImage(
        String uriString,
        double leftPercent,
        double topPercent,
        double widthPercent,
        double heightPercent,
        int rotation,
        Promise promise
    ) {
        try {
            String cleanPath = uriString.replace("file://", "");
            File file = new File(cleanPath);
            if (!file.exists()) {
                promise.reject("FILE_NOT_FOUND", "File not found: " + cleanPath);
                return;
            }

            Bitmap originalBitmap = BitmapFactory.decodeFile(file.getAbsolutePath());
            if (originalBitmap == null) {
                promise.reject("DECODE_ERROR", "Could not decode bitmap from path: " + cleanPath);
                return;
            }

            // 1. If user had rotated the image, rotate it first so crop matches screen orientation
            Bitmap orientedBitmap = originalBitmap;
            int normalizedRotation = ((rotation % 360) + 360) % 360;
            if (normalizedRotation != 0) {
                Matrix matrix = new Matrix();
                matrix.postRotate(normalizedRotation);
                orientedBitmap = Bitmap.createBitmap(
                    originalBitmap,
                    0,
                    0,
                    originalBitmap.getWidth(),
                    originalBitmap.getHeight(),
                    matrix,
                    true
                );
                if (orientedBitmap != originalBitmap) {
                    originalBitmap.recycle();
                }
            }

            int origWidth = orientedBitmap.getWidth();
            int origHeight = orientedBitmap.getHeight();

            int x = (int) Math.round(leftPercent * origWidth);
            int y = (int) Math.round(topPercent * origHeight);
            int w = (int) Math.round(widthPercent * origWidth);
            int h = (int) Math.round(heightPercent * origHeight);

            // Clamp coordinates to bitmap boundaries
            if (x < 0) x = 0;
            if (y < 0) y = 0;
            if (x >= origWidth) x = origWidth - 1;
            if (y >= origHeight) y = origHeight - 1;
            if (x + w > origWidth) w = origWidth - x;
            if (y + h > origHeight) h = origHeight - y;
            if (w < 1) w = 1;
            if (h < 1) h = 1;

            Bitmap croppedBitmap = Bitmap.createBitmap(orientedBitmap, x, y, w, h);

            File cacheDir = getReactApplicationContext().getCacheDir();
            File destFile = new File(cacheDir, "cropped_" + System.currentTimeMillis() + ".jpg");
            FileOutputStream out = new FileOutputStream(destFile);
            croppedBitmap.compress(Bitmap.CompressFormat.JPEG, 95, out);
            out.flush();
            out.close();

            if (orientedBitmap != croppedBitmap) {
                orientedBitmap.recycle();
            }
            croppedBitmap.recycle();

            promise.resolve("file://" + destFile.getAbsolutePath());
        } catch (Exception e) {
            promise.reject("CROP_ERROR", e.getMessage(), e);
        }
    }

    @ReactMethod
    public void compressImage(
        String uriString,
        int quality,
        double scaleFactor,
        Promise promise
    ) {
        try {
            String cleanPath = uriString.replace("file://", "");
            File file = new File(cleanPath);
            if (!file.exists()) {
                promise.reject("FILE_NOT_FOUND", "File not found: " + cleanPath);
                return;
            }

            Bitmap bitmap = BitmapFactory.decodeFile(file.getAbsolutePath());
            if (bitmap == null) {
                promise.reject("DECODE_ERROR", "Could not decode bitmap from path: " + cleanPath);
                return;
            }

            int origW = bitmap.getWidth();
            int origH = bitmap.getHeight();

            double scale = Math.max(0.1, Math.min(2.0, scaleFactor));
            int targetW = (int) Math.round(origW * scale);
            int targetH = (int) Math.round(origH * scale);
            if (targetW < 10) targetW = 10;
            if (targetH < 10) targetH = 10;

            Bitmap outputBitmap = bitmap;
            if (targetW != origW || targetH != origH) {
                outputBitmap = Bitmap.createScaledBitmap(bitmap, targetW, targetH, true);
                if (outputBitmap != bitmap) {
                    bitmap.recycle();
                }
            }

            int clampedQuality = Math.max(5, Math.min(100, quality));

            File cacheDir = getReactApplicationContext().getCacheDir();
            File destFile = new File(cacheDir, "comp_" + System.currentTimeMillis() + "_" + Math.round(Math.random() * 1000) + ".jpg");
            FileOutputStream out = new FileOutputStream(destFile);
            outputBitmap.compress(Bitmap.CompressFormat.JPEG, clampedQuality, out);
            out.flush();
            out.close();

            outputBitmap.recycle();

            promise.resolve("file://" + destFile.getAbsolutePath());
        } catch (Exception e) {
            promise.reject("COMPRESS_ERROR", e.getMessage(), e);
        }
    }
}
