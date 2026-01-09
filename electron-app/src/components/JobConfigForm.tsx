import { useState, useEffect } from 'react';
import '../styles/job-config-form.css';

// Electron API 타입
declare global {
  interface Window {
    electron?: {
      selectFolder: () => Promise<string | null>;
    };
  }
}

interface JobConfigFormProps {
  validationErrors?: {
    folder?: boolean;
    userPrompt?: boolean;
  };
  setValidationErrors?: (errors: { folder?: boolean; userPrompt?: boolean }) => void;
  selectedFolder?: string;
  onFolderChange?: (folderPath: string) => void;
  onUserPromptChange?: (prompt: string) => void;
  onExecute?: () => void;
}

export default function JobConfigForm({ 
  validationErrors = {}, 
  setValidationErrors,
  selectedFolder: propSelectedFolder,
  onFolderChange,
  onUserPromptChange,
  onExecute 
}: JobConfigFormProps) {
  const [selectedFolder, setSelectedFolder] = useState<string>(propSelectedFolder || '');
  const [userPrompt, setUserPrompt] = useState<string>('');

  // 폴더 선택
  const handleSelectFolder = async () => {
    if (window.electron?.selectFolder) {
      const folderPath = await window.electron.selectFolder();
      if (folderPath) {
        setSelectedFolder(folderPath);
        if (onFolderChange) {
          onFolderChange(folderPath);
        }
        // 에러 상태 제거
        if (setValidationErrors && validationErrors.folder) {
          setValidationErrors({ ...validationErrors, folder: false });
        }
      }
    } else {
      // 개발 환경에서는 임시로 alert
      alert('Electron 환경에서만 폴더 선택이 가능합니다.');
    }
  };

  // prop으로 받은 selectedFolder가 변경되면 내부 state 업데이트
  useEffect(() => {
    if (propSelectedFolder !== undefined && propSelectedFolder !== selectedFolder) {
      setSelectedFolder(propSelectedFolder);
    }
  }, [propSelectedFolder]);

  // userPrompt 변경 시 상위 컴포넌트에 전달
  useEffect(() => {
    if (onUserPromptChange) {
      onUserPromptChange(userPrompt);
    }
  }, [userPrompt, onUserPromptChange]);

  // 필수 입력 검증 및 실행
  const handleExecuteClick = () => {
    const errors: { folder?: boolean; userPrompt?: boolean } = {};
    let hasError = false;

    // 이력서 폴더 검증
    if (!selectedFolder || selectedFolder.trim() === '') {
      errors.folder = true;
      hasError = true;
    }

    // 사용자 프롬프트 검증
    if (!userPrompt || userPrompt.trim() === '') {
      errors.userPrompt = true;
      hasError = true;
    }

    if (setValidationErrors) {
      setValidationErrors(errors);
    }

    if (hasError) {
      // 첫 번째 에러 필드로 스크롤
      if (errors.folder) {
        const folderElement = document.querySelector('.folder-select-wrapper');
        if (folderElement) {
          folderElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else if (errors.userPrompt) {
        const promptElement = document.querySelector('.user-prompt-wrapper');
        if (promptElement) {
          promptElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      return;
    }

    // userPrompt 전달
    if (onUserPromptChange) {
      onUserPromptChange(userPrompt);
    }

    // 모든 검증 통과 시 실행
    if (onExecute) {
      onExecute();
    }
  };

  // onExecute prop이 변경되면 실행 버튼 핸들러 업데이트
  useEffect(() => {
    if (onExecute) {
      // App 컴포넌트의 실행 버튼 클릭 시 이 함수 호출
      (window as any).__handleJobConfigExecute = handleExecuteClick;
    }
    return () => {
      delete (window as any).__handleJobConfigExecute;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFolder, userPrompt, validationErrors, onExecute]);

  return (
    <div className="job-config-form">
      <div className="form-section">
        {/* DOCX 폴더 선택 */}
        <div className="form-group">
          <label className="form-label">이력서 폴더 *</label>
          <p className="field-hint">DOCX 이력서 파일들이 있는 폴더를 선택하세요.</p>
          <div className={`folder-select-wrapper ${validationErrors.folder ? 'error' : ''}`}>
            <input
              type="text"
              className="folder-path-input"
              value={selectedFolder}
              readOnly
              placeholder="폴더를 선택해주세요"
            />
            <button
              type="button"
              className="folder-select-btn"
              onClick={handleSelectFolder}
            >
              폴더 선택
            </button>
          </div>
        </div>

        {/* 사용자 프롬프트 입력 */}
        <div className={`form-group user-prompt-wrapper ${validationErrors.userPrompt ? 'error' : ''}`}>
          <label className="form-label">평가 기준 *</label>
          <p className="field-hint">AI가 이력서를 평가할 기준을 입력하세요.</p>
          <textarea
            className="user-prompt-input"
            value={userPrompt}
            onChange={(e) => {
              setUserPrompt(e.target.value);
              if (setValidationErrors && validationErrors.userPrompt) {
                setValidationErrors({ ...validationErrors, userPrompt: false });
              }
            }}
            placeholder="예: 5년 이상의 개발 경력, React/TypeScript 경험, 대학 졸업 이상의 학력 등을 우대합니다."
            rows={6}
          />
        </div>
      </div>
    </div>
  );
}
