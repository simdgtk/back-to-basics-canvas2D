import { remap, clamp } from "../utils/math";
import knobSvg from "../assets/knob_outside.svg?raw";

const controls = document.getElementById("controls");

export function createKnob(
  index: number,
  label: string,
  baseValue: number = 0.5,
  callback?: (value: number) => void,
) {
  const domValue = `
      <div class="knob">
        ${knobSvg}
        <img class="knob-button" id="knob${index}" src="/images/knob.webp"/>
        <span class="knob-label" id="knob-label${index}">${label}</span>
      </div>
    `;

  controls?.insertAdjacentHTML("beforeend", domValue);

  const knob = document.getElementById(`knob${index}`) as HTMLDivElement;

  function onMove(e: MouseEvent) {
    rotate(e, knob, baseValue, callback);
  }

  function startRotations(e: MouseEvent) {
    e.preventDefault();
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", endRotations);
  }

  function endRotations() {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", endRotations);
  }

  knob.addEventListener("pointerdown", startRotations);
}

function volumeKnob(e: MouseEvent, knob: HTMLDivElement, baseValue: number) {
  const rect = knob.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;

  const deltaX = e.clientX - x;
  const deltaY = e.clientY - y;

  const MIN_ANGLE = 30;
  const MAX_ANGLE = 330;

  const rad = Math.atan2(-deltaX, deltaY);
  const deg = ((rad * 180) / Math.PI + 360) % 360;
  const clamped = clamp(deg, MIN_ANGLE, MAX_ANGLE);

  return { deg, rad, clamped, MIN_ANGLE, MAX_ANGLE };
}

function rotate(
  e: MouseEvent,
  knob: HTMLDivElement,
  baseValue: number = 0.5,
  callback?: CallableFunction,
) {
  const angle = volumeKnob(e, knob, baseValue);
  let progress = baseValue;
  if (!angle) return;

  if (callback) {
    progress = remap(angle.clamped, angle.MIN_ANGLE, angle.MAX_ANGLE, 0, 1);

    callback(progress);
  }

  knob.style.transform = `translate(-50%, -50%) rotate(${angle.clamped + 180}deg)`;

  return progress;
}
