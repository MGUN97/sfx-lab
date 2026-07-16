import React, { useRef, useState } from 'react';
import { useAudioStore } from '../store/useAudioStore';
import LayerCard from './LayerCard';

export default function LayerRack() {
  const layers = useAudioStore((s) => s.layers);
  const addLayer = useAudioStore((s) => s.addLayer);
  const selectedLayerId = useAudioStore((s) => s.selectedLayerId);
  const reorderLayers = useAudioStore((s) => s.reorderLayers);
  const bulkMode = useAudioStore((s) => s.bulkMode);
  const bulkLayerIds = useAudioStore((s) => s.bulkLayerIds);
  const toggleBulkMode = useAudioStore((s) => s.toggleBulkMode);

  const dragIndex = useRef<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    dragIndex.current = index;
  };
  const handleDragOver = (index: number) => {
    setHoverIndex(index);
  };
  const handleDragEnd = () => {
    if (dragIndex.current != null && hoverIndex != null && dragIndex.current !== hoverIndex) {
      reorderLayers(dragIndex.current, hoverIndex);
    }
    dragIndex.current = null;
    setHoverIndex(null);
  };

  return (
    <div className="studio-panel p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold tracking-wide text-studio-text">CONTROL LAYERS</h2>
        <div className="flex items-center gap-1.5">
          <button
            className={`studio-btn ${bulkMode ? 'active' : ''}`}
            onClick={toggleBulkMode}
            title="여러 레이어를 선택해서 랜덤화 값을 한 번에 적용"
          >
            일괄 설정{bulkMode && bulkLayerIds.length > 0 ? ` (${bulkLayerIds.length})` : ''}
          </button>
          <button className="studio-btn" onClick={addLayer}>
            + Add Layer
          </button>
        </div>
      </div>
      {bulkMode && (
        <div className="text-[10.5px] text-studio-accent mb-3">
          레이어 카드의 체크박스로 여러 개 선택하면, 오른쪽 패널에서 랜덤화 값을 한 번에 적용할 수 있어요.
        </div>
      )}
      <div className="space-y-3">
        {layers.map((layer, i) => (
          <LayerCard
            key={layer.id}
            layer={layer}
            index={i}
            isSelected={selectedLayerId === layer.id}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          />
        ))}
        {layers.length === 0 && (
          <div className="text-center text-xs text-studio-dim py-6">레이어가 없습니다. Add Layer를 눌러 추가하세요.</div>
        )}
      </div>
    </div>
  );
}
