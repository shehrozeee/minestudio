export interface Command {
  execute(): void
  undo(): void
  serialize?(): string
}

export interface CommandBusState {
  canUndo: boolean
  canRedo: boolean
}

type ChangeListener = (state: CommandBusState) => void

export class CommandBus {
  private history: Command[] = []
  private cursor = -1
  private readonly maxSize: number
  private listeners: ChangeListener[] = []

  constructor(maxSize = 100) {
    this.maxSize = maxSize
  }

  execute(cmd: Command): void {
    this.history = this.history.slice(0, this.cursor + 1)
    if (this.history.length >= this.maxSize) {
      this.history.shift()
      this.cursor--
    }
    cmd.execute()
    this.history.push(cmd)
    this.cursor++
    this.notify()
  }

  undo(): void {
    if (!this.canUndo) return
    this.history[this.cursor].undo()
    this.cursor--
    this.notify()
  }

  redo(): void {
    if (!this.canRedo) return
    this.cursor++
    this.history[this.cursor].execute()
    this.notify()
  }

  get canUndo(): boolean {
    return this.cursor >= 0
  }

  get canRedo(): boolean {
    return this.cursor < this.history.length - 1
  }

  onChange(listener: ChangeListener): () => void {
    this.listeners.push(listener)
    return () => { this.listeners = this.listeners.filter(l => l !== listener) }
  }

  private notify(): void {
    const state: CommandBusState = { canUndo: this.canUndo, canRedo: this.canRedo }
    for (const l of this.listeners) l(state)
  }
}
