// Version 1.0.65
import { useState, useEffect } from 'react';
import JobConfigForm from './components/JobConfigForm';
import ResumeFileList from './components/ResumeFileList';
import ResultView from './components/ResultView';
import SaveLoadModal from './components/SaveLoadModal';
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
  const [showSaveLoadModal, setShowSaveLoadModal] = useState<boolean>(false);
  const [userPrompt, setUserPrompt] = useState<any>(null);
  const [loadedData, setLoadedData] = useState<any>(null);

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
    
    // 자동저장: 현재 내용을 자동저장 항목으로 저장
    if (userPrompt) {
      const autoSaveData = {
        name: '자동저장',
        timestamp: new Date().toISOString(),
        data: {
          selectedFolder,
          userPrompt,
          selectedFiles,
        },
        isAutoSave: true,
      };
      const savedItems = JSON.parse(localStorage.getItem('jobConfigSaves') || '[]');
      // 기존 자동저장 항목 제거
      const filteredItems = savedItems.filter((item: any) => !item.isAutoSave);
      // 새로운 자동저장 항목을 맨 위에 추가
      localStorage.setItem('jobConfigSaves', JSON.stringify([autoSaveData, ...filteredItems]));
    }
    
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
              onUserPromptChange={setUserPrompt}
              onExecute={handleConfigExecute}
              loadedData={loadedData}
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
        <div className="app-footer-content">
          <button 
            className="save-load-btn"
            onClick={() => setShowSaveLoadModal(true)}
          >
            내용 저장/불러오기
          </button>
          <button 
            className="execute-btn"
            onClick={handleExecute}
          >
            실행하기
          </button>
        </div>
        <div className="app-version-info">
          Copyright Ⓒ 2016 LS Automotive Technologies. All rights reserved. | Version 1.0.65
        </div>
      </div>
      {showSaveLoadModal && (
        <SaveLoadModal
          currentData={{
            selectedFolder,
            userPrompt,
            selectedFiles,
          }}
          onClose={() => setShowSaveLoadModal(false)}
          onLoad={(data) => {
            setLoadedData(data);
            setSelectedFolder(data.selectedFolder || '');
            setUserPrompt(data.userPrompt || null);
            setSelectedFiles(data.selectedFiles || []);
            setShowSaveLoadModal(false);
          }}
        />
      )}
    </div>
  );
}

export default App;
