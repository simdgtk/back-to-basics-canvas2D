import * as constants from "./utils/constants";

import { createKnob } from "./core/Knob";
import { createPushButton } from "./core/PushButton";

import { remap, clamp, makeDistortionCurve } from "./utils/math";

const canvas = document.getElementById("canvas")! as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const audioElement = document.getElementById("audio")! as HTMLAudioElement;
const bar = document.getElementById("bar");
const launchButton = document.getElementById("launch-button");
const trackCursor = document.getElementById("track-cursor");
const track = document.getElementById("track");

var audioContext: AudioContext | null = null;
let playing = false;
let analyser: AnalyserNode;
let analyserBuffer: Uint8Array<ArrayBuffer>;
let barsArray: number[];

let synthBuffer: ArrayBuffer;
var buffers = [];

let fullDuration: number;
let fullArray;

let mediaSourceNode: any;
let mediaSourceNodeGainNode: any;
let finish: any;
let distortionGainNode: any;
let distortionNode: any;

let reverb: ConvolverNode | undefined;
let isReverbed = false;

let isNotGrabbable = true;

let heightSize = constants.SCALE_HEIGHT;

// bar
let trackTop: number | undefined = 0;
let trackBottom: number | undefined = 0;

function updateVolume(volume: number) {
  audioElement.volume = volume;
}

async function updateDistortion(distortionAmountToUpdate: number) {
  await getData();
  if (!audioContext) return;
  distortionNode.curve = makeDistortionCurve(
    remap(distortionAmountToUpdate, 0, 1, 0, constants.MAX_DISTORTION),
  );
}

function updateReverb(reverbValue: boolean) {
  isReverbed = reverbValue === isReverbed ? !reverbValue : reverbValue;

  if (!reverb || !audioContext) return;
  if (isReverbed) {
    mediaSourceNode.connect(reverb);
    reverb.connect(audioContext.destination);
  } else {
    mediaSourceNode.disconnect(reverb);
    reverb.disconnect(audioContext.destination);
  }
}

createKnob(1, "volume", 0.5, updateVolume);
createKnob(2, "distortion", 0, updateDistortion);
createPushButton(3, "reverb", updateReverb, isReverbed);

addEventListener("resize", resize);

window.onkeyup = function (e) {
  if (e.key == " " || e.code == "Space") {
    if (playing) {
      pause();
    } else {
      play();
    }
  }
};

function dragElement(
  element: HTMLElement,
  axis: "x" | "y" = "y",
  boundingLimits?: { num1: number; num2: number },
  callback?: CallableFunction,
) {
  var pos1 = 0,
    pos2 = 0,
    pos3 = 0,
    pos4 = 0;

  element.onmousedown = dragMouseDown;

  element.addEventListener("pointerdown", () => {
    element.style.cursor = "grabbing";
  });

  function dragMouseDown(e: MouseEvent) {
    e.preventDefault();
    if (axis === "x") {
      pos3 = e.clientX;
    } else {
      pos4 = e.clientY;
    }
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e: MouseEvent) {
    e.preventDefault();
    if (axis === "x") {
      pos1 = pos3 - e.clientX;
      pos3 = e.clientX;
      element.style.left = element.offsetLeft - pos1 + "px";
    } else {
      pos2 = pos4 - e.clientY;
      pos4 = e.clientY;
      if (
        boundingLimits &&
        pos4 > boundingLimits.num2 + constants.TRACK_CURSOR_HEIGHT / 2
      ) {
        element.style.top =
          Math.min(
            element.offsetTop - pos2,
            boundingLimits.num2 + constants.TRACK_CURSOR_HEIGHT / 2,
          ) + "px";
      } else if (
        // TODO
        boundingLimits &&
        pos4 < boundingLimits.num1
      ) {
        Math.max(element.offsetTop - pos2, boundingLimits.num1) + "px";
      } else {
        element.style.top = element.offsetTop - pos2 + "px";
      }

      let progress = 0;
      if (boundingLimits) {
        progress = remap(
          pos4 - boundingLimits.num1,
          boundingLimits.num1,
          boundingLimits.num2,
          0,
          1,
        );

        if (callback) callback(clamp(progress, 0, 1));
      }
    }
  }

  function closeDragElement() {
    if (bar) bar.style.cursor = "grab";
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

launchButton?.addEventListener("click", async () => {
  launchButton.classList.add("hide");
  // await getSynthData();
  await getSynthData("synth")
  await getData();
  audioContext || (await createContext());
  play();
  resize();
  tick();
});

// async function getSynthData() {
//   const audioContext = new AudioContext();

//   return fetch("audio/synth.ogg")
//     .then((response) => {
//       if (!response.ok) {
//         throw new Error(`HTTP error, status = ${response.status}`);
//       }
//       return response.arrayBuffer();
//     })
//     .then((buffer) => {
//       const synthBuffer = buffer
//       const synthDelay = audioContext.createDelay(5.0);
//       let synthSource;

//       synthDelay.delayTime.value = 10;
//       synthSource = audioContext.createBufferSource();
//       console.log(synthBuffer);
//       synthSource.buffer = synthBuffer;
//       synthSource.loop = true;
//       synthSource.start();
//       synthSource.connect(synthDelay);
//       synthDelay.connect(audioContext.destination);
//       mediaSourceNode.connect(analyser);
//       mediaSourceNode.connect(audioContext.destination);
//       return audioContext.decodeAudioData(buffer);
//     })
//     .then((decodedData) => {
//       const source = new AudioBufferSourceNode(audioContext);
//       source.buffer = decodedData;
//       fullDuration = decodedData.duration;
//       source.connect(audioContext.destination);

//       const float32Array = decodedData.getChannelData(0);
//       let chunkSize = 500;
//       let array = [],
//         i = 0,
//         length = float32Array.length;
//       while (i < length) {
//         array.push(
//           float32Array
//             .slice(i, (i += chunkSize))
//             .reduce(function (total, value) {
//               return Math.max(total, Math.abs(value));
//             }),
//         );
//       }

//       // barsArray = array;
//       // return barsArray;
//     });
// }
async function getSynthData(track) {
  var request = new XMLHttpRequest();
  request.open("GET", track + ".ogg", true);
  request.responseType = "arraybuffer";

  request.onload = function () {
    if (audioContext)
      audioContext.decodeAudioData(
        request.response,
        function (buffer) {
          let myBuffer = buffer;
          buffers.push(myBuffer);
        },

        function (e) {
          "Error with decoding audio data" + e.err;
        },
      );
  };

  request.send();
}

getSynthData("synth");

async function getData() {
  const audioContext = new AudioContext();

  return fetch("audio/tenSeconds.wav")
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error, status = ${response.status}`);
      }
      return response.arrayBuffer();
    })
    .then((buffer) => {
      return audioContext.decodeAudioData(buffer);
    })
    .then((decodedData) => {
      const source = new AudioBufferSourceNode(audioContext);
      source.buffer = decodedData;
      fullDuration = decodedData.duration;
      source.connect(audioContext.destination);

      const float32Array = decodedData.getChannelData(0);
      let chunkSize = 500;
      let array = [],
        i = 0,
        length = float32Array.length;
      while (i < length) {
        array.push(
          float32Array
            .slice(i, (i += chunkSize))
            .reduce(function (total, value) {
              return Math.max(total, Math.abs(value));
            }),
        );
      }

      barsArray = array;
      return barsArray;
    });
}

function createEchoDelayEffect(audioContext: AudioContext) {
  const delay = audioContext.createDelay(1);
  const dryNode = audioContext.createGain();
  const wetNode = audioContext.createGain();
  const mixer = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();

  delay.delayTime.value = 0.05;
  dryNode.gain.value = 1;
  wetNode.gain.value = 0;
  filter.frequency.value = 1100;
  filter.type = "highpass";
  return {
    apply() {
      wetNode.gain.setValueAtTime(0.75, audioContext.currentTime);
    },
    discard() {
      wetNode.gain.setValueAtTime(0, audioContext.currentTime);
    },
    isApplied() {
      return wetNode.gain.value > 0;
    },
    placeBetween(inputNode: AudioNode, outputNode: AudioNode) {
      inputNode.connect(delay);
      delay.connect(wetNode);
      wetNode.connect(filter);
      filter.connect(delay);

      inputNode.connect(dryNode);
      dryNode.connect(mixer);
      wetNode.connect(mixer);
      mixer.connect(outputNode);
    },
  };
}

async function createReverb() {
  if (!audioContext) return;

  let convolver = audioContext.createConvolver();

  let response = await fetch("audio/irHall.ogg");
  let arraybuffer = await response.arrayBuffer();
  convolver.buffer = await audioContext.decodeAudioData(arraybuffer);

  return convolver;
}

function createDistortion(
  audioContext: AudioContext,
  distortionAmount: number,
) {
  mediaSourceNodeGainNode = audioContext.createGain();
  finish = audioContext.destination;

  distortionGainNode = audioContext.createGain();
  distortionNode = audioContext.createWaveShaper();

  distortionNode.curve = makeDistortionCurve(distortionAmount);

  mediaSourceNode.connect(distortionGainNode);
  mediaSourceNodeGainNode.connect(distortionGainNode);
  distortionGainNode.connect(distortionNode);
  distortionNode.connect(finish);
}

// function deleteDistortions(audioContext: AudioContext) {
//   mediaSourceNode.disconnect(distortionGainNode);
//   mediaSourceNodeGainNode.disconnect(distortionGainNode);
//   distortionGain.disconnect(finish);
// }
// function updateWaveHeight() {
//   fullArray = new Uint8Array(analyser.frequencyBinCount);
//   analyser.getByteFrequencyData(fullArray);
// }

async function getSythData(track: string) {
  var request = new XMLHttpRequest();
  request.open("GET", "audio/" + track + ".ogg", true);
  request.responseType = "arraybuffer";

  request.onload = function () {
    if (audioContext)
      audioContext.decodeAudioData(
        request.response,
        function (buffer) {
          let myBuffer = buffer;
          buffers.push(myBuffer);
        },

        function (e) {
          "Error with decoding audio data" + e.err;
        },
      );
  };

  request.send();
}

async function createContext() {
  audioContext = new AudioContext();

  mediaSourceNode = audioContext.createMediaElementSource(audioElement);
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 8192;
  analyserBuffer = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteTimeDomainData(analyserBuffer);

  audioElement.volume = 0.5;

  // distortion
  createDistortion(audioContext, 0);

  // reverb
  reverb = await createReverb();

  // filter
  // const filter = audioContext.createBiquadFilter();
  // filter.type = "lowpass";
  // filter.frequency.setValueAtTime(200, audioContext.currentTime + 1);
  // filter.Q.value = 20;
  // mediaSourceNode.connect(filter);
  // filter.connect(audioContext.destination);

  // delay
  const synthDelay = audioContext.createDelay(5.0);
  let synthSource;

  synthDelay.delayTime.value = 10;
  synthSource = audioContext.createBufferSource();
  console.log(buffers);
  synthSource.buffer = buffers[0];
  synthSource.loop = true;
  synthSource.start();
  synthSource.connect(synthDelay);
  synthDelay.connect(audioContext.destination);
  mediaSourceNode.connect(analyser);
  mediaSourceNode.connect(audioContext.destination);

  if (bar) bar.style.opacity = "1";
  const trackRect = track?.getBoundingClientRect();
  if (trackRect) trackTop = trackRect.top;
  if (trackRect) trackBottom = trackRect.bottom;

  dragElement(bar!, "x");
  if (trackTop && trackBottom) {
    dragElement(
      trackCursor!,
      "y",
      { num1: trackTop, num2: trackBottom },
      updateHeight,
    );
  }
}

function updateHeight(height: number) {
  heightSize = remap(
    height,
    0,
    1,
    constants.MAX_SCALE_HEIGHT,
    constants.MIN_SCALE_HEIGHT,
  );
  renderCanvas();
}

bar?.addEventListener("pointerup", () => {
  isNotGrabbable = !isNotGrabbable;
  const positionLeft = bar!.style.left.replace("px", "");
  audioElement.currentTime =
    (Number(positionLeft) * audioElement.duration) / canvas.width;

  playing = true;
  audioElement.play();
});

bar?.addEventListener("pointerdown", () => {
  isNotGrabbable = !isNotGrabbable;
  pause();
});

const average = (array: number[]) =>
  array.reduce((a, b) => a + b) / array.length;

function renderCanvas() {
  ctx.fillStyle = "#0F0F00";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (barsArray) {
    const responsiveBarsSpacingIndex = canvas.width / barsArray.length;
    const currentTimeIndex = remap(
      audioElement.currentTime,
      0,
      audioElement.duration,
      0,
      barsArray.length,
    );

    for (let index in barsArray) {
      ctx.fillStyle = "#3dff5067";
      const indexNumber = Number(index);

      if (indexNumber % 4 === 0) {
        // const distance = Math.max(Math.abs(currentTimeIndex - indexNumber), 10);
        const distance = 1000;

        ctx.fillRect(
          indexNumber * responsiveBarsSpacingIndex,
          canvas.height / 2 -
            (barsArray[indexNumber] * heightSize * distance) / 1000 / 2,
          constants.BAR_WIDTH,
          (barsArray[indexNumber] * heightSize * distance) / 1000,
        );
      } else {
        continue;
      }
    }
  }
}

function render() {
  if (isNotGrabbable) {
    bar!.style.left =
      (audioElement.currentTime * canvas.width) / audioElement.duration + "px";
  }

  if (!playing) return;

  renderCanvas();
}

function resize() {
  canvas.width = window.innerWidth - 48;
  canvas.height = window.innerHeight - 200;
  renderCanvas();
}

function tick() {
  requestAnimationFrame(tick);
  render();
}

function play() {
  playing = true;
  audioElement.play();
}

function pause() {
  playing = false;
  audioElement.pause();
}
