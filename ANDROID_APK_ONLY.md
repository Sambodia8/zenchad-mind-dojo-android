# Android APK only

Sam never wants this project treated, opened, published, or delivered as a standalone web app. He wants work performed for the Android app and delivered as an Android APK.

The React/Vite files in this folder are an internal implementation layer required by Capacitor to build the Android APK. Do not archive or separate them from `ZenChadAndroid`, because doing so would break the Android build. If browser-based visual checking is unavoidable, keep it hidden and describe it only as Android implementation QA; never present it as a web-app deliverable.

Unless Sam explicitly says otherwise, finish app changes by syncing the bundle into the Android project and producing an updated APK.
