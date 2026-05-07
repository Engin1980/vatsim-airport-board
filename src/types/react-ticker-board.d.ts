declare module "react-ticker-board" {
  import * as React from "react";

  export interface TickerBoardProps {
    messages: string[];
    count?: number;
    size?: number;
    delay?: number;
    theme?: string;
  }

  export const TickerBoard: React.FC<TickerBoardProps>;
  export default TickerBoard;
}
