import { useState, useMemo, useEffect } from 'react';
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
  searchableText?: string; // 검색 가능한 전체 텍스트 (이름, 회사, 자격증 등 모든 정보)
}

interface ResultViewProps {
  selectedFiles: DocxFile[];
  jobMetadata: any;
  onBack: () => void;
}

type SortField = 'name' | 'age' | 'lastCompany' | 'totalScore' | 'status';
type SortOrder = 'asc' | 'desc';

export default function ResultView({ selectedFiles, jobMetadata, onBack }: ResultViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('totalScore');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [results, setResults] = useState<ScoringResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedResult, setSelectedResult] = useState<ScoringResult | null>(null);
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set()); // 선택된 후보자 filePath Set
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState({
    minAge: '',
    maxAge: '',
    minScore: '',
    maxScore: '',
    company: '',
    status: '' as '' | 'pending' | 'processing' | 'completed' | 'error',
  });

  // TODO: 실제로 DOCX 파일을 파싱하고 점수를 계산하는 로직 구현
  // 지금은 임시로 플레이스홀더 데이터를 표시
  // 플레이스홀더: 선택된 파일들에 대해 초기 상태 설정
  useEffect(() => {
      const placeholderResults: ScoringResult[] = selectedFiles.map(file => ({
      fileName: file.name,
      filePath: file.path,
      totalScore: 0,
      status: 'pending' as const,
      candidateStatus: 'pending' as const, // 초기 상태는 대기
      name: undefined, // TODO: DOCX 파싱 후 실제 이름으로 교체
      age: undefined,
      lastCompany: undefined,
      lastSalary: undefined,
      searchableText: file.name, // 초기값은 파일명
    }));
    setResults(placeholderResults);
  }, [selectedFiles]);

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
        case 'totalScore':
          compareA = a.totalScore;
          compareB = b.totalScore;
          break;
        case 'status':
          const statusOrder = { error: 0, pending: 1, processing: 2, completed: 3 };
          compareA = statusOrder[a.status] ?? 0;
          compareB = statusOrder[b.status] ?? 0;
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
      status: '',
    });
  };

  // 전체 선택 여부 확인
  const isAllSelected = filteredAndSortedResults.length > 0 && 
    selectedCandidates.size === filteredAndSortedResults.length;

  // 상태 표시 아이콘
  const StatusIcon = ({ status }: { status: ScoringResult['status'] }) => {
    switch (status) {
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

  // 상태 텍스트
  const getStatusText = (status: ScoringResult['status']) => {
    switch (status) {
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
        {jobMetadata && (
          <div className="job-info-summary">
            <span className="job-info-label">채용 직종:</span>
            <span className="job-info-value">{jobMetadata.jobName || 'N/A'}</span>
            <span className="job-info-separator">|</span>
            <span className="job-info-label">대상:</span>
            <span className="job-info-value">{selectedFiles.length}명</span>
          </div>
        )}
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
        <div className="table-cell cell-score">
          <div 
            className={`sortable ${sortField === 'totalScore' ? 'active' : ''}`}
            onClick={() => handleSort('totalScore')}
          >
            총점수 <SortIcon field="totalScore" />
          </div>
        </div>
        <div className="table-cell cell-actions">
          <div>상세</div>
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
                  <StatusIcon status={result.status} />
                  <span className="status-text">{getStatusText(result.status)}</span>
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
              <div className="table-cell cell-score">
                {result.status === 'completed' ? (
                  <span className="score-value">{result.totalScore.toFixed(1)}</span>
                ) : (
                  <span className="score-placeholder">-</span>
                )}
              </div>
              <div className="table-cell cell-actions">
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
            </div>
          ))
        )}
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
            <div className="status-modal-header">
              <h3>상세 필터</h3>
              <button className="status-modal-close" onClick={() => setShowFilterModal(false)}>
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

              <div className="filter-actions">
                <button className="filter-reset-btn" onClick={resetFilters}>
                  초기화
                </button>
                <button className="filter-apply-btn" onClick={applyFilters}>
                  적용
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
