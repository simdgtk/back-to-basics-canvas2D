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

let filter;
let reverb: ConvolverNode | undefined;
let isReverbed = false;
let isLowpassFiltered = false;

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

function updateLowpassFilter(lowpassFilterValue: boolean) {
  isLowpassFiltered =
    lowpassFilterValue === isLowpassFiltered
      ? !lowpassFilterValue
      : lowpassFilterValue;

  if (!filter || !audioContext) return;
  if (isLowpassFiltered) {
    mediaSourceNode.connect(filter);
    filter.frequency.setValueAtTime(200, audioContext.currentTime + 1);
    filter.connect(audioContext.destination);
  } else {
    mediaSourceNode.disconnect(filter);
    filter.disconnect(audioContext.destination);
    filter.frequency.setValueAtTime(200000, audioContext.currentTime + 1);
  }
}

async function updateLowpassFrequency(lowpassAmountToUpdate: number) {
  // await getData();
  // if (!audioContext) return;
  // distortionNode.curve = makeDistortionCurve(
  //   remap(lowpassAmountToUpdate, 0, 1, 0, constants.MAX_DISTORTION),
  // );
}

createKnob(1, "volume", 0.5, updateVolume);
createKnob(2, "distortion", 0, updateDistortion);
createPushButton(3, "reverb", updateReverb, isReverbed);
createPushButton(4, "lowpass filter", updateLowpassFilter, isReverbed);
createKnob(5, "lowpass frequency", 0.5, updateLowpassFrequency);

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
  audioContext || (await createContext());
  // await getSynthData();
  await getData();
  play();
  resize();
  tick();
});

async function getSynthData() {
  let response = await fetch("audio/synth.ogg");
  let arraybuffer = await response.arrayBuffer();

  try {
    if (!audioContext) return;
    console.log("test");
    const decodedArrayBuffer = await audioContext.decodeAudioData(arraybuffer);
    buffers.push(decodedArrayBuffer);
  } catch (e) {
    console.log(e);
  }
}

async function getData() {
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

async function createReverb() {
  if (!audioContext) return;

  let convolver = audioContext.createConvolver();

  let response = await fetch("audio/irHall.ogg");
  let arraybuffer = await response.arrayBuffer();
  convolver.buffer = await audioContext.decodeAudioData(arraybuffer);

  return convolver;
}

async function createLowpassFilter() {
  if (!audioContext) return;

  filter = audioContext.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(200, audioContext.currentTime + 1);
  filter.Q.value = 20;
  mediaSourceNode.connect(filter);
  filter.connect(audioContext.destination);
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
  await createLowpassFilter();

  // delay
  await getSynthData();

  const synthDelay = audioContext.createDelay(0.1);
  let synthSource;

  // synthDelay.delayTime.value = 10;
  // synthSource = audioContext.createBufferSource();
  // console.log(buffers);
  // synthSource.buffer = buffers[0];
  // synthSource.loop = true;
  // synthSource.start();
  // synthSource.connect(synthDelay);
  // synthDelay.connect(audioContext.destination);
  // mediaSourceNode.connect(analyser);
  // mediaSourceNode.connect(audioContext.destination);

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
        const distance = Math.max(Math.abs(currentTimeIndex - indexNumber), 10);

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
