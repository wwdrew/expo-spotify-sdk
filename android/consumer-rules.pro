# Keep Spotify Auth SDK classes
-keep class com.spotify.sdk.android.auth.** { *; }
-keepclassmembers class com.spotify.sdk.android.auth.** { *; }
-dontwarn com.spotify.sdk.android.auth.**

# Keep our module's data classes
-keep class expo.modules.spotifysdk.** { *; }
-keepclassmembers class expo.modules.spotifysdk.** { *; }
