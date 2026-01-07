import { useState, useRef, useEffect } from 'react';
// career-fit-scoring 모듈 import
import { searchJobs, getJobDetail, searchCertifications } from 'career-fit-scoring';
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

interface CareerNetJob {
  job: string;
  jobdicSeq: string;
  aptd_type_code?: string;
  summary?: string;
  similarJob?: string;
  displayName?: string;
}

interface JobConfigFormProps {
  validationErrors?: {
    folder?: boolean;
    job?: boolean;
  };
  setValidationErrors?: (errors: { folder?: boolean; job?: boolean }) => void;
  selectedFolder?: string;
  onFolderChange?: (folderPath: string) => void;
  onExecute?: () => void;
}

export default function JobConfigForm({ 
  validationErrors = {}, 
  setValidationErrors,
  selectedFolder: propSelectedFolder,
  onFolderChange,
  onExecute 
}: JobConfigFormProps) {
  const [selectedFolder, setSelectedFolder] = useState<string>(propSelectedFolder || '');
  const [jobSearchQuery, setJobSearchQuery] = useState('');
  const [jobSearchResults, setJobSearchResults] = useState<CareerNetJob[]>([]);
  const [showJobDropdown, setShowJobDropdown] = useState(false);
  const [selectedJob, setSelectedJob] = useState<CareerNetJob | null>(null);
  const [loadingJobDetail, setLoadingJobDetail] = useState(false);
  const [loadingAllJobs, setLoadingAllJobs] = useState(false);
  
  const allJobsCacheRef = useRef<CareerNetJob[] | null>(null);
  
  const [certSearchQuery, setCertSearchQuery] = useState('');
  const [certSearchResults, setCertSearchResults] = useState<Array<{ name: string; code?: string }>>([]);
  const [showCertDropdown, setShowCertDropdown] = useState(false);
  const [loadingCerts, setLoadingCerts] = useState(false);
  
  const allCertsCacheRef = useRef<Array<{ name: string; code?: string }> | null>(null);
  
  const [requiredCertifications, setRequiredCertifications] = useState<string[]>([]);
  const [relatedCertifications, setRelatedCertifications] = useState<string[]>([]);
  
  const [scoringWeights, setScoringWeights] = useState({
    certification: 1,
    career: 1,
    education: 1,
  });

  // 전체 job 데이터 로드
  const loadAllJobs = async (): Promise<CareerNetJob[]> => {
    if (allJobsCacheRef.current) {
      return allJobsCacheRef.current;
    }

    if (loadingAllJobs) {
      return [];
    }

    setLoadingAllJobs(true);
    try {
      const apiKey = '83ae558eb34c7d75e2bde972db504fd5';
      const url = `https://www.career.go.kr/cnet/openapi/getOpenApi?apiKey=${apiKey}&svcType=api&svcCode=JOB&contentType=json&thisPage=1&perPage=9999`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      const allJobs: CareerNetJob[] = [];
      const jobNamesSet = new Set<string>();
      
      if (data.dataSearch?.content) {
        const contentList = Array.isArray(data.dataSearch.content) 
          ? data.dataSearch.content 
          : [data.dataSearch.content];
        
        contentList.forEach((item: any) => {
          const job = item.job?.trim();
          const jobdicSeq = item.jobdicSeq?.trim();
          const aptd_type_code = item.aptd_type_code?.trim();
          const summary = item.summary?.trim();
          const similarJob = item.similarJob?.trim();
          
          if (job && jobdicSeq) {
            const jobKey = `${jobdicSeq}`;
            if (!jobNamesSet.has(jobKey)) {
              allJobs.push({
                job,
                jobdicSeq,
                aptd_type_code,
                summary,
                similarJob,
                displayName: job,
              });
              jobNamesSet.add(jobKey);
            }
          }
        });
      }
      
      allJobsCacheRef.current = allJobs;
      setLoadingAllJobs(false);
      return allJobs;
    } catch (error) {
      console.error('[Load All Jobs] Failed:', error);
      setLoadingAllJobs(false);
      return [];
    }
  };

  // 직종 검색
  const handleJobSearch = async (query: string) => {
    if (!query || query.length < 1) {
      setJobSearchResults([]);
      setShowJobDropdown(false);
      return;
    }

    try {
      const queryLower = query.toLowerCase().trim();
      const allJobs = await loadAllJobs();
      
      if (allJobs.length === 0) {
        setJobSearchResults([]);
        setShowJobDropdown(false);
        return;
      }
      
      const finalResults: CareerNetJob[] = [];
      const finalJobSet = new Set<string>();
      
      allJobs.forEach(job => {
        const jobLower = job.job.toLowerCase().trim();
        const jobMatches = jobLower.includes(queryLower) || queryLower.includes(jobLower) || jobLower === queryLower;
        
        let similarJobs: string[] = [];
        if (job.similarJob) {
          similarJobs = String(job.similarJob)
            .split(/,\s*/)
            .map(s => s.trim())
            .filter(s => s.length > 0);
        }
        
        const hasMatchingSimilarJob = similarJobs.some(simJob => {
          const simJobLower = simJob.toLowerCase().trim();
          return simJobLower.includes(queryLower) || queryLower.includes(simJobLower) || simJobLower === queryLower;
        });
        
        if (jobMatches || hasMatchingSimilarJob) {
          const jobKey = `${job.jobdicSeq}`;
          if (!finalJobSet.has(jobKey)) {
            finalResults.push(job);
            finalJobSet.add(jobKey);
          }
        }
      });
      
      const resultJobs = finalResults.slice(0, 30);
      setJobSearchResults(resultJobs);
      setShowJobDropdown(resultJobs.length > 0);
    } catch (error) {
      console.error('Failed to search jobs:', error);
      setJobSearchResults([]);
      setShowJobDropdown(false);
    }
  };

  // 직종 상세 정보 가져오기
  const fetchJobDetail = async (jobdicSeq: string) => {
    setLoadingJobDetail(true);
    try {
      const certifications: string[] = [];
      
      const apiKey = '83ae558eb34c7d75e2bde972db504fd5';
      const url = `https://www.career.go.kr/cnet/openapi/getOpenApi?apiKey=${apiKey}&svcType=api&svcCode=JOB_VIEW&jobdicSeq=${jobdicSeq}`;
      
      const response = await fetch(url);
      const responseText = await response.text();
      
      if (responseText.trim().startsWith('<')) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(responseText, 'text/xml');
        
        const content = xmlDoc.querySelector('dataSearch content');
        if (content) {
          const capacityMajor = content.querySelector('capacity_major');
          if (capacityMajor) {
            const contentElements = capacityMajor.querySelectorAll('content');
            contentElements.forEach(contentEl => {
              const capacity = contentEl.querySelector('capacity');
              if (capacity && capacity.textContent) {
                const capacityText = capacity.textContent.trim();
                if (capacityText) {
                  const certList = capacityText.split(',').map(cert => cert.trim()).filter(cert => cert.length > 0);
                  certList.forEach(cert => {
                    certifications.push(cert);
                  });
                }
              }
            });
          }
        }
      } else {
        try {
          const data = JSON.parse(responseText);
          const content = data.dataSearch?.content;
          if (content?.capacity_major?.content) {
            const contentList = Array.isArray(content.capacity_major.content)
              ? content.capacity_major.content
              : [content.capacity_major.content];
            
            contentList.forEach((contentItem: any) => {
              if (contentItem?.capacity) {
                const capacityText = typeof contentItem.capacity === 'string' 
                  ? contentItem.capacity 
                  : contentItem.capacity.text || contentItem.capacity.name || '';
                
                if (capacityText && capacityText.trim()) {
                  const certList = capacityText.split(',').map((cert: string) => cert.trim()).filter((cert: string) => cert.length > 0);
                  certList.forEach((cert: string) => {
                    certifications.push(cert);
                  });
                }
              }
            });
          }
        } catch (jsonError) {
          console.error('[Job Detail] JSON parse error:', jsonError);
        }
      }
      
      setRelatedCertifications(certifications);
    } catch (error) {
      console.error('Failed to fetch job detail:', error);
    } finally {
      setLoadingJobDetail(false);
    }
  };

  // 직종 선택
  const handleJobSelect = (job: CareerNetJob) => {
    setSelectedJob(job);
    setJobSearchQuery('');
    setShowJobDropdown(false);
    setRelatedCertifications([]);
    fetchJobDetail(job.jobdicSeq);
    // 에러 상태 제거
    if (setValidationErrors && validationErrors.job) {
      setValidationErrors({ ...validationErrors, job: false });
    }
  };

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
    if (certName.trim() && !requiredCertifications.includes(certName.trim())) {
      setRequiredCertifications([...requiredCertifications, certName.trim()]);
    }
    setCertSearchQuery('');
    setShowCertDropdown(false);
  };

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

  // 초기 로드
  useEffect(() => {
    loadAllCertifications();
  }, []);

  // 검색어 하이라이트
  const highlightText = (text: string, query: string) => {
    if (!query || !text) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) => 
      regex.test(part) ? (
        <span key={i} className="search-highlight">{part}</span>
      ) : part
    );
  };

  // 비중 계산
  const totalWeight = scoringWeights.certification + scoringWeights.career + scoringWeights.education;
  const certPercent = totalWeight > 0 ? (scoringWeights.certification / totalWeight) * 100 : 0;
  const careerPercent = totalWeight > 0 ? (scoringWeights.career / totalWeight) * 100 : 0;
  const eduPercent = totalWeight > 0 ? (scoringWeights.education / totalWeight) * 100 : 0;

  // 필수 입력 검증 및 실행
  const handleExecuteClick = () => {
    const errors: { folder?: boolean; job?: boolean } = {};
    let hasError = false;

    // 이력서 폴더 검증
    if (!selectedFolder || selectedFolder.trim() === '') {
      errors.folder = true;
      hasError = true;
    }

    // 채용 직종 검증
    if (!selectedJob) {
      errors.job = true;
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
      } else if (errors.job) {
        const jobElement = document.querySelector('.job-search-wrapper, .selected-job-display');
        if (jobElement) {
          jobElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      return;
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
  }, [selectedFolder, selectedJob, validationErrors, onExecute]);

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

        {/* 채용 직종 선택 */}
        <div className={`form-group ${validationErrors.job ? 'error' : ''}`}>
          <label className="form-label">채용 직종 *</label>
          <p className="field-hint">직종을 선택하면 관련 자격증이 자동으로 불러와집니다.</p>
          
          {selectedJob && (
            <>
              <div className="selected-job-display">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
                  <span className="selected-job-name">{selectedJob.displayName || selectedJob.job}</span>
                  {selectedJob.summary && (
                    <span className="selected-job-summary">{selectedJob.summary}</span>
                  )}
                </div>
                <button
                  type="button"
                  className="selected-job-remove"
                  onClick={() => {
                    setSelectedJob(null);
                    setJobSearchQuery('');
                    setRelatedCertifications([]);
                  }}
                  title="직종 선택 해제"
                >
                  ×
                </button>
              </div>
              {relatedCertifications.length > 0 && (
                <div className="related-certs-under-job">
                  <label className="form-label">관련 자격증 목록</label>
                  <div className="certification-list">
                    {relatedCertifications.map((cert, idx) => (
                      <div key={idx} className="certification-tag">
                        {cert}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          
          {!selectedJob && (
            <div className={`job-search-wrapper ${validationErrors.job ? 'error' : ''}`}>
              <input
                type="text"
                className="job-search-input"
                placeholder="직업명을 입력하세요 (예: 소프트웨어 개발자, 회계사)"
                value={jobSearchQuery}
                onChange={(e) => {
                  setJobSearchQuery(e.target.value);
                  handleJobSearch(e.target.value);
                  setShowJobDropdown(true);
                }}
                onFocus={() => {
                  if (jobSearchQuery.length >= 1) {
                    setShowJobDropdown(true);
                  }
                }}
                onBlur={() => {
                  setTimeout(() => setShowJobDropdown(false), 200);
                }}
              />
              {showJobDropdown && jobSearchResults.length > 0 && (
                <div className="job-search-dropdown">
                  {jobSearchResults.map((job, idx) => {
                    const similarJobs: string[] = job.similarJob
                      ? String(job.similarJob)
                          .split(/,\s*/)
                          .map(s => s.trim())
                          .filter(s => s.length > 0)
                      : [];
                    
                    return (
                      <button
                        key={`${job.jobdicSeq}-${idx}`}
                        type="button"
                        className="job-search-item"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleJobSelect(job);
                        }}
                      >
                        <div className="job-search-name">
                          {highlightText(job.job, jobSearchQuery)}
                        </div>
                        {similarJobs.length > 0 && (
                          <div className="job-search-similar">
                            {similarJobs.map((simJob, simIdx) => (
                              <span key={simIdx} className="similar-job-tag">
                                {highlightText(simJob, jobSearchQuery)}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              {loadingAllJobs && (
                <div className="loading-indicator">전체 직업 데이터를 불러오는 중...</div>
              )}
              {loadingJobDetail && (
                <div className="loading-indicator">관련 자격증 정보를 불러오는 중...</div>
              )}
            </div>
          )}
        </div>

        {/* 필수 자격증 추가 */}
        <div className="form-group">
          <label className="form-label">필수 자격증 추가</label>
          <p className="field-hint">
            자격증을 검색하여 필수 자격증으로 추가할 수 있습니다.
          </p>
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
              <label className="form-label">추가된 필수 자격증</label>
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

        {/* 평가 점수 비중 설정 */}
        <div className="form-group">
          <label className="form-label">평가 점수 비중 설정</label>
          <p className="field-hint">
            각 평가 항목의 비중을 설정하세요. 비중에 따라 최종 점수가 계산됩니다.
          </p>
          
          {/* 비중 시각화 바 */}
          {totalWeight > 0 ? (
            <div className="weight-summary-bar">
              {certPercent > 0 && (
                <div 
                  className="weight-bar-segment weight-bar-cert" 
                  style={{ width: `${certPercent}%` }}
                >
                  <span className="weight-bar-label">{certPercent.toFixed(1)}%</span>
                </div>
              )}
              {careerPercent > 0 && (
                <div 
                  className="weight-bar-segment weight-bar-career" 
                  style={{ width: `${careerPercent}%` }}
                >
                  <span className="weight-bar-label">{careerPercent.toFixed(1)}%</span>
                </div>
              )}
              {eduPercent > 0 && (
                <div 
                  className="weight-bar-segment weight-bar-edu" 
                  style={{ width: `${eduPercent}%` }}
                >
                  <span className="weight-bar-label">{eduPercent.toFixed(1)}%</span>
                </div>
              )}
            </div>
          ) : (
            <div className="weight-summary-bar">
              <div className="weight-bar-empty">비중을 설정해주세요</div>
            </div>
          )}
          
          <div className="scoring-weights">
            <div className="weight-item">
              <label htmlFor="weight-cert">자격증</label>
              <input
                id="weight-cert"
                type="number"
                min="0"
                step="0.1"
                value={scoringWeights.certification}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setScoringWeights(prev => ({
                    ...prev,
                    certification: val,
                  }));
                }}
                className="weight-input"
              />
              <span className="weight-desc">자격증 매칭 점수 비중</span>
            </div>
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
              <span className="weight-desc">경력 점수 비중</span>
            </div>
            <div className="weight-item">
              <label htmlFor="weight-edu">학력</label>
              <input
                id="weight-edu"
                type="number"
                min="0"
                step="0.1"
                value={scoringWeights.education}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setScoringWeights(prev => ({
                    ...prev,
                    education: val,
                  }));
                }}
                className="weight-input"
              />
              <span className="weight-desc">학력 점수 비중</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
