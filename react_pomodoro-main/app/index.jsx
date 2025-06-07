// --- Ferramentas Essenciais para o Nosso Aplicativo ---
// Importações que trazem os recursos necessários para o app funcionar.

import React, { useState, useEffect, useRef, useCallback } from 'react'; // Base do React: estados, efeitos e referências.
import { Image, StyleSheet, Text, View, Pressable, FlatList, TouchableOpacity, Modal, StatusBar } from "react-native"; // Componentes visuais para a tela.
import { Audio } from 'expo-av'; // Para controle de áudio (tocar, pausar, etc.).
import * as DocumentPicker from 'expo-document-picker'; // Permite ao usuário escolher arquivos do celular.
import * as FileSystem from 'expo-file-system'; // Para gerenciar arquivos (copiar, apagar).
import AsyncStorage from '@react-native-async-storage/async-storage'; // Para guardar a playlist e outras informações persistentes.
import { AntDesign, Feather } from '@expo/vector-icons'; // Pacote de ícones para um visual show de bola.

// --- Constantes do Pomodoro ---
// Os tipos de sessão do timer.
const pomodoro = [
  { id: 'focus', initialValue: 25 * 60, image: require('./image1.png'), display: 'Foco' },
  { id: 'short', initialValue: 5 * 60, image: require('./image2.png'), display: 'Pausa curta' },
  { id: 'long', initialValue: 15 * 60, image: require('./image3.png'), display: 'Pausa longa' }
];

// --- Constantes do Player de MP3 ---
const AUDIO_DIR = FileSystem.documentDirectory + 'audio/'; // Diretório para guardar as músicas no app.
const PLAYLIST_STORAGE_KEY = 'mp3_playlist'; // Chave para salvar a playlist.

/**
 * --- O Coração do Nosso Aplicativo: Componente `Index` ---
 * Gerencia o Pomodoro e o Player de MP3, controlando os estados e a interface.
 */
export default function Index() {
  // --- Estados e Referências do Pomodoro ---
  const sound = useRef(null);      // Ref para o som de fundo (lofi.mp3).
  const alarmSound = useRef(null); // Ref para o som do alarme.
  const [isLofiPlaying, setIsLofiPlaying] = useState(true); // Controla a música de fundo do Pomodoro.
  const [timerType, setTimerType] = useState(pomodoro[0]); // Tipo de timer ativo.
  const [timeLeft, setTimeLeft] = useState(timerType.initialValue); // Tempo restante do timer.
  const [isRunning, setIsRunning] = useState(false); // Timer rodando ou pausado.

  // --- Estados do Player de MP3 ---
  const [playlist, setPlaylist] = useState([]); // Lista de músicas do player.
  const [currentMp3Sound, setCurrentMp3Sound] = useState(null); // Música MP3 tocando agora.
  const [isMp3Playing, setIsMp3Playing] = useState(false); // Player MP3 tocando ou pausado.
  const [mp3PlaybackStatus, setMp3PlaybackStatus] = useState(null); // Status da reprodução do MP3.
  const [mp3ErrorMessage, setMp3ErrorMessage] = useState(''); // Mensagem de erro do MP3 Player.
  const [showMp3ErrorModal, setShowMp3ErrorModal] = useState(false); // Visibilidade do modal de erro do MP3 Player.
  const [mp3Loading, setMp3Loading] = useState(false); // Carregamento da playlist do MP3 Player.

  // --- Efeitos Colaterais (useEffect): As Rotinas do App ---

  // 1. Configuração Inicial de Áudio e Carregamento dos Sons do Pomodoro:
  // Roda uma vez no início, prepara o ambiente de áudio e carrega os sons fixos.
  useEffect(() => {
    async function loadInitialSoundsAndAudioMode() {
      try {
        await Audio.setAudioModeAsync({
          allowsRecording: false, playsInSilentModeIOS: true, staysActiveInBackground: true,
          shouldDuckAndroid: true, playThroughEarpieceAndroid: false,
        });
        const { sound: bgSound } = await Audio.Sound.createAsync(require('./assets/lofi.mp3'), { shouldPlay: true, isLooping: true, volume: 1.0 });
        sound.current = bgSound;
        const { sound: loadedAlarm } = await Audio.Sound.createAsync(require('./assets/alarm.mp3'), { shouldPlay: false });
        alarmSound.current = loadedAlarm;
      } catch (error) {
        console.error('Erro carregando áudio do Pomodoro:', error);
        showMp3CustomAlert("Erro de Áudio", "Não conseguimos carregar os sons principais do app.");
      }
    }
    loadInitialSoundsAndAudioMode();
    return () => { // Limpeza: descarrega os sons ao fechar o app.
      if (sound.current) sound.current.unloadAsync();
      if (alarmSound.current) alarmSound.current.unloadAsync();
    };
  }, []);

  // 2. Reinicia o Timer do Pomodoro ao Mudar o Tipo:
  // Se o usuário troca de "Foco" para "Pausa", o timer reseta.
  useEffect(() => {
    setTimeLeft(timerType.initialValue);
    setIsRunning(false);
  }, [timerType]);

  // 3. Lógica do Cronômetro do Pomodoro:
  // Controla a contagem regressiva, toca o alarme e pausa a música lofi quando o tempo zera.
  useEffect(() => {
    let interval = null;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      if (alarmSound.current) alarmSound.current.replayAsync();
      if (sound.current) {
        sound.current.pauseAsync();
        setIsLofiPlaying(false);
      }
      setIsRunning(false);
    }
    return () => clearInterval(interval); // Limpa o intervalo para evitar conflitos.
  }, [isRunning, timeLeft]);

  // 4. Carregamento da Playlist Salva do MP3 Player:
  // Carrega as músicas salvas na "memória de longo prazo" quando o app inicia.
  useEffect(() => {
    const loadMp3Playlist = async () => {
      setMp3Loading(true);
      try {
        const storedPlaylist = await AsyncStorage.getItem(PLAYLIST_STORAGE_KEY);
        if (storedPlaylist) {
          const parsedPlaylist = JSON.parse(storedPlaylist);
          const validPlaylist = [];
          for (const item of parsedPlaylist) {
            const fileInfo = await FileSystem.getInfoAsync(item.uri);
            if (fileInfo.exists) {
              validPlaylist.push(item);
            } else {
              console.warn(`Arquivo MP3 não encontrado: ${item.name}. Removendo da playlist salva.`);
            }
          }
          setPlaylist(validPlaylist);
        }
      } catch (error) {
        console.error("Erro ao carregar a playlist do MP3 Player:", error);
        showMp3CustomAlert("Erro de Carregamento", "Não conseguimos carregar sua playlist de músicas.");
      } finally {
        setMp3Loading(false);
      }
    };
    loadMp3Playlist();
  }, []);

  // 5. Salvamento da Playlist do MP3 Player:
  // Salva a playlist na "memória de longo prazo" toda vez que ela muda.
  useEffect(() => {
    const saveMp3Playlist = async () => {
      try {
        await AsyncStorage.setItem(PLAYLIST_STORAGE_KEY, JSON.stringify(playlist));
      } catch (error) {
        console.error("Erro ao salvar a playlist do MP3 Player:", error);
        showMp3CustomAlert("Erro ao Salvar Música", "Não conseguimos salvar a playlist.");
      }
    };
    if (!mp3Loading) { // Evita salvar a playlist vazia durante o carregamento.
        saveMp3Playlist();
    }
  }, [playlist, mp3Loading]);

  // --- Funções de Controle de Áudio do Pomodoro ---

  // Alterna entre mutar e tocar a música de fundo do Pomodoro.
  const toggleLofiSound = async () => {
    if (sound.current) {
      if (isLofiPlaying) {
        await sound.current.pauseAsync();
      } else {
        await sound.current.playAsync();
      }
      setIsLofiPlaying(!isLofiPlaying);
    }
  };

  // Inicia ou pausa o timer do Pomodoro.
  const togglePomodoroTimer = async () => {
    if (!isRunning) { // Se o timer vai começar...
      // Parar o alarme e retomar a música lofi, se necessário.
      if (alarmSound.current) {
        try { await alarmSound.current.stopAsync(); } catch (e) { /* Já parado */ }
      }
      if (sound.current && !isLofiPlaying) {
        await sound.current.playAsync();
        setIsLofiPlaying(true);
      }
    }
    setIsRunning(prev => !prev);
  };

  // --- Funções de Controle de Áudio do Player de MP3 ---

  // Callback para atualizar o status de reprodução de uma música do MP3 Player.
  const onMp3PlaybackStatusUpdate = useCallback((status) => {
    setMp3PlaybackStatus(status);
    if (status.didJustFinish) { // Se a música do MP3 Player terminou...
      setIsMp3Playing(false);
      if (currentMp3Sound) {
        currentMp3Sound.unloadAsync();
        setCurrentMp3Sound(null);
      }
    }
  }, [currentMp3Sound]);

  // Toca uma música do Player de MP3.
  const playMp3Audio = async (itemUri) => {
    if (currentMp3Sound) { // Se outra música já estiver tocando, ela é parada.
      await currentMp3Sound.unloadAsync();
      setCurrentMp3Sound(null);
    }
    try {
      const { sound: newMp3Sound } = await Audio.Sound.createAsync({ uri: itemUri }, { shouldPlay: true }, onMp3PlaybackStatusUpdate);
      setCurrentMp3Sound(newMp3Sound);
      setIsMp3Playing(true);
    } catch (error) {
      console.error("Erro ao reproduzir áudio do MP3 Player:", error);
      showMp3CustomAlert("Erro de Reprodução", "Não conseguimos tocar esta música. O arquivo pode estar com problema.");
      setIsMp3Playing(false);
    }
  };

  // Pausa a música do Player de MP3.
  const pauseMp3Audio = async () => {
    if (currentMp3Sound && isMp3Playing) {
      try {
        await currentMp3Sound.pauseAsync();
        setIsMp3Playing(false);
      } catch (error) {
        console.error("Erro ao pausar áudio do MP3 Player:", error);
        showMp3CustomAlert("Erro ao Pausar", "Não conseguimos pausar a música.");
      }
    }
  };

  // Para a música do Player de MP3 e a descarrega.
  const stopMp3Audio = async () => {
    if (currentMp3Sound) {
      try {
        await currentMp3Sound.stopAsync();
        await currentMp3Sound.unloadAsync();
        setCurrentMp3Sound(null);
        setIsMp3Playing(false);
        setMp3PlaybackStatus(null);
      } catch (error) {
        console.error("Erro ao parar áudio do MP3 Player:", error);
        showMp3CustomAlert("Erro ao Parar", "Ops, tivemos um problema ao parar a música.");
      }
    }
  };

  // --- Funções de Gerenciamento de Arquivos do MP3 Player (Adicionar/Remover) ---

  // Permite ao usuário selecionar um arquivo MP3.
  const pickMp3File = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'audio/mpeg', copyToCacheDirectory: true });
      if (result.canceled === false && result.assets && result.assets.length > 0) {
        const pickedAsset = result.assets[0];
        const fileName = pickedAsset.name;
        const fileUri = pickedAsset.uri;

        const dirInfo = await FileSystem.getInfoAsync(AUDIO_DIR);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(AUDIO_DIR, { intermediates: true });
        }
        const destinationUri = AUDIO_DIR + fileName;
        await FileSystem.copyAsync({ from: fileUri, to: destinationUri });

        setPlaylist((prevPlaylist) => {
          if (!prevPlaylist.some(item => item.uri === destinationUri)) {
            showMp3CustomAlert("Sucesso!", `Oba! "${fileName}" adicionado com sucesso à playlist.`);
            return [...prevPlaylist, { name: fileName, uri: destinationUri }];
          }
          showMp3CustomAlert("Aviso", `A música "${fileName}" já está na sua playlist, chapa!`);
          return prevPlaylist;
        });
      }
    } catch (error) {
      console.error("Erro ao selecionar ou copiar arquivo MP3:", error);
      showMp3CustomAlert("Erro ao Adicionar Música", "Que pena! Não conseguimos adicionar o MP3.");
    }
  };

  // Remove uma música da playlist e do celular.
  const removeMp3Audio = async (itemUri, fileName) => {
    if (currentMp3Sound && currentMp3Sound._uri === itemUri) {
      await stopMp3Audio();
    }
    try {
      await FileSystem.deleteAsync(itemUri, { idempotent: true });
      setPlaylist((prevPlaylist) => prevPlaylist.filter((item) => item.uri !== itemUri));
      showMp3CustomAlert("Sucesso!", `Pronto! "${fileName}" foi removido da sua playlist e do celular.`);
    } catch (error) {
      console.error("Erro ao remover arquivo MP3:", error);
      showMp3CustomAlert("Erro ao Remover Música", "Vish! Não conseguimos remover o MP3.");
    }
  };

  // --- Funções Auxiliares de UI e Mensagens do MP3 Player ---

  // Exibe um modal de erro/aviso personalizado para o MP3 Player.
  const showMp3CustomAlert = (title, message) => {
    setMp3ErrorMessage({ title, message });
    setShowMp3ErrorModal(true);
  };

  // Fecha o modal de erro do MP3 Player.
  const closeMp3ErrorModal = () => {
    setShowMp3ErrorModal(false);
    setMp3ErrorMessage('');
  };

  // Formata o tempo de milissegundos para "MM:SS".
  const formatPlaybackTime = (milliseconds) => {
    if (!milliseconds) return "00:00";
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // --- Renderização da Interface do Usuário (O Que o Usuário Vê) ---
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#021123" />

      {/* --- Seção do Pomodoro --- */}
      <View style={styles.pomodoroSection}>
        <Image source={timerType.image} style={styles.pomodoroImage} />

        <View style={styles.pomodoroActions}>
          <View style={styles.pomodoroContext}>
            {pomodoro.map(p => (
              <Pressable
                key={p.id}
                style={[styles.pomodoroContextButton, timerType.id === p.id && styles.pomodoroContextButtonActive]}
                onPress={() => setTimerType(p)}
              >
                <Text style={styles.pomodoroContextButtonText}>
                  {p.display}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.pomodoroTimer}>
            {new Date(timeLeft * 1000).toLocaleTimeString('pt-BR', {
              minute: '2-digit',
              second: '2-digit'
            })}
          </Text>

          <Pressable style={styles.pomodoroButton} onPress={togglePomodoroTimer}>
            <Text style={styles.pomodoroButtonText}>
              {isRunning ? 'Pausar' : 'Começar'}
            </Text>
          </Pressable>
        </View>

        <Pressable style={styles.pomodoroMuteButton} onPress={toggleLofiSound}>
          <Text style={styles.pomodoroMuteButtonText}>
            {isLofiPlaying ? "Mutar Música Pomodoro" : "Tocar Música Pomodoro"}
          </Text>
        </Pressable>
      </View>

      {/* --- Seção do Player de MP3 --- */}
      <View style={styles.mp3PlayerSection}>
        <Text style={styles.mp3PlayerHeader}>
          <Feather name="headphones" size={28} color="#F0F2F7" /> Nosso Player de MP3
        </Text>

        <TouchableOpacity style={styles.mp3AddButton} onPress={pickMp3File}>
          <AntDesign name="pluscircle" size={24} color="#F0F2F7" style={styles.mp3ButtonIcon} />
          <Text style={styles.mp3AddButtonText}>Adicionar Música</Text>
        </TouchableOpacity>

        {mp3Loading && <Text style={styles.mp3LoadingText}>Carregando playlist, segura a emoção...</Text>}

        <FlatList
          data={playlist}
          keyExtractor={(item) => item.uri}
          ListEmptyComponent={
            <Text style={styles.mp3EmptyListText}>
              Eita! Nenhuma música na playlist ainda. Toque em "Adicionar Música" para começar a festa!
            </Text>
          }
          renderItem={({ item }) => (
            <View style={[styles.mp3TrackItem, currentMp3Sound && currentMp3Sound._uri === item.uri && styles.mp3CurrentTrackPlaying]}>
              <Text style={styles.mp3TrackName} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={styles.mp3TrackControls}>
                <TouchableOpacity
                  style={styles.mp3ControlButton}
                  onPress={() => (isMp3Playing && currentMp3Sound && currentMp3Sound._uri === item.uri ? pauseMp3Audio() : playMp3Audio(item.uri))}
                >
                  {isMp3Playing && currentMp3Sound && currentMp3Sound._uri === item.uri ? (
                    <AntDesign name="pausecircle" size={24} color="#F0F2F7" />
                  ) : (
                    <AntDesign name="playcircleo" size={24} color="#F0F2F7" />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.mp3ControlButton, styles.mp3RemoveButton]}
                  onPress={() => removeMp3Audio(item.uri, item.name)}
                >
                  <AntDesign name="delete" size={24} color="#F0F2F7" />
                </TouchableOpacity>
              </View>
            </View>
          )}
          style={styles.mp3PlaylistContainer}
          contentContainerStyle={styles.mp3PlaylistContentContainer}
        />

        {currentMp3Sound && (
          <View style={styles.mp3PlayerControls}>
            <Text style={styles.mp3NowPlayingText} numberOfLines={1}>
              Tocando Agora: {playlist.find(item => item.uri === currentMp3Sound._uri)?.name || 'Música Desconhecida'}
            </Text>
            {mp3PlaybackStatus && (
              <Text style={styles.mp3PlaybackTime}>
                {formatPlaybackTime(mp3PlaybackStatus.positionMillis)} / {formatPlaybackTime(mp3PlaybackStatus.durationMillis)}
              </Text>
            )}
            <TouchableOpacity style={styles.mp3StopButton} onPress={stopMp3Audio}>
              <AntDesign name="stopcircleo" size={24} color="#F0F2F7" style={styles.mp3ButtonIcon} />
              <Text style={styles.mp3StopButtonText}>Parar Tudo</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* --- Rodapé --- */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Projeto fictício e sem fins comerciais.</Text>
        <Text style={styles.footerText}>Desenvolvido com carinho por Acriative.</Text>
      </View>

      {/* --- Modal de Erro Personalizado (para o MP3 Player) --- */}
      <Modal animationType="fade" transparent={true} visible={showMp3ErrorModal} onRequestClose={closeMp3ErrorModal}>
        <View style={styles.mp3CenteredView}>
          <View style={styles.mp3ModalView}>
            <AntDesign name="warning" size={40} color="#FF6347" style={styles.mp3ModalIcon} />
            <Text style={styles.mp3ModalTitle}>{mp3ErrorMessage.title}</Text>
            <Text style={styles.mp3ModalText}>{mp3ErrorMessage.message}</Text>
            <TouchableOpacity style={styles.mp3ModalButton} onPress={closeMp3ErrorModal}>
              <Text style={styles.mp3ModalButtonText}>Entendi, valeu!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// --- Estilos da Aplicação (Onde a Mágica Visual Acontece!) ---
// Aqui a gente define o "look" do nosso app. Cores e tamanhos pensados para combinar com o que você já tinha!
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-start", // Alinha ao topo para ter espaço para tudo.
    alignItems: "center",
    backgroundColor: '#021123', // Fundo escuro do seu app.
    paddingTop: StatusBar.currentHeight || 40, // Espaçamento do topo, considerando a barra de status.
    gap: 40, // Espaçamento entre as seções Pomodoro e MP3.
    paddingHorizontal: 20,
  },

  // --- Estilos do Pomodoro ---
  pomodoroSection: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20, // Espaçamento antes do player.
  },
  pomodoroImage: {
    width: 150, // Tamanho da imagem que aparece no topo do Pomodoro.
    height: 150,
    borderRadius: 75, // Deixa a imagem redonda.
    marginBottom: 20,
  },
  pomodoroActions: {
    paddingVertical: 24,
    paddingHorizontal: 24,
    backgroundColor: '#14448080', // Fundo semitransparente para a caixa do timer.
    width: '80%',
    borderRadius: 32, // Cantos bem arredondados.
    borderWidth: 2,
    borderColor: '#144480', // Borda azul escuro.
    gap: 32, // Espaçamento interno.
  },
  pomodoroContext: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  pomodoroContextButton: {
    // Estilo base dos botões de contexto (Foco, Pausa).
  },
  pomodoroContextButtonActive: {
    backgroundColor: '#144480', // Cor do botão ativo.
    borderRadius: 8,
  },
  pomodoroContextButtonText: {
    fontSize: 14, // Aumentei um pouco a fonte aqui para melhor leitura.
    color: '#FFF',
    padding: 8,
  },
  pomodoroTimer: {
    fontSize: 54,
    color: '#FFF',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  pomodoroButton: {
    backgroundColor: '#B872FF', // Roxo vibrante para o botão Começar/Pausar.
    borderRadius: 32,
    padding: 12, // Aumentei o padding para o botão ficar mais "clicável".
  },
  pomodoroButtonText: {
    textAlign: 'center',
    color: '#021123', // Cor do texto escura para contrastar.
    fontSize: 20, // Aumentei a fonte para o botão principal.
    fontWeight: 'bold', // Deixei em negrito.
  },
  pomodoroMuteButton: {
    marginTop: 20, // Aumentei a margem para separar.
    padding: 12,
    backgroundColor: '#B872FF',
    borderRadius: 20,
    shadowColor: '#000', // Sombra para dar um toque 3D.
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  pomodoroMuteButtonText: {
    color: '#021123',
    fontWeight: 'bold',
    fontSize: 16, // Aumentei a fonte.
  },

  // --- Estilos do Player de MP3 ---
  mp3PlayerSection: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: '#0A1E3E', // Fundo da seção do player, um azul um pouco mais claro.
    borderRadius: 20, // Cantos arredondados.
    padding: 20,
    marginBottom: 20, // Espaçamento antes do rodapé.
    shadowColor: '#000', // Sombra para destacar a seção.
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  mp3PlayerHeader: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F0F2F7',
    marginBottom: 20,
    flexDirection: 'row', // Para alinhar ícone e texto.
    alignItems: 'center',
    gap: 10, // Espaçamento entre o ícone e o texto do cabeçalho.
  },
  mp3AddButton: {
    backgroundColor: '#7D4CDB', // Roxo vibrante.
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 30,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  mp3AddButtonText: {
    color: '#F0F2F7',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
  },
  mp3ButtonIcon: {
    marginRight: 5, // Pequena margem para ícones em botões.
  },
  mp3LoadingText: {
    fontSize: 16,
    color: '#9BB8D2',
    marginBottom: 10,
  },
  mp3EmptyListText: {
    fontSize: 16,
    color: '#9BB8D2',
    textAlign: 'center',
    marginTop: 30,
    fontStyle: 'italic',
  },
  mp3PlaylistContainer: {
    width: '100%',
    maxHeight: 250, // Altura máxima para a lista de músicas, para não tomar a tela toda.
    flexGrow: 0, // Não deixa a FlatList "empurrar" o resto da tela para baixo.
  },
  mp3PlaylistContentContainer: {
    paddingBottom: 10,
  },
  mp3TrackItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#272A3D', // Cor do card da música.
    padding: 15,
    borderRadius: 15,
    marginBottom: 8, // Espaçamento menor entre os itens da lista.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  mp3CurrentTrackPlaying: {
    borderColor: '#7FFFD4', // Borda verde água para a música tocando.
    borderWidth: 2,
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
  },
  mp3TrackName: {
    flex: 1,
    fontSize: 16,
    color: '#F0F2F7',
    marginRight: 10,
    fontWeight: '500',
  },
  mp3TrackControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mp3ControlButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginLeft: 10,
  },
  mp3RemoveButton: {
    backgroundColor: '#DC143C', // Vermelho forte.
  },
  mp3PlayerControls: {
    width: '100%',
    backgroundColor: '#0A1E3E', // Fundo do controle do player.
    padding: 20,
    borderRadius: 20,
    marginTop: 15, // Aproximei do player.
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 12,
  },
  mp3NowPlayingText: {
    color: '#F0F2F7',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
    textAlign: 'center',
  },
  mp3PlaybackTime: {
    color: '#9BB8D2',
    fontSize: 16,
    marginBottom: 10,
  },
  mp3StopButton: {
    backgroundColor: '#7D4CDB',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 25,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  mp3StopButtonText: {
    color: '#F0F2F7',
    fontSize: 17,
    fontWeight: '600',
    marginLeft: 10,
  },

  // --- Estilos do Rodapé ---
  footer: {
    marginTop: 'auto', // Empurra o rodapé para o final da tela.
    marginBottom: 15,
    alignItems: 'center',
  },
  footerText: {
    textAlign: 'center',
    color: '#98A0A8',
    fontSize: 12.5,
  },

  // --- Estilos do Modal de Erro do MP3 Player ---
  mp3CenteredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  mp3ModalView: {
    margin: 25,
    backgroundColor: '#272A3D',
    borderRadius: 25,
    padding: 30, // Reduzi o padding para um modal mais compacto.
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 10,
  },
  mp3ModalIcon: {
    marginBottom: 15,
  },
  mp3ModalTitle: {
    fontSize: 22, // Levemente menor.
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#FF6347',
    textAlign: 'center',
  },
  mp3ModalText: {
    marginBottom: 20,
    textAlign: 'center',
    fontSize: 16,
    color: '#F0F2F7',
    lineHeight: 22,
  },
  mp3ModalButton: {
    backgroundColor: '#7D4CDB',
    borderRadius: 15,
    paddingVertical: 10, // Menor.
    paddingHorizontal: 25, // Menor.
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  mp3ModalButtonText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 17, // Menor.
  },
});
