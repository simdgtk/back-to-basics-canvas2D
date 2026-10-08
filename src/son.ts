addEventListener("click", async () => {
  context || createContext();
  playing ? pause() : play();
});

let source: AudioBufferSourceNode | undefined;
let context: AudioContext;
let buffer: AudioBuffer;
let playing: Boolean = false;

async function createContext(): Promise<void> {
  context = new AudioContext();

  const response = await fetch("audio/son.wav");
  const data = await response.arrayBuffer();
  buffer = await context.decodeAudioData(data);
}
async function play() {
  source?.disconnect();
  source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.loop = true;
  source.start();
}

async function pause() {
  playing = false;
  source?.stop();
  source?.disconnect();
  source = undefined
}
