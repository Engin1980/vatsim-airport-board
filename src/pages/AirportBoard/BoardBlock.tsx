import { TickerBoard } from "react-ticker-board";

type BoardBlockProps = {
  text: string;
  length: number;
};

const BoardBlock = ({ text,  length }: BoardBlockProps) => {
  var messages = [text];

  //return <div>{text ?? "\u00A0"}</div>;
  return <TickerBoard messages={messages} count={1} size={length} theme={"dark"} />;
};

export default BoardBlock;
