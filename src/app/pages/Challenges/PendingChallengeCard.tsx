import type React from "react"
import { View, Text, Image, StyleSheet, type ImageSourcePropType } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { Ionicons } from "@expo/vector-icons"
import { DayOfWeek, DayOfWeekLabels } from "./DayOfWeek"

interface PendingChallengeCardProps {
  title: string
  icon: ImageSourcePropType
  showInvite?: boolean;
}



const PendingChallengeCard: React.FC<PendingChallengeCardProps> = ({ 
  title, 
  icon,
  showInvite = [] // Default to empty array if not provided
}) => {
  

  return (
    <LinearGradient colors={["#FFFFFF", "#F8F9FE"]} style={styles.container}>
      <View style={styles.contentContainer}>
        <View style={styles.iconContainer}>
          <Image source={icon} style={styles.icon} />
        </View>

        <View style={styles.detailsContainer}>
          <Text style={styles.title}>{title}</Text>
        </View>

        {showInvite && (
          <View style={styles.inviteBadge}>
            <Text style={styles.inviteBadgeText}>1</Text>
          </View>
        )}
      </View>
    </LinearGradient>


  )
}

const styles = StyleSheet.create({
container: {
  borderRadius: 16,
  overflow: "hidden",
  padding: 14,
  color: "#EDE7F6",
},

contentContainer: {
  flexDirection: "row",
  alignItems: "center",
  position: "relative", // Required for absolute badge positioning
},

iconContainer: {
  width: 65,
  height: 65,
  borderRadius: 32.5,
  backgroundColor: "rgba(138, 43, 226, 0.1)",
  justifyContent: "center",
  alignItems: "center",
  marginRight: 12,
},

icon: {
  width: 55,
  height: 55,
  resizeMode: "contain",
},

detailsContainer: {
  flex: 1,
},

title: {
  fontSize: 18,
  fontWeight: "700",
  color: "#333",
},

inviteBadge: {
  position: "absolute",
  right: 10,
  top: "50%",
  transform: [{ translateY: -9 }], // Centers vertically (badge is 18px high)
  width: 18,
  height: 18,
  borderRadius: 9,
  backgroundColor: "#FF3B30",
  justifyContent: "center",
  alignItems: "center",
  borderWidth: 1,
  borderColor: "#fff",
},

inviteBadgeText: {
  color: "#fff",
  fontSize: 11,
  fontWeight: "700",
},

})

export default PendingChallengeCard