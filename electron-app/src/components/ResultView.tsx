import { useState, useMemo, useEffect } from 'react';
import { Search, ChevronUp, ChevronDown, Download, Info, AlertCircle, CheckCircle2 } from 'lucide-react';
import '../styles/result-view.css';

interface DocxFile {
  name: string;
  path: string;
}

interface ScoringResult {
  fileName: string;
  filePath: string;
  certificationScore: number;
  careerScore: number;
  educationScore: number;
  totalScore: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  errorMessage?: string;
  applicationData?: any;
}

interface ResultViewProps {
  selectedFiles: DocxFile[];
  jobMetadata: any;
  onBack: () => void;
}

type SortField = 'name' | 'certification' | 'career' | 'education' | 'totalScore' | 'status';
type SortOrder = 'asc' | 'desc';

export default function ResultView({ selectedFiles, jobMetadata, onBack }: ResultViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('totalScore');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [results, setResults] = useState<ScoringResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedResult, setSelectedResult] = useState<ScoringResult | null>(null);

  // TODO: 실제로 DOCX 파일을 파싱하고 점수를 계산하는 로직 구현
  // 지금은 임시로 플레이스홀더 데이터를 표시
  // 플레이스홀더: 선택된 파일들에 대해 초기 상태 설정
  useEffect(() => {
    const placeholderResults: ScoringResult[] = selectedFiles.map(file => ({
      fileName: file.name,
      filePath: file.path,
      certificationScore: 0,
      careerScore: 0,
      educationScore: 0,
      totalScore: 0,
      status: 'pending' as const,
    }));
    setResults(placeholderResults);
  }, [selectedFiles]);

  // 검색 및 정렬된 결과
  const filteredAndSortedResults = useMemo(() => {
    let filtered = results;

    // 검색 필터
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r => 
        r.fileName.toLowerCase().includes(query)
      );
    }

    // 정렬
    filtered.sort((a, b) => {
      let compareA: any, compareB: any;

      switch (sortField) {
        case 'name':
          compareA = a.fileName;
          compareB = b.fileName;
          break;
        case 'certification':
          compareA = a.certificationScore;
          compareB = b.certificationScore;
          break;
        case 'career':
          compareA = a.careerScore;
          compareB = b.careerScore;
          break;
        case 'education':
          compareA = a.educationScore;
          compareB = b.educationScore;
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
  }, [results, searchQuery, sortField, sortOrder]);

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

  // XLSX 다운로드 (TODO: 구현 필요)
  const handleDownloadXlsx = () => {
    // TODO: XLSX 다운로드 구현
    console.log('Download XLSX:', filteredAndSortedResults);
  };

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
      <div className="result-view-header">
        <button className="back-btn" onClick={onBack}>
          ← 뒤로가기
        </button>
        <div className="result-view-title-section">
          <h1 className="result-view-title">점수 결과</h1>
          {jobMetadata && (
            <div className="job-info-summary">
              <span className="job-info-label">채용 직종:</span>
              <span className="job-info-value">{jobMetadata.jobName || 'N/A'}</span>
              <span className="job-info-separator">|</span>
              <span className="job-info-label">처리 대상:</span>
              <span className="job-info-value">{selectedFiles.length}개 파일</span>
            </div>
          )}
        </div>
      </div>

      {/* 검색 + 다운로드 */}
      <div className="candidate-search-row">
        <div className="candidate-search">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="파일명 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
        <button 
          className="download-btn"
          onClick={handleDownloadXlsx}
          disabled={filteredAndSortedResults.length === 0}
          title="Raw Data 다운로드"
        >
          <Download size={16} />
          Raw Data
        </button>
      </div>

      {/* 테이블 헤더 */}
      <div className="candidate-table-header">
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
            파일명 <SortIcon field="name" />
          </div>
        </div>
        <div className="table-cell cell-certification">
          <div 
            className={`sortable ${sortField === 'certification' ? 'active' : ''}`}
            onClick={() => handleSort('certification')}
          >
            자격증 점수 <SortIcon field="certification" />
          </div>
        </div>
        <div className="table-cell cell-career">
          <div 
            className={`sortable ${sortField === 'career' ? 'active' : ''}`}
            onClick={() => handleSort('career')}
          >
            경력 점수 <SortIcon field="career" />
          </div>
        </div>
        <div className="table-cell cell-education">
          <div 
            className={`sortable ${sortField === 'education' ? 'active' : ''}`}
            onClick={() => handleSort('education')}
          >
            학력 점수 <SortIcon field="education" />
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
              className={`candidate-row ${result.status === 'error' ? 'row-error' : ''} ${selectedResult?.filePath === result.filePath ? 'row-selected' : ''}`}
              onClick={() => setSelectedResult(selectedResult?.filePath === result.filePath ? null : result)}
            >
              <div className="table-cell cell-status">
                <div className="status-cell">
                  <StatusIcon status={result.status} />
                  <span className="status-text">{getStatusText(result.status)}</span>
                </div>
              </div>
              <div className="table-cell cell-name">
                <div className="candidate-info">
                  <span className="candidate-name">{result.fileName}</span>
                  {result.errorMessage && (
                    <span className="candidate-error">{result.errorMessage}</span>
                  )}
                </div>
              </div>
              <div className="table-cell cell-certification">
                {result.status === 'completed' ? result.certificationScore.toFixed(1) : '-'}
              </div>
              <div className="table-cell cell-career">
                {result.status === 'completed' ? result.careerScore.toFixed(1) : '-'}
              </div>
              <div className="table-cell cell-education">
                {result.status === 'completed' ? result.educationScore.toFixed(1) : '-'}
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
              <h4>점수 상세</h4>
              <div className="detail-item">
                <span className="detail-label">자격증 점수:</span>
                <span className="detail-value">
                  {selectedResult.status === 'completed' ? selectedResult.certificationScore.toFixed(1) : 'N/A'}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">경력 점수:</span>
                <span className="detail-value">
                  {selectedResult.status === 'completed' ? selectedResult.careerScore.toFixed(1) : 'N/A'}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">학력 점수:</span>
                <span className="detail-value">
                  {selectedResult.status === 'completed' ? selectedResult.educationScore.toFixed(1) : 'N/A'}
                </span>
              </div>
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
    </div>
  );
}
