import { useState, useEffect } from 'react';
import '../styles/save-load-modal.css';

interface SaveLoadModalProps {
  currentData: {
    selectedFolder: string;
    userPrompt: any;
    selectedFiles: Array<{ name: string; path: string }>;
  };
  onClose: () => void;
  onLoad: (data: {
    selectedFolder: string;
    userPrompt: any;
    selectedFiles: Array<{ name: string; path: string }>;
  }) => void;
}

interface SavedItem {
  name: string;
  timestamp: string;
  data: {
    selectedFolder: string;
    userPrompt: any;
    selectedFiles: Array<{ name: string; path: string }>;
  };
  isAutoSave?: boolean;
}

export default function SaveLoadModal({ currentData, onClose, onLoad }: SaveLoadModalProps) {
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<SavedItem | null>(null);
  const [showSaveNameModal, setShowSaveNameModal] = useState<boolean>(false);
  const [newItemName, setNewItemName] = useState<string>('');
  const [editingItem, setEditingItem] = useState<SavedItem | null>(null);
  const [editingName, setEditingName] = useState<string>('');

  useEffect(() => {
    loadSavedItems();
    // 테스트용 프리셋이 없으면 생성
    const items = JSON.parse(localStorage.getItem('jobConfigSaves') || '[]');
    const hasTestPreset = items.some((item: SavedItem) => item.name === '테스트용 프리셋');
    
    if (!hasTestPreset) {
      const testPreset: SavedItem = {
        name: '테스트용 프리셋',
        timestamp: new Date().toISOString(),
        data: {
          selectedFolder: '',
          userPrompt: {
            jobDescription: '일반프레스 (40~80톤) 설비 양산 운영 경험, 금형셋업 및 타발 업무, 자주검사 및 포장, 룸램프, RY TERMINAL, AMATEUR 터미널, F CONTACTOR ASSY 등 양산 경험 보유',
            requiredQualifications: '',
            preferredQualifications: '',
            requiredCertifications: [],
            gradeCriteria: {
              최상: '하위 등급의 모든 조건(OR 조건도 AND로)을 만족하면서 자기소개서에 LS오토모티브라는 키워드 있는 경우',
              상: '중 등급 조건을 만족하면서 경력 중에 업무 내용과 거의 동일한 실무 경험이 있거나 업무내용과 관련있는 경력을 1년 이상 유지한 경우',
              중: '하 등급 조건을 만족하면서 경력 중에 업무 내용과 직접적으로 관련이 있는 경우',
              하: '자기소개서의 문항마다 제한 글자수의 80% 이상 채웠으며 제조업, 현장 경력이 1개 이상인 경우',
              최하: '최상, 상, 중, 하 조건을 만족하지 못하며 이력서가 빈약하고 성의가 없는 경우',
            },
            scoringWeights: {
              career: 100,
              requirements: 0,
              preferred: 0,
              certifications: 0,
            },
          },
          selectedFiles: [],
        },
        isAutoSave: false,
      };
      
      const updatedItems = [testPreset, ...items];
      localStorage.setItem('jobConfigSaves', JSON.stringify(updatedItems));
      loadSavedItems();
    }
  }, []);

  const loadSavedItems = () => {
    const items = JSON.parse(localStorage.getItem('jobConfigSaves') || '[]');
    setSavedItems(items);
  };

  const handleSaveClick = () => {
    setNewItemName('');
    setShowSaveNameModal(true);
  };

  const handleSave = () => {
    if (!newItemName.trim()) {
      alert('저장할 이름을 입력해주세요.');
      return;
    }

    const newItem: SavedItem = {
      name: newItemName.trim(),
      timestamp: new Date().toISOString(),
      data: currentData,
      isAutoSave: false,
    };

    const items = JSON.parse(localStorage.getItem('jobConfigSaves') || '[]');
    // 기존 자동저장 항목 유지
    const autoSaveItems = items.filter((item: SavedItem) => item.isAutoSave);
    const otherItems = items.filter((item: SavedItem) => !item.isAutoSave);
    
    // 새 항목 추가
    const updatedItems = [...autoSaveItems, ...otherItems, newItem];
    localStorage.setItem('jobConfigSaves', JSON.stringify(updatedItems));
    
    setNewItemName('');
    setShowSaveNameModal(false);
    loadSavedItems();
    alert('저장되었습니다.');
  };

  const handleEditClick = (item: SavedItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.isAutoSave) {
      alert('자동저장 항목은 수정할 수 없습니다.');
      return;
    }
    setEditingItem(item);
    setEditingName(item.name);
  };

  const handleEditSave = () => {
    if (!editingName.trim()) {
      alert('이름을 입력해주세요.');
      return;
    }

    if (!editingItem) return;

    const items = JSON.parse(localStorage.getItem('jobConfigSaves') || '[]');
    const updatedItems = items.map((item: SavedItem) => {
      if (item.name === editingItem.name && item.timestamp === editingItem.timestamp) {
        return {
          ...item,
          name: editingName.trim(),
        };
      }
      return item;
    });
    
    localStorage.setItem('jobConfigSaves', JSON.stringify(updatedItems));
    loadSavedItems();
    setEditingItem(null);
    setEditingName('');
    if (selectedItem && selectedItem.name === editingItem.name && selectedItem.timestamp === editingItem.timestamp) {
      setSelectedItem({ ...selectedItem, name: editingName.trim() });
    }
    alert('수정되었습니다.');
  };

  const handleEditCancel = () => {
    setEditingItem(null);
    setEditingName('');
  };

  const handleLoad = () => {
    if (!selectedItem) return;
    onLoad(selectedItem.data);
  };

  const handleOverwrite = () => {
    if (!selectedItem) return;
    
    if (selectedItem.isAutoSave) {
      alert('자동저장 항목은 덮어쓸 수 없습니다.');
      return;
    }

    if (!confirm(`"${selectedItem.name}" 항목을 현재 내용으로 덮어쓰시겠습니까?`)) {
      return;
    }

    const items = JSON.parse(localStorage.getItem('jobConfigSaves') || '[]');
    const updatedItems = items.map((item: SavedItem) => {
      if (item.name === selectedItem.name && item.timestamp === selectedItem.timestamp) {
        return {
          ...item,
          data: currentData,
          timestamp: new Date().toISOString(),
        };
      }
      return item;
    });
    
    localStorage.setItem('jobConfigSaves', JSON.stringify(updatedItems));
    loadSavedItems();
    setSelectedItem(null);
    alert('덮어쓰기 완료되었습니다.');
  };

  const handleDelete = () => {
    if (!selectedItem) return;
    
    if (selectedItem.isAutoSave) {
      alert('자동저장 항목은 삭제할 수 없습니다.');
      return;
    }

    if (!confirm(`"${selectedItem.name}" 항목을 삭제하시겠습니까?`)) {
      return;
    }

    const items = JSON.parse(localStorage.getItem('jobConfigSaves') || '[]');
    const updatedItems = items.filter((item: SavedItem) => 
      !(item.name === selectedItem.name && item.timestamp === selectedItem.timestamp)
    );
    
    localStorage.setItem('jobConfigSaves', JSON.stringify(updatedItems));
    loadSavedItems();
    setSelectedItem(null);
    alert('삭제되었습니다.');
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="save-load-modal-overlay" onClick={onClose}>
      <div className="save-load-modal" onClick={(e) => e.stopPropagation()}>
        <div className="save-load-modal-header">
          <h2>내용 저장/불러오기</h2>
          <button className="save-load-modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="save-load-modal-content">
          <div className="save-load-modal-left">
            <div className="saved-items-list">
              {savedItems.map((item, idx) => (
                <div
                  key={`${item.name}-${item.timestamp}`}
                  className={`saved-item ${selectedItem?.name === item.name && selectedItem?.timestamp === item.timestamp ? 'selected' : ''}`}
                  onClick={() => setSelectedItem(item)}
                >
                  <div className="saved-item-name">
                    {item.isAutoSave && <span className="auto-save-badge">자동저장</span>}
                    {editingItem?.name === item.name && editingItem?.timestamp === item.timestamp ? (
                      <span>{item.name}</span>
                    ) : (
                      <>
                        <span>{item.name}</span>
                        {!item.isAutoSave && (
                          <button
                            className="saved-item-edit-btn"
                            onClick={(e) => handleEditClick(item, e)}
                            title="이름 수정"
                          >
                            ✎
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  <div className="saved-item-date">{formatDate(item.timestamp)}</div>
                </div>
              ))}
              {savedItems.length === 0 && (
                <div className="saved-items-empty">저장된 항목이 없습니다.</div>
              )}
            </div>
          </div>
          
          <div className="save-load-modal-right">
            <div className="save-load-actions">
              <button
                className="save-load-action-btn save-btn"
                onClick={handleSaveClick}
              >
                저장하기
              </button>
              <button
                className="save-load-action-btn load-btn"
                onClick={handleLoad}
                disabled={!selectedItem}
              >
                불러오기
              </button>
              <button
                className="save-load-action-btn overwrite-btn"
                onClick={handleOverwrite}
                disabled={!selectedItem || selectedItem?.isAutoSave}
              >
                덮어쓰기
              </button>
              <button
                className="save-load-action-btn delete-btn"
                onClick={handleDelete}
                disabled={!selectedItem || selectedItem?.isAutoSave}
              >
                삭제하기
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {showSaveNameModal && (
        <div className="save-name-modal-overlay" onClick={() => setShowSaveNameModal(false)}>
          <div className="save-name-modal" onClick={(e) => e.stopPropagation()}>
            <div className="save-name-modal-header">
              <h3>저장할 이름을 입력하세요</h3>
              <button className="save-name-modal-close" onClick={() => setShowSaveNameModal(false)}>×</button>
            </div>
            <div className="save-name-modal-content">
              <input
                type="text"
                className="save-name-input"
                placeholder="저장할 이름을 입력하세요"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSave();
                  } else if (e.key === 'Escape') {
                    setShowSaveNameModal(false);
                  }
                }}
                autoFocus
              />
            </div>
            <div className="save-name-modal-footer">
              <button className="save-name-cancel-btn" onClick={() => setShowSaveNameModal(false)}>
                취소
              </button>
              <button className="save-name-confirm-btn" onClick={handleSave}>
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {editingItem && (
        <div className="save-name-modal-overlay" onClick={handleEditCancel}>
          <div className="save-name-modal" onClick={(e) => e.stopPropagation()}>
            <div className="save-name-modal-header">
              <h3>이름 수정</h3>
              <button className="save-name-modal-close" onClick={handleEditCancel}>×</button>
            </div>
            <div className="save-name-modal-content">
              <input
                type="text"
                className="save-name-input"
                placeholder="이름을 입력하세요"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleEditSave();
                  } else if (e.key === 'Escape') {
                    handleEditCancel();
                  }
                }}
                autoFocus
              />
            </div>
            <div className="save-name-modal-footer">
              <button className="save-name-cancel-btn" onClick={handleEditCancel}>
                취소
              </button>
              <button className="save-name-confirm-btn" onClick={handleEditSave}>
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
