import { useState, useEffect } from 'react';
import '../styles/resume-file-list.css';

interface DocxFile {
  name: string;
  path: string;
}

interface ResumeFileListProps {
  folderPath: string;
  /** 문서 형식: DOCX면 .docx만, PDF면 .pdf만 목록에 표시 */
  documentType?: 'docx' | 'pdf';
  onSelectionChange?: (selectedFiles: DocxFile[]) => void;
}

declare global {
  interface Window {
    electron?: {
      getDocxFiles: (folderPath: string, documentType?: 'docx' | 'pdf') => Promise<DocxFile[]>;
    };
  }
}

export default function ResumeFileList({ folderPath, documentType = 'docx', onSelectionChange }: ResumeFileListProps) {
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

    let isCancelled = false;

    setLoading(true);
    window.electron.getDocxFiles(folderPath, documentType)
      .then((docxFiles) => {
        if (isCancelled) return;
        
        setFiles(docxFiles);
        // 기본적으로 모든 파일 선택
        const allPaths = new Set(docxFiles.map(f => f.path));
        setSelectedFiles(allPaths);
        // 파일 로드 시에만 부모에게 알림
        if (onSelectionChange) {
          onSelectionChange(docxFiles);
        }
      })
      .catch((error) => {
        if (isCancelled) return;
        console.error('[ResumeFileList] Failed to load files:', error);
        setFiles([]);
        setSelectedFiles(new Set());
      })
      .finally(() => {
        if (!isCancelled) {
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderPath, documentType]); // onSelectionChange를 의존성에서 제거하여 무한 루프 방지

  // 선택 상태 변경 시 부모 컴포넌트에 알림 (파일 로드가 아닌 경우만)
  useEffect(() => {
    // files가 비어있거나 아직 로딩 중이면 호출하지 않음
    if (!onSelectionChange || files.length === 0) {
      return;
    }
    
    const selected = files.filter(f => selectedFiles.has(f.path));
    onSelectionChange(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFiles, files]); // onSelectionChange를 의존성에서 제거하여 무한 루프 방지

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
          {folderPath
            ? (documentType === 'pdf' ? 'PDF 파일이 없습니다.' : 'DOCX 파일이 없습니다.')
            : '폴더를 선택해주세요.'}
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
