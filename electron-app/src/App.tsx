import { useState, useEffect } from 'react';
import JobConfigForm from './components/JobConfigForm';
import ResumeFileList from './components/ResumeFileList';
import ResultView from './components/ResultView';
import SaveLoadModal from './components/SaveLoadModal';
import LoadingSpinner from './components/LoadingSpinner';
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
  const [jobMetadata, setJobMetadata] = useState<{ documentType?: 'docx' | 'pdf' } | null>(null);
  const [showSaveLoadModal, setShowSaveLoadModal] = useState<boolean>(false);
  const [showPromptsModal, setShowPromptsModal] = useState<boolean>(false);
  const [promptsPreview, setPromptsPreview] = useState<{ systemPrompt: string; userPromptText: string } | null>(null);
  const [promptsPreviewError, setPromptsPreviewError] = useState<string | null>(null);
  const [userPrompt, setUserPrompt] = useState<any>(null);
  const [loadedData, setLoadedData] = useState<any>(null);
  // "실행하기"를 누른 시점의 설정 스냅샷 (뒤로가기 시 이 값으로 복원)
  const [executedSnapshot, setExecutedSnapshot] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [aiProgress, setAiProgress] = useState<{ current: number; total: number; currentFile: string; estimatedTimeRemainingMs?: number; phase?: 'parsing' | 'ai'; concurrency?: number } | null>(null);
  
  // 업데이트 관련 상태
  const [updateStatus, setUpdateStatus] = useState<{
    checking: boolean;
    available: boolean;
    downloading: boolean;
    downloaded: boolean;
    version?: string;
    progress?: number;
  }>({
    checking: false,
    available: false,
    downloading: false,
    downloaded: false,
  });
  
  // 디버깅: aiProgress 변경 추적
  useEffect(() => {
    console.log('[App] aiProgress updated:', aiProgress);
  }, [aiProgress]);

  // 업데이트 이벤트 리스너 설정
  useEffect(() => {
    const electron = (window as any).electron;
    if (!electron) return;

    const handleUpdateChecking = () => {
      setUpdateStatus(prev => ({ ...prev, checking: true }));
    };

    const handleUpdateAvailable = (info: any) => {
      setUpdateStatus(prev => ({
        ...prev,
        checking: false,
        available: true,
        downloading: true,
        version: info.version,
      }));
    };

    const handleUpdateDownloadProgress = (progress: any) => {
      setUpdateStatus(prev => ({
        ...prev,
        progress: Math.round(progress.percent || 0),
      }));
    };

    const handleUpdateDownloaded = (info: any) => {
      setUpdateStatus(prev => ({
        ...prev,
        downloading: false,
        downloaded: true,
        version: info.version,
      }));
    };

    const handleUpdateNotAvailable = () => {
      setUpdateStatus(prev => ({
        ...prev,
        checking: false,
        available: false,
        downloading: false,
      }));
    };

    const handleUpdateError = (error: string) => {
      setUpdateStatus(prev => ({
        ...prev,
        checking: false,
        available: false,
        downloading: false,
      }));
      console.error('[App] Update error:', error);
    };

    electron.onUpdateChecking?.(handleUpdateChecking);
    electron.onUpdateAvailable?.(handleUpdateAvailable);
    electron.onUpdateDownloadProgress?.(handleUpdateDownloadProgress);
    electron.onUpdateDownloaded?.(handleUpdateDownloaded);
    electron.onUpdateNotAvailable?.(handleUpdateNotAvailable);
    electron.onUpdateError?.(handleUpdateError);

    return () => {
      // cleanup은 ipcRenderer.removeListener를 사용해야 하지만,
      // contextBridge를 통해 노출된 함수에서는 직접 제거하기 어려움
      // 대신 컴포넌트 언마운트 시 상태만 초기화
    };
  }, []);

  // 앱이 마운트되면 메인 프로세스에 준비 완료 신호 전송
  useEffect(() => {
    console.log('[App] useEffect for app ready signal executed');
    const notifyReady = async () => {
      console.log('[App] notifyReady function called');
      try {
        const electron = (window as any).electron;
        console.log('[App] Checking electron object:', electron);
        console.log('[App] electron keys:', electron ? Object.keys(electron) : 'electron is null/undefined');
        
        if (electron?.notifyAppReady) {
          console.log('[App] Calling notifyAppReady...');
          await electron.notifyAppReady();
          console.log('[App] App ready signal sent to main process');
        } else {
          console.error('[App] electron.notifyAppReady is not available');
          console.error('[App] Available electron methods:', electron ? Object.keys(electron).join(', ') : 'none');
        }
      } catch (error) {
        console.error('[App] Failed to send app ready signal:', error);
      }
    };
    // 약간의 지연을 두어 React가 완전히 렌더링될 시간을 줌
    console.log('[App] Setting timeout for notifyReady...');
    const timer = setTimeout(notifyReady, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleExecute = () => {
    // JobConfigForm의 검증 함수 호출
    if ((window as any).__handleJobConfigExecute) {
      (window as any).__handleJobConfigExecute();
    }
  };

  const handleSelectedFilesChange = (files: Array<{ name: string; path: string }>) => {
    setSelectedFiles(files);
  };

  const handleConfigExecute = async () => {
    // 검증 통과 시 실행할 로직
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

    // 뒤로가기 시 복원할 "실행 시점" 스냅샷 저장
    // (ResultView에서 뒤로가기하면 JobConfigForm이 remount 되므로, 이 값으로 다시 채움)
    setExecutedSnapshot({
      selectedFolder,
      userPrompt,
    });
    
    // 로딩 시작
    setIsProcessing(true);
    
    // 결과 화면으로 전환 (AI 분석은 ResultView에서 자동 실행됨)
    setViewMode('result');
  };

  const handleBackToConfig = () => {
    // 뒤로가기 시 "실행하기"를 누른 시점의 설정으로 복원
    // (마지막으로 불러온 프리셋으로 덮어써지지 않도록 loadedData를 스냅샷으로 설정)
    if (executedSnapshot) {
      setLoadedData(executedSnapshot);
    } else {
      setLoadedData(null);
    }
    setViewMode('config');
  };

  // 결과 화면
  if (viewMode === 'result') {
    return (
      <div className="app">
        <div className="app-content-wrapper">
          <ResultView 
            selectedFiles={selectedFiles}
            userPrompt={userPrompt}
            selectedFolder={selectedFolder}
            onBack={handleBackToConfig}
            onProcessingChange={setIsProcessing}
            onProgressChange={setAiProgress}
            jobMetadata={jobMetadata}
          />
        </div>
        {isProcessing && <LoadingSpinner message="이력서 분석 중..." fullScreen progress={aiProgress || undefined} />}
        {/* 업데이트 진행도 표시 */}
        {(updateStatus.checking || updateStatus.available || updateStatus.downloading || updateStatus.downloaded) && (
          <LoadingSpinner
            message={
              updateStatus.checking
                ? '업데이트 확인 중...'
                : updateStatus.downloading
                ? `업데이트 다운로드 중... (${updateStatus.progress || 0}%)`
                : updateStatus.downloaded
                ? `업데이트 다운로드 완료! 설치 중...`
                : '업데이트 준비 중...'
            }
            fullScreen
            progress={
              updateStatus.downloading && updateStatus.progress !== undefined
                ? {
                    current: updateStatus.progress,
                    total: 100,
                    currentFile: updateStatus.version ? `버전 ${updateStatus.version}` : undefined,
                  }
                : undefined
            }
          />
        )}
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
              documentType={jobMetadata?.documentType ?? 'docx'}
              onJobMetadataChange={(meta) => {
                const prevDocumentType = jobMetadata?.documentType;
                setJobMetadata(prev => ({ ...prev, ...meta }));
                // documentType이 변경되면 선택된 파일 목록도 초기화
                if (meta.documentType && prevDocumentType && meta.documentType !== prevDocumentType) {
                  setSelectedFiles([]);
                }
              }}
              onUserPromptChange={setUserPrompt}
              onExecute={handleConfigExecute}
              loadedData={loadedData}
            />
          </div>
          <div className="app-right-panel">
            <ResumeFileList 
              folderPath={selectedFolder}
              documentType={jobMetadata?.documentType ?? 'docx'}
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
            type="button"
            className="prompts-preview-footer-btn"
            onClick={async () => {
              setPromptsPreviewError(null);
              setPromptsPreview(null);
              setShowPromptsModal(true);
              const electron = (window as any).electron;
              if (!electron?.getAiPromptsPreview) {
                setPromptsPreviewError('프롬프트 미리보기를 사용할 수 없습니다.');
                return;
              }
              const up = userPrompt || {};
              const placeholders: Record<string, string> = {
                jobDescription: '(업무 내용을 입력하세요)',
                requiredQualifications: '(필수 요구사항을 입력하세요)',
                preferredQualifications: '(우대 사항을 입력하세요)',
              };
              const gradePlaceholder = '(등급별 조건을 입력하세요)';
              const userPromptWithPlaceholders = {
                jobDescription: (up.jobDescription && String(up.jobDescription).trim()) ? up.jobDescription : placeholders.jobDescription,
                requiredQualifications: (up.requiredQualifications && String(up.requiredQualifications).trim()) ? up.requiredQualifications : placeholders.requiredQualifications,
                preferredQualifications: (up.preferredQualifications && String(up.preferredQualifications).trim()) ? up.preferredQualifications : placeholders.preferredQualifications,
                requiredCertifications: Array.isArray(up.requiredCertifications) ? up.requiredCertifications : [],
                gradeCriteria: {
                  최상: (up.gradeCriteria?.최상 && String(up.gradeCriteria.최상).trim()) ? up.gradeCriteria.최상 : gradePlaceholder,
                  상: (up.gradeCriteria?.상 && String(up.gradeCriteria.상).trim()) ? up.gradeCriteria.상 : gradePlaceholder,
                  중: (up.gradeCriteria?.중 && String(up.gradeCriteria.중).trim()) ? up.gradeCriteria.중 : gradePlaceholder,
                  하: (up.gradeCriteria?.하 && String(up.gradeCriteria.하).trim()) ? up.gradeCriteria.하 : gradePlaceholder,
                  최하: (up.gradeCriteria?.최하 && String(up.gradeCriteria.최하).trim()) ? up.gradeCriteria.최하 : gradePlaceholder,
                },
                scoringWeights: up.scoringWeights || {},
              };
              if (!userPromptWithPlaceholders.jobDescription || userPromptWithPlaceholders.jobDescription === placeholders.jobDescription) {
                userPromptWithPlaceholders.jobDescription = placeholders.jobDescription;
              }
              try {
                const res = await electron.getAiPromptsPreview({
                  userPrompt: userPromptWithPlaceholders,
                  applicationData: undefined,
                });
                if (res.success && res.systemPrompt != null && res.userPromptText != null) {
                  setPromptsPreview({ systemPrompt: res.systemPrompt, userPromptText: res.userPromptText });
                } else {
                  setPromptsPreviewError((res as { error?: string }).error || '프롬프트를 불러오지 못했습니다.');
                }
              } catch (e) {
                setPromptsPreviewError(e instanceof Error ? e.message : '알 수 없는 오류');
              }
            }}
          >
            프롬프트 미리보기
          </button>
          <button 
            className="execute-btn"
            onClick={handleExecute}
          >
            실행하기
          </button>
        </div>
        <div className="app-version-info">
          Copyright Ⓒ 2026 LS Automotive Technologies. All rights reserved. | Version {import.meta.env.VITE_APP_VERSION || '1.3.2'}
        </div>
      </div>
      {showPromptsModal && (
        <div className="status-modal-overlay app-prompts-overlay" onClick={() => { setShowPromptsModal(false); setPromptsPreview(null); setPromptsPreviewError(null); }}>
          <div className="prompts-preview-modal app-prompts-modal" onClick={(e) => e.stopPropagation()}>
            <div className="status-modal-header">
              <h3>AI 프롬프트 미리보기</h3>
              <button type="button" className="status-modal-close" onClick={() => { setShowPromptsModal(false); setPromptsPreview(null); setPromptsPreviewError(null); }}>
                ✕
              </button>
            </div>
            <div className="prompts-preview-content">
              {promptsPreviewError && (
                <div className="prompts-preview-error">{promptsPreviewError}</div>
              )}
              {promptsPreview && (
                <>
                  <div className="prompts-preview-section">
                    <h4 className="prompts-preview-label">System prompt</h4>
                    <textarea className="prompts-preview-textarea" readOnly value={promptsPreview.systemPrompt} rows={12} />
                  </div>
                  <div className="prompts-preview-section">
                    <h4 className="prompts-preview-label">User prompt</h4>
                    <textarea className="prompts-preview-textarea" readOnly value={promptsPreview.userPromptText} rows={16} />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
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
      {/* 업데이트 진행도 표시 */}
      {(updateStatus.checking || updateStatus.available || updateStatus.downloading || updateStatus.downloaded) && (
        <LoadingSpinner
          message={
            updateStatus.checking
              ? '업데이트 확인 중...'
              : updateStatus.downloading
              ? `업데이트 다운로드 중... (${updateStatus.progress || 0}%)`
              : updateStatus.downloaded
              ? `업데이트 다운로드 완료! 설치 중...`
              : '업데이트 준비 중...'
          }
          fullScreen
          progress={
            updateStatus.downloading && updateStatus.progress !== undefined
              ? {
                  current: updateStatus.progress,
                  total: 100,
                  currentFile: updateStatus.version ? `버전 ${updateStatus.version}` : undefined,
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

export default App;
