import { Pane } from "tweakpane";

export function createGUI(parameters) {
  const pane = new Pane();
  pane.addBinding(parameters, "pointerDamping", {
    step: 0.001,
  });
}
