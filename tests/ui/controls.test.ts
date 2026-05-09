import { describe, it, expect, beforeEach } from 'vitest'
import { useStore, resetStore } from '../../src/ui/store'
import { SetBodyNameCommand } from '../../src/engine/commands/SetBodyNameCommand'
import type { PlacedObject } from '../../src/engine/types'

describe('ControlsPage', () => {
  beforeEach(() => resetStore())

  it('showControls defaults to false in store', () => {
    expect(useStore.getState().showControls).toBe(false)
  })

  it('setShowControls(true) updates store', () => {
    useStore.getState().setShowControls(true)
    expect(useStore.getState().showControls).toBe(true)
  })

  it('setShowControls(false) updates store', () => {
    useStore.getState().setShowControls(true)
    useStore.getState().setShowControls(false)
    expect(useStore.getState().showControls).toBe(false)
  })
})

describe('BodyNamePanel', () => {
  beforeEach(() => resetStore())

  it('selectedObjectId defaults to null in store', () => {
    expect(useStore.getState().selectedObjectId).toBeNull()
  })

  it('setSelectedObjectId updates store', () => {
    useStore.getState().setSelectedObjectId('obj-42')
    expect(useStore.getState().selectedObjectId).toBe('obj-42')
  })

  it('updateObjectBodyName updates matching object', () => {
    const obj: PlacedObject = {
      id: 1,
      defId: 'cube',
      size: 'normal',
      position: { gx: 0, gy: 0, gz: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      color: '#ffffff',
      isNegative: false,
      isPrintable: true,
      isSupport: false,
      storageKind: 'grid',
    }
    useStore.setState({ objects: [obj] })
    useStore.getState().updateObjectBodyName(1, 'MyBody')
    const updated = useStore.getState().objects.find(o => o.id === 1)
    expect(updated?.bodyName).toBe('MyBody')
  })

  it('SetBodyNameCommand execute sets name', () => {
    const obj: PlacedObject = {
      id: 1,
      defId: 'cube',
      size: 'normal',
      position: { gx: 0, gy: 0, gz: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      color: '#ffffff',
      isNegative: false,
      isPrintable: true,
      isSupport: false,
      storageKind: 'grid',
    }
    useStore.setState({ objects: [obj] })

    const fakeEngine = {
      store: useStore,
      render: { sync: () => {} },
      objects: [obj],
    } as unknown as import('../../src/engine/BuildEngine').BuildEngine

    const cmd = new SetBodyNameCommand(1, 'Arm', fakeEngine)
    cmd.execute()
    expect(useStore.getState().objects.find(o => o.id === 1)?.bodyName).toBe('Arm')
  })

  it('SetBodyNameCommand undo restores old name', () => {
    const obj: PlacedObject = {
      id: 1,
      defId: 'cube',
      size: 'normal',
      position: { gx: 0, gy: 0, gz: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      color: '#ffffff',
      isNegative: false,
      isPrintable: true,
      isSupport: false,
      storageKind: 'grid',
      bodyName: 'OldName',
    }
    useStore.setState({ objects: [obj] })

    const fakeEngine = {
      store: useStore,
      render: { sync: () => {} },
      objects: [obj],
    } as unknown as import('../../src/engine/BuildEngine').BuildEngine

    const cmd = new SetBodyNameCommand(1, 'NewName', fakeEngine)
    cmd.execute()
    expect(useStore.getState().objects.find(o => o.id === 1)?.bodyName).toBe('NewName')
    cmd.undo()
    expect(useStore.getState().objects.find(o => o.id === 1)?.bodyName).toBe('OldName')
  })
})
