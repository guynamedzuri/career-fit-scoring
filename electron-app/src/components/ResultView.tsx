import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Search, ChevronUp, ChevronDown, Download, Info, AlertCircle, CheckCircle2, Filter } from 'lucide-react';
import '../styles/result-view.css';

// 이미지 표시: photoDataUrl(캐시용) 우선, 없으면 photoPath로 IPC 읽기
function PhotoImage({ photoPath, photoDataUrl, alt, className, placeholderClassName }: { 
  photoPath?: string; 
  photoDataUrl?: string; // 캐시에서 복원한 base64 data URL (있으면 파일 읽기 생략)
  alt: string; 
  className: string;
  placeholderClassName?: string;
}) {
  const [imageSrc, setImageSrc] = useState<string | null>(photoDataUrl || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (photoDataUrl) {
      setImageSrc(photoDataUrl);
      setError(false);
      setLoading(false);
      return;
    }
    if (!photoPath) {
      setImageSrc(null);
      setError(false);
      return;
    }

    setLoading(true);
    setError(false);

    if (window.electron?.readImageAsBase64) {
      window.electron.readImageAsBase64(photoPath)
        .then((result: any) => {
          if (result.success && result.dataUrl) {
            setImageSrc(result.dataUrl);
            setError(false);
          } else {
            console.warn('[PhotoImage] Failed to load image:', result.error);
            setError(true);
          }
        })
        .catch((err: any) => {
          console.error('[PhotoImage] Error loading image:', err);
          setError(true);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      console.warn('[PhotoImage] readImageAsBase64 not available');
      setError(true);
      setLoading(false);
    }
  }, [photoPath, photoDataUrl]);

  if ((!photoPath && !photoDataUrl) || error) {
    return <div className={placeholderClassName || className}></div>;
  }

  if (loading || !imageSrc) {
    return <div className={placeholderClassName || className}></div>;
  }

  return (
    <img 
      src={imageSrc} 
      alt={alt}
      className={className}
      onError={() => {
        setError(true);
      }}
    />
  );
}

// detail-list li: "|" 구분자를 줄바꿈으로, 기간(YYYY.MM ~ ...)은 색·작은 폰트로 표시
function DetailListLi({ text }: { text: string }) {
  const parts = text.split('|').map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) {
    return <li>{text}</li>;
  }
  const periodPattern = /^\d{4}\.\d{2}\s*~\s*(재직중|현재|\d{4}\.\d{2})?/;
  return (
    <li className="detail-list-li">
      {parts.map((part, i) => {
        const isPeriod = periodPattern.test(part);
        return (
          <span
            key={i}
            className={isPeriod ? 'detail-list-part detail-list-period' : 'detail-list-part'}
          >
            {part}
          </span>
        );
      })}
    </li>
  );
}

// 평가 항목 점수 계산 함수들은 AI 분석 단계로 이동하여 더 이상 사용하지 않음
// 이제 모든 평가 항목은 AI 분석 결과에서 가져옴
// 참고: renderer 프로세스에서는 require를 사용할 수 없으므로, 
// calculateAllScores는 더 이상 사용하지 않으며 AI 분석 결과를 사용합니다.

// 생년월일로부터 만나이 계산 함수
function calculateAgeFromBirthDate(birthDate: string | undefined): number | undefined {
  if (!birthDate) return undefined;
  
  try {
    // YYYY-MM-DD, YYYY.MM.DD, 또는 YYYYMMDD 형식 파싱
    let year: number, month: number, day: number;
    
    if (birthDate.includes('-')) {
      // YYYY-MM-DD 형식
      const parts = birthDate.split('-');
      year = parseInt(parts[0]);
      month = parseInt(parts[1]);
      day = parseInt(parts[2]);
    } else if (birthDate.includes('.')) {
      // YYYY.MM.DD 형식
      const parts = birthDate.split('.');
      year = parseInt(parts[0]);
      month = parseInt(parts[1]);
      day = parseInt(parts[2]);
    } else if (birthDate.length === 8) {
      // YYYYMMDD 형식
      year = parseInt(birthDate.substring(0, 4));
      month = parseInt(birthDate.substring(4, 6));
      day = parseInt(birthDate.substring(6, 8));
    } else {
      return undefined;
    }
    
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      return undefined;
    }
    
    const today = new Date();
    const birth = new Date(year, month - 1, day);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    // 만나이 계산: 생일이 지나지 않았으면 1살 빼기
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  } catch {
    return undefined;
  }
}

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
  photoPath?: string; // 증명사진 파일 경로
  photoDataUrl?: string; // 캐시용 증명사진 base64 data URL (있으면 파일 읽기 생략)
  // AI 검사 결과
  aiGrade?: string; // AI 평가 등급 (예: 'A', 'B', 'C', 'D')
  aiReport?: string | { // AI 분석 결과 보고서 (JSON 파싱된 객체 또는 원본 텍스트)
    grade: string;
    summary: string;
    strengths: string[];
    weaknesses: string[];
    opinion: string;
    evaluations?: {
      careerFit?: string;
      requiredQual?: string;
      preferredQual?: string;
      certification?: string;
    };
    gradeEvaluations?: Record<string, { satisfied?: boolean; reason?: string }>; // 등급별 판정·근거 (상/중/하)
  };
  aiReportParsed?: boolean; // AI 보고서가 JSON으로 파싱되었는지 여부
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
      상: string;
      중: string;
      하: string;
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
  onProgressChange?: (progress: { current: number; total: number; currentFile: string; estimatedTimeRemainingMs?: number; phase?: 'parsing' | 'ai'; concurrency?: number }) => void;
  jobMetadata?: any; // App.tsx에서 전달하는 jobMetadata
}

type SortField = 'name' | 'age' | 'lastCompany' | 'residence' | 'totalScore' | 'aiGrade' | 'status' | 'careerFit' | 'requiredQual' | 'preferredQual' | 'certification';
type SortOrder = 'asc' | 'desc';

/** 내부 등급 A/B/C → 표시용 '상'/'중'/'하' */
const aiGradeToLabel: Record<string, string> = { A: '상', B: '중', C: '하' };
const aiGradeLabel = (g: string | undefined) => (g ? (aiGradeToLabel[g] ?? g) : '-');

/** applicationData에서 최종학력 1건: educationEndDate 기준 가장 최근 항목의 학교명·학과 */
function getFinalEducation(app: any): { school: string; major: string } {
  if (!app) return { school: '', major: '' };
  const entries: { end: string; school: string; major: string }[] = [];
  for (let i = 1; i <= 6; i++) {
    const end = (app[`educationEndDate${i}`] || '').trim();
    const school = (app[`universityName${i}`] || '').trim();
    const major = (app[`universityMajor${i}_1`] || '').trim();
    if (school || end) entries.push({ end: end || '0000.00', school, major });
  }
  if (entries.length === 0) return { school: '', major: '' };
  entries.sort((a, b) => (b.end < a.end ? -1 : b.end > a.end ? 1 : 0));
  return { school: entries[0].school, major: entries[0].major };
}

/** applicationData에서 최근경력 1건: careerEndDate 기준 가장 최근 항목의 회사명·부서·연봉 */
function getLatestCareer(app: any): { company: string; department: string; salary: string } {
  if (!app) return { company: '', department: '', salary: '' };
  const entries: { end: string; company: string; department: string; salary: string }[] = [];
  for (let i = 1; i <= 5; i++) {
    const end = (app[`careerEndDate${i}`] || app[`careerStartDate${i}`] || '').trim();
    const company = (app[`careerCompanyName${i}`] || '').trim();
    const department = (app[`careerDepartment${i}`] || '').trim();
    const salary = (app[`careerSalary${i}`] || '').trim();
    if (company || end) entries.push({ end: end || '9999.12', company, department, salary });
  }
  if (entries.length === 0) return { company: '', department: '', salary: '' };
  entries.sort((a, b) => (b.end < a.end ? -1 : b.end > a.end ? 1 : 0));
  return { company: entries[0].company, department: entries[0].department, salary: entries[0].salary };
}

export default function ResultView({ selectedFiles, userPrompt, selectedFolder, onBack, onProcessingChange, onProgressChange, jobMetadata }: ResultViewProps) {
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
  const [showPromptsModal, setShowPromptsModal] = useState(false);
  const [promptsPreview, setPromptsPreview] = useState<{ systemPrompt: string; userPromptText: string } | null>(null);
  const [promptsPreviewError, setPromptsPreviewError] = useState<string | null>(null);
  /** 분석 실행 시 전달된 AI 프롬프트 (배치별). 프롬프트 보기에서 선택한 후보의 실제 전달 프롬프트 표시용 */
  const [lastBatchPrompts, setLastBatchPrompts] = useState<Array<{ systemPrompt: string; userPromptText: string }>>([]);
  /** 분석 요청 순서의 filePath 목록 (배치 인덱스 계산용) */
  const [analysisOrderFilePaths, setAnalysisOrderFilePaths] = useState<string[]>([]);
  const [currentAiReport, setCurrentAiReport] = useState<string | {
    grade: string;
    summary: string;
    strengths: string[];
    weaknesses: string[];
    opinion: string;
  }>('');
  const [currentAiReportParsed, setCurrentAiReportParsed] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiProgress, setAiProgress] = useState<{ current: number; total: number; currentFile: string; estimatedTimeRemainingMs?: number }>({ current: 0, total: 0, currentFile: '', estimatedTimeRemainingMs: undefined });
  
  // 전체 진행률 추적 (파싱 + AI 분석)
  const [overallProgress, setOverallProgress] = useState<{ 
    parsingCompleted: number; 
    parsingTotal: number; 
    aiCompleted: number; 
    aiTotal: number;
    currentPhase: 'parsing' | 'ai' | 'none';
    currentFile: string;
    estimatedTimeRemainingMs?: number;
  }>({
    parsingCompleted: 0,
    parsingTotal: 0,
    aiCompleted: 0,
    aiTotal: 0,
    currentPhase: 'none',
    currentFile: '',
    estimatedTimeRemainingMs: undefined,
  });
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
              aiReportParsed: cachedData.aiReportParsed || false,
              aiChecked: cachedData.aiChecked && cachedData.aiGrade && cachedData.aiReport ? true : false,
              searchableText: cachedData.searchableText || file.name,
              photoPath: cachedData.photoPath,
              photoDataUrl: cachedData.photoDataUrl,
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
  const processResumeFiles = useCallback(async (filePaths: string[]): Promise<void> => {
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
    
    // 파싱 단계 시작 - 전체 진행률 초기화
    const totalFiles = filePaths.length;
    
    // 전체 진행률 업데이트 함수 (로컬 함수로 정의)
    const updateOverallProgress = (parsingCompleted: number, aiCompleted: number = 0, currentFile?: string, estimatedTimeRemainingMs?: number) => {
      setOverallProgress(prev => {
        const progress = {
          parsingCompleted,
          parsingTotal: totalFiles,
          aiCompleted,
          aiTotal: prev.aiTotal,
          currentPhase: parsingCompleted < totalFiles ? 'parsing' as const : 'ai' as const,
          currentFile: currentFile || '',
          estimatedTimeRemainingMs,
        };
        
        // 전체 진행률을 progress로 변환 (파싱 50% + AI 50%)
        const totalSteps = totalFiles * 2; // 파싱 단계 + AI 단계
        const completedSteps = parsingCompleted + aiCompleted;
        const phase: 'parsing' | 'ai' = parsingCompleted < totalFiles ? 'parsing' : 'ai';
        const totalProgress = {
          current: completedSteps,
          total: totalSteps,
          currentFile: currentFile || '',
          estimatedTimeRemainingMs,
          phase,
          concurrency: phase === 'parsing' ? 4 : 3,
        };
        
        if (onProgressChange) {
          onProgressChange(totalProgress);
        }
        
        return progress;
      });
    };
    
    updateOverallProgress(0, 0);
    
    const PARSE_CONCURRENCY = 4; // 동시 파싱 개수
    let completedCount = 0;
    
    const runOneParse = async (filePath: string, file: { name: string }) => {
      setResults(prev => prev.map(r => r.filePath === filePath ? { ...r, status: 'processing' as const } : r));
      try {
        const result = await window.electron!.processResume(filePath, jobMetadata?.documentType ?? 'docx');
        if (result.success) {
          const totalScore = 0;
          setResults(prev => prev.map(r => r.filePath === filePath ? {
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
            photoPath: result.photoPath,
          } : r));
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
                photoPath: result.photoPath,
              },
            }]);
          }
        } else {
          throw new Error(result.error || '처리 실패');
        }
      } catch (error: any) {
        console.error(`[Process] Error processing ${filePath}:`, error);
        setResults(prev => prev.map(r => r.filePath === filePath ? { ...r, status: 'error' as const, errorMessage: error.message || '처리 실패' } : r));
      }
      completedCount++;
      updateOverallProgress(completedCount, 0);
    };
    
    try {
      const tasks = filePaths
        .map(fp => ({ filePath: fp, file: selectedFiles.find(f => f.path === fp) }))
        .filter((t): t is { filePath: string; file: { name: string } } => !!t.file);
      const executing: Promise<void>[] = [];
      for (const { filePath, file } of tasks) {
        const p = runOneParse(filePath, file).then(() => {
          executing.splice(executing.indexOf(p), 1);
        });
        executing.push(p);
        if (executing.length >= PARSE_CONCURRENCY) {
          await Promise.race(executing);
          await Promise.resolve(); // 한 틱 대기해 완료된 항목이 pool에서 제거되도록
        }
      }
      await Promise.all(executing);
      
      updateOverallProgress(totalFiles, 0);
      
      // 모든 파일 처리 완료 후 AI 분석 시작 (결과가 업데이트된 후)
      // AI 분석은 별도 useEffect에서 자동으로 실행됨
    } catch (error) {
      console.error('[Process] Overall error:', error);
      if (onProcessingChange) {
        onProcessingChange(false);
      }
    }
  }, [selectedFiles, selectedFolder, jobMetadata?.documentType, onProcessingChange, onProgressChange]);

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
        filtered = filtered.filter(r => {
          // applicationData.birthDate가 있으면 그것을 사용해서 나이 계산
          const calculatedAge = r.applicationData?.birthDate 
            ? calculateAgeFromBirthDate(r.applicationData.birthDate)
            : r.age;
          return calculatedAge !== undefined && calculatedAge >= minAge;
        });
      }
    }
    if (filters.maxAge) {
      const maxAge = parseInt(filters.maxAge);
      if (!isNaN(maxAge)) {
        filtered = filtered.filter(r => {
          // applicationData.birthDate가 있으면 그것을 사용해서 나이 계산
          const calculatedAge = r.applicationData?.birthDate 
            ? calculateAgeFromBirthDate(r.applicationData.birthDate)
            : r.age;
          return calculatedAge !== undefined && calculatedAge <= maxAge;
        });
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

    // cell-ai-grade에 표시되는 0~100 종합 점수 계산 (경력/필수/우대/자격증 가중합). 필수사항 불만족·미분석 시 -1
    const getAiGradeNumericScore = (r: typeof filtered[0]): number => {
      if (!r.aiChecked || !r.aiReport || typeof r.aiReport !== 'object' || !r.aiReport.evaluations) return -1;
      const ev = r.aiReport.evaluations as { requiredQual?: string; preferredQual?: string; certification?: string };
      if (userPrompt?.requiredQualifications?.trim() && ev.requiredQual === 'X') return -1; // 필수사항 불만족
      const weights = userPrompt?.scoringWeights || { career: 100, requirements: 0, preferred: 0, certifications: 0 };
      const total = weights.career + weights.requirements + weights.preferred + weights.certifications;
      const cr = total > 0 ? weights.career / total : 0;
      const rr = total > 0 ? weights.requirements / total : 0;
      const pr = total > 0 ? weights.preferred / total : 0;
      const certR = total > 0 ? weights.certifications / total : 0;
      const gradeMap: Record<string, number> = { 'A': 100, 'B': 80, 'C': 60 };
      const careerScore = r.aiGrade ? (gradeMap[r.aiGrade] ?? 0) : 0;
      let requiredScore = 0;
      if (userPrompt?.requiredQualifications?.trim()) requiredScore = ev.requiredQual === '◎' ? 100 : 0;
      let preferredScore = 0;
      if (userPrompt?.preferredQualifications?.trim()) {
        if (ev.preferredQual === '◎') preferredScore = 100;
        else if (ev.preferredQual === '○') preferredScore = 80;
      }
      let certificationScore = 0;
      if (userPrompt?.requiredCertifications?.length) {
        if (ev.certification === '◎') certificationScore = 100;
        else if (ev.certification === '○') certificationScore = 80;
      }
      return careerScore * cr + requiredScore * rr + preferredScore * pr + certificationScore * certR;
    };

    // 정렬
    filtered.sort((a, b) => {
      let compareA: number | string, compareB: number | string;

      switch (sortField) {
        case 'name':
          compareA = a.name || a.fileName || '';
          compareB = b.name || b.fileName || '';
          break;
        case 'age':
          const ageA = a.applicationData?.birthDate
            ? calculateAgeFromBirthDate(a.applicationData.birthDate)
            : a.age;
          const ageB = b.applicationData?.birthDate
            ? calculateAgeFromBirthDate(b.applicationData.birthDate)
            : b.age;
          compareA = ageA ?? 0;
          compareB = ageB ?? 0;
          break;
        case 'lastCompany':
          compareA = a.lastCompany || '';
          compareB = b.lastCompany || '';
          break;
        case 'residence':
          const residenceOrder = { '안산': 1, '시흥': 2, '수도권': 3, '서울': 4, '지방': 5 };
          compareA = residenceOrder[a.residence as keyof typeof residenceOrder] ?? 6;
          compareB = residenceOrder[b.residence as keyof typeof residenceOrder] ?? 6;
          break;
        case 'careerFit':
          // 경력 적합도 = cell-career-fit 값 (A~E)
          const careerFitOrder = { 'A': 1, 'B': 2, 'C': 3 };
          compareA = a.aiGrade ? (careerFitOrder[a.aiGrade as keyof typeof careerFitOrder] ?? 6) : 6;
          compareB = b.aiGrade ? (careerFitOrder[b.aiGrade as keyof typeof careerFitOrder] ?? 6) : 6;
          break;
        case 'requiredQual':
          const requiredQualOrder = { '◎': 1, '○': 2, 'X': 3, '-': 4 };
          const requiredQualA = (() => {
            if (!userPrompt?.requiredQualifications || !userPrompt.requiredQualifications.trim()) return 4;
            if (a.aiChecked && a.aiReport && typeof a.aiReport === 'object' && a.aiReport.evaluations?.requiredQual) {
              return requiredQualOrder[a.aiReport.evaluations.requiredQual as keyof typeof requiredQualOrder] ?? 4;
            }
            return 4;
          })();
          const requiredQualB = (() => {
            if (!userPrompt?.requiredQualifications || !userPrompt.requiredQualifications.trim()) return 4;
            if (b.aiChecked && b.aiReport && typeof b.aiReport === 'object' && b.aiReport.evaluations?.requiredQual) {
              return requiredQualOrder[b.aiReport.evaluations.requiredQual as keyof typeof requiredQualOrder] ?? 4;
            }
            return 4;
          })();
          compareA = requiredQualA;
          compareB = requiredQualB;
          break;
        case 'preferredQual':
          const preferredQualOrder = { '◎': 1, '○': 2, 'X': 3, '-': 4 };
          const preferredQualA = (() => {
            if (!userPrompt?.preferredQualifications || !userPrompt.preferredQualifications.trim()) return 4;
            if (a.aiChecked && a.aiReport && typeof a.aiReport === 'object' && a.aiReport.evaluations?.preferredQual) {
              return preferredQualOrder[a.aiReport.evaluations.preferredQual as keyof typeof preferredQualOrder] ?? 4;
            }
            return 4;
          })();
          const preferredQualB = (() => {
            if (!userPrompt?.preferredQualifications || !userPrompt.preferredQualifications.trim()) return 4;
            if (b.aiChecked && b.aiReport && typeof b.aiReport === 'object' && b.aiReport.evaluations?.preferredQual) {
              return preferredQualOrder[b.aiReport.evaluations.preferredQual as keyof typeof preferredQualOrder] ?? 4;
            }
            return 4;
          })();
          compareA = preferredQualA;
          compareB = preferredQualB;
          break;
        case 'certification':
          const certificationOrder = { '◎': 1, '○': 2, 'X': 3, '-': 4 };
          const certificationA = (() => {
            if (!userPrompt?.requiredCertifications || userPrompt.requiredCertifications.length === 0) return 4;
            if (a.aiChecked && a.aiReport && typeof a.aiReport === 'object' && a.aiReport.evaluations?.certification) {
              return certificationOrder[a.aiReport.evaluations.certification as keyof typeof certificationOrder] ?? 4;
            }
            return 4;
          })();
          const certificationB = (() => {
            if (!userPrompt?.requiredCertifications || userPrompt.requiredCertifications.length === 0) return 4;
            if (b.aiChecked && b.aiReport && typeof b.aiReport === 'object' && b.aiReport.evaluations?.certification) {
              return certificationOrder[b.aiReport.evaluations.certification as keyof typeof certificationOrder] ?? 4;
            }
            return 4;
          })();
          compareA = certificationA;
          compareB = certificationB;
          break;
        case 'aiGrade':
          // 종합 점수 = cell-ai-grade 값 (0~100 정수)
          compareA = getAiGradeNumericScore(a);
          compareB = getAiGradeNumericScore(b);
          break;
        case 'totalScore': {
          const isRequiredFail = (r: typeof a) =>
            !!userPrompt?.requiredQualifications?.trim() &&
            r.aiChecked &&
            r.aiReport &&
            typeof r.aiReport === 'object' &&
            (r.aiReport as { evaluations?: { requiredQual?: string } }).evaluations?.requiredQual === 'X';
          const failA = isRequiredFail(a);
          const failB = isRequiredFail(b);
          if (failA && !failB) {
            compareA = -1;
            compareB = b.totalScore;
          } else if (!failA && failB) {
            compareA = a.totalScore;
            compareB = -1;
          } else {
            compareA = a.totalScore;
            compareB = b.totalScore;
          }
          break;
        }
        case 'status':
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

      // 1차 비교 (동일하면 0 반환)
      let primaryCmp = 0;
      if (typeof compareA === 'string' && typeof compareB === 'string') {
        primaryCmp = compareA.localeCompare(compareB, undefined, { sensitivity: 'base' });
        if (sortOrder === 'desc') primaryCmp = -primaryCmp;
      } else {
        const numA = Number(compareA);
        const numB = Number(compareB);
        if (numA !== numB) primaryCmp = numA < numB ? -1 : 1;
        if (sortOrder === 'desc') primaryCmp = -primaryCmp;
      }
      if (primaryCmp !== 0) return primaryCmp;

      // 2차: 동점/동순위 시 cell-ai-grade(0~100 종합 점수) 순으로 정렬
      const scoreA = getAiGradeNumericScore(a);
      const scoreB = getAiGradeNumericScore(b);
      return sortOrder === 'desc' ? (scoreB - scoreA) : (scoreA - scoreB);
    });

    return filtered;
  }, [results, searchQuery, sortField, sortOrder, filters, userPrompt]);

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

  // 엑셀로 내려받기: 선택한 후보를 테이블 순서대로 엑셀 export
  const handleExportExcel = async () => {
    const selectedInOrder = filteredAndSortedResults.filter(r => selectedCandidates.has(r.filePath));
    if (selectedInOrder.length === 0 || !window.electron?.exportCandidatesExcel) return;
    const headers = ['이름', '생년월일', '최종학력_학교명', '최종학력_학과', '경력_회사명', '경력_부서명', '경력_직전연봉'];
    const rows = selectedInOrder.map(result => {
      const app = result.applicationData;
      const edu = getFinalEducation(app);
      const career = getLatestCareer(app);
      return [
        (result.name ?? app?.name ?? '').trim(),
        (app?.birthDate ?? '').trim(),
        edu.school,
        edu.major,
        career.company,
        career.department,
        career.salary,
      ];
    });
    const res = await window.electron.exportCandidatesExcel({ headers, rows });
    if (res?.success && !(res as { canceled?: boolean }).canceled && (res as { filePath?: string }).filePath) {
      // 저장 성공 시 파일 열기 등은 선택 사항
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
          residence: result.residence,
          applicationData: result.applicationData,
          aiGrade: result.aiGrade,
          aiReport: result.aiReport,
          aiReportParsed: result.aiReportParsed,
          aiChecked: result.aiChecked,
          candidateStatus: result.candidateStatus,
          searchableText: result.searchableText,
          photoPath: result.photoPath,
          photoDataUrl: result.photoDataUrl,
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
      
      if (!userPrompt || !userPrompt.jobDescription || userPrompt.jobDescription.trim() === '' || selectedFiles.length === 0 || !window.electron?.aiCheckResumeBatch) {
        console.log('[AI Analysis] Skipping - missing requirements:', {
          hasUserPrompt: !!userPrompt,
          hasJobDescription: !!(userPrompt?.jobDescription),
          hasFiles: selectedFiles.length > 0,
          hasElectron: !!window.electron?.aiCheckResumeBatch,
        });
        if (onProcessingChange) {
          onProcessingChange(false);
        }
        return;
      }

      // 모든 파일이 처리 완료되었는지 확인
      const allFilesProcessed = results.every(r => 
        r.status === 'completed' || r.status === 'error'
      );

      // 아직 처리 중인 파일이 있으면 대기
      if (!allFilesProcessed && results.length > 0) {
        console.log('[AI Analysis] Waiting for all files to be processed...', {
          total: results.length,
          completed: results.filter(r => r.status === 'completed' || r.status === 'error').length,
        });
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
      
      // 전체 파일 수 기준으로 AI 분석 진행률 초기화
      const totalFiles = selectedFiles.length;
      setOverallProgress(prev => ({
        ...prev,
        aiCompleted: 0,
        aiTotal: needsAnalysis.length,
        currentPhase: 'ai',
        currentFile: '',
      }));
      
      const initialProgress = { current: 0, total: needsAnalysis.length, currentFile: '', estimatedTimeRemainingMs: undefined };
      setAiProgress(initialProgress);
      
      // 전체 진행률 업데이트 (파싱 완료 + AI 시작)
      const totalSteps = totalFiles * 2; // 파싱 단계 + AI 단계
      const initialTotalProgress = {
        current: totalFiles, // 파싱 완료
        total: totalSteps,
        currentFile: '',
        estimatedTimeRemainingMs: undefined,
        phase: 'ai' as const,
        concurrency: 3,
      };
      
      if (onProgressChange) {
        onProgressChange(initialTotalProgress);
      }
      if (onProcessingChange) {
        onProcessingChange(true);
      }
      try {
        const aiResults: Array<{ filePath: string; aiGrade?: string; aiReport?: any; aiReportParsed?: boolean; aiChecked: boolean; error?: string }> = [];
        const BATCH_SIZE = 1;
        const MAX_RETRIES = 3;
        const totalFiles = selectedFiles.length;
        const totalSteps = totalFiles * 2;

        // 데이터 없는 건 미리 결과에 넣음
        const needsAnalysisForBatch = needsAnalysis.filter(r => {
          if (!r.applicationData) {
            aiResults.push({ filePath: r.filePath, aiChecked: true, error: '이력서 데이터가 없습니다' });
            return false;
          }
          return true;
        });

        let aiCompletedCount = aiResults.length;
        const batchCount = Math.ceil(needsAnalysisForBatch.length / BATCH_SIZE);
        const batchTimes: number[] = [];
        setAnalysisOrderFilePaths(needsAnalysisForBatch.map(r => r.filePath));
        setLastBatchPrompts([]);

        for (let start = 0; start < needsAnalysisForBatch.length; start += BATCH_SIZE) {
          const chunk = needsAnalysisForBatch.slice(start, start + BATCH_SIZE);
          const batchStart = Date.now();
          let retryCount = 0;
          let batchPayload: { results: Array<{ success: boolean; grade?: string; report?: any; reportParsed?: boolean; fileName: string; error?: string }>; systemPrompt: string; userPromptText: string } | null = null;

          while (retryCount < MAX_RETRIES) {
            try {
              const resp = await window.electron!.aiCheckResumeBatch({
                userPrompt,
                items: chunk.map(r => ({ applicationData: r.applicationData, fileName: r.fileName })),
                debugFolder: selectedFolder || undefined,
              });
              batchPayload = resp;
              break;
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'AI 분석 실패';
              if (msg.startsWith('RATE_LIMIT:')) {
                const retryAfter = parseInt(msg.split(':')[1], 10) || 10;
                retryCount++;
                if (retryCount < MAX_RETRIES) {
                  await new Promise(r => setTimeout(r, retryAfter * 1000));
                  continue;
                }
              }
              batchPayload = {
                results: chunk.map(r => ({
                  success: false,
                  grade: 'C',
                  report: '',
                  reportParsed: false,
                  fileName: r.fileName,
                  error: msg,
                })),
                systemPrompt: '',
                userPromptText: '',
              };
              break;
            }
          }

          if (batchPayload) {
            setLastBatchPrompts(prev => [...prev, { systemPrompt: batchPayload!.systemPrompt, userPromptText: batchPayload!.userPromptText }]);
            const batchResults = batchPayload.results;
            for (let i = 0; i < chunk.length; i++) {
              const r = chunk[i];
              const res = batchResults[i];
              if (res?.success && res.grade != null && res.report != null) {
                aiResults.push({
                  filePath: r.filePath,
                  aiGrade: res.grade,
                  aiReport: res.report,
                  aiReportParsed: res.reportParsed ?? false,
                  aiChecked: true,
                });
              } else {
                aiResults.push({
                  filePath: r.filePath,
                  aiChecked: true,
                  error: (res as any)?.error || 'AI 분석 실패',
                });
              }
            }
          }

          aiCompletedCount = aiResults.length;
          batchTimes.push(Date.now() - batchStart);
          const avgBatchMs = batchTimes.length > 0 ? batchTimes.reduce((a, b) => a + b, 0) / batchTimes.length : 0;
          const batchesLeft = batchCount - batchTimes.length;
          const estimatedMs = avgBatchMs > 0 ? avgBatchMs * batchesLeft : undefined;
          const lastInChunk = chunk[chunk.length - 1];
          setAiProgress({ current: aiCompletedCount, total: needsAnalysis.length, currentFile: lastInChunk?.fileName ?? '', estimatedTimeRemainingMs: estimatedMs });
          setOverallProgress(prev => {
            const totalProgress = {
              current: totalFiles + aiCompletedCount,
              total: totalSteps,
              currentFile: lastInChunk?.fileName ?? '',
              estimatedTimeRemainingMs: estimatedMs,
              phase: 'ai' as const,
              concurrency: BATCH_SIZE,
            };
            if (onProgressChange) onProgressChange(totalProgress);
            return { ...prev, aiCompleted: aiCompletedCount, currentFile: lastInChunk?.fileName ?? '', estimatedTimeRemainingMs: estimatedMs };
          });
        }

      // 결과를 results에 반영
      setResults(prevResults =>
        prevResults.map(result => {
          const aiResult = aiResults.find(r => r.filePath === result.filePath);
          if (aiResult) {
            console.log(`[AI Analysis] Updating result for ${result.fileName}:`, {
              aiGrade: aiResult.aiGrade,
              aiReportType: typeof aiResult.aiReport,
              aiReportParsed: aiResult.aiReportParsed,
              hasEvaluations: typeof aiResult.aiReport === 'object' && (aiResult.aiReport as any).evaluations ? true : false,
              evaluations: typeof aiResult.aiReport === 'object' ? (aiResult.aiReport as any).evaluations : null,
            });
            
            const updated = {
              ...result,
              aiGrade: aiResult.aiGrade,
              aiReport: aiResult.aiReport,
              aiReportParsed: aiResult.aiReportParsed,
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
                    residence: result?.residence,
                    applicationData: result?.applicationData,
                    aiGrade: r.aiGrade,
                    aiReport: r.aiReport,
                    aiReportParsed: r.aiReportParsed,
                    aiChecked: r.aiChecked,
                    candidateStatus: result?.candidateStatus,
                    searchableText: result?.searchableText,
                    photoPath: result?.photoPath,
                    photoDataUrl: result?.photoDataUrl,
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
        const emptyProgress = { current: 0, total: 0, currentFile: '', estimatedTimeRemainingMs: undefined };
        setAiProgress(emptyProgress);
        
        // 전체 진행률 초기화
        setOverallProgress({
          parsingCompleted: 0,
          parsingTotal: 0,
          aiCompleted: 0,
          aiTotal: 0,
          currentPhase: 'none',
          currentFile: '',
          estimatedTimeRemainingMs: undefined,
        });
        
        if (onProgressChange) {
          onProgressChange(emptyProgress);
        }
        if (onProcessingChange) {
          onProcessingChange(false);
        }
        if (onProcessingChange) {
          onProcessingChange(false);
        }
      }
    };

    // 디바운싱: results가 빠르게 변경될 때를 대비하여 약간의 지연 후 실행
    // 모든 파일이 처리 완료될 때까지 기다리기 위해 더 긴 지연 시간 사용
    const timeoutId = setTimeout(() => {
      runInitialAiAnalysis();
    }, 500);
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, [results, userPrompt, selectedFiles, selectedFolder, onProcessingChange]);

  // AI 보고서 모달 열기
  const handleOpenAiReport = (report: string | {
    grade: string;
    summary: string;
    strengths: string[];
    weaknesses: string[];
    opinion: string;
  }, parsed: boolean = false) => {
    setCurrentAiReport(report);
    setCurrentAiReportParsed(parsed);
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
        <button
          type="button"
          className="prompts-preview-btn"
          onClick={async () => {
            setPromptsPreviewError(null);
            setPromptsPreview(null);
            setShowPromptsModal(true);
            const BATCH_SIZE = 1;
            if (lastBatchPrompts.length > 0 && selectedCandidates.size > 0) {
              const firstFilePath = Array.from(selectedCandidates)[0];
              const idx = analysisOrderFilePaths.indexOf(firstFilePath);
              const chunkIndex = idx >= 0 ? Math.floor(idx / BATCH_SIZE) : 0;
              const prompt = lastBatchPrompts[chunkIndex];
              if (prompt) {
                setPromptsPreview({ systemPrompt: prompt.systemPrompt, userPromptText: prompt.userPromptText });
                return;
              }
            }
            if (lastBatchPrompts.length > 0 && selectedCandidates.size === 0) {
              setPromptsPreviewError('해당 후보의 분석 프롬프트를 보려면 후보 테이블에서 한 명을 선택한 뒤 다시 눌러 주세요.');
              return;
            }
            if (!window.electron?.getAiPromptsPreview || !userPrompt) {
              setPromptsPreviewError('userPrompt가 없거나 프롬프트 미리보기를 사용할 수 없습니다.');
              return;
            }
            try {
              const firstWithData = results.find(r => r.applicationData);
              const res = await window.electron.getAiPromptsPreview({
                userPrompt,
                applicationData: firstWithData?.applicationData,
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
          프롬프트 보기
        </button>
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
          type="button"
          className="export-excel-btn"
          onClick={handleExportExcel}
          disabled={selectedCandidates.size === 0}
          title="선택된 후보자를 엑셀 파일로 저장"
        >
          엑셀로 내려받기
        </button>
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
        <div className="table-cell cell-career-fit">
          <div 
            className={`sortable ${sortField === 'careerFit' ? 'active' : ''}`}
            onClick={() => handleSort('careerFit')}
          >
            경력 적합도 <SortIcon field="careerFit" />
          </div>
        </div>
        <div className="table-cell cell-required-qual">
          <div 
            className={`sortable ${sortField === 'requiredQual' ? 'active' : ''}`}
            onClick={() => handleSort('requiredQual')}
          >
            필수사항<br />만족여부 <SortIcon field="requiredQual" />
          </div>
        </div>
        <div className="table-cell cell-preferred-qual">
          <div 
            className={`sortable ${sortField === 'preferredQual' ? 'active' : ''}`}
            onClick={() => handleSort('preferredQual')}
          >
            우대사항<br />만족여부 <SortIcon field="preferredQual" />
          </div>
        </div>
        <div className="table-cell cell-certification">
          <div 
            className={`sortable ${sortField === 'certification' ? 'active' : ''}`}
            onClick={() => handleSort('certification')}
          >
            자격증<br />만족여부 <SortIcon field="certification" />
          </div>
        </div>
          <div className="table-cell cell-ai-grade">
            <div 
              className={`sortable ${sortField === 'aiGrade' ? 'active' : ''}`}
              onClick={() => handleSort('aiGrade')}
            >
              종합 점수 <SortIcon field="aiGrade" />
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
                  <div className="candidate-photo-container">
                    <PhotoImage 
                      photoPath={result.photoPath}
                      photoDataUrl={result.photoDataUrl}
                      alt={result.name || result.fileName}
                      className="candidate-photo"
                      placeholderClassName="candidate-photo candidate-photo-placeholder"
                    />
                  </div>
                  <span className="candidate-name">{result.name || result.fileName}</span>
                  {result.errorMessage && (
                    <span className="candidate-error">{result.errorMessage}</span>
                  )}
                </div>
              </div>
              <div className="table-cell cell-age">
                {result.status === 'completed' ? (() => {
                  // applicationData.birthDate가 있으면 그것을 사용해서 나이 계산
                  const calculatedAge = result.applicationData?.birthDate 
                    ? calculateAgeFromBirthDate(result.applicationData.birthDate)
                    : result.age;
                  return calculatedAge !== undefined ? `${calculatedAge}세` : '-';
                })() : '-'}
              </div>
              <div className="table-cell cell-company">
                {result.status === 'completed' && result.lastCompany ? (
                  <div className="company-info">
                    <span className="company-name-wrap">
                      <span className="company-name">
                        {result.lastCompany.length > 8
                          ? `${result.lastCompany.slice(0, 8)}...`
                          : result.lastCompany}
                      </span>
                      <span className="company-tooltip">{result.lastCompany}</span>
                    </span>
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
              <div className="table-cell cell-career-fit" data-field="career-fit">
                {result.aiChecked && result.aiGrade ? (
                  <span className={`evaluation-grade grade-${result.aiGrade.toLowerCase()}`} data-grade={result.aiGrade}>
                    {aiGradeLabel(result.aiGrade)}
                  </span>
                ) : (
                  <span className="evaluation-grade grade--" data-grade="-">-</span>
                )}
              </div>
              <div className="table-cell cell-required-qual" data-field="required-qual">
                {(() => {
                  // 필수요구사항이 없으면 항상 '-'
                  if (!userPrompt?.requiredQualifications || !userPrompt.requiredQualifications.trim()) {
                    return <span className="evaluation-grade grade--" data-grade="-">-</span>;
                  }
                  // AI 분석 결과가 있으면 표시
                  if (result.aiChecked && result.aiReport && typeof result.aiReport === 'object' && result.aiReport.evaluations?.requiredQual) {
                    return <span className={`evaluation-grade grade-${result.aiReport.evaluations.requiredQual}`} data-grade={result.aiReport.evaluations.requiredQual}>
                      {result.aiReport.evaluations.requiredQual}
                    </span>;
                  }
                  return <span className="evaluation-grade grade--" data-grade="-">-</span>;
                })()}
              </div>
              <div className="table-cell cell-preferred-qual" data-field="preferred-qual">
                {(() => {
                  // 우대사항이 없으면 항상 '-'
                  if (!userPrompt?.preferredQualifications || !userPrompt.preferredQualifications.trim()) {
                    return <span className="evaluation-grade grade--" data-grade="-">-</span>;
                  }
                  // AI 분석 결과가 있으면 표시
                  if (result.aiChecked && result.aiReport && typeof result.aiReport === 'object' && result.aiReport.evaluations?.preferredQual) {
                    return <span className={`evaluation-grade grade-${result.aiReport.evaluations.preferredQual}`} data-grade={result.aiReport.evaluations.preferredQual}>
                      {result.aiReport.evaluations.preferredQual}
                    </span>;
                  }
                  return <span className="evaluation-grade grade--" data-grade="-">-</span>;
                })()}
              </div>
              <div className="table-cell cell-certification" data-field="certification">
                {(() => {
                  // 필수자격증이 없으면 항상 '-'
                  if (!userPrompt?.requiredCertifications || userPrompt.requiredCertifications.length === 0) {
                    return <span className="evaluation-grade grade--" data-grade="-">-</span>;
                  }
                  // AI 분석 결과가 있으면 표시
                  if (result.aiChecked && result.aiReport && typeof result.aiReport === 'object' && result.aiReport.evaluations?.certification) {
                    return <span className={`evaluation-grade grade-${result.aiReport.evaluations.certification}`} data-grade={result.aiReport.evaluations.certification}>
                      {result.aiReport.evaluations.certification}
                    </span>;
                  }
                  return <span className="evaluation-grade grade--" data-grade="-">-</span>;
                })()}
              </div>
              <div className="table-cell cell-ai-grade">
                {(() => {
                  // 종합 점수 계산
                  if (!result.aiChecked || !result.aiReport || typeof result.aiReport !== 'object' || !result.aiReport.evaluations) {
                    return <span className="ai-grade-placeholder">-</span>;
                  }
                  
                  const evaluations = result.aiReport.evaluations;
                  
                  // 가중치 가져오기 (userPrompt에서)
                  const weights = userPrompt?.scoringWeights || {
                    career: 100,
                    requirements: 0,
                    preferred: 0,
                    certifications: 0,
                  };
                  
                  // 가중치를 비율로 변환 (합이 100이 되도록 정규화)
                  const totalWeight = weights.career + weights.requirements + weights.preferred + weights.certifications;
                  const careerRatio = totalWeight > 0 ? weights.career / totalWeight : 0;
                  const requirementsRatio = totalWeight > 0 ? weights.requirements / totalWeight : 0;
                  const preferredRatio = totalWeight > 0 ? weights.preferred / totalWeight : 0;
                  const certificationsRatio = totalWeight > 0 ? weights.certifications / totalWeight : 0;
                  
                  // 각 항목 점수 계산
                  // 1. 경력 적합도 점수 (상=A=100, 중=B=80, 하=C=60)
                  let careerScore = 0;
                  if (result.aiGrade) {
                    const gradeMap: { [key: string]: number } = {
                      'A': 100,
                      'B': 80,
                      'C': 60,
                    };
                    careerScore = gradeMap[result.aiGrade] || 0;
                  }
                  
                  // 2. 필수사항 만족여부 점수 (◎=100, X=불만족, -=0)
                  let requiredScore = 0;
                  const requiredQual = evaluations.requiredQual;
                  if (userPrompt?.requiredQualifications && userPrompt.requiredQualifications.trim()) {
                    if (requiredQual === '◎') {
                      requiredScore = 100;
                    } else if (requiredQual === 'X') {
                      // 필수사항 불만족이면 종합 점수 대신 '필수사항 불만족' 표시
                      return <span className="ai-grade ai-grade-fail" style={{ color: '#ef4444', fontWeight: '600', whiteSpace: 'pre-line' }}>
                        필수사항{'\n'}불만족
                      </span>;
                    }
                  }
                  
                  // 3. 우대사항 만족여부 점수 (◎=100, ○=80, X=0, -=0)
                  let preferredScore = 0;
                  const preferredQual = evaluations.preferredQual;
                  if (userPrompt?.preferredQualifications && userPrompt.preferredQualifications.trim()) {
                    if (preferredQual === '◎') {
                      preferredScore = 100;
                    } else if (preferredQual === '○') {
                      preferredScore = 80;
                    } else if (preferredQual === 'X') {
                      preferredScore = 0;
                    }
                  }
                  
                  // 4. 자격증 만족여부 점수 (◎=100, ○=80, X=0, -=0)
                  let certificationScore = 0;
                  const certificationQual = evaluations.certification;
                  if (userPrompt?.requiredCertifications && userPrompt.requiredCertifications.length > 0) {
                    if (certificationQual === '◎') {
                      certificationScore = 100;
                    } else if (certificationQual === '○') {
                      certificationScore = 80;
                    } else if (certificationQual === 'X') {
                      certificationScore = 0;
                    }
                  }
                  
                  // 종합 점수 계산 (가중치 적용)
                  const totalScore = 
                    (careerScore * careerRatio) +
                    (requiredScore * requirementsRatio) +
                    (preferredScore * preferredRatio) +
                    (certificationScore * certificationsRatio);
                  
                  return <span className="ai-grade ai-grade-score" style={{ fontWeight: '600', color: '#072761' }}>
                    {Math.round(totalScore)}
                  </span>;
                })()}
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
                      handleOpenAiReport(result.aiReport, result.aiReportParsed || false);
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

      {/* 상세 정보 패널 */}
      {selectedResult && (
        <div className="result-detail-panel">
          <div className="detail-panel-header">
            <h3>상세 정보</h3>
            <div className="detail-header-actions">
              {selectedResult.aiChecked && selectedResult.aiReport && (
                <button
                  className="detail-ai-comment-btn"
                  onClick={() => handleOpenAiReport(selectedResult.aiReport!, selectedResult.aiReportParsed || false)}
                  title="AI 분석 보고서 보기"
                >
                  AI COMMENT 확인
                </button>
              )}
              <button 
                className="detail-close-btn"
                onClick={() => setSelectedResult(null)}
              >
                ✕
              </button>
            </div>
          </div>
          <div className="detail-panel-content">
            <div className="detail-section">
              <h4>파일 정보</h4>
              <div className="detail-item">
                <span className="detail-label">파일명:</span>
                <span className="detail-value">{selectedResult.fileName}</span>
              </div>
              <div className="detail-item detail-file-button-container">
                <button
                  className="detail-open-file-btn"
                  onClick={async () => {
                    if (window.electron?.openFile) {
                      try {
                        await window.electron.openFile(selectedResult.filePath);
                      } catch (error) {
                        console.error('[Detail] Failed to open file:', error);
                      }
                    }
                  }}
                  title="파일 열기"
                >
                  파일 열기
                </button>
              </div>
            </div>
            
            <div className="detail-section">
              <h4>기본 정보</h4>
              <div className="detail-photo-container">
                <PhotoImage 
                  photoPath={selectedResult.photoPath}
                  photoDataUrl={selectedResult.photoDataUrl}
                  alt={selectedResult.name || selectedResult.fileName}
                  className="detail-photo"
                  placeholderClassName="detail-photo detail-photo-placeholder"
                />
              </div>
              <div className="detail-item">
                <span className="detail-label">이름:</span>
                <span className="detail-value">
                  {selectedResult.name || selectedResult.fileName || 'N/A'}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">나이:</span>
                <span className="detail-value">
                  {selectedResult.status === 'completed' ? (() => {
                    // applicationData.birthDate가 있으면 그것을 사용해서 나이 계산
                    const calculatedAge = selectedResult.applicationData?.birthDate 
                      ? calculateAgeFromBirthDate(selectedResult.applicationData.birthDate)
                      : selectedResult.age;
                    return calculatedAge !== undefined ? `${calculatedAge}세` : 'N/A';
                  })() : 'N/A'}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">주소:</span>
                <span className="detail-value">
                  {selectedResult.status === 'completed' && selectedResult.applicationData?.address 
                    ? selectedResult.applicationData.address 
                    : 'N/A'}
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
            </div>

            <div className="detail-section">
              <h4>추출된 데이터</h4>
              {selectedResult.status === 'completed' && selectedResult.applicationData ? (
                <div className="detail-extracted-data">
                  {/* 자격증 목록 */}
                  {(() => {
                    const certificates: string[] = [];
                    for (let i = 1; i <= 10; i++) {
                      const certName = selectedResult.applicationData[`certificateName${i}`];
                      const certDate = selectedResult.applicationData[`certificateDate${i}`];
                      if (certName) {
                        certificates.push(`${certName}${certDate ? ` (${certDate})` : ''}`);
                      }
                    }
                    return certificates.length > 0 ? (
                      <div className="detail-subsection">
                        <h5>자격증</h5>
                        <ul className="detail-list">
                          {certificates.map((cert, idx) => (
                            <DetailListLi key={idx} text={cert} />
                          ))}
                        </ul>
                      </div>
                    ) : null;
                  })()}
                  
                  {/* 경력 사항 */}
                  {(() => {
                    const careers: string[] = [];
                    for (let i = 1; i <= 5; i++) {
                      const company = selectedResult.applicationData[`careerCompanyName${i}`];
                      const department = selectedResult.applicationData[`careerDepartment${i}`];
                      const startDate = selectedResult.applicationData[`careerStartDate${i}`];
                      const endDate = selectedResult.applicationData[`careerEndDate${i}`];
                      const jobType = selectedResult.applicationData[`careerJobType${i}`];
                      if (company) {
                        const companyLabel = department ? `${company} - ${department}` : company;
                        careers.push(`${companyLabel} | ${startDate || ''} ~ ${endDate || '현재'} | ${jobType || ''}`);
                      }
                    }
                    return careers.length > 0 ? (
                      <div className="detail-subsection">
                        <h5>경력 사항</h5>
                        <ul className="detail-list">
                          {careers.map((career, idx) => (
                            <DetailListLi key={idx} text={career} />
                          ))}
                        </ul>
                      </div>
                    ) : null;
                  })()}
                  
                  {/* 학력 사항 */}
                  {(() => {
                    const educations: string[] = [];
                    for (let i = 1; i <= 5; i++) {
                      const school = selectedResult.applicationData[`universityName${i}`];
                      const degree = selectedResult.applicationData[`universityDegreeType${i}`] ?? selectedResult.applicationData[`universityGraduationType${i}`];
                      const major = selectedResult.applicationData[`universityMajor${i}_1`];
                      const gpa = selectedResult.applicationData[`universityGPA${i}`];
                      const gpaMax = selectedResult.applicationData[`universityGPAMax${i}`];
                      const gpaStr = gpa ? (gpaMax ? `${gpa}/${gpaMax}` : gpa) : '';
                      if (school) {
                        educations.push(`${school} | ${degree || ''} | ${major || ''} | GPA: ${gpaStr || 'N/A'}`);
                      }
                    }
                    return educations.length > 0 ? (
                      <div className="detail-subsection">
                        <h5>학력 사항</h5>
                        <ul className="detail-list">
                          {educations.map((edu, idx) => (
                            <DetailListLi key={idx} text={edu} />
                          ))}
                        </ul>
                      </div>
                    ) : null;
                  })()}
                  
                  {/* 대학원 정보 */}
                  {(() => {
                    const gradSchools: string[] = [];
                    for (let i = 1; i <= 5; i++) {
                      const school = selectedResult.applicationData[`graduateSchoolName${i}`];
                      const degree = selectedResult.applicationData[`graduateSchoolDegreeType${i}`];
                      const major = selectedResult.applicationData[`graduateSchoolMajor${i}_1`];
                      if (school) {
                        gradSchools.push(`${school} | ${degree || ''} | ${major || ''}`);
                      }
                    }
                    return gradSchools.length > 0 ? (
                      <div className="detail-subsection">
                        <h5>대학원</h5>
                        <ul className="detail-list">
                          {gradSchools.map((grad, idx) => (
                            <DetailListLi key={idx} text={grad} />
                          ))}
                        </ul>
                      </div>
                    ) : null;
                  })()}
                  
                  {/* 자기소개서 */}
                  {(() => {
                    const selfIntros: string[] = [];
                    for (let i = 1; i <= 4; i++) {
                      const selfIntro = selectedResult.applicationData[`selfIntroduction${i}`];
                      if (selfIntro && selfIntro.trim()) {
                        selfIntros.push(selfIntro.trim());
                      }
                    }
                    return selfIntros.length > 0 ? (
                      <div className="detail-subsection">
                        <h5>자기소개서</h5>
                        {selfIntros.map((intro, idx) => (
                          <div key={idx} className="detail-selfintro-item">
                            <h6>자기소개서 {idx + 1}</h6>
                            <p className="detail-selfintro-text">{intro}</p>
                          </div>
                        ))}
                      </div>
                    ) : null;
                  })()}
                  
                  {/* 경력기술서 */}
                  {(() => {
                    const careerDetails: string[] = [];
                    for (let i = 1; i <= 4; i++) {
                      const careerDetail = selectedResult.applicationData[`careerDetailDescription${i}`];
                      if (careerDetail && careerDetail.trim()) {
                        careerDetails.push(careerDetail.trim());
                      }
                    }
                    return careerDetails.length > 0 ? (
                      <div className="detail-subsection">
                        <h5>경력기술서</h5>
                        {careerDetails.map((detail, idx) => (
                          <div key={idx} className="detail-career-detail-item">
                            <h6>경력기술서 {idx + 1}</h6>
                            <p className="detail-career-detail-text">{detail}</p>
                          </div>
                        ))}
                      </div>
                    ) : null;
                  })()}

                  {/* 경력세부내용 (PDF 전용: 경력기술서 섹션 통째로) */}
                  {selectedResult.applicationData.careerDetailContent?.trim() ? (
                    <div className="detail-subsection">
                      <h5>경력세부내용</h5>
                      <p className="detail-career-detail-text">{selectedResult.applicationData.careerDetailContent.trim()}</p>
                    </div>
                  ) : null}
                  
                  {(!selectedResult.applicationData.certificateName1 && 
                    !selectedResult.applicationData.careerCompanyName1 && 
                    !selectedResult.applicationData.universityName1 && 
                    !selectedResult.applicationData.graduateSchoolName1 &&
                    !selectedResult.applicationData.selfIntroduction1 &&
                    !selectedResult.applicationData.careerDetailDescription1 &&
                    !selectedResult.applicationData.careerDetailContent) && (
                    <div className="detail-placeholder">
                      <p>추출된 데이터가 없습니다.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="detail-placeholder">
                  <p>이력서 파싱이 완료되지 않았습니다.</p>
                </div>
              )}
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
              {currentAiReportParsed && typeof currentAiReport === 'object' ? (
                <div className="ai-report-structured">
                  <div className="ai-report-grade">
                    <span className="ai-report-grade-label">등급</span>
                    <span className={`ai-report-grade-value grade-${(currentAiReport.grade || '').toLowerCase()}`}>
                      {aiGradeLabel(currentAiReport.grade)}
                    </span>
                  </div>
                  
                  {currentAiReport.summary && currentAiReport.summary.trim() && (
                    <div className="ai-report-section">
                      <h4 className="ai-report-section-title">평가 요약</h4>
                      <p className="ai-report-summary">{currentAiReport.summary}</p>
                    </div>
                  )}
                  
                  {currentAiReport.gradeEvaluations && typeof currentAiReport.gradeEvaluations === 'object' && (
                    <div className="ai-report-section ai-report-grade-evaluations">
                      <h4 className="ai-report-section-title">등급별 판정 및 근거</h4>
                      <div className="grade-evaluations-list">
                        {['상', '중', '하'].map((gradeName, index) => {
                          const labels: Record<string, string> = { '상': 'A (상)', '중': 'B (중)', '하': 'C (하)' };
                          const ev = (currentAiReport.gradeEvaluations as Record<string, { satisfied?: boolean; reason?: string }>)?.[gradeName];
                          if (!ev) return null;
                          const satisfied = ev.satisfied ? '✓ 만족' : '✗ 불만족';
                          const reason = (ev.reason || '').trim() || '—';
                          return (
                            <div key={gradeName} className="grade-evaluation-item">
                              <div className="grade-evaluation-header">
                                <span className="grade-evaluation-name">{labels[gradeName] ?? gradeName}</span>
                                <span className={`grade-evaluation-verdict ${ev.satisfied ? 'satisfied' : 'unsatisfied'}`}>{satisfied}</span>
                              </div>
                              <p className="grade-evaluation-reason">{reason}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {currentAiReport.evaluations && typeof currentAiReport.evaluations === 'object' && (currentAiReport.evaluations as { requiredQual?: string; requiredQualReason?: string }).requiredQual != null && (
                    <div className="ai-report-section ai-report-required-qual">
                      <h4 className="ai-report-section-title">필수사항 판정 및 근거</h4>
                      <div className="grade-evaluation-item">
                        <div className="grade-evaluation-header">
                          <span className="grade-evaluation-name">필수사항 만족여부</span>
                          <span className={`grade-evaluation-verdict ${(currentAiReport.evaluations as { requiredQual?: string }).requiredQual === '◎' ? 'satisfied' : 'unsatisfied'}`}>
                            {(currentAiReport.evaluations as { requiredQual?: string }).requiredQual === '◎' ? '✓ 만족' : (currentAiReport.evaluations as { requiredQual?: string }).requiredQual === 'X' ? '✗ 불만족' : (currentAiReport.evaluations as { requiredQual?: string }).requiredQual || '—'}
                          </span>
                        </div>
                        <p className="grade-evaluation-reason">
                          {((currentAiReport.evaluations as { requiredQualReason?: string }).requiredQualReason || '').trim() || '—'}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {currentAiReport.strengths && currentAiReport.strengths.length > 0 && (
                    <div className="ai-report-section">
                      <h4 className="ai-report-section-title">주요 강점</h4>
                      <ul className="ai-report-list ai-report-strengths">
                        {currentAiReport.strengths.map((strength, index) => (
                          <li key={index}>{strength}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {currentAiReport.weaknesses && currentAiReport.weaknesses.length > 0 && (
                    <div className="ai-report-section">
                      <h4 className="ai-report-section-title">주요 약점</h4>
                      <ul className="ai-report-list ai-report-weaknesses">
                        {currentAiReport.weaknesses.map((weakness, index) => (
                          <li key={index}>{weakness}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {currentAiReport.opinion && currentAiReport.opinion.trim() && (
                    <div className="ai-report-section">
                      <h4 className="ai-report-section-title">종합 의견</h4>
                      <div className="ai-report-opinion">{currentAiReport.opinion}</div>
                    </div>
                  )}
                  
                  {(!currentAiReport.summary || !currentAiReport.summary.trim()) && 
                   (!currentAiReport.opinion || !currentAiReport.opinion.trim()) && 
                   (!currentAiReport.strengths || currentAiReport.strengths.length === 0) && 
                   (!currentAiReport.weaknesses || currentAiReport.weaknesses.length === 0) && (
                    <div className="ai-report-section">
                      <p className="ai-report-empty">AI 분석 결과가 비어있습니다. 원본 응답을 확인해주세요.</p>
                    </div>
                  )}
                </div>
              ) : (
                <pre className="ai-report-text">{typeof currentAiReport === 'string' ? currentAiReport : JSON.stringify(currentAiReport, null, 2)}</pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI 프롬프트 미리보기 모달 */}
      {showPromptsModal && (
        <div className="status-modal-overlay" onClick={() => { setShowPromptsModal(false); setPromptsPreview(null); setPromptsPreviewError(null); }}>
          <div className="prompts-preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="status-modal-header">
              <h3>AI 프롬프트 미리보기</h3>
              <button className="status-modal-close" onClick={() => { setShowPromptsModal(false); setPromptsPreview(null); setPromptsPreviewError(null); }}>
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
                    <textarea
                      className="prompts-preview-textarea"
                      readOnly
                      value={promptsPreview.systemPrompt}
                      rows={12}
                    />
                  </div>
                  <div className="prompts-preview-section">
                    <h4 className="prompts-preview-label">User prompt</h4>
                    <textarea
                      className="prompts-preview-textarea"
                      readOnly
                      value={promptsPreview.userPromptText}
                      rows={16}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
