import { useState, useEffect, useRef } from 'react';
import { parseOfficialCertificates, parseAdditionalNationalCertificates, ADDITIONAL_NATIONAL_CERTIFICATES } from 'career-fit-scoring';
import '../styles/job-config-form.css';

// Electron API 타입
declare global {
  interface Window {
    electron?: {
      selectFolder: () => Promise<string | null>;
      qnetSearchCertifications: () => Promise<string[]>;
      readOfficialCertificates: () => Promise<string | null>;
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
    requiredQualifications: string;
    preferredQualifications: string;
    requiredCertifications: string[];
    gradeCriteria: {
      최상: string;
      상: string;
      중: string;
      하: string;
      최하: string;
    };
    scoringWeights: {
      career: number;
      requirements: number;
      preferred: number;
      certifications: number;
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
  const [requiredQualifications, setRequiredQualifications] = useState<string>('');
  const [preferredQualifications, setPreferredQualifications] = useState<string>('');
  const [requiredCertifications, setRequiredCertifications] = useState<string[]>([]);
  const [gradeCriteria, setGradeCriteria] = useState({
    최상: '',
    상: '',
    중: '',
    하: '',
    최하: '',
  });
  const [scoringWeights, setScoringWeights] = useState({
    career: 1,
    requirements: 1,
    preferred: 1,
    certifications: 1,
  });
  const [isCareerEvaluationExpanded, setIsCareerEvaluationExpanded] = useState<boolean>(true);
  
  // 자격증 검색 관련
  const [certSearchQuery, setCertSearchQuery] = useState('');
  const [certSearchResults, setCertSearchResults] = useState<Array<{ name: string; code?: string }>>([]);
  const [showCertDropdown, setShowCertDropdown] = useState(false);
  const [loadingCerts, setLoadingCerts] = useState(false);
  const allCertsCacheRef = useRef<Array<{ name: string; code?: string }> | null>(null);

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

  // 전체 자격증 데이터 로드
  const loadAllCertifications = async (): Promise<Array<{ name: string; code?: string }>> => {
    if (allCertsCacheRef.current) {
      return allCertsCacheRef.current;
    }

    if (loadingCerts) {
      return [];
    }

    setLoadingCerts(true);
    try {
      const allCerts: Array<{ name: string; code?: string }> = [];
      
      // Q-Net API (Electron 메인 프로세스를 통해 호출)
      try {
        if (window.electron?.qnetSearchCertifications) {
          const qnetCerts = await window.electron.qnetSearchCertifications();
          qnetCerts.forEach(certName => {
            allCerts.push({ name: certName });
          });
          console.log('[Load Certs] Q-Net: Loaded', qnetCerts.length, 'certifications');
        } else {
          console.warn('[Load Certs] Q-Net API not available (not in Electron)');
        }
      } catch (error) {
        console.error('[Load Certs] Q-Net API error:', error);
      }
      
      // 공인민간자격증 파일 (Electron 메인 프로세스를 통해 읽기)
      try {
        if (window.electron?.readOfficialCertificates) {
          const fileContent = await window.electron.readOfficialCertificates();
          if (fileContent) {
            const officialCerts = parseOfficialCertificates(fileContent);
            officialCerts.forEach(cert => {
              allCerts.push({ name: cert });
            });
            console.log('[Load Certs] Official: Loaded', officialCerts.length, 'certifications');
          } else {
            console.warn('[Load Certs] Official certs file not found');
          }
        } else {
          console.warn('[Load Certs] Official certs not available (not in Electron)');
        }
      } catch (error) {
        console.error('[Load Certs] Official certs parse error:', error);
      }
      
      // 추가 국가자격증
      try {
        const additionalCerts = parseAdditionalNationalCertificates(ADDITIONAL_NATIONAL_CERTIFICATES);
        additionalCerts.forEach(certName => {
          allCerts.push({ name: certName });
        });
      } catch (error) {
        console.error('[Load Certs] Additional certs error:', error);
      }
      
      allCertsCacheRef.current = allCerts;
      setLoadingCerts(false);
      return allCerts;
    } catch (error) {
      console.error('[Load Certs] Failed:', error);
      setLoadingCerts(false);
      return [];
    }
  };

  // 자격증 검색
  const handleCertSearch = async (query: string) => {
    if (!query || query.trim().length === 0) {
      setCertSearchResults([]);
      setShowCertDropdown(false);
      return;
    }

    try {
      const queryLower = query.toLowerCase().trim();
      const allCerts = await loadAllCertifications();
      
      const filtered = allCerts.filter(cert => 
        cert.name.toLowerCase().includes(queryLower)
      ).slice(0, 20);
      
      setCertSearchResults(filtered);
      setShowCertDropdown(filtered.length > 0 || query.trim().length > 0);
    } catch (error) {
      console.error('Failed to search certifications:', error);
      setCertSearchResults([]);
      setShowCertDropdown(false);
    }
  };

  // 자격증 추가
  const handleAddCertification = (certName: string) => {
    const trimmedName = certName.trim();
    if (trimmedName && !requiredCertifications.includes(trimmedName)) {
      setRequiredCertifications([...requiredCertifications, trimmedName]);
    }
    setCertSearchQuery('');
    setShowCertDropdown(false);
  };

  // 초기 로드
  useEffect(() => {
    loadAllCertifications();
  }, []);

  // 가중치 계산 및 자동 조정
  useEffect(() => {
    const trimmedRequired = requiredQualifications.trim();
    const trimmedPreferred = preferredQualifications.trim();
    const hasCerts = requiredCertifications.length > 0;

    const newWeights = {
      career: scoringWeights.career,
      requirements: trimmedRequired ? scoringWeights.requirements : 0,
      preferred: trimmedPreferred ? scoringWeights.preferred : 0,
      certifications: hasCerts ? scoringWeights.certifications : 0,
    };

    // 다른 항목들의 가중치가 변경되었을 때만 업데이트
    if (
      newWeights.requirements !== scoringWeights.requirements ||
      newWeights.preferred !== scoringWeights.preferred ||
      newWeights.certifications !== scoringWeights.certifications
    ) {
      setScoringWeights(newWeights);
    }
  }, [requiredQualifications, preferredQualifications, requiredCertifications]);

  // userPrompt 변경 시 상위 컴포넌트에 전달
  useEffect(() => {
    if (onUserPromptChange) {
      onUserPromptChange({
        jobDescription,
        requiredQualifications: requiredQualifications.trim(),
        preferredQualifications: preferredQualifications.trim(),
        requiredCertifications,
        gradeCriteria,
        scoringWeights,
      });
    }
  }, [jobDescription, requiredQualifications, preferredQualifications, requiredCertifications, gradeCriteria, scoringWeights, onUserPromptChange]);

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
  }, [selectedFolder, jobDescription, requiredQualifications, preferredQualifications, requiredCertifications, gradeCriteria, scoringWeights, validationErrors, onExecute]);

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

        {/* 적합도 평가 기준 헤더 */}
        <h2 className="evaluation-criteria-header">적합도 평가 기준</h2>

        {/* 경력 평가 기준 아코디언 */}
        <div className="career-evaluation-accordion">
          <button
            type="button"
            className="career-evaluation-header"
            onClick={() => setIsCareerEvaluationExpanded(!isCareerEvaluationExpanded)}
          >
            <span className="career-evaluation-title">경력 평가 기준</span>
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
                  onBlur={(e) => {
                    setJobDescription(e.target.value.trim());
                  }}
                  placeholder="예: React/TypeScript를 사용한 프론트엔드 개발, RESTful API 설계 및 개발, AWS 클라우드 인프라 관리 등"
                  rows={6}
                />
              </div>

              {/* 필수 요구사항 */}
              <div className="form-group">
                <label className="form-label">필수 요구사항</label>
                <p className="field-hint">반드시 충족해야 하는 요구사항을 작성하세요.</p>
                <textarea
                  className="qualifications-input"
                  value={requiredQualifications}
                  onChange={(e) => {
                    setRequiredQualifications(e.target.value);
                  }}
                  onBlur={(e) => {
                    setRequiredQualifications(e.target.value.trim());
                  }}
                  placeholder="예: 5년 이상의 개발 경력, 대학 졸업 이상의 학력 등"
                  rows={4}
                />
              </div>

              {/* 우대 사항 */}
              <div className="form-group">
                <label className="form-label">우대 사항</label>
                <p className="field-hint">있으면 좋은 우대 사항을 작성하세요.</p>
                <textarea
                  className="qualifications-input"
                  value={preferredQualifications}
                  onChange={(e) => {
                    setPreferredQualifications(e.target.value);
                  }}
                  onBlur={(e) => {
                    setPreferredQualifications(e.target.value.trim());
                  }}
                  placeholder="예: 대학원 졸업, 특정 자격증 보유, 특정 기술 스택 경험 등"
                  rows={4}
                />
              </div>

              {/* 필수 자격증 */}
              <div className="form-group">
                <label className="form-label">필수 자격증</label>
                <p className="field-hint">자격증을 검색하여 필수 자격증으로 추가할 수 있습니다.</p>
                <div className="cert-search-wrapper">
                  <input
                    type="text"
                    className="cert-search-input"
                    placeholder="자격증명을 검색하세요"
                    value={certSearchQuery}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setCertSearchQuery(newValue);
                      handleCertSearch(newValue);
                    }}
                    onFocus={() => {
                      if (certSearchQuery.trim().length > 0) {
                        handleCertSearch(certSearchQuery);
                      }
                    }}
                    onBlur={() => {
                      setTimeout(() => setShowCertDropdown(false), 200);
                    }}
                  />
                  {showCertDropdown && certSearchQuery.trim().length > 0 && (
                    <div className="cert-search-dropdown">
                      {certSearchResults.map((cert, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className="cert-search-item"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleAddCertification(cert.name);
                          }}
                        >
                          <div className="cert-search-name">{cert.name}</div>
                        </button>
                      ))}
                      <button
                        type="button"
                        className="cert-search-item"
                        style={{ borderTop: '1px solid #e5e7eb', fontWeight: '500' }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleAddCertification(certSearchQuery.trim());
                        }}
                      >
                        <div className="cert-search-name">"{certSearchQuery.trim()}"</div>
                      </button>
                    </div>
                  )}
                  {loadingCerts && (
                    <div className="loading-indicator">자격증 검색 중...</div>
                  )}
                </div>
                
                {requiredCertifications.length > 0 && (
                  <div className="added-required-certs">
                    <div className="certification-list">
                      {requiredCertifications.map((cert, idx) => (
                        <div key={idx} className="certification-tag required">
                          {cert}
                          <button
                            type="button"
                            className="cert-remove-btn"
                            onClick={() => {
                              setRequiredCertifications(requiredCertifications.filter((_, i) => i !== idx));
                            }}
                            title="제거"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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

        {/* 평가 가중치 설정 */}
        <div className="scoring-weights-section">
          <h3 className="scoring-weights-header">평가 가중치 설정</h3>
          <p className="field-hint">각 평가 항목의 비중을 설정하세요. 비중에 따라 최종 점수가 계산됩니다.</p>
          
          {/* 비중 시각화 파이 */}
          <div className="weight-summary-bar">
            {(() => {
              const totalWeight = scoringWeights.career + scoringWeights.requirements + scoringWeights.preferred + scoringWeights.certifications;
              if (totalWeight === 0) {
                return <div className="weight-bar-empty">비중을 설정해주세요</div>;
              }
              
              const careerPercent = (scoringWeights.career / totalWeight) * 100;
              const requirementsPercent = (scoringWeights.requirements / totalWeight) * 100;
              const preferredPercent = (scoringWeights.preferred / totalWeight) * 100;
              const certsPercent = (scoringWeights.certifications / totalWeight) * 100;
              
              return (
                <>
                  {careerPercent > 0 && (
                    <div 
                      className="weight-bar-segment weight-bar-career" 
                      style={{ width: `${careerPercent}%` }}
                    >
                      <span className="weight-bar-label">{careerPercent.toFixed(1)}%</span>
                    </div>
                  )}
                  {requirementsPercent > 0 && (
                    <div 
                      className="weight-bar-segment weight-bar-requirements" 
                      style={{ width: `${requirementsPercent}%` }}
                    >
                      <span className="weight-bar-label">{requirementsPercent.toFixed(1)}%</span>
                    </div>
                  )}
                  {preferredPercent > 0 && (
                    <div 
                      className="weight-bar-segment weight-bar-preferred" 
                      style={{ width: `${preferredPercent}%` }}
                    >
                      <span className="weight-bar-label">{preferredPercent.toFixed(1)}%</span>
                    </div>
                  )}
                  {certsPercent > 0 && (
                    <div 
                      className="weight-bar-segment weight-bar-cert" 
                      style={{ width: `${certsPercent}%` }}
                    >
                      <span className="weight-bar-label">{certsPercent.toFixed(1)}%</span>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
          
          <div className="scoring-weights">
            <div className="weight-item">
              <label htmlFor="weight-career">경력</label>
              <input
                id="weight-career"
                type="number"
                min="0"
                step="0.1"
                value={scoringWeights.career}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setScoringWeights(prev => ({
                    ...prev,
                    career: val,
                  }));
                }}
                className="weight-input"
              />
              <span className="weight-desc">경력 적합도 점수 비중</span>
            </div>
            <div className="weight-item">
              <label htmlFor="weight-requirements">요구사항</label>
              <input
                id="weight-requirements"
                type="number"
                min="0"
                step="0.1"
                value={scoringWeights.requirements}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setScoringWeights(prev => ({
                    ...prev,
                    requirements: val,
                  }));
                }}
                className="weight-input"
                disabled={!requiredQualifications.trim()}
              />
              <span className="weight-desc">필수 요구사항 매칭 점수 비중</span>
            </div>
            <div className="weight-item">
              <label htmlFor="weight-preferred">우대사항</label>
              <input
                id="weight-preferred"
                type="number"
                min="0"
                step="0.1"
                value={scoringWeights.preferred}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setScoringWeights(prev => ({
                    ...prev,
                    preferred: val,
                  }));
                }}
                className="weight-input"
                disabled={!preferredQualifications.trim()}
              />
              <span className="weight-desc">우대 사항 매칭 점수 비중</span>
            </div>
            <div className="weight-item">
              <label htmlFor="weight-cert">자격증</label>
              <input
                id="weight-cert"
                type="number"
                min="0"
                step="0.1"
                value={scoringWeights.certifications}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setScoringWeights(prev => ({
                    ...prev,
                    certifications: val,
                  }));
                }}
                className="weight-input"
                disabled={requiredCertifications.length === 0}
              />
              <span className="weight-desc">자격증 매칭 점수 비중</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
