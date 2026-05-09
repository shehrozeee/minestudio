import { useState, useEffect, useCallback } from 'react'
import { useStore } from '../store'
import { BLOCK_REGISTRY } from '../../engine/registries/blocks'
import type { BlockCategory } from '../../engine/types'

const TABS: { id: BlockCategory; label: string }[] = [
  { id: 'basic', label: 'Basic' },
  { id: 'round', label: 'Round' },
  { id: 'partial', label: 'Partial' },
  { id: 'connector', label: 'Connector' },
  { id: 'utility', label: 'Utility' },
]

export function Inventory() {
  const inventoryOpen = useStore(s => s.inventoryOpen)
  const inventoryTab = useStore(s => s.inventoryTab)
  const setInventoryOpen = useStore(s => s.setInventoryOpen)
  const setSelectedBlockDefId = useStore(s => s.setSelectedBlockDefId)
  const hotbarSlots = useStore(s => s.hotbarSlots)
  const selectedSlot = useStore(s => s.selectedSlot)
  const setHotbarSlots = useStore(s => s.setHotbarSlots)

  const [search, setSearch] = useState('')
  const [focusedIdx, setFocusedIdx] = useState(0)

  const filteredBlocks = BLOCK_REGISTRY.filter(b => {
    const tabMatch = b.category === inventoryTab
    const searchMatch = search === '' || b.label.toLowerCase().includes(search.toLowerCase())
    return tabMatch && searchMatch
  })

  const handleSelectBlock = useCallback((id: string) => {
    setSelectedBlockDefId(id)
    const updated = [...hotbarSlots]
    updated[selectedSlot] = id
    setHotbarSlots(updated)
    setInventoryOpen(false)
  }, [hotbarSlots, selectedSlot, setSelectedBlockDefId, setHotbarSlots, setInventoryOpen])

  useEffect(() => {
    if (!inventoryOpen) return
    setFocusedIdx(0)
  }, [inventoryOpen, inventoryTab, search])

  useEffect(() => {
    if (!inventoryOpen) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setInventoryOpen(false)
        return
      }
      const cols = 3
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        setFocusedIdx(i => Math.min(i + 1, filteredBlocks.length - 1))
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setFocusedIdx(i => Math.max(i - 1, 0))
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocusedIdx(i => Math.min(i + cols, filteredBlocks.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusedIdx(i => Math.max(i - cols, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filteredBlocks[focusedIdx]) {
          handleSelectBlock(filteredBlocks[focusedIdx].id)
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [inventoryOpen, filteredBlocks, focusedIdx, handleSelectBlock, setInventoryOpen])

  if (!inventoryOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) setInventoryOpen(false) }}
    >
      <div style={{
        background: 'rgba(13,15,18,0.97)',
        border: '1px solid #2a2f37',
        borderRadius: 12,
        padding: '20px 24px',
        width: 480,
        maxHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        fontFamily: "'JetBrains Mono', monospace",
        color: '#f4f5f7',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setInventoryOpen(true, tab.id)
                  setSearch('')
                }}
                style={{
                  background: inventoryTab === tab.id ? 'rgba(0,213,99,0.15)' : 'rgba(255,255,255,0.05)',
                  border: inventoryTab === tab.id ? '1px solid #00d563' : '1px solid #2a2f37',
                  borderRadius: 6,
                  color: inventoryTab === tab.id ? '#00d563' : '#8b8f97',
                  cursor: 'pointer',
                  fontSize: 11,
                  padding: '5px 12px',
                  fontFamily: 'inherit',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setInventoryOpen(false)}
            style={{
              background: 'transparent',
              border: '1px solid #2a2f37',
              borderRadius: 6,
              color: '#8b8f97',
              cursor: 'pointer',
              fontSize: 14,
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'inherit',
            }}
          >
            X
          </button>
        </div>

        {/* Search */}
        <input
          autoFocus
          value={search}
          onChange={e => { setSearch(e.target.value); setFocusedIdx(0) }}
          placeholder="Search..."
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid #2a2f37',
            borderRadius: 6,
            color: '#f4f5f7',
            fontFamily: 'inherit',
            fontSize: 12,
            padding: '7px 10px',
            outline: 'none',
            width: '100%',
            boxSizing: 'border-box',
          }}
          onKeyDown={e => e.stopPropagation()}
        />

        {/* Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
          overflowY: 'auto',
          paddingRight: 4,
        }}>
          {filteredBlocks.length === 0 ? (
            <div style={{ gridColumn: 'span 3', textAlign: 'center', color: '#8b8f97', padding: 20, fontSize: 12 }}>
              No blocks found
            </div>
          ) : (
            filteredBlocks.map((block, idx) => (
              <button
                key={block.id}
                onClick={() => handleSelectBlock(block.id)}
                style={{
                  background: idx === focusedIdx ? 'rgba(0,213,99,0.15)' : 'rgba(255,255,255,0.04)',
                  border: idx === focusedIdx ? '1px solid #00d563' : '1px solid #2a2f37',
                  borderRadius: 8,
                  color: '#f4f5f7',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 11,
                  padding: '12px 8px',
                  textAlign: 'center',
                  transition: 'background 0.1s, border-color 0.1s',
                }}
                onMouseEnter={() => setFocusedIdx(idx)}
              >
                {block.label}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
