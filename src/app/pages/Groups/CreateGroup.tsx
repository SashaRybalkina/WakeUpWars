/**
 * @file CreateGroup.tsx
 * @description This screen lets users create a new group, which involves giving the group 
 * a new name and selecting the friends that the user wants to invite to the group upon
 * creation.
 */

import type React from "react"
import { useState, useEffect } from "react"
import {
  ImageBackground,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import type { NavigationProp } from "@react-navigation/native"
import { LinearGradient } from "expo-linear-gradient"
import { useUser } from "../../context/UserContext"

type Group = {
  id: number;
  name: string;
  members: Friend[];
};
import { BASE_URL, endpoints } from "../../api"
import { getAccessToken } from "../../auth"
import { useGroups } from "../../context/GroupsContext"
import NavBar from "../Components/NavBar"

type Props = {
  navigation: NavigationProp<any>
}

type Friend = {
  id: number
  name: string
  username: string
  selected?: boolean
  avatar?: {
    id: number;
    imageUrl: string;
    backgroundColor: string;
  };
}

const CreateGroup: React.FC<Props> = ({ navigation }) => {
  const { user, logout } = useUser()
  const { invalidateGroups } = useGroups();
  const [groupName, setGroupName] = useState<string>("");
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [friends, setFriends] = useState<Friend[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    if (!user?.id) return

    const fetchFriends = async () => {
      try {
        setLoading(true)
        const accessToken = await getAccessToken();
        if (!accessToken) {
          Alert.alert(
            "Session expired",
            "Your login session has expired. Please log in again.",
            [
              {
                text: "OK",
                onPress: async () => {
                  await logout();
                  navigation.reset({
                    index: 0,
                    routes: [{ name: "Login" }],
                  });
                },
              },
            ],
            { cancelable: false }
          );

          return;
        }

        const response = await fetch(endpoints.friends(Number(user.id)), {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        });
        const data = await response.json()

        // Add selected property to each friend
        const friendsWithSelection = data.map((friend: Friend) => ({
          ...friend,
          selected: false,
        }))

        setFriends(friendsWithSelection)
      } catch (error) {
        console.error("Failed to fetch friends:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchFriends()
  }, [user])

  const toggleFriendSelection = (id: number) => {
    setFriends(friends.map((friend) => (friend.id === id ? { ...friend, selected: !friend.selected } : friend)))
  }

  const filteredFriends = searchQuery
    ? friends.filter(
      (friend) =>
        friend.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        friend.username.toLowerCase().includes(searchQuery.toLowerCase()),
    )
    : friends

  const selectedFriends = friends.filter((friend) => friend.selected)

  const handleCreateGroup = async () => {
    const safeGroupName = typeof groupName === "string" ? groupName : "";
    if (!safeGroupName.trim()) {
      Alert.alert("Error", "Please enter a group name");
      return;
    }

    try {
      setCreating(true)

      const payload = {
        name: groupName,
        members: [
          ...selectedFriends
            .filter((friend) => friend.id !== undefined)
            .map((friend) => friend.id),
          user?.id ?? 0,
        ],
      }

      const accessToken = await getAccessToken();
      if (!accessToken) {
        Alert.alert(
          "Session expired",
          "Your login session has expired. Please log in again.",
          [
            {
              text: "OK",
              onPress: async () => {
                await logout();
                navigation.reset({
                  index: 0,
                  routes: [{ name: "Login" }],
                });
              },
            },
          ],
          { cancelable: false }
        );

        return;
      }
      const response = await fetch(endpoints.createGroup, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create group");
      }

      const data = await response.json();
      console.log('Created group:', data);

      invalidateGroups();


      Alert.alert("Success", "Group created successfully", [
        { text: "OK", onPress: () => navigation.navigate("Groups") },
      ])

    } catch (error) {
      console.error("Failed to create group:", error)
      Alert.alert("Error", "Failed to create group. Please try again.")
      setCreating(false)
    }
  }

  const goToChallenges = () => navigation.navigate("Challenges")
  const goToGroups = () => navigation.navigate("Groups")
  const goToMessages = () => navigation.navigate("Messages")
  const goToProfile = () => navigation.navigate("Profile")

  // Generate a pastel color based on name for avatars
  const generatePastelColor = (name: string): string => {
    const hash = name.split("").reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc)
    }, 0)

    const h = hash % 360
    const s = 60 + (hash % 20)
    const l = 80 + (hash % 10)

    return `hsl(${h}, ${s}%, ${l}%)`
  }

  // Get initials from name
  const getInitials = (name: string): string => {
    return name
      .split(" ")
      .map((part) => part.charAt(0).toUpperCase())
      .join("")
      .substring(0, 2)
  }

  return (
    <ImageBackground source={require("../../images/cgpt.png")} style={styles.background} resizeMode="cover">
      <View style={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color="#FFF" />
        </TouchableOpacity>

        <Text style={styles.pageTitle}>Create New Group</Text>

        <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Group Name</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Enter group name"
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                value={groupName}
                onChangeText={setGroupName}
              />
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Add Friends</Text>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search friends..."
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FFD700" />
              </View>
            ) : filteredFriends.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <Ionicons name="people-outline" size={40} color="rgba(255,255,255,0.5)" />
                <Text style={styles.emptyStateText}>No friends found</Text>
              </View>
            ) : (
              <View style={styles.friendsList}>
                {filteredFriends.map((friend) => {
                  const backgroundColor = generatePastelColor(friend.name)
                  return (
                    <TouchableOpacity
                      key={friend.id}
                      style={[styles.friendItem, friend.selected && styles.friendItemSelected]}
                      onPress={() => toggleFriendSelection(friend.id)}
                    >
                      <View
                        style={[
                          styles.avatarContainer,
                          { backgroundColor: friend.avatar?.backgroundColor || generatePastelColor(friend.name) },
                        ]}
                      >
                        {friend.avatar?.imageUrl ? (
                          <Image
                            source={{ uri: `${BASE_URL}${friend.avatar.imageUrl}` }}
                            style={{ width: 50, height: 50, borderRadius: 25 }}
                            resizeMode="contain"
                          />
                        ) : (
                          <Text style={styles.avatarText}>{getInitials(friend.name)}</Text>
                        )}
                      </View>
                      <View style={styles.friendInfo}>
                        <Text style={styles.friendName}>{friend.name}</Text>
                        <Text style={styles.friendUsername}>@{friend.username}</Text>
                      </View>
                      <View style={styles.checkboxContainer}>
                        {friend.selected ? (
                          <Ionicons name="checkmark-circle" size={24} color="#FFD700" />
                        ) : (
                          <View style={styles.checkbox} />
                        )}
                      </View>
                    </TouchableOpacity>
                  )
                })}
              </View>
            )}
          </View>

          <View style={styles.selectedSection}>
            <Text style={styles.selectedTitle}>
              Selected Friends: <Text style={styles.selectedCount}>{selectedFriends.length}</Text>
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectedFriendsScroll}>
              {selectedFriends.map((friend) => {
                const backgroundColor = generatePastelColor(friend.name)
                return (
                  <View key={friend.id} style={styles.selectedFriend}>
                    <View style={[styles.selectedFriendAvatar, { backgroundColor }]}>
                      <Text style={styles.selectedFriendInitials}>{getInitials(friend.name)}</Text>
                    </View>
                    <Text style={styles.selectedFriendName}>{friend.name.split(" ")[0]}</Text>
                  </View>
                )
              })}
            </ScrollView>
          </View>

          <TouchableOpacity
            style={styles.createButton}
            onPress={handleCreateGroup}
            disabled={creating || !groupName.trim() || selectedFriends.length === 0}
          >
            <LinearGradient
              colors={["#FFD700", "#FFA500"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.createButtonGradient}
            >
              {creating ? (
                <ActivityIndicator size="small" color="#333" />
              ) : (
                <Text style={styles.createButtonText}>Create Group</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <NavBar
        goToPublicChallenges={() => navigation.navigate("PublicChallenges")}
        goToChallenges={() => navigation.navigate("Challenges")}
        goToGroups={() => navigation.navigate("Groups")}
        goToMessages={() => navigation.navigate("Messages")}
        goToProfile={() => navigation.navigate("Profile")}
        active="Groups"
      />
    </ImageBackground>
  )
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingTop: 50,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 20,
    marginBottom: 10,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFF",
    textAlign: "center",
    marginBottom: 20,
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  formSection: {
    marginBottom: 25,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#FFF",
    marginBottom: 15,
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  inputContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  input: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    color: "#FFF",
    fontSize: 16,
    width: "100%",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    color: "#FFF",
    fontSize: 16,
  },
  loadingContainer: {
    padding: 20,
    alignItems: "center",
  },
  emptyStateContainer: {
    padding: 30,
    alignItems: "center",
  },
  emptyStateText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 16,
    marginTop: 10,
  },
  friendsList: {
    marginTop: 10,
  },
  friendItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  friendItemSelected: {
    backgroundColor: "rgba(255, 215, 0, 0.15)",
    borderColor: "rgba(255, 215, 0, 0.3)",
  },
  friendAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  friendInitials: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  friendUsername: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 14,
  },
  checkboxContainer: {
    width: 30,
    alignItems: "center",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.5)",
  },
  selectedSection: {
    marginBottom: 25,
  },
  selectedTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFF",
    marginBottom: 15,
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  selectedCount: {
    color: "#FFD700",
  },
  selectedFriendsScroll: {
    flexDirection: "row",
    marginBottom: 10,
  },
  selectedFriend: {
    alignItems: "center",
    marginRight: 15,
    width: 60,
  },
  selectedFriendAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 5,
    borderWidth: 2,
    borderColor: "rgba(255, 215, 0, 0.5)",
  },
  selectedFriendInitials: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
  },
  selectedFriendName: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
  },
  createButton: {
    borderRadius: 12,
    overflow: "hidden",
    marginVertical: 10,
    marginBottom: 30,
  },
  createButtonGradient: {
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  createButtonText: {
    color: "#333",
    fontSize: 18,
    fontWeight: "700",
  },
  navButton: {
    justifyContent: "center",
    alignItems: "center",
    flex: 1,
  },
  navText: {
    color: "#999",
    fontSize: 12,
    marginTop: 4,
  },
  activeNavText: {
    color: "#FFD700",
    fontSize: 12,
    marginTop: 4,
    fontWeight: "600",
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#333",
  },
})

export default CreateGroup
