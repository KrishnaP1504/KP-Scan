package com.kp_scan.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.MotionEvent
import android.view.View
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class DocScanCameraActivity : AppCompatActivity() {

    private lateinit var viewFinder: PreviewView
    private lateinit var btnClose: ImageButton
    private lateinit var btnFlash: ImageButton
    private lateinit var btnGallery: ImageButton
    private lateinit var btnShutter: FrameLayout
    private lateinit var btnModeManual: TextView
    private lateinit var btnModeAuto: TextView
    private lateinit var tvStatusPill: TextView

    private var imageCapture: ImageCapture? = null
    private var cameraControl: CameraControl? = null
    private lateinit var cameraExecutor: ExecutorService

    private var flashMode: Int = ImageCapture.FLASH_MODE_OFF
    private var isAutoMode: Boolean = true
    private var hasCaptured: Boolean = false

    private val autoCaptureHandler = Handler(Looper.getMainLooper())
    private var autoCaptureRunnable: Runnable? = null

    companion object {
        private const val REQUEST_CODE_PERMISSIONS = 1001
        private const val REQUEST_CODE_GALLERY = 1002
        private val REQUIRED_PERMISSIONS = arrayOf(Manifest.permission.CAMERA)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_doc_scan_camera)

        viewFinder = findViewById(R.id.viewFinder)
        btnClose = findViewById(R.id.btnClose)
        btnFlash = findViewById(R.id.btnFlash)
        btnGallery = findViewById(R.id.btnGallery)
        btnShutter = findViewById(R.id.btnShutter)
        btnModeManual = findViewById(R.id.btnModeManual)
        btnModeAuto = findViewById(R.id.btnModeAuto)
        tvStatusPill = findViewById(R.id.tvStatusPill)

        cameraExecutor = Executors.newSingleThreadExecutor()

        setupButtons()

        if (allPermissionsGranted()) {
            startCamera()
        } else {
            ActivityCompat.requestPermissions(
                this, REQUIRED_PERMISSIONS, REQUEST_CODE_PERMISSIONS
            )
        }
    }

    private fun allPermissionsGranted() = REQUIRED_PERMISSIONS.all {
        ContextCompat.checkSelfPermission(baseContext, it) == PackageManager.PERMISSION_GRANTED
    }

    override fun onRequestPermissionsResult(
        requestCode: Int, permissions: Array<String>, grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_CODE_PERMISSIONS) {
            if (allPermissionsGranted()) {
                startCamera()
            } else {
                Toast.makeText(this, "Camera permission is required", Toast.LENGTH_SHORT).show()
                finish()
            }
        }
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun setupButtons() {
        btnClose.setOnClickListener {
            setResult(Activity.RESULT_CANCELED)
            finish()
        }

        btnFlash.setOnClickListener {
            toggleFlash()
        }

        btnGallery.setOnClickListener {
            openGallery()
        }

        btnShutter.setOnClickListener {
            cancelAutoCapture()
            takePhoto()
        }

        btnModeManual.setOnClickListener {
            setMode(false)
        }

        btnModeAuto.setOnClickListener {
            setMode(true)
        }

        // Tap to focus on preview
        viewFinder.setOnTouchListener { _, event ->
            if (event.action == MotionEvent.ACTION_UP) {
                val factory = viewFinder.meteringPointFactory
                val point = factory.createPoint(event.x, event.y)
                val action = FocusMeteringAction.Builder(point).build()
                cameraControl?.startFocusAndMetering(action)
            }
            true
        }
    }

    private fun setMode(auto: Boolean) {
        isAutoMode = auto
        if (auto) {
            btnModeAuto.setBackgroundResource(R.drawable.mode_pill_selected_bg)
            btnModeAuto.setTextColor(0xFF000000.toInt())
            btnModeManual.setBackgroundResource(0)
            btnModeManual.setTextColor(0xFFFFFFFF.toInt())
            tvStatusPill.text = "Scanning... hold steady"
            scheduleAutoCapture()
        } else {
            btnModeManual.setBackgroundResource(R.drawable.mode_pill_selected_bg)
            btnModeManual.setTextColor(0xFF000000.toInt())
            btnModeAuto.setBackgroundResource(0)
            btnModeAuto.setTextColor(0xFFFFFFFF.toInt())
            tvStatusPill.text = "Tap shutter to capture"
            cancelAutoCapture()
        }
    }

    private fun scheduleAutoCapture() {
        cancelAutoCapture()
        if (!isAutoMode || hasCaptured) return

        autoCaptureRunnable = Runnable {
            if (!isDestroyed && !isFinishing && !hasCaptured && isAutoMode) {
                takePhoto()
            }
        }
        // Auto capture after holding steady for 2.8 seconds
        autoCaptureHandler.postDelayed(autoCaptureRunnable!!, 2800)
    }

    private fun cancelAutoCapture() {
        autoCaptureRunnable?.let {
            autoCaptureHandler.removeCallbacks(it)
            autoCaptureRunnable = null
        }
    }

    private fun toggleFlash() {
        flashMode = when (flashMode) {
            ImageCapture.FLASH_MODE_OFF -> ImageCapture.FLASH_MODE_AUTO
            ImageCapture.FLASH_MODE_AUTO -> ImageCapture.FLASH_MODE_ON
            else -> ImageCapture.FLASH_MODE_OFF
        }

        when (flashMode) {
            ImageCapture.FLASH_MODE_OFF -> {
                btnFlash.setImageResource(R.drawable.ic_flash_off)
            }
            ImageCapture.FLASH_MODE_AUTO -> {
                btnFlash.setImageResource(R.drawable.ic_flash_auto)
            }
            ImageCapture.FLASH_MODE_ON -> {
                btnFlash.setImageResource(R.drawable.ic_flash_on)
            }
        }

        imageCapture?.flashMode = flashMode
    }

    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)

        cameraProviderFuture.addListener({
            val cameraProvider: ProcessCameraProvider = cameraProviderFuture.get()

            val preview = Preview.Builder()
                .build()
                .also {
                    it.setSurfaceProvider(viewFinder.surfaceProvider)
                }

            imageCapture = ImageCapture.Builder()
                .setCaptureMode(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY)
                .setFlashMode(flashMode)
                .build()

            val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA

            try {
                cameraProvider.unbindAll()
                val camera = cameraProvider.bindToLifecycle(
                    this, cameraSelector, preview, imageCapture
                )
                cameraControl = camera.cameraControl

                if (isAutoMode) {
                    scheduleAutoCapture()
                }
            } catch (exc: Exception) {
                Toast.makeText(this, "Could not start camera: ${exc.message}", Toast.LENGTH_SHORT).show()
            }
        }, ContextCompat.getMainExecutor(this))
    }

    private fun takePhoto() {
        val capture = imageCapture ?: return
        if (hasCaptured) return
        hasCaptured = true

        tvStatusPill.text = "Processing..."
        btnShutter.alpha = 0.5f

        val photoFile = File(cacheDir, "doc_scan_${System.currentTimeMillis()}.jpg")
        val outputOptions = ImageCapture.OutputFileOptions.Builder(photoFile).build()

        capture.takePicture(
            outputOptions,
            cameraExecutor,
            object : ImageCapture.OnImageSavedCallback {
                override fun onImageSaved(outputFileResults: ImageCapture.OutputFileResults) {
                    // Physical EXIF rotation bake to disk so JPEG is consistently right-side up
                    normalizeExifOrientation(photoFile)

                    runOnUiThread {
                        val resultIntent = Intent().apply {
                            putExtra("imagePath", photoFile.absolutePath)
                        }
                        setResult(Activity.RESULT_OK, resultIntent)
                        finish()
                    }
                }

                override fun onError(exception: ImageCaptureException) {
                    hasCaptured = false
                    runOnUiThread {
                        btnShutter.alpha = 1.0f
                        tvStatusPill.text = "Capture failed, tap again"
                        Toast.makeText(this@DocScanCameraActivity, "Capture failed: ${exception.message}", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        )
    }

    private fun normalizeExifOrientation(file: File) {
        try {
            val exif = ExifInterface(file.absolutePath)
            val orientation = exif.getAttributeInt(
                ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL
            )
            val degrees = when (orientation) {
                ExifInterface.ORIENTATION_ROTATE_90 -> 90
                ExifInterface.ORIENTATION_ROTATE_180 -> 180
                ExifInterface.ORIENTATION_ROTATE_270 -> 270
                else -> 0
            }
            if (degrees != 0) {
                val bitmap = BitmapFactory.decodeFile(file.absolutePath)
                if (bitmap != null) {
                    val matrix = Matrix().apply { postRotate(degrees.toFloat()) }
                    val rotated = Bitmap.createBitmap(
                        bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true
                    )
                    val fos = FileOutputStream(file)
                    rotated.compress(Bitmap.CompressFormat.JPEG, 95, fos)
                    fos.flush()
                    fos.close()
                    if (rotated != bitmap) bitmap.recycle()
                    rotated.recycle()
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun openGallery() {
        cancelAutoCapture()
        val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
            type = "image/*"
        }
        startActivityForResult(
            Intent.createChooser(intent, "Select Document"), REQUEST_CODE_GALLERY
        )
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQUEST_CODE_GALLERY && resultCode == Activity.RESULT_OK) {
            val uri: Uri? = data?.data
            if (uri != null) {
                try {
                    val inputStream: InputStream? = contentResolver.openInputStream(uri)
                    val photoFile = File(cacheDir, "gallery_doc_${System.currentTimeMillis()}.jpg")
                    val outputStream = FileOutputStream(photoFile)
                    inputStream?.copyTo(outputStream)
                    inputStream?.close()
                    outputStream.close()

                    normalizeExifOrientation(photoFile)

                    val resultIntent = Intent().apply {
                        putExtra("imagePath", photoFile.absolutePath)
                    }
                    setResult(Activity.RESULT_OK, resultIntent)
                    finish()
                } catch (e: Exception) {
                    Toast.makeText(this, "Failed to load selected image", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        cancelAutoCapture()
        cameraExecutor.shutdown()
    }
}
