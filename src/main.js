import { createGUI } from "./gui";

const DAMPING = 0.01;
let a = true;

const parameters = {
  pointerDamping: DAMPING,
};

(async () => {
  const canvas = document.querySelector("#canvas");
  const ctx = canvas.getContext("2d");

  let frameRequest;
  let time = 0;
  let elapsed = 0;
  let delta = 0;
  let pointerX = 0;
  let pointerY = 0;
  let easePointerX = 0;
  let easePointerY = 0;

  const image = new Image();
  new Promise((resolve, reject) => {
    image.addEventListener("load", () => {
      resolve(image);
      resize()
    });
    image.addEventListener("error", (event) => {
      reject(event);
    });

    image.src = "/img.JPG";
  });

  let imageData = new ImageData(2, 2);

  imageData.data[0] = 255;
  imageData.data[1] = 0;
  imageData.data[2] = 0;
  imageData.data[3] = 255;

  imageData.data[4] = 0;
  imageData.data[5] = 0;
  imageData.data[6] = 255;
  imageData.data[7] = 255;

  window.addEventListener("resize", resize);
  // passive, dit au nav qu'il a pas besoin d'attendre la fin de l'exe du code pour passer à la suite
  window.addEventListener("pointermove", onPointerMove, { passive: true }); // pointer est plus moderne que mouse, prend aussi les touch screens

  createGUI(parameters);
  play();
  resize();

  function onPointerMove(event) {
    pointerX = event.clientX;
    pointerY = event.clientY;
  }

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // redimentionner un canvas, l'efface, ne pas oublier de re rendre
    render();
  }

  function render() {
    const currentTime = Date.now();
    delta = currentTime - time;
    time = currentTime;
    elapsed += delta;

    const easing = Math.min(delta * parameters.pointerDamping, 1);
    easePointerX += (pointerX - easePointerX) * easing;
    easePointerY += (pointerY - easePointerY) * easing;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "red";
    ctx.strokeStyle = "blue";
    ctx.lineWidth = 5;

    ctx.beginPath();
    ctx.moveTo(50, 50);
    ctx.lineTo(200, 50);
    ctx.stroke();
    ctx.closePath();
    ctx.scale(0.5, 0.5);
    ctx.drawImage(image, 1, 1, 400, 400);

    ctx.putImageData(imageData, 0, 0); // image de 2px par 2px en haut à gauche

    // ctx.getImageData(0, 0, canvas.width, canvas.height)

    // blob : binary large object
    // createObjectURL pour récupérer l'url du canvas qu'on a exporté en blob
    // revokeObjectURL pour supprimer la place prise en mémoire du createObjectURL

    ctx.strokeRect(easePointerX - 50, easePointerY - 50, 100, 100, 100);
    // ctx.fillRect(easePointerX - 50, easePointerY - 50, 100, 100, 100);
  }
  function tick() {
    frameRequest = requestAnimationFrame(tick);
    // render();
  }

  function play() {
    time = Date.now();
    tick();
  }

  function pause() {
    frameRequest && cancelAnimationFrame(frameRequest);
    frameRequest = undefined;
  }
})();
