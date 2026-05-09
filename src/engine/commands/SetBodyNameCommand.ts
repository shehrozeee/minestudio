import type { Command } from './Command'
import type { BuildEngine } from '../BuildEngine'

export class SetBodyNameCommand implements Command {
  private oldName: string | undefined

  constructor(
    private id: number,
    private name: string,
    private engine: BuildEngine,
  ) {}

  execute(): void {
    const state = this.engine.store.getState()
    const obj = state.objects.find((o) => o.id === this.id)
    this.oldName = obj?.bodyName
    state.updateObjectBodyName(this.id, this.name)
    this.engine.render.sync(this.engine.objects)
  }

  undo(): void {
    const state = this.engine.store.getState()
    state.updateObjectBodyName(this.id, this.oldName)
    this.engine.render.sync(this.engine.objects)
  }
}
