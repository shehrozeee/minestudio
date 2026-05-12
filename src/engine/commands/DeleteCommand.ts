import type { Command } from './Command'
import type { BuildEngine } from '../BuildEngine'
import type { PlacedObject } from '../types'

export class DeleteCommand implements Command {
  constructor(
    private engine: BuildEngine,
    private obj: PlacedObject,
  ) {}

  execute(): void {
    const idx = this.engine.objects.indexOf(this.obj)
    if (idx !== -1) this.engine.objects.splice(idx, 1)
    if (!this.obj.isNegative) {
      this.engine.occupancy.unregister(this.obj.id, this.obj.position, this.obj.size)
    }
    this.engine.render.sync(this.engine.objects)
  }

  undo(): void {
    this.engine.objects.push(this.obj)
    if (!this.obj.isNegative) {
      this.engine.occupancy.register(this.obj.id, this.obj.position, this.obj.size)
    }
    this.engine.render.sync(this.engine.objects)
  }
}
