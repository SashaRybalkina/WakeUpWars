import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import type { NavigationProp } from '@react-navigation/native';
import { useUser } from '../../context/UserContext';
import { getAccessToken } from '../../auth';
import { endpoints } from '../../api';

type Props = { navigation: NavigationProp<any> };

const MySkills: React.FC<Props> = ({ navigation }) => {
  const { skillLevels, setSkillLevels } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const access = await getAccessToken();
        const res = await fetch(endpoints.skillLevels(), {
          headers: { Authorization: `Bearer ${access}` },
        });
        const data = await res.json();
        if (!cancelled) setSkillLevels(data);
      } catch (e: any) {
        if (!cancelled) setError('Failed to load skills');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [setSkillLevels]);

  const computeSkill = (earned: number, possible: number) => {
    if (!possible || possible <= 0) return 0;
    const v = Math.min(10, 10 * (earned / possible));
    return Math.round(v * 100) / 100;
    };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>My Skills</Text>

      {loading && (
        <View style={styles.center}> 
          <ActivityIndicator color="#FFD700" />
        </View>
      )}
      {!!error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.list}>
        {(skillLevels as any[]).map((sl, idx) => {
          const categoryId = sl?.category?.id;
          const categoryName = sl?.category?.categoryName ?? 'Unknown';
          const skill = computeSkill(Number(sl?.totalEarned || 0), Number(sl?.totalPossible || 0));
          return (
            <TouchableOpacity
              key={`${categoryId ?? idx}`}
              style={styles.row}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('SkillDetail', { categoryId, categoryName })}
              disabled={categoryId == null}
            >
              <Text style={styles.rowLeft}>{categoryName}</Text>
              <Text style={styles.rowRight}>{skill.toFixed(2)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f12' },
  content: { padding: 20 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 12 },
  error: { color: '#ff7070', marginVertical: 8 },
  center: { paddingVertical: 20, alignItems: 'center' },
  list: { borderRadius: 12, overflow: 'hidden', borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomColor: 'rgba(255,255,255,0.06)', borderBottomWidth: 1 },
  rowLeft: { color: '#fff', fontSize: 16, fontWeight: '600' },
  rowRight: { color: '#FFD700', fontSize: 16, fontWeight: '700' },
});

export default MySkills;
