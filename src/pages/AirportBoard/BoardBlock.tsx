import { useEffect, useRef } from "react";

type BoardBlockProps = {
  text: string;
  length: number;
};

const BoardBlock = ({ text,  length }: BoardBlockProps) => {
  const ref = useRef<HTMLUListElement | null>(null);
  const boardRef = useRef<any>(null);
  const lastTextRef = useRef<string | null>(null);

  var messages = [text];

  return <div>{text ?? "\u00A0"}</div>;
  // return <TickerBoard messages={messages} count={1} size={length} theme={"dark"} />;
};

export default BoardBlock;
