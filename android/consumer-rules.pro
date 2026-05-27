# Keep Spotify Auth SDK classes
-keep class com.spotify.sdk.android.auth.** { *; }
-keepclassmembers class com.spotify.sdk.android.auth.** { *; }
-dontwarn com.spotify.sdk.android.auth.**

# Keep Spotify App Remote SDK classes
-keep class com.spotify.android.appremote.** { *; }
-keepclassmembers class com.spotify.android.appremote.** { *; }
-dontwarn com.spotify.android.appremote.**

# Keep our module's data classes
-keep class expo.modules.spotifysdk.** { *; }
-keepclassmembers class expo.modules.spotifysdk.** { *; }
