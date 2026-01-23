import '../styles/loading-spinner.css';

// 예상 시간 포맷팅 함수
function formatEstimatedTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  if (minutes > 0) {
    return `${minutes}분 ${seconds}초`;
  } else {
    return `${seconds}초`;
  }
}

interface LoadingSpinnerProps {
  message?: string;
  fullScreen?: boolean;
  progress?: {
    current: number;
    total: number;
    currentFile?: string;
    estimatedTimeRemainingMs?: number;
  };
}

export default function LoadingSpinner({ message = '처리 중...', fullScreen = false, progress }: LoadingSpinnerProps) {
  console.log('[LoadingSpinner] progress prop:', progress);
  const progressPercent = progress && progress.total > 0 
    ? ((progress.current + 1) / progress.total) * 100 
    : 0;
  console.log('[LoadingSpinner] progressPercent:', progressPercent, 'total:', progress?.total);

  return (
    <div className={`loading-spinner-overlay ${fullScreen ? 'fullscreen' : ''}`}>
      <div className="loading-spinner-container">
        <div className="loading-spinner">
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
        </div>
        <div className="loading-spinner-message">{message}</div>
        
        {/* 프로그레스 바 */}
        {progress && progress.total > 0 && (
          <div className="loading-spinner-progress">
            <div className="loading-progress-header">
              <span className="loading-progress-count">
                {progress.current + 1} / {progress.total}
              </span>
            </div>
            <div className="loading-progress-bar-wrapper">
              <div 
                className="loading-progress-bar" 
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {progress.currentFile && (
              <div className="loading-progress-file">
                {progress.currentFile}
              </div>
            )}
            {progress.estimatedTimeRemainingMs !== undefined && progress.estimatedTimeRemainingMs > 0 && (
              <div className="loading-progress-eta">
                예상 완료 시간: {formatEstimatedTime(progress.estimatedTimeRemainingMs)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
