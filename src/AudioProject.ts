import {
  SCALE_HEIGHT_INDEX,
  BAR_WIDTH,
  TRACK_CURSOR_HEIGHT,
} from "./utils/constants";
import { remap, clamp, degreesToRadians } from "./utils/math";

const canvas = document.getElementById("canvas")! as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const audioElement = document.getElementById("audio")! as HTMLAudioElement;
const bar = document.getElementById("bar");
const launchButton = document.getElementById("launch-button");
const trackCursor = document.getElementById("track-cursor");
const track = document.getElementById("track");

const knob1 = document.getElementById("knob1") as HTMLDivElement;

let audioContext: AudioContext | null = null;
let playing = false;
let analyser: AnalyserNode;
let analyserBuffer: Uint8Array<ArrayBuffer>;
let barsArray: number[];

let isNotGrabbable = true;

let isRotating = false;

// bar
let trackTop: number | undefined = 0;
let trackBottom: number | undefined = 0;

// knob
let prevXKnob = 0;
let prevYKnob = 0;
let volume = 0;

function volumeKnob(e: MouseEvent, knob: HTMLDivElement) {
  if (knob) {
    const w = knob?.clientWidth / 2;
    const h = knob?.clientHeight / 2;

    const x = e.clientX - knob.getBoundingClientRect().left;
    const y = e.clientY - knob.getBoundingClientRect().top;

    const deltaX = w - x;
    const deltaY = h - y;

    const rad = Math.atan2(deltaY, deltaX);
    let deg = degreesToRadians(rad);

    prevXKnob = x;
    prevYKnob = y;
    return { deg, rad };
  }
}
function rotate(e: MouseEvent) {
  const volume = volumeKnob(e, knob1);
  if (!volume) {
    return;
  }
  const result = Math.floor(volume.deg - 90);
  // console.log(result);
  audioElement.volume = remap(clamp(result, -90, 90), -90, 90, 0, 1);
  // console.log(audioElement.volume);
  // console.log(((volume?.deg % 360) + 360) / 360);
  // console.log(remap(result, -150, 0, 1, 0));
  knob1.style.transform = `translate(-50%, -50%) rotate(${result}deg)`;
}

function manageRotations() {
  if (isRotating) {
    endRotations();
  } else {
    startRotations();
  }
}
function startRotations() {
  isRotating = true;
  window.addEventListener("mousemove", rotate);
  window.addEventListener("mouseup", rotate);
}

function endRotations() {
  window.removeEventListener("mousemove", rotate);
  window.removeEventListener("mouseup", rotate);
  isRotating = false;
}

knob1?.addEventListener("pointerdown", manageRotations);

addEventListener("resize", resize);

document.body.onkeyup = function (e) {
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
  // callback?: any,
) {
  var pos1 = 0,
    pos2 = 0,
    pos3 = 0,
    pos4 = 0;

  let progress;

  // if (callback) callback("boundingLimits", boundingLimits);

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
        pos4 > boundingLimits.num2 + TRACK_CURSOR_HEIGHT / 2
      ) {
        element.style.top =
          Math.min(
            element.offsetTop - pos2,
            boundingLimits.num2 + TRACK_CURSOR_HEIGHT / 2,
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
    }
  }

  function closeDragElement() {
    if (bar) bar.style.cursor = "grab";
    document.onmouseup = null;
    document.onmousemove = null;
  }

  if (boundingLimits) {
    if (axis === "x") {
      progress = remap(
        pos3 - boundingLimits.num1,
        boundingLimits.num1,
        boundingLimits.num2,
        0,
        1,
      );
    }
    if (axis === "y") {
      progress = remap(
        pos4 - boundingLimits.num1,
        boundingLimits.num1,
        boundingLimits.num2,
        0,
        1,
      );
    }

    return progress;
  }

  // callback();
}

launchButton?.addEventListener("click", async () => {
  launchButton.classList.add("hide");
  await getData();
  audioContext || (await createContext());
  play();
  resize();
  tick();
});

async function getData() {
  const audioCtx = new AudioContext();

  return fetch("audio/tenSeconds.wav")
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error, status = ${response.status}`);
      }
      return response.arrayBuffer();
    })
    .then((buffer) => audioCtx.decodeAudioData(buffer))
    .then((decodedData) => {
      const source = new AudioBufferSourceNode(audioCtx);
      source.buffer = decodedData;
      source.connect(audioCtx.destination);

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

      // return source
      // console.log(source, array);
      barsArray = array;
      // console.log(barsArray);
      return barsArray;
    });
}

async function createContext() {
  audioContext = new AudioContext();

  const mediaSourceNode = audioContext.createMediaElementSource(audioElement);
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 32768;
  analyserBuffer = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteTimeDomainData(analyserBuffer);

  audioElement.volume = 0.0;
  // audioElement.playbackRate = 0.1

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
      // function (donnees: number) {
      //   console.log(donnees);
      // },
    );
  }
}

bar?.addEventListener("pointerup", () => {
  isNotGrabbable = !isNotGrabbable;
  const positionLeft = bar!.style.left.replace("px", "");
  audioElement.currentTime =
    (Number(positionLeft) * audioElement.duration) / canvas.width;

  // bar!.style.left * audioElement.duration / canvas.width =
  //   (audioElement.currentTime);
  playing = true;
  audioElement.play();
});

bar?.addEventListener("pointerdown", () => {
  isNotGrabbable = !isNotGrabbable;
  pause();
});

function render() {
  if (isNotGrabbable) {
    bar!.style.left =
      (audioElement.currentTime * canvas.width) / audioElement.duration + "px";
  }

  if (!playing) return;

  ctx.fillStyle = "#0F0F00";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.lineWidth = 1;
  ctx.strokeStyle = "#3DA2FF";
  ctx.fillStyle = "#3DA2FF";

  if (barsArray) {
    const responsiveBarsSpacingIndex = canvas.width / barsArray.length;

    for (let index in barsArray) {
      ctx.fillStyle = "#3dff5067";
      const indexNumber = Number(index);
      
      if (indexNumber % 8 === 0) {
        ctx.fillRect(
          indexNumber * responsiveBarsSpacingIndex,
          canvas.height / 2 - (barsArray[indexNumber] * SCALE_HEIGHT_INDEX) / 2,
          BAR_WIDTH,
          barsArray[indexNumber] * SCALE_HEIGHT_INDEX,
        );
      } else {
        continue;
      }
    }

    // for (let index in barsArray) {
    //   ctx.fillStyle = "#0F0F00";
    //   ctx.fillRect(0, 0, canvas.width, canvas.height);

    //   ctx.lineTo(
    //     index * responsiveBarsSpacingIndex,
    //     (canvas.height / 2 - (barsArray[index] * SCALE_HEIGHT_INDEX) / 4) + 300,
    //   );
    //   ctx.stroke();
    //   // if (index % 2 === 0) {
    //   // ctx.fillRect(
    //   //   index * responsiveBarsSpacingIndex,
    //   //   canvas.height / 2 - (barsArray[index] * SCALE_HEIGHT_INDEX) / 2,
    //   //   BAR_WIDTH,
    //   //   barsArray[index] * SCALE_HEIGHT_INDEX,
    //   // );
    //   // } else {
    //   //   continue;
    //   // }
    // }
    // for (let index in barsArray) {
    //   ctx.fillStyle = "#0F0F00";
    //   ctx.fillRect(0, 0, canvas.width, canvas.height);

    //   ctx.lineTo(
    //     index * responsiveBarsSpacingIndex,
    //     canvas.height / 2 - (barsArray[index] * SCALE_HEIGHT_INDEX) / 4,
    //   );
    //   ctx.stroke();
    //   // if (index % 2 === 0) {
    //   // ctx.fillRect(
    //   //   index * responsiveBarsSpacingIndex,
    //   //   canvas.height / 2 - (barsArray[index] * SCALE_HEIGHT_INDEX) / 2,
    //   //   BAR_WIDTH,
    //   //   barsArray[index] * SCALE_HEIGHT_INDEX,
    //   // );
    //   // } else {
    //   //   continue;
    //   // }
    // }
  }

  // ctx.beginPath();

  // const sliceWidth = canvas.width / analyserBuffer.length;
  // let x = 0;

  // for (let i = 0; i < analyserBuffer.length; i++) {
  //   const v = analyserBuffer[i] / 128;
  //   const y = (v * canvas.height) / 2;

  //   if (i === 0) {
  //     // ctx.moveTo(x, y);
  //   } else {
  //     ctx.lineTo(x, y);
  //   }

  //   x += sliceWidth;
  // }

  // ctx.lineTo(canvas.width, canvas.height / 2);
  // ctx.stroke();
}

// function renderTracksSpectrumOverlay(
//   tracks: AudioTrack[],
//   currentTime: number,
//   heightPercent: number = 50,
//   windowDuration: number = 1.0,
// ): void {
//   const dimensions = this.renderContext.getDimensions();
//   // Spectrum bars grow upward from the bottom of the canvas
//   const baseY = dimensions.height;

//   tracks.forEach((track) => {
//     this.renderTrackSpectrum(
//       track,
//       currentTime,
//       baseY,
//       heightPercent,
//       windowDuration,
//     );
//   });
// }

function resize() {
  canvas.width = window.innerWidth - 48;
  canvas.height = window.innerHeight - 200;
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
