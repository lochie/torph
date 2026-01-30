import { TextMorph } from "torph";

const texts = [
  "Animate Text Easily",
  "Animate Text Effortlessly",
  "Animate Text Seamlessly",
  "Fluidly Animate Text",
];

const container = document.getElementById("torph-text")!;
container.style.display = "flex";
container.style.justifyContent = "center";
container.style.alignItems = "center";
container.style.height = "100vh";
container.style.fontSize = "2rem";

const morph = new TextMorph({ element: container });

let index = 0;
morph.update(texts[index]);

setInterval(() => {
  index = (index + 1) % texts.length;
  morph.update(texts[index]);
}, 2000);
