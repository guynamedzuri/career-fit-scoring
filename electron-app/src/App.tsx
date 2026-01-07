import { useState } from 'react';
import JobConfigForm from './components/JobConfigForm';
import ResumeFileList from './components/ResumeFileList';
import './styles/app.css';

function App() {
  const [validationErrors, setValidationErrors] = useState<{
    folder?: boolean;
    job?: boolean;
  }>({});
  const [selectedFolder, setSelectedFolder] = useState<string>('');

  const handleExecute = () => {
    // JobConfigForm의 검증 함수 호출
    if ((window as any).__handleJobConfigExecute) {
      (window as any).__handleJobConfigExecute();
    }
  };

  const handleSelectedFilesChange = (files: Array<{ name: string; path: string }>) => {
    console.log('Selected files:', files);
    // TODO: 선택된 파일 목록 저장
  };

  return (
    <div className="app">
      <div className="app-content-wrapper">
        <div className="app-main-layout">
          <div className="app-left-panel">
            <JobConfigForm 
              validationErrors={validationErrors}
              setValidationErrors={setValidationErrors}
              selectedFolder={selectedFolder}
              onFolderChange={setSelectedFolder}
              onExecute={() => {
                // 검증 통과 시 실행할 로직
                console.log('실행하기 - 모든 필수 입력 완료');
                // TODO: 실제 실행 로직 추가
              }}
            />
          </div>
          <div className="app-right-panel">
            <ResumeFileList 
              folderPath={selectedFolder}
              onSelectionChange={handleSelectedFilesChange}
            />
          </div>
        </div>
      </div>
      <div className="app-footer">
        <button 
          className="execute-btn"
          onClick={handleExecute}
        >
          실행하기
        </button>
      </div>
    </div>
  );
}

export default App;
