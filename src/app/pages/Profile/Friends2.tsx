import React, { useState } from 'react';
import {
  Alert,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NavigationProp, useRoute } from '@react-navigation/native';
import * as Font from 'expo-font';
import { Int32 } from 'react-native/Libraries/Types/CodegenTypes';
import { Button } from 'tamagui';

type Props = {
  navigation: NavigationProp<any>;
};

const Friends2: React.FC<Props> = ({ navigation }) => {
  const [input, setInput] = useState<string>('');
  const [friendName, setFriendName] = useState<string>('');
  const [selectedFriend, setSelectedFriend] = useState<string | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [groups, setGroups] = useState<string[][]>([
    ['GroupA', 'fnucwncjkwnl'],
    ['GroupB', 'nfenvoencklk'],
    ['GroupC', 'cneoenclknck'],
    ['GroupD', 'qowfpwhnljnv'],
  ]);

  const goToGroups = () => {
    navigation.navigate('Groups');
  };

  const goToChallenges = () => {
    navigation.navigate('Challenges');
  };

  const goToMessages = () => {
    navigation.navigate('Messages');
  };

  const goToProfile = () => { navigation.navigate('Profile');};
  
  const Group: React.FC<{ name: string; text: string; index: number }> = ({
    name,
    text,
    index,
  }) => {
    const isSelected = selectedGroups.includes(name);

    const toggleSelection = () => {
      if (isSelected) {
        setSelectedGroups((prev) => prev.filter((g) => g !== name));
      } else {
        setSelectedGroups((prev) => [...prev, name]);
      }
    };

    return (
      <TouchableOpacity
        style={[styles.group, isSelected && styles.selectedGroupBorder]}
        onPress={toggleSelection}
      >
        <Text style={styles.groupName}>{name}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <ImageBackground
      source={require('../../images/tertiary.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.backButtonContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={30} color="#FFF" />
        </TouchableOpacity>
      </View>
      <View style={styles.container}>
        <Text style={styles.title}>Add Friend</Text>
        <TextInput
          style={styles.input}
          placeholder="Search Friend ID"
          placeholderTextColor="#AAA"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => {
            setFriendName(input);
          }}
          returnKeyType="done"
        />
        <TouchableOpacity
          style={[
            styles.friend,
            selectedFriend === friendName && styles.selectedFriendBorder,
          ]}
          onPress={() => {
            if (selectedFriend === friendName) {
              setSelectedFriend(null);
            } else {
              setSelectedFriend(friendName);
            }
          }}
        >
          <Text style={styles.friendText}>{friendName}</Text>
        </TouchableOpacity>
        <Text style={styles.sg}>Select Group(s):</Text>
        <ScrollView style={styles.scrollViewContainer}>
          {groups.map((group, index) => (
            <Group
              key={index}
              name={group[0] + ''}
              text={group[1] + ''}
              index={index}
            />
          ))}
        </ScrollView>
        <TouchableOpacity
          style={styles.sendInviteButton}
          onPress={() => {
            if (selectedFriend) {
              Alert.alert(
                'Invite Sent!',
                `Invited ${selectedFriend} to groups: ${selectedGroups.join(', ')}`,
              );
            } else {
              Alert.alert(
                'No Friend Selected',
                'Please select a friend to invite.',
              );
            }
          }}
        >
          <Text style={styles.sendInviteText}>Send Invite</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.navBar}>
          <TouchableOpacity style={styles.navButton} onPress={goToChallenges}>
            <Ionicons name="star" size={28} color="#FFF" />
            <Text style={styles.navText}>Challenges</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.navButton} onPress={goToGroups}>
            <Ionicons name="people-outline" size={28} color="#FFF" />
            <Text style={styles.navText}>Groups</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.navButton} onPress={goToMessages}>
            <Ionicons name="mail-outline" size={28} color="#FFF" />
            <Text style={styles.navText}>Messages</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.navButton} onPress={goToProfile}>
            <Ionicons name="person-outline" size={28} color="#FFD700" />
            <Text style={styles.activeNavText}>Profile</Text>
          </TouchableOpacity>
        </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    alignItems: 'center',
  },
  backButtonContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
  },
  container: {
    alignItems: 'center',
    maxWidth: 400,
    width: '80%',
    marginVertical: 80,
  },
  title: {
    color: '#fff',
    fontSize: 40,
    fontWeight: '700',
    marginBottom: 20,
    marginVertical: 100,
    marginTop: 30,
  },
  input: {
    backgroundColor: '#fff',
    width: 280,
    height: 40,
    borderRadius: 5,
    marginBottom: 30,
    fontSize: 18,
    paddingHorizontal: 10,
  },
  sg: {
    color: 'white',
    fontSize: 25,
    fontWeight: '700',
    marginBottom: 15,
  },
  friend: {
    backgroundColor: 'pink',
    width: 280,
    height: 50,
    borderRadius: 15,
    marginBottom: 30,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendText: {
    fontSize: 25,
    fontWeight: '500',
    color: 'white',
  },
  selection: {
    color: '#fff',
    fontSize: 22.5,
    fontWeight: '700',
    marginHorizontal: 25,
    marginBottom: 30,
  },
  group: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    width: '100%',
    height: 50,
    marginVertical: 7.5,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  groupName: {
    color: '#FFF455',
    fontSize: 22.5,
    fontWeight: '600',
    marginLeft: 5,
    marginBottom: 5,
  },
  selectedGroupBorder: {
    borderWidth: 2,
    borderColor: '#FFF455',
  },
  selectedFriendBorder: {
    borderWidth: 2,
    borderColor: '#FFF455',
  },
  sendInviteButton: {
    backgroundColor: '#AA55FF',
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    width: 250,
    height: 65,
    marginTop: 15,
  },
  sendInviteText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 25,
    textAlign: 'center',
  },
  scrollViewContainer: {
    width: '100%',
    height: 250,
    marginBottom: 20,
    marginTop: -10,
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

export default Friends2;
