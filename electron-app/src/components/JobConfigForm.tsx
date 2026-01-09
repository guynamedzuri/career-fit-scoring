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
      // Electron 환경에서는 IPC를 통해 호출 (백업 기능 포함)
      if (window.electron?.careernetSearchJobs) {
        const jobs = await window.electron.careernetSearchJobs();
        const allJobs: CareerNetJob[] = [];
        const jobNamesSet = new Set<string>();
        
        jobs.forEach((item: any) => {
          const jobKey = `${item.jobdicSeq}`;
          if (!jobNamesSet.has(jobKey)) {
            allJobs.push({
              job: item.job,
              jobdicSeq: item.jobdicSeq,
              aptd_type_code: item.aptd_type_code,
              summary: item.summary,
              profession: item.profession,
              similarJob: item.similarJob,
              displayName: item.job,
            });
            jobNamesSet.add(jobKey);
          }
        });
        
        allJobsCacheRef.current = allJobs;
        setLoadingAllJobs(false);
        return allJobs;
      }
      
      // Electron이 아닌 환경에서는 직접 fetch (백업 없음)
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
      
      // Electron 환경에서는 IPC를 통해 호출
      if (window.electron?.careernetGetJobDetail) {
        const data = await window.electron.careernetGetJobDetail(jobdicSeq);
        
        console.log('[Job Detail] IPC Response:', JSON.stringify(data, null, 2));
        
        if (data) {
          // IPC 핸들러가 반환하는 구조: { capacity_major: { content: [{ capacity: '...' }, ...] } }
          if (data.capacity_major) {
            const capacityMajor = data.capacity_major;
            
            // content 배열이 있는 경우 (IPC 핸들러가 XML을 파싱한 경우)
            if (capacityMajor.content && Array.isArray(capacityMajor.content)) {
              capacityMajor.content.forEach((item: any) => {
                if (item.capacity) {
                  const capacityText = typeof item.capacity === 'string' ? item.capacity : item.capacity.toString();
                  const certList = capacityText.split(',').map((cert: string) => cert.trim()).filter((cert: string) => cert.length > 0);
                  certList.forEach((cert: string) => {
                    certifications.push(cert);
                  });
                }
              });
            }
            // content가 배열인 경우 (직접 배열로 반환된 경우)
            else if (Array.isArray(capacityMajor.content)) {
              capacityMajor.content.forEach((item: any) => {
                if (item.capacity) {
                  const capacityText = typeof item.capacity === 'string' ? item.capacity : item.capacity.toString();
                  const certList = capacityText.split(',').map((cert: string) => cert.trim()).filter((cert: string) => cert.length > 0);
                  certList.forEach((cert: string) => {
                    certifications.push(cert);
                  });
                }
              });
            }
            // capacityMajor가 직접 배열인 경우
            else if (Array.isArray(capacityMajor)) {
              capacityMajor.forEach((item: any) => {
                if (item.capacity) {
                  const capacityText = typeof item.capacity === 'string' ? item.capacity : item.capacity.toString();
                  const certList = capacityText.split(',').map((cert: string) => cert.trim()).filter((cert: string) => cert.length > 0);
                  certList.forEach((cert: string) => {
                    certifications.push(cert);
                  });
                }
              });
            }
            // 단일 capacity 객체인 경우
            else if (capacityMajor.capacity) {
              const capacityText = typeof capacityMajor.capacity === 'string' ? capacityMajor.capacity : capacityMajor.capacity.toString();
              const certList = capacityText.split(',').map((cert: string) => cert.trim()).filter((cert: string) => cert.length > 0);
              certList.forEach((cert: string) => {
                certifications.push(cert);
              });
            }
          }
          
          console.log('[Job Detail] Extracted certifications:', certifications);
        }
      } else {
        // Electron이 아닌 환경에서는 직접 fetch
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
      }
      
      console.log('[Job Detail] Final certifications array:', certifications);
      setRelatedCertifications(certifications);
    } catch (error) {
      console.error('Failed to fetch job detail:', error);
      setRelatedCertifications([]);
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

  // userPrompt 변경 시 상위 컴포넌트에 전달
  useEffect(() => {
    if (onUserPromptChange) {
      onUserPromptChange(userPrompt);
    }
  }, [userPrompt, onUserPromptChange]);

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
