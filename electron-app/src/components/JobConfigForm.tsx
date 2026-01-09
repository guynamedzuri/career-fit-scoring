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
    jobDescription?: boolean;
    gradeCriteria?: {
      최상?: boolean;
      상?: boolean;
      중?: boolean;
      하?: boolean;
      최하?: boolean;
    };
  };
  setValidationErrors?: (errors: {
    folder?: boolean;
    jobDescription?: boolean;
    gradeCriteria?: {
      최상?: boolean;
      상?: boolean;
      중?: boolean;
      하?: boolean;
      최하?: boolean;
    };
  }) => void;
  selectedFolder?: string;
  onFolderChange?: (folderPath: string) => void;
  onUserPromptChange?: (prompt: {
    jobDescription: string;
    gradeCriteria: {
      최상: string;
      상: string;
      중: string;
      하: string;
      최하: string;
    };
  }) => void;
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
  const [jobDescription, setJobDescription] = useState<string>('');
  const [gradeCriteria, setGradeCriteria] = useState({
    최상: '',
    상: '',
    중: '',
    하: '',
    최하: '',
  });
  const [isCareerEvaluationExpanded, setIsCareerEvaluationExpanded] = useState<boolean>(true);

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
      onUserPromptChange({
        jobDescription,
        gradeCriteria,
      });
    }
  }, [jobDescription, gradeCriteria, onUserPromptChange]);

  // 필수 입력 검증 및 실행
  const handleExecuteClick = () => {
    const errors: {
      folder?: boolean;
      jobDescription?: boolean;
      gradeCriteria?: {
        최상?: boolean;
        상?: boolean;
        중?: boolean;
        하?: boolean;
        최하?: boolean;
      };
    } = {};
    let hasError = false;

    // 이력서 폴더 검증
    if (!selectedFolder || selectedFolder.trim() === '') {
      errors.folder = true;
      hasError = true;
    }

    // 업무 내용 검증
    if (!jobDescription || jobDescription.trim() === '') {
      errors.jobDescription = true;
      hasError = true;
    }

    // 등급 기준 검증
    const gradeErrors: { 최상?: boolean; 상?: boolean; 중?: boolean; 하?: boolean; 최하?: boolean } = {};
    if (!gradeCriteria.최상 || gradeCriteria.최상.trim() === '') {
      gradeErrors.최상 = true;
      hasError = true;
    }
    if (!gradeCriteria.상 || gradeCriteria.상.trim() === '') {
      gradeErrors.상 = true;
      hasError = true;
    }
    if (!gradeCriteria.중 || gradeCriteria.중.trim() === '') {
      gradeErrors.중 = true;
      hasError = true;
    }
    if (!gradeCriteria.하 || gradeCriteria.하.trim() === '') {
      gradeErrors.하 = true;
      hasError = true;
    }
    if (!gradeCriteria.최하 || gradeCriteria.최하.trim() === '') {
      gradeErrors.최하 = true;
      hasError = true;
    }
    
    if (Object.keys(gradeErrors).length > 0) {
      errors.gradeCriteria = gradeErrors;
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
      } else if (errors.jobDescription) {
        const jobDescElement = document.querySelector('.job-description-wrapper');
        if (jobDescElement) {
          jobDescElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else if (errors.gradeCriteria) {
        const gradeElement = document.querySelector('.grade-criteria-wrapper');
        if (gradeElement) {
          gradeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      return;
    }

    // userPrompt 전달
    if (onUserPromptChange) {
      onUserPromptChange({
        jobDescription,
        gradeCriteria,
      });
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
  }, [selectedFolder, jobDescription, gradeCriteria, validationErrors, onExecute]);

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

        {/* 구분선 */}
        <div className="form-divider"></div>

        {/* 경력 평가 아코디언 */}
        <div className="career-evaluation-accordion">
          <button
            type="button"
            className="career-evaluation-header"
            onClick={() => setIsCareerEvaluationExpanded(!isCareerEvaluationExpanded)}
          >
            <span className="career-evaluation-title">경력 평가</span>
            <span className="career-evaluation-toggle">
              {isCareerEvaluationExpanded ? '▼' : '▶'}
            </span>
          </button>

          {isCareerEvaluationExpanded && (
            <div className="career-evaluation-content">
              {/* 업무 내용 */}
              <div className={`form-group job-description-wrapper ${validationErrors.jobDescription ? 'error' : ''}`}>
                <label className="form-label">업무 내용 *</label>
                <p className="field-hint">채용할 사람이 하게 될 업무 내용이나 필요로 하는 skill 등을 작성하세요.</p>
                <textarea
                  className="job-description-input"
                  value={jobDescription}
                  onChange={(e) => {
                    setJobDescription(e.target.value);
                    if (setValidationErrors && validationErrors.jobDescription) {
                      setValidationErrors({ ...validationErrors, jobDescription: false });
                    }
                  }}
                  placeholder="예: React/TypeScript를 사용한 프론트엔드 개발, RESTful API 설계 및 개발, AWS 클라우드 인프라 관리 등"
                  rows={6}
                />
              </div>

              {/* 경력 적합도 등급 기준 */}
              <div className="grade-criteria-section">
                <h3 className="grade-criteria-header">경력 적합도 등급 기준 *</h3>
                <p className="grade-criteria-tip">
                  ※ 점진적 소거법으로 작성하세요. 하위 등급 조건을 만족하면서 추가 조건을 충족하는 경우 상위 등급으로 평가됩니다.
                </p>
                
                <div className="grade-criteria-wrapper">
                  <div className={`form-group grade-criteria-item ${validationErrors.gradeCriteria?.최하 ? 'error' : ''}`}>
                    <label className="form-label">최하 등급 기준 *</label>
                    <textarea
                      className="grade-criteria-input"
                      value={gradeCriteria.최하}
                      onChange={(e) => {
                        setGradeCriteria({ ...gradeCriteria, 최하: e.target.value });
                        if (setValidationErrors && validationErrors.gradeCriteria?.최하) {
                          setValidationErrors({
                            ...validationErrors,
                            gradeCriteria: { ...validationErrors.gradeCriteria, 최하: false },
                          });
                        }
                      }}
                      placeholder="예: 최상, 상, 중, 하 조건을 만족하지 못하며 이력서가 빈약하고 성의가 없는 경우"
                      rows={3}
                    />
                  </div>

                  <div className={`form-group grade-criteria-item ${validationErrors.gradeCriteria?.하 ? 'error' : ''}`}>
                    <label className="form-label">하 등급 기준 *</label>
                    <textarea
                      className="grade-criteria-input"
                      value={gradeCriteria.하}
                      onChange={(e) => {
                        setGradeCriteria({ ...gradeCriteria, 하: e.target.value });
                        if (setValidationErrors && validationErrors.gradeCriteria?.하) {
                          setValidationErrors({
                            ...validationErrors,
                            gradeCriteria: { ...validationErrors.gradeCriteria, 하: false },
                          });
                        }
                      }}
                      placeholder="예: 자기소개서의 문항마다 제한 글자수의 80% 이상 채웠으며 제조업, 현장 경력이 1개 이상인 경우"
                      rows={3}
                    />
                  </div>

                  <div className={`form-group grade-criteria-item ${validationErrors.gradeCriteria?.중 ? 'error' : ''}`}>
                    <label className="form-label">중 등급 기준 *</label>
                    <textarea
                      className="grade-criteria-input"
                      value={gradeCriteria.중}
                      onChange={(e) => {
                        setGradeCriteria({ ...gradeCriteria, 중: e.target.value });
                        if (setValidationErrors && validationErrors.gradeCriteria?.중) {
                          setValidationErrors({
                            ...validationErrors,
                            gradeCriteria: { ...validationErrors.gradeCriteria, 중: false },
                          });
                        }
                      }}
                      placeholder="예: 하 등급 조건을 만족하면서 경력 중에 업무 내용과 직접적으로 관련이 있는 경우"
                      rows={3}
                    />
                  </div>

                  <div className={`form-group grade-criteria-item ${validationErrors.gradeCriteria?.상 ? 'error' : ''}`}>
                    <label className="form-label">상 등급 기준 *</label>
                    <textarea
                      className="grade-criteria-input"
                      value={gradeCriteria.상}
                      onChange={(e) => {
                        setGradeCriteria({ ...gradeCriteria, 상: e.target.value });
                        if (setValidationErrors && validationErrors.gradeCriteria?.상) {
                          setValidationErrors({
                            ...validationErrors,
                            gradeCriteria: { ...validationErrors.gradeCriteria, 상: false },
                          });
                        }
                      }}
                      placeholder="예: 중 등급 조건을 만족하면서 경력 중에 업무 내용과 거의 동일한 실무 경험이 있거나 업무내용과 관련있는 경력을 1년 이상 유지한 경우"
                      rows={3}
                    />
                  </div>

                  <div className={`form-group grade-criteria-item ${validationErrors.gradeCriteria?.최상 ? 'error' : ''}`}>
                    <label className="form-label">최상 등급 기준 *</label>
                    <textarea
                      className="grade-criteria-input"
                      value={gradeCriteria.최상}
                      onChange={(e) => {
                        setGradeCriteria({ ...gradeCriteria, 최상: e.target.value });
                        if (setValidationErrors && validationErrors.gradeCriteria?.최상) {
                          setValidationErrors({
                            ...validationErrors,
                            gradeCriteria: { ...validationErrors.gradeCriteria, 최상: false },
                          });
                        }
                      }}
                      placeholder="예: 하위 등급의 모든 조건(OR 조건도 AND로)을 만족하면서 자기소개서에 LS오토모티브라는 키워드 있는 경우"
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
