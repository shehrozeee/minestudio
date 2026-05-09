import type { Command } from './Command'
import type { BuildEngine } from '../BuildEngine'
import type { PlacedObject } from '../types'

export class PlaceCommand implements Command {
  constructor(
    private engine: BuildEngine,
    private obj: PlacedObject,
  ) {}

  execute(): void {
    this.engine.objects.push(this.obj)
    this.engine.occupancy.register(this.obj.id, this.obj.position, this.obj.size)
    this.engine.render.sync(this.engine.objects)
  }

  undo(): void {
    const idx = this.engine.objects.indexOf(this.obj)
    if (idx !== -1) this.engine.objects.splice(idx, 1)
    this.engine.occupancy.unregister(this.obj.id, this.obj.position, this.obj.size)
    this.engine.render.sync(this.engine.objects)
  }
}
