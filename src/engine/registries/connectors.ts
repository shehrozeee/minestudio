import type { ConnectorDef } from '../types'

export const CONNECTOR_REGISTRY: ConnectorDef[] = [
  { id: 'peg',        label: 'Peg',        matesWith: ['slot'],       clearance: 0.2, bodyRule: 'different', role: 'male'    },
  { id: 'slot',       label: 'Slot',       matesWith: ['peg'],        clearance: 0.2, bodyRule: 'different', role: 'female'  },
  { id: 'ball-joint', label: 'Ball Joint', matesWith: ['socket'],     clearance: 0.3, bodyRule: 'different', role: 'male'    },
  { id: 'socket',     label: 'Socket',     matesWith: ['ball-joint'], clearance: 0.3, bodyRule: 'different', role: 'female'  },
  { id: 'hook',       label: 'Chain Hook', matesWith: ['hook'],       clearance: 0.5, bodyRule: 'different', role: 'neutral' },
]
