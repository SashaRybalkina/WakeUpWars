// all
// GroupChallCollab2
// perschall2copy
// createchallengeforfriend

// some
// createpublicchall2

import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
  ImageBackground,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NavigationProp, useRoute } from '@react-navigation/native';
import { endpoints } from '../../api';
import { getAccessToken } from '../../auth';
import { getGameMeta } from './NewGamesManagement';

type Props = {
  navigation: NavigationProp<any>;
};

type Game = {
  id: number;
  name: string;
  route?: string | null;
};

type Category = {
  id: number;
  categoryName: string;
  games: Game[];
};

const GameSelection: React.FC<Props> = ({ navigation }) => {
  const route = useRoute();
  const { categories, onGameSelected, singOrMult } = route.params as {
    onGameSelected: (game: { id: number; name: string }) => void;
    categories: { id: number; name: string }[] | null;
    singOrMult: string;
  };

  const [cats, setCats] = useState<Category[]>([]);
//   const [selectedCatId, setSelectedCatId] = useState<number | null>(null);
  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalGame, setModalGame] = useState<Game | null>(null);

  useEffect(() => {
    const fetchCats = async () => {
      try {
        const accessToken = await getAccessToken();
        if (!accessToken) throw new Error("Not authenticated");

        const response = await fetch(
          endpoints.someCats(categories ? categories.map(c => c.id) : [], singOrMult),
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const data: Category[] = await response.json();
        setCats(data);
        // Select first category by default
        if (data.length > 0) setSelectedCat(data[0].id);
      } catch (err) {
        console.error("Failed to fetch categories:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchCats();
  }, []);


  const handleSelect = (id: number, name: string) => {
    onGameSelected({ id, name });
    navigation.goBack();
  };


  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#FFF" />
      </View>
    );
  }

  const selectedCategory = cats.find(c => c.id === selectedCat);

  return (
<ImageBackground
  source={require('../../images/tertiary.png')}
  style={{ flex: 1 }}
  resizeMode="cover"
>
  {/* Tabs */}
    <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    style={styles.tabsContainer}
    contentContainerStyle={{ alignItems: 'center' }}
    >
    {cats.map((cat) => (
      <TouchableOpacity
        key={cat.id}
        style={[
          styles.tabButton,
          selectedCat === cat.id && styles.tabButtonActive,
        ]}
        onPress={() => setSelectedCat(cat.id)}
      >
        <Text
          style={[
            styles.tabButtonText,
            selectedCat === cat.id && styles.tabButtonTextActive,
          ]}
        >
          {cat.categoryName}
        </Text>
      </TouchableOpacity>
    ))}
  </ScrollView>

  {/* Game list */}
  <View style={{ flex: 1, paddingHorizontal: 15, marginTop: 10 }}>
{selectedCategory?.games.map((game) => {
  const meta = getGameMeta(game.id, game.name);

  return (
    <View key={game.id} style={styles.gameItemContainer}>
      {/* Pressable container to open modal */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => setModalGame(game)}
        style={styles.gameContainer}
      >
        <ImageBackground
          source={meta.image}
          style={styles.gameImg}
          imageStyle={styles.gameImgStyle}
        />
        <Text style={styles.gameName}>{game.name}</Text>
      </TouchableOpacity>

      {/* Select button stays independent */}
      <TouchableOpacity
        style={styles.selectButton}
        onPress={() => handleSelect(game.id, game.name)}
      >
        <Text style={styles.selectButtonText}>Select</Text>
      </TouchableOpacity>
    </View>
  );
})}

{/* Single modal for all games */}
<Modal
  visible={modalGame !== null}
  transparent
  animationType="fade"
  onRequestClose={() => setModalGame(null)}
>
  <View style={styles.modalOverlay}>
    <View style={styles.modalContent}>
      {modalGame && (
        <>
          <Text style={styles.modalTitle}>{modalGame.name}</Text>
          <Text style={styles.modalDesc}>
            {getGameMeta(modalGame.id, modalGame.name).desc}
          </Text>
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setModalGame(null)}
          >
            <Text style={styles.modalCloseButtonText}>Close</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  </View>
</Modal>
  </View>
</ImageBackground>

  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    alignItems: 'center',
  },
  gameItemContainer: {
    marginBottom: 16,
    alignItems: "center",
    width: "100%",
  },
  gameContainer: {
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 8,
  },
  gameImg: {
    width: "100%",
    height: 150,
    justifyContent: "flex-end",
  },
  gameImgStyle: {
    borderRadius: 12,
  },
  gameName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    backgroundColor: "rgba(0,0,0,0.4)",
    padding: 6,
    textAlign: "center",
  },
  selectButton: {
    backgroundColor: "#FFD700",
    paddingVertical: 8,
    borderRadius: 6,
    width: "60%",
    alignItems: "center",
  },
  selectButtonText: {
    fontWeight: "bold",
    color: "#000",
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "80%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
  },
  modalDesc: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: "center",
  },
  modalCloseButton: {
    backgroundColor: "#4CAF50",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  modalCloseButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  tabButton: {
  paddingVertical: 6,
  paddingHorizontal: 16,
  marginRight: 10,
  borderRadius: 12,
  backgroundColor: 'rgba(255,255,255,0.2)',
},
tabButtonActive: {
  backgroundColor: '#4CAF50',
},
tabButtonText: {
  color: '#fff',
  fontWeight: '600',
  fontSize: 14,
},
tabButtonTextActive: {
  fontWeight: '700',
},
  backButtonContainer: {
    position: 'absolute',
    top: 40, // slightly higher for better spacing
    left: 15,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    width: '100%',
    paddingTop: 80, // reduced from 120 to move content up
    paddingHorizontal: 15,
  },
  title: {
    color: '#fff',
    fontSize: 36, // slightly smaller
    fontWeight: '700',
    marginBottom: 20, // reduce spacing
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  // Tabs ScrollView
tabsContainer: {
  flexDirection: 'row',
  height: 50,
  paddingHorizontal: 10,
  marginTop: 20,
},
  gameItem: {
    marginBottom: 12,
    backgroundColor: 'rgba(80,90,140,0.5)',
    padding: 12,
    borderRadius: 10,
  },
  // Decorative elements
  decorativeStar: {
    position: 'absolute',
    width: 24,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 12,
    transform: [{ rotate: '45deg' }],
  },
  decorativeDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 6,
  },
});


export default GameSelection;