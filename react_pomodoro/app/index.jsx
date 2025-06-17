import { Image, StyleSheet, Text, View, Pressable } from "react-native";
import { Audio } from 'expo-av';
import { useEffect, useRef, useState } from "react";
import { Link } from 'expo-router'; // Importação essencial para o botão de navegação

const pomodoro = [
  {
    id: 'focus',
    initialValue: 25 * 60,
    image: require('./image1.png'), // Certifique-se de que 'image1.png' existe na mesma pasta
    display: 'Foco'
  },
  {
    id: 'short',
    initialValue: 5,
    image: require('./image2.png'), // Certifique-se de que 'image2.png' existe na mesma pasta
    display: 'Pausa curta'
  },
  {
    id: 'long',
    initialValue: 15 * 60,
    image: require('./image3.png'), // Certifique-se de que 'image3.png' existe na mesma pasta
    display: 'Pausa longa'
  }
];

export default function Index() {
  const sound = useRef(null);
  const alarmSound = useRef(null);
  const [isPlaying, setIsPlaying] = useState(true);

  const [timerType, setTimerType] = useState(pomodoro[0]);
  const [timeLeft, setTimeLeft] = useState(timerType.initialValue);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    async function loadSounds() {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
        });

        const { sound: bgSound } = await Audio.Sound.createAsync(
          require('./assets/lofi.mp3'), // Certifique-se de que 'assets/lofi.mp3' existe
          {
            shouldPlay: true,
            isLooping: true,
            volume: 1.0,
          }
        );
        sound.current = bgSound;
        await sound.current.playAsync();

        const { sound: loadedAlarm } = await Audio.Sound.createAsync(
          require('./assets/alarm.mp3'), // Certifique-se de que 'assets/alarm.mp3' existe
          { shouldPlay: false }
        );
        alarmSound.current = loadedAlarm;

      } catch (error) {
        console.log('Erro carregando áudio:', error);
      }
    }

    loadSounds();

    return () => {
      if (sound.current) sound.current.unloadAsync();
      if (alarmSound.current) alarmSound.current.unloadAsync();
    };
  }, []);

  useEffect(() => {
    setTimeLeft(timerType.initialValue);
    setIsRunning(false);
  }, [timerType]);

  useEffect(() => {
    let interval = null;

    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      if (alarmSound.current) {
        alarmSound.current.replayAsync();
      }
      if (sound.current) {
        sound.current.pauseAsync();
        setIsPlaying(false);
      }
      setIsRunning(false);
    }

    return () => clearInterval(interval);
  }, [isRunning, timeLeft]);

  const toggleSound = async () => {
    if (sound.current) {
      if (isPlaying) {
        await sound.current.pauseAsync();
      } else {
        await sound.current.playAsync();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleTimer = async () => {
    if (!isRunning) {
      // Início do cronômetro: parar alarme e retomar música, se necessário
      if (alarmSound.current) {
        try {
          await alarmSound.current.stopAsync();
        } catch (e) {
          // Alarme já parado
        }
      }

      if (sound.current && !isPlaying) {
        await sound.current.playAsync();
        setIsPlaying(true);
      }
    }
    setIsRunning(prev => !prev);
  };

  return (
    <View style={styles.container}>
      <Image source={timerType.image} />

      <View style={styles.actions}>
        <View style={styles.context}>
          {pomodoro.map(p => (
            <Pressable
              key={p.id}
              style={timerType.id === p.id ? styles.contextButtonActive : null}
              onPress={() => setTimerType(p)}
            >
              <Text style={styles.contextButtonText}>
                {p.display}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.timer}>
          {new Date(timeLeft * 1000).toLocaleTimeString('pt-BR', {
            minute: '2-digit',
            second: '2-digit'
          })}
        </Text>

        <Pressable style={styles.button} onPress={toggleTimer}>
          <Text style={styles.buttonText}>
            {isRunning ? 'Pausar' : 'Começar'}
          </Text>
        </Pressable>
      </View>

      <Pressable style={styles.muteButton} onPress={toggleSound}>
        <Text style={styles.muteButtonText}>
          {isPlaying ? "Mutar Música" : "Tocar Música"}
        </Text>
      </Pressable>

      {/* ESTE É O BOTÃO PARA O REPRODUTOR DE MP3 */}
      <Link href="/mp3player" style={styles.mp3Button}>
        <Text style={styles.mp3ButtonText}>Ir para Reprodutor de MP3</Text>
      </Link>

      <View>
        <Text style={styles.footerText}>
          Projeto fictício e sem fins comerciais.
        </Text>
        <Text style={styles.footerText}>
          Desenvolvido por Acriative.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // ESTILOS DO BOTÃO MP3 PLAYER
  mp3Button: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#B872FF', // Cor do botão do Pomodoro, para manter a consistência
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: '80%',
    alignSelf: 'center',
  },
  mp3ButtonText: {
    color: '#021123',
    fontSize: 18,
    fontWeight: 'bold',
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: '#021123',
    gap: 40
  },
  actions: {
    paddingVertical: 24,
    paddingHorizontal: 24,
    backgroundColor: '#14448080',
    width: '80%',
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#144480',
    gap: 32
  },
  context: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center'
  },
  contextButtonActive: {
    backgroundColor: '#144480',
    borderRadius: 8
  },
  contextButtonText: {
    fontSize: 12.5,
    color: '#FFF',
    padding: 8
  },
  timer: {
    fontSize: 54,
    color: '#FFF',
    fontWeight: 'bold',
    textAlign: 'center'
  },
  button: {
    backgroundColor: '#B872FF',
    borderRadius: 32,
    padding: 8
  },
  buttonText: {
    textAlign: 'center',
    color: '#021123',
    fontSize: 18
  },
  muteButton: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#B872FF',
    borderRadius: 20,
  },
  muteButtonText: {
    color: '#021123',
    fontWeight: 'bold'
  },
  footerText: {
    textAlign: 'center',
    color: '#98A0A8',
    fontSize: 12.5
  }
});
