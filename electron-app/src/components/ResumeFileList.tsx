import { useState, useEffect } from 'react';
import '../styles/resume-file-list.css';

interface DocxFile {
  name: string;
  path: string;
}

interface ResumeFileListProps {
  folderPath: string;
  onSelectionChange?: (selectedFiles: DocxFile[]) => void;
}

declare global {
  interface Window {
    electron?: {
      getDocxFiles: (folderPath: string) => Promise<DocxFile[]>;
    };
  }
}

export default function ResumeFileList({ folderPath, onSelectionChange }: ResumeFileListProps) {
  const [files, setFiles] = useState<DocxFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // 폴더 경로가 변경되면 파일 목록 로드
  useEffect(() => {
    if (!folderPath || !window.electron?.getDocxFiles) {
      setFiles([]);
      setSelectedFiles(new Set());
      return;
    }

    setLoading(true);
    window.electron.getDocxFiles(folderPath)
      .then((docxFiles) => {
        setFiles(docxFiles);
        // 기본적으로 모든 파일 선택
        const allPaths = new Set(docxFiles.map(f => f.path));
        setSelectedFiles(allPaths);
        if (onSelectionChange) {
          onSelectionChange(docxFiles);
        }
      })
      .catch((error) => {
        console.error('[ResumeFileList] Failed to load files:', error);
        setFiles([]);
        setSelectedFiles(new Set());
      })
      .finally(() => {
        setLoading(false);
      });
  }, [folderPath, onSelectionChange]);

  // 선택 상태 변경 시 부모 컴포넌트에 알림
  useEffect(() => {
    if (onSelectionChange) {
      const selected = files.filter(f => selectedFiles.has(f.path));
      onSelectionChange(selected);
    }
  }, [selectedFiles, files, onSelectionChange]);

  // 전체 선택
  const handleSelectAll = () => {
    const allPaths = new Set(files.map(f => f.path));
    setSelectedFiles(allPaths);
  };

  // 전체 해제
  const handleDeselectAll = () => {
    setSelectedFiles(new Set());
  };

  // 개별 파일 선택/해제
  const handleToggleFile = (filePath: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(filePath)) {
      newSelected.delete(filePath);
    } else {
      newSelected.add(filePath);
    }
    setSelectedFiles(newSelected);
  };

  const selectedCount = selectedFiles.size;
  const totalCount = files.length;

  return (
    <div className="resume-file-list">
      <div className="resume-file-list-header">
        <h3 className="resume-file-list-title">이력서 파일 목록</h3>
        <div className="resume-file-list-count">
          선택됨 {selectedCount}개 / 총 {totalCount}개
        </div>
      </div>
      
      <div className="resume-file-list-actions">
        <button
          type="button"
          className="resume-file-list-action-btn"
          onClick={handleSelectAll}
          disabled={selectedCount === totalCount || totalCount === 0}
        >
          전체 선택
        </button>
        <button
          type="button"
          className="resume-file-list-action-btn"
          onClick={handleDeselectAll}
          disabled={selectedCount === 0}
        >
          전체 해제
        </button>
      </div>

      {loading ? (
        <div className="resume-file-list-loading">파일 목록을 불러오는 중...</div>
      ) : files.length === 0 ? (
        <div className="resume-file-list-empty">
          {folderPath ? 'DOCX 파일이 없습니다.' : '폴더를 선택해주세요.'}
        </div>
      ) : (
        <div className="resume-file-list-items">
          {files.map((file) => (
            <div
              key={file.path}
              className={`resume-file-list-item ${selectedFiles.has(file.path) ? 'selected' : ''}`}
              onClick={() => handleToggleFile(file.path)}
            >
              <input
                type="checkbox"
                checked={selectedFiles.has(file.path)}
                onChange={() => handleToggleFile(file.path)}
                onClick={(e) => e.stopPropagation()}
                className="resume-file-checkbox"
              />
              <span className="resume-file-name">{file.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
