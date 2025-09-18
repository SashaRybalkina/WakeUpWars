import React, { useState } from "react";
import { 
  ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View, 
  Platform, Alert, Image 
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import type { NavigationProp, RouteProp } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import axios from "axios";
import { endpoints } from "../../api";
import { getGameMeta } from "../Games/NewGamesManagement";

type Props = {
  navigation: NavigationProp<any>;
  route: RouteProp<any>;
};

const DAYS = ["M", "T", "W", "TH", "F", "S", "SU"];

const EditChallengeSharingFriends: React.FC<Props> = ({ navigation, route }) => {
  const { challenge } = route.params || {};
  console.log("[FRONTEND] Entering EditChallengeSharingFriends");
  console.log("[FRONTEND] Incoming challenge data:", challenge);

  // Dates
  const [startDate, setStartDate] = useState(new Date(challenge.startDate));
  const [endDate, setEndDate] = useState(new Date(challenge.endDate));

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // --- Date picker handler ---
  const onDateChange = (
    picker: "start" | "end",
    event: any,
    date?: Date
  ) => {
    if (event?.type === "dismissed") {
      picker === "start" ? setShowStartPicker(false) : setShowEndPicker(false);
      return;
    }
    if (date) {
      picker === "start" ? setStartDate(date) : setEndDate(date);
      if (Platform.OS === "android") {
        picker === "start" ? setShowStartPicker(false) : setShowEndPicker(false);
      }
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // --- Save handler (create new copy with new dates) ---
  const handleSave = async () => {
    try {
      const payload = {
        startDate: startDate.toISOString().split("T")[0],
        endDate: endDate.toISOString().split("T")[0],
      };

      console.log("[FRONTEND] Payload to send:", payload);

      const response = await axios.post(
        endpoints.shareChallenge(challenge.id),
        payload,
        { withCredentials: true } 
      );

      console.log("[FRONTEND] Response from backend:", response.data);
      Alert.alert("Saved", "Challenge shared successfully!");
      navigation.goBack();
    } catch (error: any) {
      console.error(
        "[FRONTEND] Error response:",
        error.response?.data || error.message
      );
      Alert.alert("Error", "Failed to share challenge.");
    }
  };

  return (
    <ImageBackground
      source={require("../../images/secondary.png")}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={28} color="#FFF" />
        </TouchableOpacity>

        <Text style={styles.pageTitle}>Share Challenge</Text>

        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Challenge Info */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Name</Text>
            <Text style={styles.readonlyText}>{challenge.name}</Text>
          </View>

          {/* Days & Alarm */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Days & Alarm</Text>
            <View style={styles.daysContainer}>
              {challenge.daysOfWeek?.map((day: number | string, idx: number) => {
                const label = typeof day === "number" ? DAYS[day - 1] : day;
                return (
                  <View key={idx} style={styles.dayReadonly}>
                    <Text style={styles.dayText}>{label}</Text>
                  </View>
                );
              })}
            </View>

            {/* alarms come from schedule */}
            {challenge.schedule?.map((s: any, idx: number) => {
              const label = DAYS[s.dayOfWeek - 1] || s.dayOfWeek;
              return (
                <Text key={idx} style={styles.readonlyText}>
                  {`${label}: ${s.alarmTime || "No alarm"}`}
                </Text>
              );
            })}
          </View>

          {/* Games */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Games</Text>
            {challenge.schedule?.some((s: any) => s.games?.length > 0) ? (
              challenge.schedule.map((s: any, idx: number) => (
                <View key={idx} style={{ marginBottom: 15 }}>
                  <Text style={[styles.readonlyText, { fontWeight: "700", marginBottom: 5 }]}>
                    {DAYS[s.dayOfWeek - 1] || s.dayOfWeek}
                  </Text>
                  {s.games.map((g: any, gIdx: number) => {
                    const meta = getGameMeta(g.id, g.name); 
                    return (
                      <View key={gIdx} style={styles.gameRow}>
                        <Image source={meta.image} style={styles.gameIcon} resizeMode="contain" />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.gameName}>{g.name}</Text>
                          <Text style={styles.gameDesc}>{meta.desc}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ))
            ) : (
              <Text style={styles.readonlyText}>No games</Text>
            )}
          </View>

          {/* Start / End Dates */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Start Date</Text>
            <Text style={styles.dateDisplay}>{formatDate(startDate)}</Text>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setShowStartPicker(true)}
            >
              <LinearGradient
                colors={["rgba(255, 255, 255, 0.2)", "rgba(255, 255, 255, 0.1)"]}
                style={styles.buttonGradient}
              >
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color="#FFF"
                  style={styles.buttonIcon}
                />
                <Text style={styles.buttonText}>Select Start Date</Text>
              </LinearGradient>
            </TouchableOpacity>

            {showStartPicker && (
              <DateTimePicker
                value={startDate}
                mode="date"
                display="spinner"
                onChange={(event, date) => onDateChange("start", event, date)}
              />
            )}
          </View>

          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>End Date</Text>
            <Text style={styles.dateDisplay}>{formatDate(endDate)}</Text>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setShowEndPicker(true)}
            >
              <LinearGradient
                colors={["rgba(255, 255, 255, 0.2)", "rgba(255, 255, 255, 0.1)"]}
                style={styles.buttonGradient}
              >
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color="#FFF"
                  style={styles.buttonIcon}
                />
                <Text style={styles.buttonText}>Select End Date</Text>
              </LinearGradient>
            </TouchableOpacity>

            {showEndPicker && (
              <DateTimePicker
                value={endDate}
                mode="date"
                display="spinner"
                onChange={(event, date) => onDateChange("end", event, date)}
              />
            )}
          </View>

          <TouchableOpacity style={styles.createButton} onPress={handleSave}>
            <LinearGradient colors={["#FFD700", "#FFC107"]} style={styles.createButtonGradient}>
              <Text style={styles.createButtonText}>Save Challenge</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: { flex: 1 },
  container: { flex: 1, paddingTop: 50 },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center", alignItems: "center",
    marginLeft: 20, marginBottom: 10,
  },
  pageTitle: {
    fontSize: 28, fontWeight: "700", color: "#FFF",
    textAlign: "center", marginBottom: 20,
  },
  scrollContainer: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },
  formSection: {
    marginBottom: 25, backgroundColor: "rgba(0, 0, 0, 0.2)",
    borderRadius: 16, padding: 20, borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  sectionTitle: { fontSize: 20, fontWeight: "600", color: "#FFF", marginBottom: 15 },
  readonlyText: { fontSize: 16, color: "#FFF", marginBottom: 8 },
  daysContainer: { flexDirection: "row", flexWrap: "wrap" },
  dayReadonly: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center", alignItems: "center",
    marginRight: 8, marginBottom: 8,
  },
  dayText: { color: "#FFF", fontWeight: "600" },
  dateDisplay: { color: "#FFD700", fontSize: 18, marginBottom: 10 },
  actionButton: { borderRadius: 12, overflow: "hidden", marginTop: 10 },
  buttonGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12 },
  buttonIcon: { marginRight: 8 },
  buttonText: { color: "#FFF", fontSize: 16, fontWeight: "600" },
  createButton: { borderRadius: 12, overflow: "hidden", marginTop: 20, marginBottom: 30 },
  createButtonGradient: { paddingVertical: 15, alignItems: "center", justifyContent: "center" },
  createButtonText: { color: "#333", fontSize: 18, fontWeight: "700" },
  gameRow: {
  flexDirection: "row",
  alignItems: "center",
  marginBottom: 10,
  backgroundColor: "rgba(255,255,255,0.05)",
  borderRadius: 12,
  padding: 10,
},
gameIcon: {
  width: 40,
  height: 40,
  marginRight: 12,
},
gameName: {
  fontSize: 16,
  fontWeight: "600",
  color: "#FFF",
},
gameDesc: {
  fontSize: 12,
  color: "rgba(255,255,255,0.7)",
  marginTop: 2,
},

});

export default EditChallengeSharingFriends;
