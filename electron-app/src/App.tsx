import { useState } from 'react';
import JobConfigForm from './components/JobConfigForm';
import ResumeFileList from './components/ResumeFileList';
import ResultView from './components/ResultView';
import './styles/app.css';

type ViewMode = 'config' | 'result';

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('config');
  const [validationErrors, setValidationErrors] = useState<{
    folder?: boolean;
    job?: boolean;
  }>({});
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<Array<{ name: string; path: string }>>([]);
  const [jobMetadata, setJobMetadata] = useState<any>(null);

  const handleExecute = () => {
    // JobConfigForm의 검증 함수 호출
    if ((window as any).__handleJobConfigExecute) {
      (window as any).__handleJobConfigExecute();
    }
  };

  const handleSelectedFilesChange = (files: Array<{ name: string; path: string }>) => {
    setSelectedFiles(files);
  };

  const handleConfigExecute = () => {
    // 검증 통과 시 실행할 로직
    // TODO: 실제 점수 계산 로직 추가
    console.log('실행하기 - 모든 필수 입력 완료');
    console.log('Selected files:', selectedFiles);
    console.log('Job metadata:', jobMetadata);
    
    // 결과 화면으로 전환
    setViewMode('result');
  };

  const handleBackToConfig = () => {
    setViewMode('config');
  };

  // 결과 화면
  if (viewMode === 'result') {
    return (
      <div className="app">
        <div className="app-content-wrapper">
          <ResultView 
            selectedFiles={selectedFiles}
            jobMetadata={jobMetadata}
            selectedFolder={selectedFolder}
            onBack={handleBackToConfig}
          />
        </div>
      </div>
    );
  }

  // 설정 화면
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
              onJobMetadataChange={setJobMetadata}
              onExecute={handleConfigExecute}
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
