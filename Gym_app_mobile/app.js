// --- Importações Essenciais para o Nosso App ---
// São como as "ferramentas" que precisamos para construir o player.
import React, { useState, useEffect, useCallback } from 'react'; // A base do React Native para criar componentes e gerenciar estados.
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, StatusBar } from 'react-native'; // Componentes visuais básicos do React Native (blocos, textos, listas, botões, modais).

// Bibliotecas do Expo, que facilitam muito o desenvolvimento mobile!
import { Audio } from 'expo-av'; // Essa é a "caixa de som" do nosso app. Permite tocar, pausar e controlar o áudio.
import * as DocumentPicker from 'expo-document-picker'; // A "mãozinha" que ajuda o usuário a escolher arquivos MP3 do celular.
import * as FileSystem from 'expo-file-system'; // O "gerente de arquivos" do app. Permite copiar, mover e apagar arquivos no armazenamento interno.
import AsyncStorage from '@react-native-async-storage/async-storage'; // A "memória de longo prazo" do app. Guarda a lista de músicas mesmo depois que o app é fechado.
import { AntDesign, Feather } from '@expo/vector-icons'; // Nossa "caixa de ícones". Deixa os botões e textos mais bonitos e intuitivos.

// --- Constantes Importantes para a Organização ---
// É sempre bom ter constantes para caminhos e chaves, facilita a manutenção e evita erros de digitação.

// Onde vamos guardar as músicas MP3 copiadas para dentro do aplicativo.
// `FileSystem.documentDirectory` é um local seguro e persistente do app.
const AUDIO_DIR = FileSystem.documentDirectory + 'audio/';

// A "etiqueta" que usamos para salvar e encontrar nossa playlist na "memória de longo prazo" (AsyncStorage).
const PLAYLIST_STORAGE_KEY = 'mp3_playlist';

/**
 * --- O Coração do Nosso Player: O Componente Principal `App` ---
 *
 * Este é o componente que controla toda a lógica do player MP3,
 * desde a seleção das músicas até a reprodução e o controle visual.
 *
 * Ele é uma função React, o que significa que ele vai "renderizar"
 * (desenhar na tela) a interface do nosso aplicativo.
 */
export default function App() {
  // --- Estados do Componente: Onde Guardamos as Informações Atuais do App ---
  // `useState` são como "pequenas gavetas" onde armazenamos dados que podem mudar ao longo do tempo
  // e que, quando mudam, fazem com que a tela seja atualizada.

  // `playlist`: Uma lista (array) que vai conter todas as músicas que o usuário adicionar.
  // Cada música é um objeto com `name` (o nome do arquivo, ex: "minha_musica.mp3")
  // e `uri` (o caminho completo do arquivo no sistema de arquivos do celular).
  const [playlist, setPlaylist] = useState([]);

  // `currentSound`: Aqui vamos guardar o objeto de áudio do `expo-av` da música que está tocando.
  // Se for `null`, significa que nenhuma música está carregada ou tocando no momento.
  const [currentSound, setCurrentSound] = useState(null);

  // `isPlaying`: Um simples "sim ou não" (booleano) que nos diz se a música está tocando (`true`) ou pausada/parada (`false`).
  const [isPlaying, setIsPlaying] = useState(false);

  // `playbackStatus`: Um objeto que o `expo-av` nos dá com informações detalhadas sobre a música tocando:
  // tempo atual, duração total, se está carregando, etc.
  const [playbackStatus, setPlaybackStatus] = useState(null);

  // `errorMessage`: A mensagem de erro que queremos mostrar para o usuário, se algo der errado.
  const [errorMessage, setErrorMessage] = useState('');

  // `showErrorModal`: Controla se o nosso "pop-up" de erro (o modal) deve aparecer na tela.
  const [showErrorModal, setShowErrorModal] = useState(false);

  // `loading`: Um booleano para indicar se o app está no processo de carregar a playlist salva.
  // Usamos isso para mostrar uma mensagem de "Carregando..." e evitar que o usuário interaja antes da playlist estar pronta.
  const [loading, setLoading] = useState(false);

  // --- Efeitos Colaterais (useEffect): Ações que Acontecem Automaticamente ---
  // `useEffect` é um Hook do React que nos permite executar funções em momentos específicos
  // do ciclo de vida do componente (quando ele aparece, quando ele é atualizado, quando ele sai da tela).

  // 1. Configuração Inicial do Modo de Áudio:
  // Este efeito roda APENAS UMA VEZ, logo que o aplicativo é iniciado (`[]` como dependência).
  // Ele diz ao sistema operacional como o nosso app vai lidar com o áudio.
  useEffect(() => {
    const setupAudioMode = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecording: false,          // Nosso player não grava áudio, então desativamos isso.
          playsInSilentModeIOS: true,      // No iPhone, se o modo silencioso estiver ativado, a música ainda vai tocar!
          staysActiveInBackground: true,   // A música continua tocando mesmo se o usuário sair do app (ficar em segundo plano).
          shouldDuckAndroid: true,         // Se uma notificação de áudio (tipo um WhatsApp) tocar, a música abaixa o volume rapidinho no Android.
          playThroughEarpieceAndroid: false, // Garante que o áudio saia pelos alto-falantes ou fones de ouvido, não pelo fone de chamada.
        });
        console.log("Modo de áudio configurado com sucesso!"); // Uma mensagem para o console, útil para depurar.
      } catch (e) {
        // Se algo der errado na configuração, mostramos um erro e logamos para o desenvolvedor.
        console.error("Erro ao configurar o modo de áudio:", e);
        showCustomAlert("Erro de Configuração", "Ops! Não conseguimos preparar o áudio. Tente reiniciar o aplicativo.");
      }
    };
    setupAudioMode(); // Chamamos a função para configurar o modo de áudio.
  }, []); // O array vazio `[]` significa que este efeito só é executado uma vez, ao "montar" o componente.

  // 2. Carregamento da Playlist Salva:
  // Este efeito também roda APENAS UMA VEZ ao iniciar o app.
  // Ele é responsável por "lembrar" as músicas que o usuário adicionou da última vez.
  useEffect(() => {
    const loadPlaylist = async () => {
      setLoading(true); // Avisamos que estamos carregando, para mostrar o indicador na tela.
      try {
        // Tentamos pegar a playlist salva na "memória de longo prazo" (AsyncStorage).
        const storedPlaylist = await AsyncStorage.getItem(PLAYLIST_STORAGE_KEY);
        if (storedPlaylist) { // Se encontrarmos algo salvo...
          const parsedPlaylist = JSON.parse(storedPlaylist); // Convertemos de volta de texto para um objeto JavaScript.
          const validPlaylist = [];

          // Um laço de repetição para cada item na playlist salva.
          for (const item of parsedPlaylist) {
            // Verificamos se o arquivo da música ainda existe no celular.
            // Isso é importante porque o usuário pode ter apagado o arquivo manualmente.
            const fileInfo = await FileSystem.getInfoAsync(item.uri);
            if (fileInfo.exists) {
              validPlaylist.push(item); // Se o arquivo existe, adicionamos na nossa lista válida.
            } else {
              // Se o arquivo não for encontrado, avisamos no console (para o desenvolvedor).
              console.warn(`Arquivo não encontrado: ${item.name} (${item.uri}). Removendo da playlist salva.`);
            }
          }
          setPlaylist(validPlaylist); // Atualizamos a playlist do nosso app com a lista válida.
          console.log("Playlist carregada com sucesso!");
        } else {
          console.log("Nenhuma playlist salva encontrada. Começando com playlist vazia.");
        }
      } catch (error) {
        // Se der algum problema ao carregar, avisamos o usuário.
        console.error("Erro ao carregar a playlist:", error);
        showCustomAlert("Erro de Carregamento", "Eita! Não conseguimos carregar sua playlist salva. Mas você pode adicionar músicas novas!");
      } finally {
        setLoading(false); // Terminamos o carregamento, então o indicador some.
      }
    };
    loadPlaylist(); // Chamamos a função para carregar a playlist.
  }, []); // Novamente, `[]` para rodar uma vez na montagem.

  // 3. Salvamento Automático da Playlist:
  // Este efeito roda SEMPRE que a `playlist` ou o estado `loading` mudam.
  // Ele é o "zelador" da nossa playlist, garantindo que tudo seja salvo.
  useEffect(() => {
    const savePlaylist = async () => {
      try {
        // Convertemos a playlist (que é um array de objetos) para uma string JSON
        // antes de guardar no AsyncStorage, porque ele só aceita strings.
        await AsyncStorage.setItem(PLAYLIST_STORAGE_KEY, JSON.stringify(playlist));
        console.log("Playlist salva automaticamente!");
      } catch (error) {
        // Em caso de erro ao salvar, avisamos.
        console.error("Erro ao salvar a playlist:", error);
        showCustomAlert("Erro ao Salvar", "Não foi possível salvar a playlist. Suas alterações podem não ser guardadas para a próxima vez.");
      }
    };
    // IMPORTANTE: Só salvamos a playlist se não estivermos no meio do processo de carregamento inicial.
    // Isso evita que uma playlist vazia (antes de ser carregada) sobrescreva uma playlist já existente no AsyncStorage.
    if (!loading) {
        savePlaylist();
    }
  }, [playlist, loading]); // Dependências: este efeito é "disparado" quando `playlist` ou `loading` mudam.

  // --- Funções de Controle de Reprodução de Áudio ---
  // São as funções que fazem o player funcionar: tocar, pausar, parar.

  // `onPlaybackStatusUpdate`: Um "observador" que o `expo-av` chama a cada milissegundo
  // para nos dar informações sobre a música que está tocando.
  const onPlaybackStatusUpdate = useCallback((status) => {
    setPlaybackStatus(status); // Atualizamos o estado `playbackStatus` com as novas informações.

    // Verifica se a música acabou de tocar (chegou ao fim).
    if (status.didJustFinish) {
      setIsPlaying(false); // Avisamos que não está mais tocando.
      if (currentSound) {
        currentSound.unloadAsync(); // É muito importante descarregar a música da memória para liberar recursos.
        setCurrentSound(null);     // E limpamos a referência ao objeto de som.
        console.log("Música finalizada e descarregada.");
      }
    }
  }, [currentSound]); // `useCallback` com `currentSound` otimiza essa função, evitando que seja recriada desnecessariamente.

  // `playAudio`: A função que faz a música começar!
  // Recebe o `itemUri` (o caminho do arquivo da música) como argumento.
  const playAudio = async (itemUri) => {
    // Primeiro, se já tiver alguma música tocando, precisamos parar e descarregá-la.
    if (currentSound) {
      console.log("Parando e descarregando música anterior...");
      await currentSound.unloadAsync();
      setCurrentSound(null);
    }

    try {
      console.log(`Tentando tocar: ${itemUri}`);
      // Cria um novo objeto de som do `expo-av` a partir do URI da música.
      // `shouldPlay: true` faz ela começar a tocar imediatamente.
      // `onPlaybackStatusUpdate` é o nosso "observador" que vai nos dar o status da reprodução.
      const { sound } = await Audio.Sound.createAsync(
        { uri: itemUri },           // O caminho do arquivo de áudio.
        { shouldPlay: true },        // Começa a tocar na hora.
        onPlaybackStatusUpdate       // Nosso callback para updates de status.
      );
      setCurrentSound(sound);    // Guardamos o objeto `sound` para poder controlá-lo depois (pausar, parar).
      setIsPlaying(true);        // Atualizamos o estado para "tocando".
      console.log("Música começou a tocar!");
    } catch (error) {
      // Se algo der errado ao tentar tocar, mostramos um erro amigável.
      console.error("Erro ao reproduzir áudio:", error);
      showCustomAlert("Erro de Reprodução", "Poxa, não conseguimos tocar esta música. Ela pode estar com problemas ou o formato não é compatível.");
      setIsPlaying(false);       // Garante que o estado de reprodução esteja correto (não tocando).
    }
  };

  // `pauseAudio`: Função para pausar a música que está tocando.
  const pauseAudio = async () => {
    if (currentSound && isPlaying) { // Só faz sentido pausar se houver uma música e ela estiver tocando.
      try {
        console.log("Pausando música...");
        await currentSound.pauseAsync(); // Comando para pausar.
        setIsPlaying(false);             // Atualiza o estado para "pausado".
        console.log("Música pausada.");
      } catch (error) {
        console.error("Erro ao pausar áudio:", error);
        showCustomAlert("Erro ao Pausar", "Ih, não conseguimos pausar a música.");
      }
    }
  };

  // `stopAudio`: Função para parar a música e limpar tudo.
  const stopAudio = async () => {
    if (currentSound) { // Só para se houver uma música carregada.
      try {
        console.log("Parando e descarregando música atual...");
        await currentSound.stopAsync();   // Comando para parar.
        await currentSound.unloadAsync(); // Descarrega o som da memória para liberar recursos.
        setCurrentSound(null);            // Limpa a referência ao objeto de som.
        setIsPlaying(false);              // Atualiza o estado para "não tocando".
        setPlaybackStatus(null);          // Limpa o status de reprodução.
        console.log("Música parada e descarregada.");
      } catch (error) {
        console.error("Erro ao parar áudio:", error);
        showCustomAlert("Erro ao Parar", "Ops, tivemos um problema ao parar a música.");
      }
    }
  };

  // --- Funções de Gerenciamento de Arquivos: Adicionar e Remover MP3s ---

  // `pickAudioFile`: Permite ao usuário escolher um arquivo MP3 do celular.
  const pickAudioFile = async () => {
    try {
      // Abre a tela de seleção de documentos do sistema.
      // `type: 'audio/mpeg'` filtra para mostrar apenas arquivos MP3.
      // `copyToCacheDirectory: true` faz uma cópia temporária do arquivo, o que é bom.
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/mpeg',
        copyToCacheDirectory: true,
      });

      // Se o usuário selecionou um arquivo (e não cancelou a ação)...
      if (result.canceled === false && result.assets && result.assets.length > 0) {
        const pickedAsset = result.assets[0]; // Pegamos os detalhes do primeiro arquivo selecionado.
        const fileName = pickedAsset.name;    // O nome original do arquivo (ex: "minha_musica.mp3").
        const fileUri = pickedAsset.uri;      // O caminho temporário onde o arquivo foi copiado.

        // Precisamos verificar se o nosso diretório de áudio interno existe.
        // Se não existir, a gente cria ele!
        const dirInfo = await FileSystem.getInfoAsync(AUDIO_DIR);
        if (!dirInfo.exists) {
          console.log(`Criando diretório: ${AUDIO_DIR}`);
          await FileSystem.makeDirectoryAsync(AUDIO_DIR, { intermediates: true }); // `intermediates: true` cria pastas aninhadas se necessário.
        }

        // Definimos o caminho final onde o arquivo MP3 será permanentemente guardado no nosso app.
        const destinationUri = AUDIO_DIR + fileName;

        // Agora, copiamos o arquivo do local temporário para o nosso diretório permanente.
        console.log(`Copiando ${fileUri} para ${destinationUri}`);
        await FileSystem.copyAsync({
          from: fileUri,
          to: destinationUri,
        });

        // Atualizamos a lista de músicas (`playlist`).
        // Usamos um callback com `prevPlaylist` para garantir que estamos trabalhando com a versão mais recente da lista.
        setPlaylist((prevPlaylist) => {
          // Antes de adicionar, verificamos se essa música já não está na playlist (para evitar duplicatas).
          if (!prevPlaylist.some(item => item.uri === destinationUri)) {
            showCustomAlert("Sucesso!", `Oba! "${fileName}" adicionado com sucesso à playlist.`);
            // Se não for duplicata, adicionamos a nova música e retornamos a nova lista.
            return [...prevPlaylist, { name: fileName, uri: destinationUri }];
          }
          showCustomAlert("Aviso", `A música "${fileName}" já está na sua playlist, chapa!`);
          return prevPlaylist; // Se for duplicata, retornamos a playlist original sem mudanças.
        });
        console.log(`Música "${fileName}" processada e adicionada.`);
      } else {
        console.log("Seleção de arquivo cancelada pelo usuário.");
      }
    } catch (error) {
      // Se der qualquer erro durante a seleção ou cópia, avisamos o usuário.
      console.error("Erro ao selecionar ou copiar arquivo:", error);
      showCustomAlert("Erro ao Adicionar Música", "Que pena! Não conseguimos adicionar o MP3. Verifique as permissões ou tente outro arquivo.");
    }
  };

  // `removeAudio`: Remove uma música da playlist e também a apaga do celular.
  const removeAudio = async (itemUri, fileName) => {
    // Se a música que vamos remover estiver tocando, a gente para ela primeiro.
    if (currentSound && currentSound._uri === itemUri) {
      console.log("Música a ser removida está tocando, parando...");
      await stopAudio();
    }

    try {
      // Apagamos o arquivo fisicamente do diretório do nosso app.
      // `idempotent: true` é uma segurança: não dá erro se o arquivo já não existir.
      console.log(`Deletando arquivo: ${itemUri}`);
      await FileSystem.deleteAsync(itemUri, { idempotent: true });

      // Atualizamos a playlist, removendo o item que corresponde ao arquivo apagado.
      setPlaylist((prevPlaylist) =>
        prevPlaylist.filter((item) => item.uri !== itemUri)
      );
      showCustomAlert("Sucesso!", `Pronto! "${fileName}" foi removido da sua playlist e do celular.`);
      console.log(`Música "${fileName}" removida com sucesso.`);
    } catch (error) {
      console.error("Erro ao remover arquivo:", error);
      showCustomAlert("Erro ao Remover Música", "Vish! Não conseguimos remover o MP3. Tente novamente ou verifique as permissões.");
    }
  };

  // --- Funções Auxiliares de UI (Interface do Usuário) e Mensagens ---

  // `showCustomAlert`: Uma função para exibir nossas mensagens de erro/aviso de forma mais bonita
  // do que o `alert()` padrão do JavaScript.
  const showCustomAlert = (title, message) => {
    setErrorMessage({ title, message }); // Guarda o título e a mensagem de erro nos estados.
    setShowErrorModal(true);             // Faz o modal de erro aparecer.
  };

  // `closeErrorModal`: Fecha o nosso modal de erro.
  const closeErrorModal = () => {
    setShowErrorModal(false); // Esconde o modal.
    setErrorMessage('');      // Limpa a mensagem de erro, por segurança.
  };

  // `formatPlaybackTime`: Converte o tempo da música (em milissegundos) para um formato mais legível (MM:SS).
  const formatPlaybackTime = (milliseconds) => {
    if (!milliseconds) return "00:00"; // Se não tiver tempo, mostra "00:00".
    const totalSeconds = Math.floor(milliseconds / 1000); // Converte milissegundos para segundos.
    const minutes = Math.floor(totalSeconds / 60);         // Calcula os minutos.
    const seconds = totalSeconds % 60;                      // Calcula os segundos restantes.
    // Retorna a string formatada, adicionando um "0" na frente se o número for menor que 10 (ex: 05:07).
    return `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // --- A Seção de Renderização: O Que o Usuário Vê na Tela ---
  return (
    // `View`: É como uma `div` do HTML, um container básico para organizar elementos.
    <View style={styles.container}>
      {/* StatusBar: Controla como a barra de status do celular (hora, bateria, sinal) aparece. */}
      {/* `barStyle="light-content"`: faz os ícones na barra de status ficarem claros, bom para fundo escuro. */}
      {/* `backgroundColor="#1A1C2C"`: Cor de fundo da barra de status, combinando com o nosso app. */}
      <StatusBar barStyle="light-content" backgroundColor="#1A1C2C" />

      {/* headerContainer: Um container para o título, para centralizar melhor. */}
      <View style={styles.headerContainer}>
        {/* Feather: Ícone de fone de ouvido para o título, um charme a mais! */}
        {/* `name="headphones"`: O nome do ícone. */}
        {/* `size={32}`: O tamanho do ícone. */}
        {/* `color="#F0F2F7"`: A cor do ícone. */}
        <Feather name="headphones" size={32} color="#F0F2F7" style={styles.headerIcon} />
        {/* Text: O título do nosso player. */}
        <Text style={styles.header}>Meu Player MP3</Text>
      </View>

      {/* Botão para Adicionar Músicas: */}
      {/* `TouchableOpacity`: Um botão que "some" um pouco quando tocado, dando feedback visual. */}
      <TouchableOpacity style={styles.addButton} onPress={pickAudioFile}>
        {/* AntDesign: Ícone de adição (o "mais" dentro de um círculo). */}
        <AntDesign name="pluscircle" size={24} color="#F0F2F7" style={styles.buttonIcon} />
        <Text style={styles.addButtonText}>Adicionar Música</Text>
      </TouchableOpacity>

      {/* Indicador de Carregamento: Mostrado apenas quando o `loading` é `true`. */}
      {loading && <Text style={styles.loadingText}>Carregando playlist, segura a emoção...</Text>}

      {/* FlatList: Componente otimizado para exibir listas grandes de itens. */}
      {/* É como uma `ul` (lista não ordenada) super inteligente para mobile. */}
      <FlatList
        data={playlist} // O array `playlist` é a fonte dos dados que a lista vai exibir.
        keyExtractor={(item) => item.uri} // Uma função que retorna uma chave única para cada item. Essencial para a performance da lista.
        // `ListEmptyComponent`: O que mostrar se a lista de músicas estiver vazia.
        ListEmptyComponent={
          <Text style={styles.emptyListText}>
            Eita! Nenhuma música na playlist ainda. Toque em "Adicionar Música" para começar a festa!
          </Text>
        }
        // `renderItem`: Uma função que diz como cada item da `playlist` deve ser desenhado na tela.
        // Recebe um objeto com `item` (a música atual) e `index` (a posição na lista).
        renderItem={({ item }) => (
          // Cada item da lista é um `View` (um "card" de música).
          <View style={[
            styles.trackItem, // Estilos básicos para o card.
            // Se a música atual for a que está tocando, adicionamos um estilo extra para destacá-la.
            currentSound && currentSound._uri === item.uri && styles.currentTrackPlaying
          ]}>
            {/* O nome da música. `numberOfLines={1}` garante que nomes longos não quebrem o layout. */}
            <Text style={styles.trackName} numberOfLines={1}>
              {item.name}
            </Text>
            {/* Controles para tocar/pausar e remover a música. */}
            <View style={styles.trackControls}>
              {/* Botão Tocar/Pausar: Muda de ícone dependendo se está tocando ou não. */}
              <TouchableOpacity
                style={styles.controlButton}
                // O `onPress` verifica se a música atual é esta. Se for, pausa. Se não, toca.
                onPress={() => (isPlaying && currentSound && currentSound._uri === item.uri ? pauseAudio() : playAudio(item.uri))}
              >
                {/* Lógica para mostrar o ícone de pausa ou play. */}
                {isPlaying && currentSound && currentSound._uri === item.uri ? (
                  <AntDesign name="pausecircle" size={24} color="#F0F2F7" /> // Ícone de pausa.
                ) : (
                  <AntDesign name="playcircleo" size={24} color="#F0F2F7" /> // Ícone de play.
                )}
              </TouchableOpacity>
              {/* Botão Remover: */}
              <TouchableOpacity
                style={[styles.controlButton, styles.removeButton]} // Aplica estilos de controle e de remoção.
                onPress={() => removeAudio(item.uri, item.name)} // Chama a função para remover.
              >
                <AntDesign name="delete" size={24} color="#F0F2F7" /> {/* Ícone de lixeira. */}
              </TouchableOpacity>
            </View>
          </View>
        )}
        style={styles.playlistContainer} // Estilos para o `FlatList` em si.
        contentContainerStyle={styles.playlistContentContainer} // Estilos para o conteúdo dentro do `FlatList`.
      />

      {/* Controles de Reprodução Global: Aparecem apenas se alguma música estiver carregada. */}
      {currentSound && (
        <View style={styles.playerControls}>
          {/* Nome da música que está tocando agora. */}
          <Text style={styles.nowPlayingText} numberOfLines={1}>
            Tocando Agora: {playlist.find(item => item.uri === currentSound._uri)?.name || 'Música Desconhecida'}
          </Text>
          {/* Tempo de reprodução atual e duração total. */}
          {playbackStatus && (
            <Text style={styles.playbackTime}>
              {formatPlaybackTime(playbackStatus.positionMillis)} / {formatPlaybackTime(playbackStatus.durationMillis)}
            </Text>
          )}
          {/* Botão Parar Tudo: Para qualquer música que esteja tocando. */}
          <TouchableOpacity style={styles.stopButton} onPress={stopAudio}>
            <AntDesign name="stopcircleo" size={24} color="#F0F2F7" style={styles.buttonIcon} />
            <Text style={styles.stopButtonText}>Parar Tudo</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Modal de Erro Personalizado: Nosso "pop-up" de aviso bonitinho. */}
      <Modal
        animationType="fade" // A animação quando o modal aparece/desaparece.
        transparent={true}   // Deixa o fundo transparente para ver o app por trás (escurecido).
        visible={showErrorModal} // Controla a visibilidade com base no estado `showErrorModal`.
        onRequestClose={closeErrorModal} // Função para fechar o modal (ex: clicando fora ou no botão de voltar do Android).
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            {/* Ícone de aviso/perigo. */}
            <AntDesign name="warning" size={40} color="#FF6347" style={styles.modalIcon} /> {/* Cor "Tomato" para o ícone de aviso, bem vibrante! */}
            {/* Título do erro. */}
            <Text style={styles.modalTitle}>{errorMessage.title}</Text>
            {/* Mensagem detalhada do erro. */}
            <Text style={styles.modalText}>{errorMessage.message}</Text>
            {/* Botão para fechar o modal. */}
            <TouchableOpacity style={styles.modalButton} onPress={closeErrorModal}>
              <Text style={styles.modalButtonText}>Entendi</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// --- Estilos da Aplicação (Onde a Mágica Visual Acontece!) ---
// `StyleSheet.create` é a forma padrão e mais performática de definir estilos no React Native.
// As cores e tamanhos foram escolhidos para combinar com a imagem que você enviou.
const styles = StyleSheet.create({
  // `container`: O estilo do nosso "fundo" principal do aplicativo.
  container: {
    flex: 1, // Faz com que o container ocupe todo o espaço disponível na tela.
    backgroundColor: '#1A1C2C', // Cor de fundo escura, como na imagem.
    paddingTop: StatusBar.currentHeight + 20, // Garante que o conteúdo não fique escondido atrás da barra de status.
    paddingHorizontal: 20, // Espaçamento nas laterais.
    alignItems: 'center', // Centraliza os itens horizontalmente dentro do container.
  },
  // `headerContainer`: Para organizar o título e o ícone do cabeçalho.
  headerContainer: {
    width: '100%', // Ocupa toda a largura disponível.
    alignItems: 'center', // Centraliza o texto e o ícone.
    marginBottom: 30, // Espaço abaixo do cabeçalho.
  },
  // `header`: O estilo do texto do título principal.
  header: {
    fontSize: 32, // Tamanho da fonte grande.
    fontWeight: 'bold', // Negrito.
    color: '#F0F2F7', // Cor de texto clara, para contrastar com o fundo escuro.
    textAlign: 'center', // Alinhamento central do texto.
    // Abaixo, estilos para alinhar o ícone com o texto, se o ícone for parte do `Text`
    // (no nosso caso, o ícone é irmão do texto, então esses estilos não são estritamente necessários para ele,
    // mas servem como boa prática se o ícone estivesse dentro do mesmo `Text`).
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // `headerIcon`: Estilo específico para o ícone no cabeçalho (apenas margem).
  headerIcon: {
    marginRight: 10, // Espaçamento entre o ícone e o texto.
  },
  // `addButton`: Estilo do botão "Adicionar Música".
  addButton: {
    backgroundColor: '#7D4CDB', // Um roxo vibrante, parecido com os botões da imagem.
    flexDirection: 'row', // Organiza o ícone e o texto lado a lado.
    alignItems: 'center', // Centraliza verticalmente ícone e texto.
    paddingVertical: 16, // Espaçamento interno vertical.
    paddingHorizontal: 35, // Espaçamento interno horizontal.
    borderRadius: 30, // Cantos bem arredondados, deixando o botão com formato de pílula.
    marginBottom: 25, // Espaçamento abaixo do botão.
    shadowColor: '#000', // Cor da sombra.
    shadowOffset: { width: 0, height: 6 }, // Deslocamento da sombra (para baixo).
    shadowOpacity: 0.4, // Opacidade da sombra.
    shadowRadius: 8, // Raio da sombra.
    elevation: 10, // Sombra para Android (elevação).
  },
  // `addButtonText`: Estilo do texto dentro do botão "Adicionar Música".
  addButtonText: {
    color: '#F0F2F7', // Cor do texto clara.
    fontSize: 19, // Tamanho da fonte.
    fontWeight: '600', // Peso da fonte (um pouco mais negrito).
    marginLeft: 10, // Margem à esquerda do texto (distância do ícone).
  },
  // `buttonIcon`: Estilo comum para ícones dentro de botões.
  buttonIcon: {
    marginRight: 5, // Pequena margem à direita para separar do texto.
  },
  // `loadingText`: Estilo para a mensagem "Carregando playlist...".
  loadingText: {
    fontSize: 16,
    color: '#9BB8D2', // Azul acinzentado claro.
    marginBottom: 15,
  },
  // `emptyListText`: Estilo para a mensagem que aparece quando a playlist está vazia.
  emptyListText: {
    fontSize: 17,
    color: '#9BB8D2',
    textAlign: 'center',
    marginTop: 60,
    fontStyle: 'italic', // Texto em itálico.
  },
  // `playlistContainer`: Estilo para o próprio componente `FlatList`.
  playlistContainer: {
    width: '100%', // Ocupa toda a largura.
    flexGrow: 1, // Permite que a lista cresça e ocupe o espaço restante.
  },
  // `playlistContentContainer`: Estilo para o CONTEÚDO dentro da `FlatList` (útil para padding, etc.).
  playlistContentContainer: {
    paddingBottom: 20, // Espaçamento na parte inferior da lista.
  },
  // `trackItem`: Estilo para cada "card" de música na playlist.
  trackItem: {
    flexDirection: 'row', // Organiza o nome da música e os botões lado a lado.
    justifyContent: 'space-between', // Distribui o espaço entre os itens.
    alignItems: 'center', // Alinha verticalmente no centro.
    backgroundColor: '#272A3D', // Um tom mais claro de azul escuro, para os cards.
    padding: 18, // Espaçamento interno.
    borderRadius: 20, // Cantos arredondados, como nos cards da imagem.
    marginBottom: 12, // Espaçamento entre os cards.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 6,
    borderWidth: 1, // Borda padrão transparente.
    borderColor: 'transparent',
  },
  // `currentTrackPlaying`: Estilo EXTRA para o card da música que está tocando.
  // Será aplicado EM CIMA do `trackItem`.
  currentTrackPlaying: {
    borderColor: '#7FFFD4', // Borda verde água, bem chamativa!
    borderWidth: 2,
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
  },
  // `trackName`: Estilo para o nome da música no card.
  trackName: {
    flex: 1, // Faz o texto ocupar o máximo de espaço possível.
    fontSize: 17,
    color: '#F0F2F7',
    marginRight: 10,
    fontWeight: '500', // Meio-termo entre normal e negrito.
  },
  // `trackControls`: Container para os botões de controle (Play/Pause, Remover).
  trackControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // `controlButton`: Estilo geral para os botões de controle (Play/Pause, Remover).
  controlButton: {
    padding: 8, // Espaçamento interno.
    borderRadius: 20, // Deixa os botões redondos.
    backgroundColor: 'rgba(255, 255, 255, 0.1)', // Um fundo semi-transparente branco.
    marginLeft: 12, // Margem entre os botões de controle.
  },
  // `removeButton`: Estilo específico para o botão de remover (sobrepõe o `controlButton`).
  removeButton: {
    backgroundColor: '#DC143C', // Um vermelho forte (Carmesim), para indicar "perigo" ou remoção.
  },
  // `playerControls`: Estilo para a barra de controle global do player (nome da música, tempo, botão "Parar Tudo").
  playerControls: {
    width: '100%',
    backgroundColor: '#272A3D', // Mesma cor dos cards da playlist.
    padding: 25,
    borderRadius: 20, // Cantos arredondados.
    marginTop: 30, // Espaçamento acima.
    marginBottom: 20, // Espaçamento abaixo.
    alignItems: 'center', // Centraliza o conteúdo.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 12,
  },
  // `nowPlayingText`: Estilo do texto "Tocando Agora: [Nome da Música]".
  nowPlayingText: {
    color: '#F0F2F7',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  // `playbackTime`: Estilo do texto que mostra o tempo da música (00:00 / 03:45).
  playbackTime: {
    color: '#9BB8D2',
    fontSize: 17,
    marginBottom: 15,
  },
  // `stopButton`: Estilo do botão "Parar Tudo".
  stopButton: {
    backgroundColor: '#7D4CDB', // Mesmo roxo vibrante do botão "Adicionar Música".
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  // `stopButtonText`: Estilo do texto dentro do botão "Parar Tudo".
  stopButtonText: {
    color: '#F0F2F7',
    fontSize: 19,
    fontWeight: '600',
    marginLeft: 10,
  },
  // --- Estilos para o Modal de Erro Personalizado ---
  // `centeredView`: O container que centraliza o modal na tela e escurece o fundo.
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)', // Fundo preto semi-transparente para o efeito "overlay".
  },
  // `modalView`: O "card" principal do modal de erro.
  modalView: {
    margin: 25,
    backgroundColor: '#272A3D', // Fundo escuro para o modal, combinando com o tema.
    borderRadius: 25, // Cantos arredondados.
    padding: 40, // Espaçamento interno.
    alignItems: 'center', // Centraliza o conteúdo.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 10,
  },
  // `modalIcon`: Estilo para o ícone de aviso dentro do modal.
  modalIcon: {
    marginBottom: 15, // Espaçamento abaixo do ícone.
  },
  // `modalTitle`: Estilo para o título do modal de erro.
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 18,
    color: '#FF6347', // Cor de texto laranja-avermelhada para o título do erro, bem evidente!
    textAlign: 'center',
  },
  // `modalText`: Estilo para a mensagem detalhada do erro.
  modalText: {
    marginBottom: 25,
    textAlign: 'center',
    fontSize: 17,
    color: '#F0F2F7', // Texto claro para a mensagem.
    lineHeight: 24, // Altura da linha para melhor legibilidade.
  },
  // `modalButton`: Estilo para o botão "Entendi" do modal.
  modalButton: {
    backgroundColor: '#7D4CDB', // Roxo vibrante, para combinar e ser clicável.
    borderRadius: 15,
    paddingVertical: 12,
    paddingHorizontal: 30,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  // `modalButtonText`: Estilo do texto dentro do botão do modal.
  modalButtonText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 18,
  },
});
