// All sound is synthesized live with WebAudio — no audio files.
// Three radio stations, engine hum, gunshots, sirens and UI blips.

const STATIONS = [
  { name: 'Solmar FM', bpm: 112, root: 57, scale: [0, 3, 5, 7, 10], wave: 'sawtooth', bass: 0.16 },
  { name: 'Bay Nights', bpm: 92, root: 52, scale: [0, 2, 3, 7, 8, 10], wave: 'triangle', bass: 0.2 },
  { name: 'Static 88', bpm: 132, root: 62, scale: [0, 2, 5, 7, 9], wave: 'square', bass: 0.12 },
];

export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    radioGain: null,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    station: 0,
    radioOn: true,
    step: 0,
    nextNote: 0,
    muted: false,
  };

  audio.ensure = function () {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audio.ctx = new Ctx();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.5;
    audio.master.connect(audio.ctx.destination);
    audio.radioGain = audio.ctx.createGain();
    audio.radioGain.gain.value = 0.14;
    audio.radioGain.connect(audio.master);
    // Engine hum.
    audio.engineOsc = audio.ctx.createOscillator();
    audio.engineOsc.type = 'sawtooth';
    audio.engineOsc.frequency.value = 40;
    audio.engineGain = audio.ctx.createGain();
    audio.engineGain.gain.value = 0;
    audio.engineOsc.connect(audio.engineGain);
    audio.engineGain.connect(audio.master);
    audio.engineOsc.start();
    // Police siren (two-tone).
    audio.sirenOsc = audio.ctx.createOscillator();
    audio.sirenOsc.type = 'sine';
    audio.sirenOsc.frequency.value = 700;
    audio.sirenGain = audio.ctx.createGain();
    audio.sirenGain.gain.value = 0;
    audio.sirenOsc.connect(audio.sirenGain);
    audio.sirenGain.connect(audio.master);
    audio.sirenOsc.start();
  };

  audio.setEngine = function (speed01, on) {
    if (!audio.ctx) return;
    const t = audio.ctx.currentTime;
    audio.engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.05 : 0, t, 0.1);
    audio.engineOsc.frequency.setTargetAtTime(40 + speed01 * 120, t, 0.1);
  };

  audio.setSiren = function (on) {
    if (!audio.ctx) return;
    const t = audio.ctx.currentTime;
    audio.sirenGain.gain.setTargetAtTime(on ? 0.05 : 0, t, 0.2);
    if (on) {
      const now = audio.ctx.currentTime;
      audio.sirenOsc.frequency.cancelScheduledValues(now);
      for (let i = 0; i < 8; i++) {
        audio.sirenOsc.frequency.linearRampToValueAtTime(i % 2 === 0 ? 700 : 950, now + i * 0.35 + 0.35);
      }
    }
  };

  // Radio sequencer: called every frame, schedules notes ahead of time.
  audio.tickRadio = function () {
    if (!audio.ctx || !audio.radioOn || audio.muted) return;
    const st = STATIONS[audio.station];
    const spb = 60 / st.bpm / 2;
    while (audio.nextNote < audio.ctx.currentTime + 0.25) {
      if (audio.nextNote < audio.ctx.currentTime) audio.nextNote = audio.ctx.currentTime + 0.05;
      const step = audio.step;
      const note = st.scale[step % st.scale.length] + st.root + 12 * Math.floor((step % 16) / 8);
      const freq = 440 * Math.pow(2, (note - 69) / 12);
      const osc = audio.ctx.createOscillator();
      osc.type = st.wave;
      osc.frequency.value = freq;
      const g = audio.ctx.createGain();
      g.gain.setValueAtTime(0.0001, audio.nextNote);
      g.gain.exponentialRampToValueAtTime(0.5, audio.nextNote + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, audio.nextNote + spb * 0.9);
      osc.connect(g);
      g.connect(audio.radioGain);
      osc.start(audio.nextNote);
      osc.stop(audio.nextNote + spb);
      // Bass on the beat.
      if (step % 4 === 0) {
        const b = audio.ctx.createOscillator();
        b.type = 'sine';
        b.frequency.value = 440 * Math.pow(2, (st.root - 24 - 69) / 12);
        const bg = audio.ctx.createGain();
        bg.gain.setValueAtTime(0.0001, audio.nextNote);
        bg.gain.exponentialRampToValueAtTime(st.bass * 3, audio.nextNote + 0.02);
        bg.gain.exponentialRampToValueAtTime(0.001, audio.nextNote + spb * 3.5);
        b.connect(bg);
        bg.connect(audio.radioGain);
        b.start(audio.nextNote);
        b.stop(audio.nextNote + spb * 4);
      }
      audio.nextNote += spb;
      audio.step += 1;
    }
  };

  audio.nextStation = function () {
    audio.station = (audio.station + 1) % STATIONS.length;
    audio.step = 0;
    audio.nextNote = audio.ctx ? audio.ctx.currentTime : 0;
    return STATIONS[audio.station].name;
  };

  audio.stationName = function () {
    return STATIONS[audio.station].name;
  };

  audio.shot = function (kind) {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime;
    const dur = kind === 'shotgun' ? 0.28 : 0.12;
    const buffer = audio.ctx.createBuffer(1, audio.ctx.sampleRate * dur, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
    }
    const src = audio.ctx.createBufferSource();
    src.buffer = buffer;
    const g = audio.ctx.createGain();
    g.gain.value = kind === 'shotgun' ? 0.5 : 0.3;
    const f = audio.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = kind === 'shotgun' ? 900 : 1800;
    src.connect(f);
    f.connect(g);
    g.connect(audio.master);
    src.start(t);
  };

  audio.crash = function (hard) {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime;
    const dur = hard ? 0.3 : 0.15;
    const buffer = audio.ctx.createBuffer(1, audio.ctx.sampleRate * dur, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.5);
    }
    const src = audio.ctx.createBufferSource();
    src.buffer = buffer;
    const g = audio.ctx.createGain();
    g.gain.value = hard ? 0.5 : 0.25;
    const f = audio.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 500;
    src.connect(f);
    f.connect(g);
    g.connect(audio.master);
    src.start(t);
  };

  audio.blip = function (freq) {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime;
    const osc = audio.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq || 880;
    const g = audio.ctx.createGain();
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(g);
    g.connect(audio.master);
    osc.start(t);
    osc.stop(t + 0.15);
  };

  audio.horn = function () {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime;
    for (const f of [370, 466]) {
      const osc = audio.ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = f;
      const g = audio.ctx.createGain();
      g.gain.setValueAtTime(0.12, t);
      g.gain.setValueAtTime(0.12, t + 0.25);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(g);
      g.connect(audio.master);
      osc.start(t);
      osc.stop(t + 0.32);
    }
  };

  return audio;
}
