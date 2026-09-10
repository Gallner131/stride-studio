// The one colour that matters for a layer — §6.5.
//
// Every layer type keeps its colour somewhere different: text in style.color, a shape in
// style.fill, a stat in style.valueColor, a route in style.color. The Inspector has a
// Colour section for each of them, but it lives behind a tab and a collapsed section, so
// changing the colour of something you can see took four steps. Reported, fairly, as "it is
// really not clear how to change the colours of anything".
//
// These two functions are the whole contract the on-canvas selection toolbar needs.
//
// Values may be a literal like "#FF0000" or a look token like "$accent" (§5.4). Writing a
// literal is a deliberate override of the look for that one element, which is what picking a
// swatch means; tokens stay settable so an element can be put back under the look.
import type { Layer } from "./types";

/** The colour a person would name if you pointed at this layer. Null if it has none. */
export function primaryColor(layer: Layer): string | null {
  switch (layer.type) {
    case "text":
      return layer.style.color;
    case "shape":
      return layer.style.fill;
    case "sticker":
      return layer.style.fill;
    case "stat":
      // The big number, not its label — that is the thing being pointed at.
      return layer.style.valueColor;
    case "statRow":
      return layer.style.color;
    case "route":
      // A route's colour is its stroke; there is no fill to speak of.
      return layer.style.stroke;
    case "chart":
      return layer.style.color;
    default:
      // Images carry no colour of their own, and the HYROX blocks are composed panels whose
      // colours belong to the look rather than to one swatch.
      return null;
  }
}

/** Sets that colour in place. A layer with no colour of its own is left untouched. */
export function setPrimaryColor(layer: Layer, color: string): void {
  switch (layer.type) {
    case "text":
      layer.style.color = color;
      return;
    case "shape":
      layer.style.fill = color;
      return;
    case "sticker":
      layer.style.fill = color;
      return;
    case "stat":
      layer.style.valueColor = color;
      return;
    case "statRow":
      layer.style.color = color;
      return;
    case "route":
      layer.style.stroke = color;
      return;
    case "chart":
      layer.style.color = color;
      return;
    default:
      return;
  }
}

/** True when this layer can be recoloured at all, for showing or hiding the swatch. */
export const hasPrimaryColor = (layer: Layer): boolean => primaryColor(layer) !== null;
