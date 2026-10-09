const controls = document.getElementById("controls");

export function createPushButton(
  index: number,
  label: string,
  callback?: (value: boolean) => void,
  currentValue?: boolean,
) {
  const domValue = `
      <div class="push-button">
        <img class="push-button-background" id="push-button${index}" src="/images/push_button_bg.webp"/>
        <img class="push-button-button pushed" id="push-button-button${index}" src="/images/push_button.webp"/>
        <div class="push-overlay" id="push-overlay${index}"></div>
        <span class="push-button-label" id="push-button-label${index}">${label}</span>
      </div>
    `;

  controls?.insertAdjacentHTML("beforeend", domValue);

  const pushButton = document.getElementById(
    `push-button-button${index}`,
  ) as HTMLDivElement;

  const pushOverlay = document.getElementById(
    `push-overlay${index}`,
  ) as HTMLDivElement;

  function onClick() {
    clickFunction(pushOverlay, callback, currentValue);
  }

  pushButton.addEventListener("pointerdown", onClick);
}

function clickFunction(
  pushOverlay: HTMLDivElement,
  callback?: CallableFunction,
  currentValue?: boolean,
) {
  let value: boolean = currentValue ? currentValue : false;

  if (callback) callback(value);

  pushOverlay.classList.toggle("visible");
}
