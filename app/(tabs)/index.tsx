import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as Speech from "expo-speech";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// --- FIREBASE IMPORTS ---
import { initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyAira_qqKIAiBKp_rdYVv29BZVrQUdzVmQ",
  authDomain: "gardeningassistant.firebaseapp.com",
  projectId: "gardeningassistant",
  storageBucket: "gardeningassistant.firebasestorage.app",
  messagingSenderId: "619828019144",
  appId: "1:619828019144:web:c8b1515bab8f1294d9cafd",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ─── Pest Detection Screen ────────────────────────────────────────────────────
function PestDetectionScreen({ lang, t }) {
  const [image, setImage] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // Replace YOUR_LAPTOP_IP with your actual IP e.g. 192.168.1.5
  const BACKEND_URL = "http://192.168.1.2:5000";

  const ui = {
    en: {
      title: "Pest & Disease Detection",
      subtitle: "Take or upload a photo of your crop",
      camera: "📷  Take Photo",
      gallery: "🖼️  Choose from Gallery",
      analyze: "🔍  Analyze Image",
      analyzing: "Analyzing...",
      resultLabel: "Detection Result",
      tryAgain: "Try Another Image",
      speak: "🔊 Hear Result",
    },
    ta: {
      title: "பூச்சி & நோய் கண்டறிதல்",
      subtitle: "உங்கள் பயிரின் புகைப்படம் எடுக்கவும்",
      camera: "📷  புகைப்படம் எடு",
      gallery: "🖼️  கேலரியிலிருந்து தேர்வு",
      analyze: "🔍  படத்தை பகுப்பாய்வு செய்",
      analyzing: "பகுப்பாய்வு செய்கிறது...",
      resultLabel: "கண்டறிதல் முடிவு",
      tryAgain: "வேறு படம் முயற்சி",
      speak: "🔊 முடிவை கேளுங்கள்",
    },
  };
  const u = ui[lang] || ui.en;

  const pickFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Error", "Camera permission required.");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
    });
    if (!res.canceled) {
      setImage(res.assets[0]);
      setResult(null);
    }
  };

  const pickFromGallery = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
    });
    if (!res.canceled) {
      setImage(res.assets[0]);
      setResult(null);
    }
  };

  const analyzeImage = async () => {
    if (!image?.base64) return;
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch(`${BACKEND_URL}/predict`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image_base64: image.base64 }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      const icon = data.is_healthy ? "✅" : "⚠️";
      const mockNote = data.mock
        ? "\n\n[Demo mode — train model for real predictions]"
        : "";
      setResult(
        `${icon} ${data.disease}\nConfidence: ${data.confidence}%\n\nTreatment:\n${data.treatment}${mockNote}`,
      );
    } catch (err) {
      Alert.alert(
        "Connection Error",
        "Make sure:\n• Backend is running (python app.py)\n• Phone & laptop on same WiFi\n• IP address is correct",
      );
    }
    setLoading(false);
  };

  return (
    <ScrollView contentContainerStyle={pestStyles.container}>
      <Text style={pestStyles.title}>{u.title}</Text>
      <Text style={pestStyles.subtitle}>{u.subtitle}</Text>

      {image ? (
        <View style={pestStyles.imageContainer}>
          <Image
            source={{ uri: image.uri }}
            style={pestStyles.image}
            resizeMode="cover"
          />
        </View>
      ) : (
        <View style={pestStyles.imagePlaceholder}>
          <Text style={{ fontSize: 60 }}>🌿</Text>
          <Text style={{ color: "#aaa", marginTop: 8 }}>No image selected</Text>
        </View>
      )}

      <View style={pestStyles.btnRow}>
        <TouchableOpacity
          style={pestStyles.btnSecondary}
          onPress={pickFromCamera}
        >
          <Text style={pestStyles.btnSecondaryText}>{u.camera}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={pestStyles.btnSecondary}
          onPress={pickFromGallery}
        >
          <Text style={pestStyles.btnSecondaryText}>{u.gallery}</Text>
        </TouchableOpacity>
      </View>

      {image && !loading && (
        <TouchableOpacity style={pestStyles.btnPrimary} onPress={analyzeImage}>
          <Text style={pestStyles.btnPrimaryText}>{u.analyze}</Text>
        </TouchableOpacity>
      )}

      {loading && (
        <View style={{ alignItems: "center", marginVertical: 20 }}>
          <ActivityIndicator size="large" color="#2e7d32" />
          <Text style={{ marginTop: 10, color: "#555" }}>{u.analyzing}</Text>
        </View>
      )}

      {result && (
        <View style={pestStyles.resultCard}>
          <Text style={pestStyles.resultLabel}>{u.resultLabel}</Text>
          <Text style={pestStyles.resultText}>{result}</Text>
          <TouchableOpacity
            style={pestStyles.speakBtn}
            onPress={() =>
              Speech.speak(result, {
                language: lang === "ta" ? "ta-IN" : "en-IN",
                rate: 0.85,
              })
            }
          >
            <Text style={pestStyles.speakBtnText}>{u.speak}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ marginTop: 10, alignItems: "center" }}
            onPress={() => {
              setImage(null);
              setResult(null);
            }}
          >
            <Text style={{ color: "#999", fontSize: 13 }}>{u.tryAgain}</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const pestStyles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#f9f9f9",
    padding: 20,
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1b5e20",
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: "#777",
    textAlign: "center",
    marginBottom: 20,
  },
  imageContainer: {
    width: "100%",
    height: 240,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
    elevation: 4,
  },
  image: { width: "100%", height: "100%" },
  imagePlaceholder: {
    width: "100%",
    height: 200,
    borderRadius: 16,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "#ddd",
    borderStyle: "dashed",
  },
  btnRow: { flexDirection: "row", gap: 10, width: "100%", marginBottom: 12 },
  btnSecondary: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#2e7d32",
    padding: 13,
    borderRadius: 12,
    alignItems: "center",
  },
  btnSecondaryText: { color: "#2e7d32", fontWeight: "600", fontSize: 13 },
  btnPrimary: {
    width: "100%",
    backgroundColor: "#1b5e20",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 16,
    elevation: 3,
  },
  btnPrimaryText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  resultCard: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    elevation: 4,
    marginTop: 8,
    borderLeftWidth: 5,
    borderLeftColor: "#2e7d32",
  },
  resultLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  resultText: { fontSize: 15, color: "#333", lineHeight: 24 },
  speakBtn: {
    marginTop: 14,
    backgroundColor: "#e8f5e9",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  speakBtnText: { color: "#2e7d32", fontWeight: "600" },
});

export default function App() {
  // --- STATES ---
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoginView, setIsLoginView] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState("home");
  const [lang, setLang] = useState("ta");
  const [selectedCrop, setSelectedCrop] = useState(null);
  const [forecastData, setForecastData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(null);
  const [manualCommand, setManualCommand] = useState("");

  const API_KEY = "0ed4badab1bde6ff9948854e82d8c165";
  const BACKEND_URL = "http://192.168.1.2:5000";

  // --- VOICE COMMAND MAPPING ---
  const voiceCommands = {
    "1": "weather",
    one: "weather",
    ஒன்று: "weather",
    ஒன்னு: "weather",
    "2": "pest",
    two: "pest",
    இரண்டு: "pest",
    ரெண்டு: "pest",
    "3": "crop",
    three: "crop",
    மூன்று: "crop",
    மூணு: "crop",
    "4": "diary",
    four: "diary",
    நான்கு: "diary",
    நாலு: "diary",
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (authenticatedUser) => {
      setUser(authenticatedUser);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status === "granted") {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
        const { recording: newRecording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY,
        );
        setRecording(newRecording);
      }
    } catch (err) {
      Alert.alert("Mic Error", "Could not start recording");
    }
  };

  const stopAndProcessVoice = async () => {
    if (!recording) return;
    const currentRecording = recording;
    setRecording(null);
    setLoading(true);
    try {
      await currentRecording.stopAndUnloadAsync();
      const uri = currentRecording.getURI();
      if (!uri) throw new Error("No audio recorded");

      // Ensure you use the correct encoding constant
      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const response = await fetch(`${BACKEND_URL}/transcribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }, // Capitalization matters
        body: JSON.stringify({
          audio_base64: base64Audio,
          lang: lang,
        }),
      });

      const data = await response.json();
      if (data.text) {
        handleVoiceCommand(data.text);
      } else {
        Alert.alert(
          lang === "ta" ? "புரியவில்லை" : "Not understood",
          "Please try again.",
        );
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Check if server is running and on the same WiFi.");
    }
    setLoading(false);
  };

  const handleVoiceCommand = (text) => {
    const cleanText = text?.toString().toLowerCase().trim();
    const targetScreen = voiceCommands[cleanText];
    if (targetScreen) {
      setCurrentScreen(targetScreen);
      setManualCommand("");
      Speech.speak(
        lang === "ta" ? "திரை மாற்றப்படுகிறது" : "Switching screen",
        { language: lang === "ta" ? "ta-IN" : "en-IN" },
      );
    } else if (text !== "") {
      Alert.alert("Error", "Command not recognized. Try 1, 2, 3, or 4.");
    }
  };

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter both email and password.");
      return;
    }
    try {
      if (isLoginView) await signInWithEmailAndPassword(auth, email, password);
      else {
        await createUserWithEmailAndPassword(auth, email, password);
        Alert.alert("Success", "Account created successfully!");
      }
    } catch (error) {
      Alert.alert("Authentication Error", error.message);
    }
  };

  const handleLogout = () => {
    signOut(auth).then(() => {
      setCurrentScreen("home");
      setEmail("");
      setPassword("");
    });
  };

  const translations = {
    en: {
      nav_guide:
        "Say or Tap: 1 for Weather, 2 for Pest, 3 for Crop, 4 for Diary.",
      tab_names: {
        weather: "Weather forecast",
        pest: "Pest Detection",
        crop: "Crop Recommendation",
        diary: "Farm Diary",
      },
      back: "Back",
      title: "Precision Farm Assistant",
      weather_report: "Today's Timeline",
      speak_btn: "🔊 Hear Advisory",
      crops: { rice: "Rice", cotton: "Cotton" },
      alerts: {
        RainSoon: (hrs) =>
          `Rain predicted in ${hrs} hours. Cancel fertilizer spraying.`,
        ClearSky: "No rain predicted. Safe for fertilization.",
        select: "Select a crop for advice.",
      },
      labels: { time: "Time", temp: "Temp", cond: "Condition" },
    },
    ta: {
      nav_guide: "வானிலைக்கு 1, பூச்சிக்கு 2, பயிருக்கு 3, நாட்குறிப்பிற்கு 4.",
      tab_names: {
        weather: "வானிலை",
        pest: "பூச்சி கண்டறிதல்",
        crop: "பயிர் பரிந்துரை",
        diary: "நாட்குறிப்பு",
      },
      back: "பின்னால்",
      title: "துல்லிய விவசாய உதவியாளர்",
      weather_report: "இன்றைய காலக்கோடு",
      speak_btn: "🔊 ஆலோசனையைக் கேளுங்கள்",
      crops: { rice: "நெல்", cotton: "பருத்தி" },
      alerts: {
        RainSoon: (hrs) =>
          `இன்னும் ${hrs} மணிநேரத்தில் மழை பெய்யும். உரம் இட வேண்டாம்.`,
        ClearSky: "மழைக்கு வாய்ப்பில்லை. உரம் இட தகுந்த நேரம்.",
        select: "ஆலோசனையைக் கேட்க பயிரைத் தேர்ந்தெடுக்கவும்.",
      },
      labels: { time: "நேரம்", temp: "வெப்பநிலை", cond: "நிலை" },
    },
  };

  const t = translations[lang];

  useEffect(() => {
    if (user && currentScreen === "weather") {
      (async () => {
        setLoading(true);
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setLoading(false);
          return;
        }
        try {
          let loc = await Location.getCurrentPositionAsync({});
          const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${loc.coords.latitude}&lon=${loc.coords.longitude}&units=metric&appid=${API_KEY}`;
          const response = await fetch(url);
          const data = await response.json();
          if (response.ok) {
            const next24h = data.list.slice(0, 8);
            setForecastData(next24h);
            const rainEntry = next24h.find(
              (item) => item.weather[0].main === "Rain",
            );
            setSummary(
              rainEntry
                ? {
                    willRain: true,
                    hoursAway: Math.max(
                      1,
                      Math.round(
                        (rainEntry.dt * 1000 - new Date().getTime()) / 3600000,
                      ),
                    ),
                  }
                : { willRain: false },
            );
          }
        } catch (e) {
          console.log(e);
        }
        setLoading(false);
      })();
    }
  }, [currentScreen, user]);

  const speakAdvice = () => {
    let msg = !selectedCrop
      ? t.alerts.select
      : summary?.willRain
        ? t.alerts.RainSoon(summary.hoursAway)
        : t.alerts.ClearSky;
    Speech.speak(msg, {
      language: lang === "ta" ? "ta-IN" : "en-IN",
      rate: 0.8,
    });
  };

  if (authLoading)
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#1b5e20" />
      </View>
    );

  if (!user)
    return (
      <View style={styles.authContainer}>
        <Text style={styles.authHeader}>
          {isLoginView ? "Farmer Login" : "Farmer Registration"}
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Email Address"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TouchableOpacity style={styles.authButton} onPress={handleAuth}>
          <Text style={styles.authButtonText}>
            {isLoginView ? "LOGIN" : "CREATE ACCOUNT"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setIsLoginView(!isLoginView)}>
          <Text style={styles.toggleText}>
            {isLoginView
              ? "Don't have an account? Sign Up"
              : "Already have an account? Login"}
          </Text>
        </TouchableOpacity>
      </View>
    );

  if (currentScreen === "home")
    return (
      <View style={styles.container}>
        <View style={styles.topBar}>
          <Text style={styles.userLabel}>{user.email}</Text>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {/* MOVED TOGGLE HERE FOR VISIBILITY */}
            <TouchableOpacity
              style={styles.topLangBtn}
              onPress={() => setLang(lang === "en" ? "ta" : "en")}
            >
              <Text style={styles.topLangText}>
                {lang === "en" ? "தமிழ்" : "ENG"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLogout}>
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[styles.header, { marginTop: 10 }]}>
          AI Gardening Assistant
        </Text>

        <View style={styles.manualCommandContainer}>
          <TextInput
            style={styles.manualInput}
            placeholder="Type 1, 2, 3, or 4 here"
            value={manualCommand}
            onChangeText={setManualCommand}
          />
          <TouchableOpacity
            style={styles.goButton}
            onPress={() => handleVoiceCommand(manualCommand)}
          >
            <Text style={{ color: "#fff", fontWeight: "bold" }}>GO</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.voiceGuideCard}
          onPress={() =>
            Speech.speak(t.nav_guide, {
              language: lang === "ta" ? "ta-IN" : "en-IN",
            })
          }
        >
          <Text style={styles.voiceGuideText}>🔊 {t.nav_guide}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.micButton, recording && styles.micActive]}
          onPressIn={startRecording}
          onPressOut={stopAndProcessVoice}
        >
          <Text style={styles.micText}>
            {recording ? "Recording... Release to Stop" : "🎤 Hold to Speak"}
          </Text>
        </TouchableOpacity>

        <View style={styles.grid}>
          {[
            {
              id: "weather",
              num: "1",
              label: t.tab_names.weather,
              color: "#2196F3",
              icon: "☁️",
            },
            {
              id: "pest",
              num: "2",
              label: t.tab_names.pest,
              color: "#F44336",
              icon: "🐛",
            },
            {
              id: "crop",
              num: "3",
              label: t.tab_names.crop,
              color: "#4CAF50",
              icon: "🌾",
            },
            {
              id: "diary",
              num: "4",
              label: t.tab_names.diary,
              color: "#FF9800",
              icon: "📖",
            },
          ].map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.card, { backgroundColor: item.color }]}
              onPress={() => setCurrentScreen(item.id)}
            >
              <View style={styles.numberBadge}>
                <Text style={styles.numberText}>{item.num}</Text>
              </View>
              <Text style={{ fontSize: 40 }}>{item.icon}</Text>
              <Text style={styles.cardLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => setCurrentScreen("home")}
        style={styles.backBtn}
      >
        <Text style={{ color: "#fff", fontWeight: "bold" }}>← {t.back}</Text>
      </TouchableOpacity>
      {currentScreen === "weather" ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {loading ? (
            <ActivityIndicator
              size="large"
              color="#2e7d32"
              style={{ marginTop: 50 }}
            />
          ) : (
            <View>
              <Text style={styles.header}>{t.title}</Text>
              <View style={styles.mainCard}>
                <View style={styles.row}>
                  {["rice", "cotton"].map((key) => (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.chip,
                        selectedCrop === key && styles.selectedChip,
                      ]}
                      onPress={() => setSelectedCrop(key)}
                    >
                      <Text style={styles.chipText}>{t.crops[key]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.adviceText}>
                  {!selectedCrop
                    ? t.alerts.select
                    : summary?.willRain
                      ? t.alerts.RainSoon(summary.hoursAway)
                      : t.alerts.ClearSky}
                </Text>
                <TouchableOpacity
                  style={styles.voiceButton}
                  onPress={speakAdvice}
                >
                  <Text style={styles.buttonText}>{t.speak_btn}</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.subHeader}>{t.weather_report}</Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={styles.headerCell}>{t.labels.time}</Text>
                  <Text style={styles.headerCell}>{t.labels.temp}</Text>
                  <Text style={styles.headerCell}>{t.labels.cond}</Text>
                </View>
                {forecastData.map((item, index) => (
                  <View key={index} style={styles.tableRow}>
                    <Text style={styles.cell}>
                      {new Date(item.dt * 1000).getHours() + ":00"}
                    </Text>
                    <Text style={styles.cell}>
                      {Math.round(item.main.temp)}°C
                    </Text>
                    <Text style={styles.cell}>
                      {item.weather[0].main === "Rain" ? "🌧️" : "☀️"}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      ) : currentScreen === "pest" ? (
        <PestDetectionScreen lang={lang} t={t} />
      ) : (
        <View style={styles.dummy}>
          <Text style={styles.header}>{t.tab_names[currentScreen]}</Text>
          <Text style={{ color: "#777", marginTop: 10 }}>Coming soon...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  authContainer: {
    flex: 1,
    justifyContent: "center",
    padding: 25,
    backgroundColor: "#f4f7f4",
  },
  authHeader: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1b5e20",
    marginBottom: 30,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  authButton: {
    backgroundColor: "#1b5e20",
    padding: 18,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  authButtonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  toggleText: { marginTop: 20, textAlign: "center", color: "#2e7d32" },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    padding: 5,
    alignItems: "center",
  },
  userLabel: { fontSize: 10, color: "#666", flex: 1 },
  logoutText: {
    color: "#d32f2f",
    fontWeight: "bold",
    fontSize: 12,
    marginLeft: 15,
  },
  topLangBtn: {
    backgroundColor: "#e8f5e9",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#2e7d32",
  },
  topLangText: { color: "#2e7d32", fontWeight: "bold", fontSize: 12 },
  container: {
    flex: 1,
    backgroundColor: "#f9f9f9",
    padding: 15,
    paddingTop: 40,
  },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  manualCommandContainer: { flexDirection: "row", marginBottom: 15 },
  manualInput: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 12,
  },
  goButton: {
    backgroundColor: "#1b5e20",
    padding: 15,
    borderRadius: 10,
    marginLeft: 10,
    justifyContent: "center",
  },
  voiceGuideCard: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 15,
    elevation: 4,
    marginVertical: 10,
    borderLeftWidth: 6,
    borderLeftColor: "#1b5e20",
  },
  voiceGuideText: { fontSize: 16, fontWeight: "bold", color: "#333" },
  micButton: {
    backgroundColor: "#333",
    padding: 15,
    borderRadius: 15,
    alignItems: "center",
    marginBottom: 15,
  },
  micActive: { backgroundColor: "#d32f2f" },
  micText: { color: "#fff", fontWeight: "bold" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  card: {
    width: "48%",
    height: 110,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
    elevation: 5,
  },
  numberBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "rgba(255,255,255,0.3)",
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  numberText: { color: "#fff", fontWeight: "bold" },
  cardLabel: {
    color: "#fff",
    fontWeight: "bold",
    marginTop: 5,
    fontSize: 12,
    textAlign: "center",
  },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1b5e20",
    textAlign: "center",
  },
  mainCard: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 20,
    elevation: 5,
    marginVertical: 20,
  },
  row: { flexDirection: "row", justifyContent: "center", marginBottom: 15 },
  chip: {
    padding: 10,
    borderRadius: 15,
    backgroundColor: "#eee",
    marginHorizontal: 5,
  },
  selectedChip: { backgroundColor: "#a5d6a7" },
  chipText: { fontWeight: "bold" },
  adviceText: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
    color: "#333",
    lineHeight: 22,
  },
  voiceButton: {
    backgroundColor: "#2e7d32",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "bold" },
  subHeader: {
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 10,
    marginBottom: 10,
    color: "#444",
  },
  table: {
    backgroundColor: "#fff",
    borderRadius: 15,
    overflow: "hidden",
    elevation: 2,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#e8f5e9",
    padding: 12,
  },
  headerCell: {
    flex: 1,
    fontWeight: "bold",
    textAlign: "center",
    color: "#2e7d32",
  },
  tableRow: {
    flexDirection: "row",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  cell: { flex: 1, textAlign: "center", color: "#555" },
  backBtn: {
    backgroundColor: "#333",
    padding: 10,
    borderRadius: 10,
    alignSelf: "flex-start",
    marginBottom: 10,
  },
  dummy: { flex: 1, justifyContent: "center", alignItems: "center" },
});
