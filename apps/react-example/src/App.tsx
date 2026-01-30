import { useState, useEffect } from "react";
import { TextMorph } from "torph/react";

const texts = [
  "Animate Text Easily",
  "Animate Text Effortlessly",
  "Animate Text Seamlessly",
  "Fluidly Animate Text",
];

export default function App() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % texts.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        fontSize: "2rem",
      }}
    >
      <TextMorph>{texts[index]}</TextMorph>
    </div>
  );
}
