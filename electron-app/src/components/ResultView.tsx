import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Search, ChevronUp, ChevronDown, Download, Info, AlertCircle, CheckCircle2, Filter } from 'lucide-react';
import '../styles/result-view.css';

interface DocxFile {
  name: string;
  path: string;
}

interface ScoringResult {
  fileName: string;
  filePath: string;
  totalScore: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  candidateStatus?: 'pending' | 'review' | 'rejected'; // 후보자 상태 (대기, 검토, 탈락)
  errorMessage?: string;
  applicationData?: any;
  // 파싱된 데이터
  name?: string; // 이력서에서 추출한 이름
  age?: number; // 나이
  lastCompany?: string; // 직전 회사 이름
  lastSalary?: string; // 직전 연봉
  residence?: string; // 거주지 (서울, 수도권, 시흥, 안산, 지방)
  searchableText?: string; // 검색 가능한 전체 텍스트 (이름, 회사, 자격증 등 모든 정보)
  // AI 검사 결과
  aiGrade?: string; // AI 평가 등급 (예: 'A', 'B', 'C', 'D')
  aiReport?: string; // AI 분석 결과 보고서
  aiChecked?: boolean; // AI 검사 완료 여부
}

interface ResultViewProps {
  selectedFiles: DocxFile[];
  userPrompt?: {
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
  };
  selectedFolder: string; // 캐시를 위해 폴더 경로 필요
  onBack: () => void;
  onProcessingChange?: (processing: boolean) => void;
  jobMetadata?: any; // App.tsx에서 전달하는 jobMetadata
}

type SortField = 'name' | 'age' | 'lastCompany' | 'residence' | 'totalScore' | 'aiGrade' | 'status';
type SortOrder = 'asc' | 'desc';

export default function ResultView({ selectedFiles, userPrompt, selectedFolder, onBack, onProcessingChange, jobMetadata }: ResultViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('totalScore');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [results, setResults] = useState<ScoringResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedResult, setSelectedResult] = useState<ScoringResult | null>(null);
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set()); // 선택된 후보자 filePath Set
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showAiReportModal, setShowAiReportModal] = useState(false);
  const [currentAiReport, setCurrentAiReport] = useState<string>('');
  const [aiProcessing, setAiProcessing] = useState(false);
  const [filters, setFilters] = useState({
    minAge: '',
    maxAge: '',
    minScore: '',
    maxScore: '',
    company: '',
    status: '' as '' | 'pending' | 'processing' | 'completed' | 'error',
    residence: 3 as 0 | 1 | 2 | 3, // 0=안산, 1=시흥+안산, 2=수도권, 3=전국
  });

  // TODO: 실제로 DOCX 파일을 파싱하고 점수를 계산하는 로직 구현
  // 지금은 임시로 플레이스홀더 데이터를 표시
  // 캐시 로드 및 초기 상태 설정
  useEffect(() => {
    const loadCachedData = async () => {
      if (!selectedFolder || !window.electron?.loadCache || selectedFiles.length === 0) {
        // 캐시 로드 불가능하거나 파일이 없으면 플레이스홀더만 설정
        const placeholderResults: ScoringResult[] = selectedFiles.map(file => ({
          fileName: file.name,
          filePath: file.path,
          totalScore: 0,
          status: 'pending' as const,
          candidateStatus: 'pending' as const,
          name: undefined,
          age: undefined,
          lastCompany: undefined,
          lastSalary: undefined,
          searchableText: file.name,
        }));
        setResults(placeholderResults);
        return;
      }

      try {
        const filePaths = selectedFiles.map(f => f.path);
        const { cached, toProcess } = await window.electron.loadCache(selectedFolder, filePaths);

        const results: ScoringResult[] = selectedFiles.map(file => {
          // 캐시된 데이터가 있으면 사용
          if (cached[file.path]) {
            const cachedData = cached[file.path];
            return {
              fileName: file.name,
              filePath: file.path,
              totalScore: cachedData.totalScore || 0,
              status: 'completed' as const,
              candidateStatus: cachedData.candidateStatus || 'pending',
              name: cachedData.name,
              age: cachedData.age,
              lastCompany: cachedData.lastCompany,
              lastSalary: cachedData.lastSalary,
              residence: cachedData.residence,
              applicationData: cachedData.applicationData,
              aiGrade: cachedData.aiGrade,
              aiReport: cachedData.aiReport,
              // aiChecked가 true이지만 aiGrade나 aiReport가 없으면 재분석 필요
              aiChecked: cachedData.aiChecked && cachedData.aiGrade && cachedData.aiReport ? true : false,
              searchableText: cachedData.searchableText || file.name,
            };
          } else {
            // 캐시 없음 - 새로 처리 필요
            return {
              fileName: file.name,
              filePath: file.path,
              totalScore: 0,
              status: 'pending' as const,
              candidateStatus: 'pending' as const,
              name: undefined,
              age: undefined,
              lastCompany: undefined,
              lastSalary: undefined,
              residence: undefined,
              searchableText: file.name,
            };
          }
        });

        setResults(results);
        console.log('[Cache] Loaded', Object.keys(cached).length, 'cached entries,', toProcess.length, 'files to process');
        
        // 처리할 파일이 있으면 처리 시작
        if (toProcess.length > 0 && window.electron?.processResume) {
          // 로딩 시작
          if (onProcessingChange) {
            onProcessingChange(true);
          }
          // processResumeFiles 완료를 기다린 후 AI 분석 시작
          processResumeFiles(toProcess)
            .then(() => {
              console.log('[Process] All files processed, AI analysis will be triggered by useEffect');
            })
            .catch(err => {
              console.error('[Process] Error in processResumeFiles:', err);
              if (onProcessingChange) {
                onProcessingChange(false);
              }
            });
        } else {
          // 처리할 파일이 없고, AI 분석이 필요한 파일이 있으면 로딩 유지
          // AI 분석이 필요한지 확인
          // aiChecked가 false이거나, aiChecked가 true이지만 aiGrade나 aiReport가 없으면 재분석 필요
          const needsAiAnalysis = results.some(r => 
            r.status === 'completed' && 
            r.applicationData && 
            (!r.aiChecked || (r.aiChecked && (!r.aiGrade || !r.aiReport)))
          );
          if (!needsAiAnalysis && onProcessingChange) {
            onProcessingChange(false);
          }
        }
      } catch (error) {
        console.error('[Cache] Error loading cache:', error);
        // 에러 발생 시 플레이스홀더만 설정
        const placeholderResults: ScoringResult[] = selectedFiles.map(file => ({
          fileName: file.name,
          filePath: file.path,
          totalScore: 0,
          status: 'pending' as const,
          candidateStatus: 'pending' as const,
          name: undefined,
          age: undefined,
          lastCompany: undefined,
          lastSalary: undefined,
          searchableText: file.name,
        }));
        setResults(placeholderResults);
      }
    };

    loadCachedData();
  }, [selectedFiles, selectedFolder]);
  
  // 이력서 파일 처리 함수
  const processResumeFiles = useCallback(async (filePaths: string[]) => {
    if (!window.electron?.processResume) {
      console.error('[Process] processResume not available');
      if (onProcessingChange) {
        onProcessingChange(false);
      }
      return;
    }
    
    if (onProcessingChange) {
      onProcessingChange(true);
    }
    
    try {
      const processPromises = filePaths.map(async (filePath) => {
        const file = selectedFiles.find(f => f.path === filePath);
        if (!file) return null;
        
        // 상태를 processing으로 변경
        setResults(prevResults =>
          prevResults.map(r => 
            r.filePath === filePath ? { ...r, status: 'processing' as const } : r
          )
        );
        
        try {
          const result = await window.electron!.processResume(filePath);
          
          if (result.success) {
            // 점수 계산 (나중에 구현)
            const totalScore = 0; // TODO: 실제 점수 계산
            
            // 결과 업데이트
            setResults(prevResults =>
              prevResults.map(r => {
                if (r.filePath === filePath) {
                  return {
                    ...r,
                    status: 'completed' as const,
                    totalScore,
                    name: result.name,
                    age: result.age,
                    lastCompany: result.lastCompany,
                    lastSalary: result.lastSalary,
                    residence: result.residence,
                    applicationData: result.applicationData,
                    searchableText: result.searchableText || r.fileName,
                  };
                }
                return r;
              })
            );
            
            // 캐시에 저장
            if (window.electron?.saveCache && selectedFolder) {
              await window.electron.saveCache(selectedFolder, [{
                filePath,
                fileName: file.name,
                data: {
                  totalScore,
                  name: result.name,
                  age: result.age,
                  lastCompany: result.lastCompany,
                  lastSalary: result.lastSalary,
                  residence: result.residence,
                  applicationData: result.applicationData,
                  searchableText: result.searchableText || file.name,
                },
              }]);
            }
            
            return { filePath, success: true };
          } else {
            throw new Error(result.error || '처리 실패');
          }
        } catch (error: any) {
          console.error(`[Process] Error processing ${filePath}:`, error);
          setResults(prevResults =>
            prevResults.map(r => 
              r.filePath === filePath 
                ? { ...r, status: 'error' as const, errorMessage: error.message || '처리 실패' }
                : r
            )
          );
          return { filePath, success: false, error: error.message };
        }
      });
      
      await Promise.all(processPromises);
      
      // 모든 파일 처리 완료 후 AI 분석 시작 (결과가 업데이트된 후)
      // AI 분석은 별도 useEffect에서 자동으로 실행됨
      // 여기서는 로딩 상태를 유지하지 않음 (AI 분석이 별도로 로딩 상태 관리)
    } catch (error) {
      console.error('[Process] Overall error:', error);
      if (onProcessingChange) {
        onProcessingChange(false);
      }
    }
  }, [selectedFiles, selectedFolder, onProcessingChange]);

  // 검색 및 정렬된 결과
  const filteredAndSortedResults = useMemo(() => {
    let filtered = results;

    // 키워드 검색 필터 (이름, 파일명, 회사명, 검색 가능한 모든 텍스트에서 검색)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r => {
        // 파일명 검색
        if (r.fileName.toLowerCase().includes(query)) return true;
        // 이름 검색
        if (r.name && r.name.toLowerCase().includes(query)) return true;
        // 회사명 검색
        if (r.lastCompany && r.lastCompany.toLowerCase().includes(query)) return true;
        // 검색 가능한 전체 텍스트에서 검색
        if (r.searchableText && r.searchableText.toLowerCase().includes(query)) return true;
        return false;
      });
    }

    // 상세 필터 적용
    if (filters.minAge) {
      const minAge = parseInt(filters.minAge);
      if (!isNaN(minAge)) {
        filtered = filtered.filter(r => r.age !== undefined && r.age >= minAge);
      }
    }
    if (filters.maxAge) {
      const maxAge = parseInt(filters.maxAge);
      if (!isNaN(maxAge)) {
        filtered = filtered.filter(r => r.age !== undefined && r.age <= maxAge);
      }
    }
    if (filters.minScore) {
      const minScore = parseFloat(filters.minScore);
      if (!isNaN(minScore)) {
        filtered = filtered.filter(r => r.totalScore >= minScore);
      }
    }
    if (filters.maxScore) {
      const maxScore = parseFloat(filters.maxScore);
      if (!isNaN(maxScore)) {
        filtered = filtered.filter(r => r.totalScore <= maxScore);
      }
    }
    if (filters.company.trim()) {
      const companyQuery = filters.company.toLowerCase();
      filtered = filtered.filter(r => 
        r.lastCompany && r.lastCompany.toLowerCase().includes(companyQuery)
      );
    }
    if (filters.status) {
      filtered = filtered.filter(r => r.candidateStatus === filters.status);
    }
    
    // 거주지 필터
    if (filters.residence !== 3) {
      const allowedResidences: string[] = [];
      if (filters.residence === 0) {
        // 안산만
        allowedResidences.push('안산');
      } else if (filters.residence === 1) {
        // 시흥+안산
        allowedResidences.push('시흥', '안산');
      } else if (filters.residence === 2) {
        // 수도권 (서울, 수도권, 시흥, 안산)
        allowedResidences.push('서울', '수도권', '시흥', '안산');
      }
      filtered = filtered.filter(r => {
        if (!r.residence) return false;
        return allowedResidences.includes(r.residence);
      });
    }

    // 정렬
    filtered.sort((a, b) => {
      let compareA: any, compareB: any;

      switch (sortField) {
        case 'name':
          compareA = a.name || a.fileName;
          compareB = b.name || b.fileName;
          break;
        case 'age':
          compareA = a.age ?? 0;
          compareB = b.age ?? 0;
          break;
        case 'lastCompany':
          compareA = a.lastCompany || '';
          compareB = b.lastCompany || '';
          break;
        case 'residence':
          const residenceOrder = { '서울': 1, '수도권': 2, '시흥': 3, '안산': 4, '지방': 5 };
          compareA = residenceOrder[a.residence as keyof typeof residenceOrder] ?? 6;
          compareB = residenceOrder[b.residence as keyof typeof residenceOrder] ?? 6;
          break;
        case 'aiGrade':
          const gradeOrder = { 'A': 1, 'B': 2, 'C': 3, 'D': 4 };
          const gradeA = a.aiGrade ? (gradeOrder[a.aiGrade as keyof typeof gradeOrder] ?? 5) : 6;
          const gradeB = b.aiGrade ? (gradeOrder[b.aiGrade as keyof typeof gradeOrder] ?? 5) : 6;
          compareA = gradeA;
          compareB = gradeB;
          break;
        case 'totalScore':
          compareA = a.totalScore;
          compareB = b.totalScore;
          break;
        case 'status':
          // 후보자 상태 우선, 없으면 처리 상태
          const candidateStatusOrder = { pending: 1, review: 2, rejected: 3 };
          const processStatusOrder = { error: 0, pending: 1, processing: 2, completed: 3 };
          if (a.candidateStatus && b.candidateStatus) {
            compareA = candidateStatusOrder[a.candidateStatus] ?? 0;
            compareB = candidateStatusOrder[b.candidateStatus] ?? 0;
          } else if (a.candidateStatus) {
            compareA = candidateStatusOrder[a.candidateStatus] ?? 0;
            compareB = processStatusOrder[b.status] ?? 0;
          } else if (b.candidateStatus) {
            compareA = processStatusOrder[a.status] ?? 0;
            compareB = candidateStatusOrder[b.candidateStatus] ?? 0;
          } else {
            compareA = processStatusOrder[a.status] ?? 0;
            compareB = processStatusOrder[b.status] ?? 0;
          }
          break;
        default:
          compareA = a.totalScore;
          compareB = b.totalScore;
      }

      if (sortOrder === 'asc') {
        return compareA > compareB ? 1 : -1;
      } else {
        return compareA < compareB ? 1 : -1;
      }
    });

    return filtered;
  }, [results, searchQuery, sortField, sortOrder, filters]);

  // 정렬 토글
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // 정렬 아이콘
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  // 전체 선택/해제
  const handleSelectAll = () => {
    if (selectedCandidates.size === filteredAndSortedResults.length) {
      // 모두 선택되어 있으면 전체 해제
      setSelectedCandidates(new Set());
    } else {
      // 전체 선택
      const allPaths = new Set(filteredAndSortedResults.map(r => r.filePath));
      setSelectedCandidates(allPaths);
    }
  };

  // 개별 선택/해제
  const handleToggleCandidate = (filePath: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    const newSelected = new Set(selectedCandidates);
    if (newSelected.has(filePath)) {
      newSelected.delete(filePath);
    } else {
      newSelected.add(filePath);
    }
    setSelectedCandidates(newSelected);
  };

  // 상태 이동 모달 열기
  const handleOpenStatusModal = () => {
    if (selectedCandidates.size > 0) {
      setShowStatusModal(true);
    }
  };

  // 상태 이동 모달 닫기
  const handleCloseStatusModal = () => {
    setShowStatusModal(false);
  };

  // 상태 이동 처리
  const handleStatusChange = (newStatus: 'pending' | 'review' | 'rejected') => {
    // 실제 상태 변경: results 배열 업데이트
    setResults(prevResults => 
      prevResults.map(result => {
        if (selectedCandidates.has(result.filePath)) {
          return {
            ...result,
            candidateStatus: newStatus,
          };
        }
        return result;
      })
    );
    
    console.log('상태 변경:', Array.from(selectedCandidates), '->', newStatus);
    
    // 상태 변경 후 선택 해제
    setSelectedCandidates(new Set());
    setShowStatusModal(false);

    // 캐시에 저장
    if (window.electron?.saveCache && selectedFolder) {
      const updatedResults = results.filter(r => selectedCandidates.has(r.filePath));
      const resultsToSave = updatedResults.map(result => ({
        filePath: result.filePath,
        fileName: result.fileName,
        data: {
          totalScore: result.totalScore,
          name: result.name,
          age: result.age,
          lastCompany: result.lastCompany,
          lastSalary: result.lastSalary,
          applicationData: result.applicationData,
          aiGrade: result.aiGrade,
          aiReport: result.aiReport,
          aiChecked: result.aiChecked,
          candidateStatus: result.candidateStatus,
          searchableText: result.searchableText,
        },
      }));
      
      if (resultsToSave.length > 0) {
        window.electron.saveCache(selectedFolder, resultsToSave).catch(err => {
          console.error('[Cache] Error saving status change:', err);
        });
      }
    }
  };

  // 필터 적용
  const applyFilters = () => {
    // 필터는 filteredAndSortedResults에서 이미 적용됨
    setShowFilterModal(false);
  };

  // 필터 초기화
  const resetFilters = () => {
    setFilters({
      minAge: '',
      maxAge: '',
      minScore: '',
      maxScore: '',
      company: '',
      status: '' as '' | 'pending' | 'processing' | 'completed' | 'error',
      residence: 3 as 0 | 1 | 2 | 3, // 전국으로 초기화
    });
  };

  // AI 분석 실행 중 추적을 위한 ref
  const isAiAnalysisRunning = useRef(false);

  // 이력서 처리 완료 후 AI 분석 실행
  useEffect(() => {
    const runInitialAiAnalysis = async () => {
      // 이미 AI 분석이 진행 중이면 중복 실행 방지
      if (isAiAnalysisRunning.current || aiProcessing) {
        console.log('[AI Analysis] Already processing, skipping...');
        return;
      }
      
      if (!userPrompt || !userPrompt.jobDescription || userPrompt.jobDescription.trim() === '' || selectedFiles.length === 0 || !window.electron?.aiCheckResume) {
        console.log('[AI Analysis] Skipping - missing requirements:', {
          hasUserPrompt: !!userPrompt,
          hasJobDescription: !!(userPrompt?.jobDescription),
          hasFiles: selectedFiles.length > 0,
          hasElectron: !!window.electron?.aiCheckResume,
        });
        if (onProcessingChange) {
          onProcessingChange(false);
        }
        return;
      }

      // 이미 AI 분석이 완료된 파일이 있는지 확인
      // aiChecked가 false이거나, aiChecked가 true이지만 aiGrade나 aiReport가 없으면 재분석 필요
      const needsAnalysis = results.filter(r => 
        r.status === 'completed' && 
        r.applicationData && 
        (!r.aiChecked || (r.aiChecked && (!r.aiGrade || !r.aiReport)))
      );

      if (needsAnalysis.length === 0) {
        console.log('[AI Analysis] No files need analysis');
        if (onProcessingChange) {
          onProcessingChange(false);
        }
        return;
      }

      console.log(`[AI Analysis] Starting analysis for ${needsAnalysis.length} files:`, needsAnalysis.map(r => r.fileName));
      isAiAnalysisRunning.current = true;
      setAiProcessing(true);
      if (onProcessingChange) {
        onProcessingChange(true);
      }
      try {
        const aiPromises = needsAnalysis.map(async (result) => {
          console.log(`[AI Analysis] Processing ${result.fileName}...`);
          try {
            if (!result.applicationData) {
              console.warn(`[AI Analysis] No applicationData for ${result.fileName}`);
              return {
                filePath: result.filePath,
                aiGrade: undefined,
                aiReport: undefined,
                aiChecked: true, // 에러가 발생해도 aiChecked를 true로 설정하여 무한루프 방지
                error: '이력서 데이터가 없습니다',
              };
            }

            const response = await window.electron!.aiCheckResume({
              applicationData: result.applicationData,
              userPrompt: userPrompt,
              fileName: result.fileName,
            });

            if (response.success && response.grade && response.report) {
              return {
                filePath: result.filePath,
                aiGrade: response.grade,
                aiReport: response.report,
                aiChecked: true,
              };
            } else {
              throw new Error(response.error || 'AI 분석 실패');
            }
          } catch (error) {
            console.error(`[AI Analysis] Error for ${result.filePath}:`, error);
            return {
              filePath: result.filePath,
              aiGrade: undefined,
              aiReport: undefined,
              aiChecked: true, // 에러가 발생해도 aiChecked를 true로 설정하여 무한루프 방지
              error: error instanceof Error ? error.message : 'AI 분석 실패',
            };
          }
        });

        const aiResults = await Promise.all(aiPromises);

      // 결과를 results에 반영
      setResults(prevResults =>
        prevResults.map(result => {
          const aiResult = aiResults.find(r => r.filePath === result.filePath);
          if (aiResult) {
            const updated = {
              ...result,
              aiGrade: aiResult.aiGrade,
              aiReport: aiResult.aiReport,
              aiChecked: aiResult.aiChecked,
            };
            return updated;
          }
          return result;
        })
      );

      // 캐시에 저장
      if (window.electron?.saveCache && selectedFolder) {
        const resultsToSave = aiResults
          .filter(r => r.aiChecked)
          .map(r => {
            const result = results.find(res => res.filePath === r.filePath);
            return {
              filePath: r.filePath,
              fileName: result?.fileName || r.filePath.split(/[/\\]/).pop() || r.filePath,
              data: {
                totalScore: result?.totalScore || 0,
                name: result?.name,
                age: result?.age,
                lastCompany: result?.lastCompany,
                lastSalary: result?.lastSalary,
                applicationData: result?.applicationData,
                aiGrade: r.aiGrade,
                aiReport: r.aiReport,
                aiChecked: r.aiChecked,
                candidateStatus: result?.candidateStatus,
                searchableText: result?.searchableText,
              },
            };
          });
        
        if (resultsToSave.length > 0) {
          await window.electron.saveCache(selectedFolder, resultsToSave);
        }
      }

      } catch (error) {
        console.error('[AI Analysis] Overall error:', error);
      } finally {
        isAiAnalysisRunning.current = false;
        setAiProcessing(false);
        if (onProcessingChange) {
          onProcessingChange(false);
        }
      }
    };

    // 디바운싱: results가 빠르게 변경될 때를 대비하여 약간의 지연 후 실행
    const timeoutId = setTimeout(() => {
      runInitialAiAnalysis();
    }, 100);
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, [results, userPrompt, selectedFiles, selectedFolder, onProcessingChange]);

  // AI 보고서 모달 열기
  const handleOpenAiReport = (report: string) => {
    setCurrentAiReport(report);
    setShowAiReportModal(true);
  };

  // 전체 선택 여부 확인
  const isAllSelected = filteredAndSortedResults.length > 0 && 
    selectedCandidates.size === filteredAndSortedResults.length;

  // 상태 표시 아이콘 (후보자 상태 우선, 없으면 처리 상태)
  const StatusIcon = ({ result }: { result: ScoringResult }) => {
    // 후보자 상태가 있으면 우선 표시
    if (result.candidateStatus) {
      switch (result.candidateStatus) {
        case 'review':
          return <div className="status-icon status-review">👁</div>;
        case 'rejected':
          return <AlertCircle size={16} className="status-icon status-rejected" />;
        case 'pending':
        default:
          return <div className="status-icon status-pending">⏸</div>;
      }
    }
    
    // 후보자 상태가 없으면 처리 상태 표시
    switch (result.status) {
      case 'completed':
        return <CheckCircle2 size={16} className="status-icon status-completed" />;
      case 'error':
        return <AlertCircle size={16} className="status-icon status-error" />;
      case 'processing':
        return <div className="status-icon status-processing">⏳</div>;
      default:
        return <div className="status-icon status-pending">⏸</div>;
    }
  };

  // 상태 텍스트 (후보자 상태 우선, 없으면 처리 상태)
  const getStatusText = (result: ScoringResult) => {
    // 후보자 상태가 있으면 우선 표시
    if (result.candidateStatus) {
      switch (result.candidateStatus) {
        case 'review':
          return '검토';
        case 'rejected':
          return '탈락';
        case 'pending':
        default:
          return '대기';
      }
    }
    
    // 후보자 상태가 없으면 처리 상태 표시
    switch (result.status) {
      case 'completed':
        return '완료';
      case 'error':
        return '오류';
      case 'processing':
        return '처리중';
      default:
        return '대기';
    }
  };

  return (
    <div className="result-view">
      {/* 뒤로가기 버튼 row */}
      <div className="result-view-back-row">
        <button className="back-btn" onClick={onBack}>
          ← 뒤로가기
        </button>
      </div>

      {/* 헤더 */}
      <div className="result-view-header">
        <div className="job-info-summary">
          <span className="job-info-label">대상:</span>
          <span className="job-info-value">{selectedFiles.length}명</span>
        </div>
      </div>

      {/* 검색 + 필터 + 상태 이동 */}
      <div className="candidate-search-row">
        <div className="candidate-search">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="이름, 회사명, 키워드 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <button
            className="filter-btn"
            onClick={() => setShowFilterModal(true)}
            title="상세 필터"
          >
            <Filter size={16} />
          </button>
        </div>
        <button 
          className="status-move-btn"
          onClick={handleOpenStatusModal}
          disabled={selectedCandidates.size === 0}
          title="선택된 후보자 상태 이동"
        >
          상태 이동
        </button>
      </div>

      {/* 테이블 컨테이너 (헤더 + 리스트 함께 스크롤) */}
      <div className="candidate-table-container">
        {/* 테이블 헤더 */}
        <div className="candidate-table-header">
          <div className="table-cell cell-checkbox">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={handleSelectAll}
              className="header-checkbox"
              title="전체 선택/해제"
            />
          </div>
          <div className="table-cell cell-status">
            <div 
              className={`sortable ${sortField === 'status' ? 'active' : ''}`}
              onClick={() => handleSort('status')}
            >
              상태 <SortIcon field="status" />
            </div>
          </div>
          <div className="table-cell cell-name">
            <div 
              className={`sortable ${sortField === 'name' ? 'active' : ''}`}
              onClick={() => handleSort('name')}
            >
              이름 <SortIcon field="name" />
            </div>
          </div>
          <div className="table-cell cell-age">
            <div 
              className={`sortable ${sortField === 'age' ? 'active' : ''}`}
              onClick={() => handleSort('age')}
            >
              나이 <SortIcon field="age" />
            </div>
          </div>
        <div className="table-cell cell-company">
          <div 
            className={`sortable ${sortField === 'lastCompany' ? 'active' : ''}`}
            onClick={() => handleSort('lastCompany')}
          >
            직전 회사 <SortIcon field="lastCompany" />
          </div>
        </div>
        <div className="table-cell cell-residence">
          <div 
            className={`sortable ${sortField === 'residence' ? 'active' : ''}`}
            onClick={() => handleSort('residence')}
          >
            거주지 <SortIcon field="residence" />
          </div>
        </div>
        <div className="table-cell cell-score">
            <div 
              className={`sortable ${sortField === 'totalScore' ? 'active' : ''}`}
              onClick={() => handleSort('totalScore')}
            >
              총점수 <SortIcon field="totalScore" />
            </div>
          </div>
          <div className="table-cell cell-ai-grade">
            <div 
              className={`sortable ${sortField === 'aiGrade' ? 'active' : ''}`}
              onClick={() => handleSort('aiGrade')}
            >
              AI 평가 <SortIcon field="aiGrade" />
            </div>
          </div>
          <div className="table-cell cell-detail">
            <div>상세</div>
          </div>
          <div className="table-cell cell-ai-comment">
            <div>AI Comment</div>
          </div>
        </div>

        {/* 결과 리스트 */}
        <div className="candidate-list">
        {loading ? (
          <div className="candidate-list-empty">점수를 계산하는 중...</div>
        ) : filteredAndSortedResults.length === 0 ? (
          <div className="candidate-list-empty">
            {results.length === 0 ? '점수 계산 결과가 없습니다.' : '검색 결과가 없습니다.'}
          </div>
        ) : (
          filteredAndSortedResults.map((result, idx) => (
            <div 
              key={idx} 
              className={`candidate-row ${result.status === 'error' ? 'row-error' : ''} ${selectedResult?.filePath === result.filePath ? 'row-selected' : ''} ${selectedCandidates.has(result.filePath) ? 'row-checked' : ''}`}
              onClick={() => setSelectedResult(selectedResult?.filePath === result.filePath ? null : result)}
            >
              <div className="table-cell cell-checkbox">
                <input
                  type="checkbox"
                  checked={selectedCandidates.has(result.filePath)}
                  onChange={() => handleToggleCandidate(result.filePath)}
                  onClick={(e) => e.stopPropagation()}
                  className="row-checkbox"
                />
              </div>
              <div className="table-cell cell-status">
                <div className="status-cell">
                  <StatusIcon result={result} />
                  <span className="status-text">{getStatusText(result)}</span>
                </div>
              </div>
              <div className="table-cell cell-name">
                <div className="candidate-info">
                  <span className="candidate-name">{result.name || result.fileName}</span>
                  {result.errorMessage && (
                    <span className="candidate-error">{result.errorMessage}</span>
                  )}
                </div>
              </div>
              <div className="table-cell cell-age">
                {result.status === 'completed' && result.age !== undefined ? `${result.age}세` : '-'}
              </div>
              <div className="table-cell cell-company">
                {result.status === 'completed' && result.lastCompany ? (
                  <div className="company-info">
                    <span className="company-name">{result.lastCompany}</span>
                    {result.lastSalary && (
                      <span className="company-salary">({result.lastSalary})</span>
                    )}
                  </div>
                ) : '-'}
              </div>
              <div className="table-cell cell-residence">
                {result.status === 'completed' && result.residence ? (
                  <span className="residence-value">{result.residence}</span>
                ) : '-'}
              </div>
              <div className="table-cell cell-score">
                {result.status === 'completed' ? (
                  <span className="score-value">{result.totalScore.toFixed(1)}</span>
                ) : (
                  <span className="score-placeholder">-</span>
                )}
              </div>
              <div className="table-cell cell-ai-grade">
                {result.aiChecked && result.aiGrade ? (
                  <span className={`ai-grade ai-grade-${result.aiGrade.toLowerCase()}`}>
                    {result.aiGrade}
                  </span>
                ) : (
                  <span className="ai-grade-placeholder">-</span>
                )}
              </div>
              <div className="table-cell cell-detail">
                <button 
                  className="detail-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedResult(selectedResult?.filePath === result.filePath ? null : result);
                  }}
                  title="상세 정보 보기"
                >
                  <Info size={16} />
                </button>
              </div>
              <div className="table-cell cell-ai-comment">
                <button
                  className={`ai-comment-btn ${result.aiChecked && result.aiReport ? 'active' : 'disabled'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (result.aiChecked && result.aiReport) {
                      handleOpenAiReport(result.aiReport);
                    }
                  }}
                  disabled={!result.aiChecked || !result.aiReport}
                  title={result.aiChecked && result.aiReport ? 'AI 분석 보고서 보기' : 'AI 검사를 먼저 진행해주세요!'}
                >
                  확인하기
                </button>
              </div>
            </div>
          ))
        )}
        </div>
      </div>

      {/* 상세 정보 패널 (플레이스홀더) */}
      {selectedResult && (
        <div className="result-detail-panel">
          <div className="detail-panel-header">
            <h3>상세 정보</h3>
            <button 
              className="detail-close-btn"
              onClick={() => setSelectedResult(null)}
            >
              ✕
            </button>
          </div>
          <div className="detail-panel-content">
            <div className="detail-section">
              <h4>파일 정보</h4>
              <div className="detail-item">
                <span className="detail-label">파일명:</span>
                <span className="detail-value">{selectedResult.fileName}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">경로:</span>
                <span className="detail-value">{selectedResult.filePath}</span>
              </div>
            </div>
            
            <div className="detail-section">
              <h4>기본 정보</h4>
              <div className="detail-item">
                <span className="detail-label">이름:</span>
                <span className="detail-value">
                  {selectedResult.name || selectedResult.fileName || 'N/A'}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">나이:</span>
                <span className="detail-value">
                  {selectedResult.status === 'completed' && selectedResult.age !== undefined ? `${selectedResult.age}세` : 'N/A'}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">직전 회사:</span>
                <span className="detail-value">
                  {selectedResult.status === 'completed' && selectedResult.lastCompany ? selectedResult.lastCompany : 'N/A'}
                </span>
              </div>
              {selectedResult.status === 'completed' && selectedResult.lastSalary && (
                <div className="detail-item">
                  <span className="detail-label">직전 연봉:</span>
                  <span className="detail-value">{selectedResult.lastSalary}</span>
                </div>
              )}
              <div className="detail-item">
                <span className="detail-label">총점수:</span>
                <span className="detail-value detail-value-total">
                  {selectedResult.status === 'completed' ? selectedResult.totalScore.toFixed(1) : 'N/A'}
                </span>
              </div>
            </div>

            <div className="detail-section">
              <h4>추출된 데이터 (플레이스홀더)</h4>
              <div className="detail-placeholder">
                <p>이력서에서 추출한 데이터가 여기에 표시됩니다.</p>
                <ul>
                  <li>기본 정보 (이름, 생년월일, 연락처 등)</li>
                  <li>자격증 목록</li>
                  <li>경력 사항</li>
                  <li>학력 사항</li>
                  <li>대학원 정보</li>
                </ul>
                <p className="placeholder-note">
                  ※ 실제 DOCX 파싱 로직 구현 후 데이터가 표시됩니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 상태 이동 모달 */}
      {showStatusModal && (
        <div className="status-modal-overlay" onClick={handleCloseStatusModal}>
          <div className="status-modal" onClick={(e) => e.stopPropagation()}>
            <div className="status-modal-header">
              <h3>상태 이동</h3>
              <button className="status-modal-close" onClick={handleCloseStatusModal}>
                ✕
              </button>
            </div>
            <div className="status-modal-content">
              <p className="status-modal-info">
                선택된 후보자 <strong>{selectedCandidates.size}명</strong>의 상태를 변경합니다.
              </p>
              <div className="status-options">
                <button
                  className="status-option-btn status-pending"
                  onClick={() => handleStatusChange('pending')}
                >
                  대기
                </button>
                <button
                  className="status-option-btn status-review"
                  onClick={() => handleStatusChange('review')}
                >
                  검토
                </button>
                <button
                  className="status-option-btn status-rejected"
                  onClick={() => handleStatusChange('rejected')}
                >
                  탈락
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 필터 모달 */}
      {showFilterModal && (
        <div className="status-modal-overlay" onClick={() => setShowFilterModal(false)}>
          <div className="filter-modal" onClick={(e) => e.stopPropagation()}>
            <div className="filter-modal-header">
              <h3>상세 필터</h3>
              <button className="filter-modal-close" onClick={() => setShowFilterModal(false)}>
                ✕
              </button>
            </div>
            <div className="filter-modal-content">
              <div className="filter-group">
                <label className="filter-label">나이</label>
                <div className="filter-range">
                  <input
                    type="number"
                    placeholder="최소"
                    value={filters.minAge}
                    onChange={(e) => setFilters({ ...filters, minAge: e.target.value })}
                    className="filter-input"
                    min="0"
                  />
                  <span className="filter-separator">~</span>
                  <input
                    type="number"
                    placeholder="최대"
                    value={filters.maxAge}
                    onChange={(e) => setFilters({ ...filters, maxAge: e.target.value })}
                    className="filter-input"
                    min="0"
                  />
                </div>
              </div>

              <div className="filter-group">
                <label className="filter-label">총점수</label>
                <div className="filter-range">
                  <input
                    type="number"
                    placeholder="최소"
                    value={filters.minScore}
                    onChange={(e) => setFilters({ ...filters, minScore: e.target.value })}
                    className="filter-input"
                    min="0"
                    step="0.1"
                  />
                  <span className="filter-separator">~</span>
                  <input
                    type="number"
                    placeholder="최대"
                    value={filters.maxScore}
                    onChange={(e) => setFilters({ ...filters, maxScore: e.target.value })}
                    className="filter-input"
                    min="0"
                    step="0.1"
                  />
                </div>
              </div>

              <div className="filter-group">
                <label className="filter-label">회사명</label>
                <input
                  type="text"
                  placeholder="회사명으로 검색..."
                  value={filters.company}
                  onChange={(e) => setFilters({ ...filters, company: e.target.value })}
                  className="filter-input filter-input-full"
                />
              </div>

              <div className="filter-group">
                <label className="filter-label">후보자 상태</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value as any })}
                  className="filter-select"
                >
                  <option value="">전체</option>
                  <option value="pending">대기</option>
                  <option value="review">검토</option>
                  <option value="rejected">탈락</option>
                </select>
              </div>

              <div className="filter-group">
                <label className="filter-label">거주지</label>
                <div className="residence-slider-container">
                  <input
                    type="range"
                    min="0"
                    max="3"
                    step="1"
                    value={filters.residence}
                    onChange={(e) => setFilters({ ...filters, residence: parseInt(e.target.value) as 0 | 1 | 2 | 3 })}
                    className="residence-slider"
                  />
                  <div className="residence-slider-labels">
                    <span className={filters.residence === 0 ? 'active' : ''}>안산</span>
                    <span className={filters.residence === 1 ? 'active' : ''}>시흥+안산</span>
                    <span className={filters.residence === 2 ? 'active' : ''}>수도권</span>
                    <span className={filters.residence === 3 ? 'active' : ''}>전국</span>
                  </div>
                  <div className="residence-slider-value">
                    {filters.residence === 0 && '안산'}
                    {filters.residence === 1 && '시흥+안산'}
                    {filters.residence === 2 && '수도권'}
                    {filters.residence === 3 && '전국'}
                  </div>
                </div>
              </div>
            </div>
            <div className="filter-modal-actions">
              <button className="filter-reset-btn" onClick={resetFilters}>
                초기화
              </button>
              <button className="filter-apply-btn" onClick={applyFilters}>
                적용
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI 보고서 모달 */}
      {showAiReportModal && (
        <div className="status-modal-overlay" onClick={() => setShowAiReportModal(false)}>
          <div className="ai-report-modal" onClick={(e) => e.stopPropagation()}>
            <div className="status-modal-header">
              <h3>AI 분석 보고서</h3>
              <button className="status-modal-close" onClick={() => setShowAiReportModal(false)}>
                ✕
              </button>
            </div>
            <div className="ai-report-content">
              <pre className="ai-report-text">{currentAiReport}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
