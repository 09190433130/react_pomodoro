import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TextInput, Button, FlatList, TouchableOpacity, Alert } from 'react-native';
import { Audio } from 'expo-av';
import { Stack } from 'expo-router'; // Para o título da tela com Expo Router

const MP3Player = () => {
  const [currentSound, setCurrentSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlayingUri, setCurrentPlayingUri] = useState(null); // URI da música atualmente tocando
  const [mp3List, setMp3List] = useState([]); // Lista de URIs de MP3 adicionados
  const [newMp3Uri, setNewMp3Uri] = useState(''); // Estado para o input de nova URI

  // useEffect para limpar o som quando o componente for desmontado ou um novo som for carregado
  useEffect(() => {
    return () => {
      if (currentSound) {
        currentSound.unloadAsync();
      }
    };
  }, [currentSound]);

  // Função para adicionar uma nova URI de MP3 à lista
  const handleAddMp3 = () => {
    if (newMp3Uri.trim()) { // Garante que o input não está vazio
      setMp3List(prevList => {
        // Evita adicionar URIs duplicadas
        if (!prevList.some(item => item.uri === newMp3Uri.trim())) {
          return [...prevList, { id: Date.now().toString(), uri: newMp3Uri.trim() }];
        }
        return prevList;
      });
      setNewMp3Uri(''); // Limpa o input após adicionar
    } else {
      Alert.alert("Erro", "Por favor, insira um URL de MP3 válido.");
    }
  };

  // Função para remover uma MP3 da lista
  const handleRemoveMp3 = async (idToRemove) => {
    // Se a música sendo removida é a que está tocando, pare-a primeiro
    if (currentPlayingUri && mp3List.find(item => item.id === idToRemove)?.uri === currentPlayingUri) {
      await stopSound();
    }
    setMp3List(prevList => prevList.filter(item => item.id !== idToRemove));
  };

  // Função para tocar um MP3 a partir de uma URI
  const playSound = async (uri) => {
    try {
      // Se houver um som tocando/pausado, descarregue-o primeiro
      if (currentSound) {
        await currentSound.unloadAsync();
      }

      console.log('Carregando Som:', uri);
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true, isLooping: false }, // shouldPlay: true inicia a reprodução imediatamente
        onPlaybackStatusUpdate // Função para monitorar o status da reprodução
      );
      setCurrentSound(sound);
      setCurrentPlayingUri(uri);
      setIsPlaying(true);
      console.log('Tocando Som');
    } catch (error) {
      console.error('Erro ao tocar som', error);
      Alert.alert("Erro ao tocar MP3", "Verifique o URL e sua conexão com a internet.");
      setIsPlaying(false);
      setCurrentPlayingUri(null);
    }
  };

  // Função para pausar a reprodução
  const pauseSound = async () => {
    if (currentSound) {
      console.log('Pausando Som');
      await currentSound.pauseAsync();
      setIsPlaying(false);
    }
  };

  // Função para parar e descarregar o som
  const stopSound = async () => {
    if (currentSound) {
      console.log('Parando Som');
      await currentSound.stopAsync(); // Para a reprodução
      await currentSound.unloadAsync(); // Libera os recursos de memória
      setCurrentSound(null);
      setIsPlaying(false);
      setCurrentPlayingUri(null);
    }
  };

  // Função chamada a cada atualização de status da reprodução
  const onPlaybackStatusUpdate = (status) => {
    if (status.didJustFinish && !status.isLooping) {
      // A música terminou de tocar
      setIsPlaying(false);
      setCurrentPlayingUri(null);
      if (currentSound) {
        currentSound.unloadAsync();
        setCurrentSound(null);
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Configura o título da tela usando Expo Router Stack */}
      <Stack.Screen options={{ title: 'Meu Reprodutor de MP3' }} />

      <Text style={styles.title}>Reprodutor de MP3</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="URL do MP3 (ex: http://exemplo.com/musica.mp3)"
          value={newMp3Uri}
          onChangeText={setNewMp3Uri}
          autoCapitalize="none" // Para URLs, não capitalizar a primeira letra
        />
        <Button title="Adicionar" onPress={handleAddMp3} />
      </View>

      {/* Lista de MP3s adicionados */}
      <FlatList
        style={styles.mp3List}
        data={mp3List}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.mp3Item}>
            <Text style={styles.mp3Text} numberOfLines={1}>{item.uri}</Text>
            <TouchableOpacity
              style={styles.playButton}
              onPress={() => playSound(item.uri)}
            >
              <Text style={styles.buttonText}>{currentPlayingUri === item.uri && isPlaying ? '❚❚' : '▶'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => handleRemoveMp3(item.id)}
            >
              <Text style={styles.buttonText}>X</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      {/* Controles de reprodução para a música atual */}
      {currentPlayingUri && (
        <View style={styles.controls}>
          <Text style={styles.playingText}>Tocando: {currentPlayingUri.length > 40 ? currentPlayingUri.substring(0, 37) + '...' : currentPlayingUri}</Text>
          <View style={styles.controlButtons}>
            <Button title={isPlaying ? "Pausar" : "Continuar"} onPress={isPlaying ? pauseSound : () => playSound(currentPlayingUri)} />
            <Button title="Parar" onPress={stopSound} />
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50, // Espaço para a barra de status
    paddingHorizontal: 15,
    backgroundColor: '#f0f4f7',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 25,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  input: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    borderRightWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
  },
  mp3List: {
    flex: 1,
    paddingBottom: 20,
  },
  mp3Item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  mp3Text: {
    flex: 1,
    marginRight: 10,
    fontSize: 15,
    color: '#555',
  },
  playButton: {
    backgroundColor: '#28a745', // Verde
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
    marginRight: 8,
  },
  removeButton: {
    backgroundColor: '#dc3545', // Vermelho
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  controls: {
    marginTop: 20,
    padding: 20,
    backgroundColor: '#e9ecef',
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 5,
  },
  playingText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    color: '#343a40',
  },
  controlButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '80%',
  },
});

export default MP3Player;