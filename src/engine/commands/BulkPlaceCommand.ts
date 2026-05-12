import type { BuildEngine } from '../BuildEngine'
import type { PlacedObject } from '../types'
import type { Command } from './Command'

export class BulkPlaceCommand implements Command {
  constructor(private objects: PlacedObject[], private engine: BuildEngine) {}

  execute(): void {
    for (const obj of this.objects) {
      this.engine.objects.push(obj)
      if (!obj.isNegative) {
        this.engine.occupancy.register(obj.id, obj.position, obj.size)
      }
    }
    this.engine.render.sync(this.engine.objects)
  }

  undo(): void {
    for (const obj of this.objects) {
      const idx = this.engine.objects.indexOf(obj)
      if (idx !== -1) this.engine.objects.splice(idx, 1)
      if (!obj.isNegative) {
        this.engine.occupancy.unregister(obj.id, obj.position, obj.size)
      }
    }
    this.engine.render.sync(this.engine.objects)
  }
}
