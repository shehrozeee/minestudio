import type { Command } from './Command'
import type { BuildEngine } from '../BuildEngine'
import type { PlacedObject } from '../types'

export class PaintCommand implements Command {
  private oldColor: string

  constructor(
    private engine: BuildEngine,
    private obj: PlacedObject,
    private newColor: string,
  ) {
    this.oldColor = obj.color
  }

  execute(): void {
    this.obj.color = this.newColor
    this.engine.render.updateColor(this.obj.id, this.newColor)
  }

  undo(): void {
    this.obj.color = this.oldColor
    this.engine.render.updateColor(this.obj.id, this.oldColor)
  }
}
