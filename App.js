import * as Location from "expo-location";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function App() {
  const [weather, setWeather] = useState(null);
  const [lang, setLang] = useState("ta");
  const [loading, setLoading] = useState(true);

  const translations = {
    en: {
      title: "Farming Assistant",
      temp: "Temperature",
      advice_rain: "Alert: Heavy rain. Do not spray pesticides.",
      advice_clear: "Weather is clear. Good for irrigation.",
      toggle: "Switch to Tamil",
    },
    ta: {
      title: "விவசாய உதவியாளர்",
      temp: "வெப்பநிலை",
      advice_rain:
        "எச்சரிக்கை: பலத்த மழை. இன்று மருந்து தெளிப்பதைத் தவிர்க்கவும்.",
      advice_clear: "வானிலை சீராக உள்ளது. பாசனத்திற்கு ஏற்றது.",
      toggle: "Switch to English",
    },
  };

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLoading(false);
        return;
      }
      let loc = await Location.getCurrentPositionAsync({});
      try {
        const res = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${loc.coords.latitude}&lon=${loc.coords.longitude}&units=metric&appid=YOUR_API_KEY`,
        );
        const data = await res.json();
        setWeather(data);
      } catch (e) {
        setWeather({ main: { temp: 30 }, weather: [{ main: "Clear" }] });
      }
      setLoading(false);
    })();
  }, []);

  const t = translations[lang];
  if (loading)
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2e7d32" />
      </View>
    );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{t.title}</Text>
      <View style={styles.card}>
        <Text style={styles.label}>
          {t.temp}: {weather?.main?.temp}°C
        </Text>
        <View style={styles.divider} />
        <Text style={styles.advice}>
          {weather?.weather[0].main === "Rain" ? t.advice_rain : t.advice_clear}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.button}
        onPress={() => setLang(lang === "en" ? "ta" : "en")}
      >
        <Text style={styles.buttonText}>{t.toggle}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f4f9f4",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#2e7d32",
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 15,
    width: "100%",
    elevation: 5,
  },
  label: { fontSize: 18, marginVertical: 5 },
  divider: { height: 1, backgroundColor: "#ddd", marginVertical: 15 },
  advice: {
    fontSize: 20,
    color: "#d32f2f",
    fontWeight: "bold",
    textAlign: "center",
  },
  button: {
    marginTop: 30,
    backgroundColor: "#2e7d32",
    padding: 15,
    borderRadius: 10,
  },
  buttonText: { color: "#fff", fontSize: 16 },
});
