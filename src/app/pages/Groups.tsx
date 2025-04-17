import React, { useState } from 'react';
import { endpoints } from '../api';
import { useEffect } from 'react';
import {
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NavigationProp } from '@react-navigation/native';
import { Int32 } from 'react-native/Libraries/Types/CodegenTypes';
import { Button, ScrollView } from 'tamagui';
import { useUser } from '../context/UserContext';

type Props = {
  navigation: NavigationProp<any>;
};

const Groups: React.FC<Props> = ({ navigation }) => {
  // const [groups, setGroups] = useState<string[]>([]);
  const { user } = useUser();

  const [groups, setGroups] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    if (!user?.id) {
      console.error('userId is missing!');
      return;
    }
    const fetchGroups = async () => {
      try {
        const response = await fetch(endpoints.groups(user.id));
        const data = await response.json();
        setGroups(data); // Don't reduce it to just names
      } catch (error) {
        console.error('Failed to fetch groups:', error);
      }
    };
  
    fetchGroups();
  }, []);
  
  const goToPersonalChall = () => {
    //navigation.navigate('ChallPers');
  };

  const goToGroupChall = () => {
    navigation.navigate('ChallGroup');
  };

  const goToChallenges = () => {
    navigation.navigate('Challenges');
  };

  const goToMessages = () => {
    navigation.navigate('Messages');
  };

  const goToProfile = () => {
    navigation.navigate('Profile');
  };

  const goToGroups = () => navigation.navigate("Groups")

  return (
    <ImageBackground
      source={require('../images/cgpt.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.container}>
        <Text style={styles.title}>My Groups</Text>
        <ScrollView style={styles.scrollViewContainer}>
        {groups.map((group, index) => (
          <TouchableOpacity
            key={group.id}
            style={styles.navToGroup}
            onPress={() => navigation.navigate('GroupDetails', { groupId: group.id })}
          >
            <Text style={styles.navToGroupText}>{group.name}</Text>
          </TouchableOpacity>
        ))}
        </ScrollView>
      </View>

      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navButton} onPress={goToChallenges}>
          <Ionicons name="star" size={28} color="#FFF" />
          <Text style={styles.navText}>Challenges</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navButton} onPress={goToGroups}>
          <Ionicons name="people-outline" size={28} color="#FFD700" />
          <Text style={styles.activeNavText}>Groups</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navButton} onPress={goToMessages}>
          <Ionicons name="mail-outline" size={28} color="#FFF" />
          <Text style={styles.navText}>Messages</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navButton} onPress={goToProfile}>
          <Ionicons name="person-outline" size={28} color="#FFF" />
          <Text style={styles.navText}>Profile</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    alignItems: 'center',
    maxWidth: 400,
    width: '80%',
    marginVertical: 60,
    justifyContent: 'center',
  },
  addButton: {
    backgroundColor: 'transparent',
    borderRadius: 20,
    width: 100,
    height: 100,
    marginTop: 75,
    marginLeft: 300,
  },
  title: {
    color: '#fff',
    fontSize: 40,
    fontWeight: '700',
    marginBottom: 50,
  },
  scrollViewContainer: {
    width: '100%',
    height: '100%',
    marginBottom: 20,
  },
  navToGroup: {
    width: '100%',
    height: 80,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 15,
    marginVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navToGroupText: {
    color: '#FFF',
    fontSize: 30,
    fontWeight: '900',
  },
  buttons: {
    backgroundColor: '#211F26',
    flexDirection: 'row',
    height: 100,
    justifyContent: 'space-around',
    alignItems: 'center',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
    marginBottom: 15,
  },
  navBar: {
    backgroundColor: "#211F26",
    flexDirection: "row",
    height: 80,
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: 15,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
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
});

export default Groups;
