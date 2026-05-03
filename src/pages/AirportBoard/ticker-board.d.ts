declare module 'ticker-board' {
  export class TickerBoard {
    constructor(el: Element | string)
    updateMessages(msgs: string[]): void
    destroy?(): void
  }
}
