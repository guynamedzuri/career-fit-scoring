import { useState, useMemo } from 'react';
import { Search, ChevronUp, ChevronDown, Download } from 'lucide-react';
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
  applicationData?: any;
}

interface ResultViewProps {
  selectedFiles: DocxFile[];
  jobMetadata: any;
  onBack: () => void;
}

type SortField = 'name' | 'career' | 'education' | 'totalScore';
type SortOrder = 'asc' | 'desc';

export default function ResultView({ selectedFiles, jobMetadata, onBack }: ResultViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('totalScore');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [results, setResults] = useState<ScoringResult[]>([]);
  const [loading, setLoading] = useState(false);

  // TODO: 실제로 DOCX 파일을 파싱하고 점수를 계산하는 로직 구현
  // 지금은 임시로 빈 결과를 표시

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

  return (
    <div className="result-view">
      <div className="result-view-header">
        <button className="back-btn" onClick={onBack}>
          ← 뒤로가기
        </button>
        <h1 className="result-view-title">점수 결과</h1>
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
        <div className="table-cell cell-name">
          <div 
            className={`sortable ${sortField === 'name' ? 'active' : ''}`}
            onClick={() => handleSort('name')}
          >
            파일명 <SortIcon field="name" />
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
            <div key={idx} className="candidate-row">
              <div className="table-cell cell-name">
                <div className="candidate-info">
                  <span className="candidate-name">{result.fileName}</span>
                </div>
              </div>
              <div className="table-cell cell-career">
                {result.careerScore.toFixed(1)}
              </div>
              <div className="table-cell cell-education">
                {result.educationScore.toFixed(1)}
              </div>
              <div className="table-cell cell-score">
                {result.totalScore.toFixed(1)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
