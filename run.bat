@echo off
set "PATHEXT=.COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC"
set "JAVA_HOME=C:\Java\jdk-17.0.12"
set "ANDROID_HOME=C:\Users\pipal\AppData\Local\Android\Sdk"
set "PATH=C:\Java\jdk-17.0.12\bin;C:\Users\pipal\AppData\Local\Android\Sdk\platform-tools;C:\Program\nodejs;C:\Windows\System32;%PATH%"

echo ========================================
echo   Launching KP Scan Android App
echo ========================================
echo Reversing adb port 8081...
adb reverse tcp:8081 tcp:8081

echo Building bundle...
call npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res

echo Installing debug build on device...
cd android
call gradlew.bat app:installDebug
cd ..

echo Starting app...
adb shell am force-stop com.kp_scan.app
adb shell am start -n com.kp_scan.app/.MainActivity
echo App launched successfully!
pause
