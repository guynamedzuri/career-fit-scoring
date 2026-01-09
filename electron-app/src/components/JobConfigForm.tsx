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
  loadedData?: any;
}

export default function JobConfigForm({ 
  validationErrors = {}, 
  setValidationErrors, 
  selectedFolder: propSelectedFolder,
  onFolderChange, 
  onUserPromptChange, 
  onExecute,
  loadedData
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
  
  // 활성화 상태 추적용 ref
  const prevActiveStateRef = useRef({
    requirements: false,
    preferred: false,
    certifications: false,
  });

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

  // 불러온 데이터 적용
  useEffect(() => {
    if (loadedData?.userPrompt) {
      const prompt = loadedData.userPrompt;
      setJobDescription(prompt.jobDescription || '');
      setRequiredQualifications(prompt.requiredQualifications || '');
      setPreferredQualifications(prompt.preferredQualifications || '');
      setRequiredCertifications(prompt.requiredCertifications || []);
      setGradeCriteria(prompt.gradeCriteria || { 최상: '', 상: '', 중: '', 하: '', 최하: '' });
      setScoringWeights(prompt.scoringWeights || { career: 1, requirements: 1, preferred: 1, certifications: 1 });
    }
    if (loadedData?.selectedFolder) {
      setSelectedFolder(loadedData.selectedFolder);
      if (onFolderChange) {
        onFolderChange(loadedData.selectedFolder);
      }
    }
  }, [loadedData, onFolderChange]);

  // 가중치 계산 및 자동 조정
  useEffect(() => {
    const trimmedRequired = requiredQualifications.trim();
    const trimmedPreferred = preferredQualifications.trim();
    const hasCerts = requiredCertifications.length > 0;

    // 현재 활성화 상태
    const currentActive = {
      requirements: trimmedRequired.length > 0,
      preferred: trimmedPreferred.length > 0,
      certifications: hasCerts,
    };

    // 새로 활성화된 항목 확인
    const newlyActivated = {
      requirements: !prevActiveStateRef.current.requirements && currentActive.requirements,
      preferred: !prevActiveStateRef.current.preferred && currentActive.preferred,
      certifications: !prevActiveStateRef.current.certifications && currentActive.certifications,
    };

    // 새로 비활성화된 항목 확인
    const newlyDeactivated = {
      requirements: prevActiveStateRef.current.requirements && !currentActive.requirements,
      preferred: prevActiveStateRef.current.preferred && !currentActive.preferred,
      certifications: prevActiveStateRef.current.certifications && !currentActive.certifications,
    };

    // 활성화된 항목 수 계산
    const activeCount = 1 + // career는 항상 활성화
      (currentActive.requirements ? 1 : 0) +
      (currentActive.preferred ? 1 : 0) +
      (currentActive.certifications ? 1 : 0);

    let newWeights = { ...scoringWeights };

    // 새로 활성화된 항목이 있는 경우
    if (newlyActivated.requirements || newlyActivated.preferred || newlyActivated.certifications) {
      // 기존 활성화된 항목들의 합 계산
      const existingActiveSum = scoringWeights.career +
        (prevActiveStateRef.current.requirements ? scoringWeights.requirements : 0) +
        (prevActiveStateRef.current.preferred ? scoringWeights.preferred : 0) +
        (prevActiveStateRef.current.certifications ? scoringWeights.certifications : 0);

      // 기존 항목들의 비율을 (n-1)/n로 조정
      const ratio = (activeCount - 1) / activeCount;
      
      if (existingActiveSum > 0) {
        newWeights.career = scoringWeights.career * ratio;
        if (prevActiveStateRef.current.requirements) {
          newWeights.requirements = scoringWeights.requirements * ratio;
        }
        if (prevActiveStateRef.current.preferred) {
          newWeights.preferred = scoringWeights.preferred * ratio;
        }
        if (prevActiveStateRef.current.certifications) {
          newWeights.certifications = scoringWeights.certifications * ratio;
        }
      } else {
        // 기존 활성화된 항목이 없었던 경우 (처음 활성화)
        newWeights.career = 1 / activeCount;
      }

      // 새로 활성화된 항목에 1/n 할당
      const newItemWeight = existingActiveSum > 0 
        ? (existingActiveSum / activeCount) 
        : (1 / activeCount);

      if (newlyActivated.requirements) {
        newWeights.requirements = newItemWeight;
      }
      if (newlyActivated.preferred) {
        newWeights.preferred = newItemWeight;
      }
      if (newlyActivated.certifications) {
        newWeights.certifications = newItemWeight;
      }
    }

    // 새로 비활성화된 항목이 있는 경우
    if (newlyDeactivated.requirements || newlyDeactivated.preferred || newlyDeactivated.certifications) {
      // 비활성화된 항목의 가중치를 0으로 설정
      if (newlyDeactivated.requirements) {
        newWeights.requirements = 0;
      }
      if (newlyDeactivated.preferred) {
        newWeights.preferred = 0;
      }
      if (newlyDeactivated.certifications) {
        newWeights.certifications = 0;
      }

      // 남은 활성화된 항목들의 합 계산
      const remainingActiveSum = newWeights.career +
        (currentActive.requirements ? newWeights.requirements : 0) +
        (currentActive.preferred ? newWeights.preferred : 0) +
        (currentActive.certifications ? newWeights.certifications : 0);

      // 비활성화된 항목의 가중치를 나머지 항목들에 비례 분배
      if (remainingActiveSum > 0 && activeCount > 0) {
        const totalSum = newWeights.career + newWeights.requirements + newWeights.preferred + newWeights.certifications;
        const ratio = totalSum / remainingActiveSum;

        newWeights.career = newWeights.career * ratio;
        if (currentActive.requirements) {
          newWeights.requirements = newWeights.requirements * ratio;
        }
        if (currentActive.preferred) {
          newWeights.preferred = newWeights.preferred * ratio;
        }
        if (currentActive.certifications) {
          newWeights.certifications = newWeights.certifications * ratio;
        }
      }
    }

    // 비활성화된 항목의 가중치를 0으로 설정 (안전장치)
    if (!currentActive.requirements) {
      newWeights.requirements = 0;
    }
    if (!currentActive.preferred) {
      newWeights.preferred = 0;
    }
    if (!currentActive.certifications) {
      newWeights.certifications = 0;
    }

    // 상태 업데이트 (무한 루프 방지를 위해 값이 실제로 변경되었을 때만)
    const hasChanged = 
      Math.abs(newWeights.career - scoringWeights.career) > 0.001 ||
      Math.abs(newWeights.requirements - scoringWeights.requirements) > 0.001 ||
      Math.abs(newWeights.preferred - scoringWeights.preferred) > 0.001 ||
      Math.abs(newWeights.certifications - scoringWeights.certifications) > 0.001;

    if (hasChanged) {
      setScoringWeights(newWeights);
    }

    // 현재 활성화 상태를 이전 상태로 저장
    prevActiveStateRef.current = currentActive;
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
                              placeholder="예: 일반프레스 (40~80톤) 설비 양산 운영 경험, 금형셋업 및 타발 업무, 자주검사 및 포장, 룸램프, RY TERMINAL, AMATEUR 터미널, F CONTACTOR ASSY 등 양산 경험 보유"
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

        {/* 평가 가중치 설정 */}
        <div className="scoring-weights-section">
          <h3 className="scoring-weights-header">평가 가중치 설정</h3>
          <p className="field-hint">슬라이더를 드래그하여 각 평가 항목의 비중을 조절하세요. (1% 단위)</p>
          
          {/* 비중 시각화 바 with 슬라이더 */}
          <div className="weight-bar-container">
            {(() => {
              const totalWeight = scoringWeights.career + scoringWeights.requirements + scoringWeights.preferred + scoringWeights.certifications;
              if (totalWeight === 0) {
                return <div className="weight-bar-empty">비중을 설정해주세요</div>;
              }
              
              const careerPercent = (scoringWeights.career / totalWeight) * 100;
              const requirementsPercent = (scoringWeights.requirements / totalWeight) * 100;
              const preferredPercent = (scoringWeights.preferred / totalWeight) * 100;
              const certsPercent = (scoringWeights.certifications / totalWeight) * 100;
              
              const hasRequirements = requiredQualifications.trim().length > 0;
              const hasPreferred = preferredQualifications.trim().length > 0;
              const hasCerts = requiredCertifications.length > 0;
              
              // 각 구간의 시작 위치 계산
              let careerStart = 0;
              let requirementsStart = careerPercent;
              let preferredStart = careerPercent + (hasRequirements ? requirementsPercent : 0);
              let certsStart = careerPercent + (hasRequirements ? requirementsPercent : 0) + (hasPreferred ? preferredPercent : 0);
              
              // 슬라이더 위치 계산
              const sliders: Array<{ position: number; leftSegment: string; rightSegment: string }> = [];
              
              if (hasRequirements && careerPercent > 0 && requirementsPercent > 0) {
                sliders.push({
                  position: requirementsStart,
                  leftSegment: 'career',
                  rightSegment: 'requirements',
                });
              }
              
              if (hasPreferred && (careerPercent + (hasRequirements ? requirementsPercent : 0)) > 0 && preferredPercent > 0) {
                sliders.push({
                  position: preferredStart,
                  leftSegment: hasRequirements ? 'requirements' : 'career',
                  rightSegment: 'preferred',
                });
              }
              
              if (hasCerts && (careerPercent + (hasRequirements ? requirementsPercent : 0) + (hasPreferred ? preferredPercent : 0)) > 0 && certsPercent > 0) {
                sliders.push({
                  position: certsStart,
                  leftSegment: hasPreferred ? 'preferred' : (hasRequirements ? 'requirements' : 'career'),
                  rightSegment: 'certifications',
                });
              }
              
              return (
                <div className="weight-bar-wrapper">
                  <div className="weight-summary-bar">
                    {careerPercent > 0 && (
                      <div 
                        className="weight-bar-segment weight-bar-career" 
                        style={{ width: `${careerPercent}%` }}
                      >
                        <span className="weight-bar-label">{Math.round(careerPercent)}%</span>
                      </div>
                    )}
                    {hasRequirements && requirementsPercent > 0 && (
                      <div 
                        className="weight-bar-segment weight-bar-requirements" 
                        style={{ width: `${requirementsPercent}%` }}
                      >
                        <span className="weight-bar-label">{Math.round(requirementsPercent)}%</span>
                      </div>
                    )}
                    {hasPreferred && preferredPercent > 0 && (
                      <div 
                        className="weight-bar-segment weight-bar-preferred" 
                        style={{ width: `${preferredPercent}%` }}
                      >
                        <span className="weight-bar-label">{Math.round(preferredPercent)}%</span>
                      </div>
                    )}
                    {hasCerts && certsPercent > 0 && (
                      <div 
                        className="weight-bar-segment weight-bar-cert" 
                        style={{ width: `${certsPercent}%` }}
                      >
                        <span className="weight-bar-label">{Math.round(certsPercent)}%</span>
                      </div>
                    )}
                  </div>
                  
                  {/* 슬라이더들 */}
                  {sliders.map((slider, idx) => (
                    <div
                      key={idx}
                      className="weight-bar-slider"
                      style={{ left: `${slider.position}%` }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        const barContainer = (e.currentTarget.parentElement as HTMLElement)?.querySelector('.weight-summary-bar') as HTMLElement;
                        if (!barContainer) return;
                        
                        const startX = e.clientX;
                        const startLeft = slider.position;
                        const barRect = barContainer.getBoundingClientRect();
                        const barWidth = barRect.width;
                        
                        const handleMouseMove = (moveEvent: MouseEvent) => {
                          const deltaX = moveEvent.clientX - startX;
                          const deltaPercent = (deltaX / barWidth) * 100;
                          let newPosition = startLeft + deltaPercent;
                          
                          // 1% 단위로 반올림
                          newPosition = Math.round(newPosition);
                          
                          // 최소 1% 제한 (인접한 두 구간 각각 최소 1%)
                          const minPercent = 1;
                          const maxPercent = 100 - minPercent;
                          newPosition = Math.max(minPercent, Math.min(maxPercent, newPosition));
                          
                          // 양쪽 구간의 비율 조정
                          const leftPercent = newPosition;
                          const rightPercent = 100 - newPosition;
                          
                          // 현재 활성화된 항목들의 총합
                          const activeItems = [
                            { key: 'career', value: scoringWeights.career, enabled: true },
                            { key: 'requirements', value: scoringWeights.requirements, enabled: hasRequirements },
                            { key: 'preferred', value: scoringWeights.preferred, enabled: hasPreferred },
                            { key: 'certifications', value: scoringWeights.certifications, enabled: hasCerts },
                          ].filter(item => item.enabled);
                          
                          // 슬라이더 기준으로 왼쪽/오른쪽 항목 분류
                          const leftItems = activeItems.filter((item, i) => {
                            if (slider.leftSegment === 'career') return i === 0;
                            if (slider.leftSegment === 'requirements') return i <= 1;
                            if (slider.leftSegment === 'preferred') return i <= 2;
                            return false;
                          });
                          
                          const rightItems = activeItems.filter((item, i) => {
                            if (slider.rightSegment === 'requirements') return i === 1;
                            if (slider.rightSegment === 'preferred') return i === 2;
                            if (slider.rightSegment === 'certifications') return i === 3;
                            return false;
                          });
                          
                          // 왼쪽 항목들의 현재 합
                          const leftSum = leftItems.reduce((sum, item) => sum + item.value, 0);
                          // 오른쪽 항목들의 현재 합
                          const rightSum = rightItems.reduce((sum, item) => sum + item.value, 0);
                          const totalSum = leftSum + rightSum;
                          
                          if (totalSum === 0) return;
                          
                          // 전체 가중치 합 계산 (최소 1% 보장을 위해)
                          const totalWeight = scoringWeights.career + scoringWeights.requirements + scoringWeights.preferred + scoringWeights.certifications;
                          const minWeight = totalWeight * 0.01; // 최소 1%
                          
                          // 새로운 비율에 맞게 조정
                          const newLeftSum = (totalSum * leftPercent) / 100;
                          const newRightSum = (totalSum * rightPercent) / 100;
                          
                          // 각 항목의 비율 유지하면서 조정
                          const newWeights = { ...scoringWeights };
                          
                          if (leftSum > 0) {
                            leftItems.forEach(item => {
                              const ratio = item.value / leftSum;
                              const newValue = newLeftSum * ratio;
                              // 최소 1% 보장
                              (newWeights as any)[item.key] = Math.max(minWeight, newValue);
                            });
                          }
                          
                          if (rightSum > 0) {
                            rightItems.forEach(item => {
                              const ratio = item.value / rightSum;
                              const newValue = newRightSum * ratio;
                              // 최소 1% 보장
                              (newWeights as any)[item.key] = Math.max(minWeight, newValue);
                            });
                          }
                          
                          setScoringWeights(newWeights);
                        };
                        
                        const handleMouseUp = () => {
                          document.removeEventListener('mousemove', handleMouseMove);
                          document.removeEventListener('mouseup', handleMouseUp);
                        };
                        
                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);
                      }}
                    >
                      <div className="weight-slider-handle"></div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
          
          {/* 비중 수치 표시 */}
          <div className="weight-values-display">
            <div className="weight-value-item">
              <div className="weight-value-color-indicator weight-value-color-career"></div>
              <span className="weight-value-label">경력:</span>
              <span className="weight-value-number">{(() => {
                const total = scoringWeights.career + scoringWeights.requirements + scoringWeights.preferred + scoringWeights.certifications;
                return total > 0 ? Math.round((scoringWeights.career / total) * 100) : 0;
              })()}%</span>
            </div>
            {requiredQualifications.trim() && (
              <div className="weight-value-item">
                <div className="weight-value-color-indicator weight-value-color-requirements"></div>
                <span className="weight-value-label">요구사항:</span>
                <span className="weight-value-number">{(() => {
                  const total = scoringWeights.career + scoringWeights.requirements + scoringWeights.preferred + scoringWeights.certifications;
                  return total > 0 ? Math.round((scoringWeights.requirements / total) * 100) : 0;
                })()}%</span>
              </div>
            )}
            {preferredQualifications.trim() && (
              <div className="weight-value-item">
                <div className="weight-value-color-indicator weight-value-color-preferred"></div>
                <span className="weight-value-label">우대사항:</span>
                <span className="weight-value-number">{(() => {
                  const total = scoringWeights.career + scoringWeights.requirements + scoringWeights.preferred + scoringWeights.certifications;
                  return total > 0 ? Math.round((scoringWeights.preferred / total) * 100) : 0;
                })()}%</span>
              </div>
            )}
            {requiredCertifications.length > 0 && (
              <div className="weight-value-item">
                <div className="weight-value-color-indicator weight-value-color-cert"></div>
                <span className="weight-value-label">자격증:</span>
                <span className="weight-value-number">{(() => {
                  const total = scoringWeights.career + scoringWeights.requirements + scoringWeights.preferred + scoringWeights.certifications;
                  return total > 0 ? Math.round((scoringWeights.certifications / total) * 100) : 0;
                })()}%</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
