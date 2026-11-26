import { Fragment } from "react";

/** Превращает "строка1\nстрока2" в текст с <br /> */
export default function Lines({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {line}
        </Fragment>
      ))}
    </>
  );
}
