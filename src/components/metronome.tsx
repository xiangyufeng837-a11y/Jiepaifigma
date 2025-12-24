import { useState, useEffect, useRef } from "react";
import { Play, Pause, Minus, Plus, Volume2, Mic } from "lucide-react";

export function Metronome() {
  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [beatsPerMeasure, setBeatsPerMeasure] = useState(4);
  const [volume, setVolume] = useState(0.5);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextNoteTimeRef = useRef(0);
  const timerIdRef = useRef<number | null>(null);
  const currentBeatRef = useRef(0);
  const volumeRef = useRef(0.5);
  const voiceEnabledRef = useRef(false);

  // Keep refs in sync with state
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
  }, [voiceEnabled]);

  // Initialize audio context
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Play tick sound
  const playTick = (isAccent: boolean) => {
    if (!audioContextRef.current) return;

    const audioContext = audioContextRef.current;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Accent beat (first beat) has higher frequency
    oscillator.frequency.value = isAccent ? 1000 : 800;
    gainNode.gain.value = volumeRef.current;

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.05);
  };

  // Voice count function - optimized for timing
  const speakBeatNumber = (beatNumber: number) => {
    if (!voiceEnabledRef.current) return;
    
    // Use a shorter, more immediate approach
    try {
      const utterance = new SpeechSynthesisUtterance((beatNumber + 1).toString());
      utterance.lang = 'zh-CN';
      utterance.rate = 2.0; // Faster rate for quicker response
      utterance.volume = volumeRef.current;
      utterance.pitch = beatNumber === 0 ? 1.3 : 1.0;
      
      // Speak immediately without canceling (let it queue naturally)
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error('Speech synthesis error:', e);
    }
  };

  // Scheduler function
  const scheduler = () => {
    if (!audioContextRef.current) return;

    const scheduleAheadTime = 0.1;
    const currentTime = audioContextRef.current.currentTime;

    while (nextNoteTimeRef.current < currentTime + scheduleAheadTime) {
      const isAccent = currentBeatRef.current === 0;
      
      // Schedule the tick sound
      playTick(isAccent);
      
      // Trigger voice immediately for better synchronization
      speakBeatNumber(currentBeatRef.current);
      
      setCurrentBeat(currentBeatRef.current);
      currentBeatRef.current = (currentBeatRef.current + 1) % beatsPerMeasure;
      
      const secondsPerBeat = 60.0 / bpm;
      nextNoteTimeRef.current += secondsPerBeat;
    }

    timerIdRef.current = window.setTimeout(scheduler, 25);
  };

  // Start/stop metronome
  useEffect(() => {
    if (isPlaying) {
      if (audioContextRef.current) {
        nextNoteTimeRef.current = audioContextRef.current.currentTime;
      }
      currentBeatRef.current = 0;
      setCurrentBeat(0);
      scheduler();
    } else {
      if (timerIdRef.current) {
        clearTimeout(timerIdRef.current);
        timerIdRef.current = null;
      }
      window.speechSynthesis.cancel();
      setCurrentBeat(0);
      currentBeatRef.current = 0;
    }

    return () => {
      if (timerIdRef.current) {
        clearTimeout(timerIdRef.current);
      }
      window.speechSynthesis.cancel();
    };
  }, [isPlaying, bpm, beatsPerMeasure]);

  const handleBpmChange = (newBpm: number) => {
    const clampedBpm = Math.max(40, Math.min(240, newBpm));
    setBpm(clampedBpm);
  };

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white/20 w-full max-w-md">
      <h1 className="text-white text-center mb-8">节拍器</h1>
      
      {/* BPM Display */}
      <div className="text-center mb-8">
        <div className="text-white/60 text-sm mb-2">BPM</div>
        <div className="text-white text-6xl mb-4">{bpm}</div>
        
        {/* BPM Controls */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <button
            onClick={() => handleBpmChange(bpm - 1)}
            className="bg-white/10 hover:bg-white/20 text-white rounded-full p-3 transition-colors"
          >
            <Minus className="w-5 h-5" />
          </button>
          
          <input
            type="range"
            min="40"
            max="240"
            value={bpm}
            onChange={(e) => handleBpmChange(parseInt(e.target.value))}
            className="w-48 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
          />
          
          <button
            onClick={() => handleBpmChange(bpm + 1)}
            className="bg-white/10 hover:bg-white/20 text-white rounded-full p-3 transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Preset BPM Buttons */}
        <div className="flex gap-2 justify-center mb-6">
          {[60, 90, 120, 140, 180].map((presetBpm) => (
            <button
              key={presetBpm}
              onClick={() => handleBpmChange(presetBpm)}
              className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                bpm === presetBpm
                  ? 'bg-purple-500 text-white'
                  : 'bg-white/10 text-white/80 hover:bg-white/20'
              }`}
            >
              {presetBpm}
            </button>
          ))}
        </div>
      </div>

      {/* Beat Visualization */}
      <div className="flex gap-2 justify-center mb-8">
        {Array.from({ length: beatsPerMeasure }).map((_, index) => (
          <div
            key={index}
            className={`w-12 h-12 rounded-full transition-all duration-100 ${
              isPlaying && currentBeat === index
                ? index === 0
                  ? 'bg-purple-500 scale-110 shadow-lg shadow-purple-500/50'
                  : 'bg-blue-400 scale-110 shadow-lg shadow-blue-400/50'
                : 'bg-white/20'
            }`}
          />
        ))}
      </div>

      {/* Time Signature */}
      <div className="flex gap-2 justify-center mb-6">
        <span className="text-white/60 text-sm mr-2">拍号:</span>
        {[2, 3, 4, 5, 6].map((beats) => (
          <button
            key={beats}
            onClick={() => {
              setBeatsPerMeasure(beats);
              setCurrentBeat(0);
            }}
            className={`px-3 py-1 rounded-lg text-sm transition-colors ${
              beatsPerMeasure === beats
                ? 'bg-purple-500 text-white'
                : 'bg-white/10 text-white/80 hover:bg-white/20'
            }`}
          >
            {beats}/4
          </button>
        ))}
      </div>

      {/* Volume Control */}
      <div className="flex items-center gap-3 mb-4">
        <Volume2 className="w-5 h-5 text-white/60" />
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="flex-1 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
        />
      </div>

      {/* Voice Count Toggle */}
      <div className="flex items-center justify-between mb-8 bg-white/5 rounded-xl p-4">
        <div className="flex items-center gap-2">
          <Mic className="w-5 h-5 text-white/60" />
          <span className="text-white/80">语音报数</span>
        </div>
        <button
          onClick={() => setVoiceEnabled(!voiceEnabled)}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            voiceEnabled ? 'bg-purple-500' : 'bg-white/20'
          }`}
        >
          <div
            className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
              voiceEnabled ? 'translate-x-7' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Play/Pause Button */}
      <button
        onClick={() => setIsPlaying(!isPlaying)}
        className={`w-full py-4 rounded-2xl transition-all flex items-center justify-center gap-2 ${
          isPlaying
            ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30'
            : 'bg-purple-500 hover:bg-purple-600 text-white shadow-lg shadow-purple-500/30'
        }`}
      >
        {isPlaying ? (
          <>
            <Pause className="w-6 h-6" />
            <span>停止</span>
          </>
        ) : (
          <>
            <Play className="w-6 h-6" />
            <span>开始</span>
          </>
        )}
      </button>
    </div>
  );
}