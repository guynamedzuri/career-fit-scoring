import '../styles/loading-spinner.css';

interface LoadingSpinnerProps {
  message?: string;
  fullScreen?: boolean;
  progress?: {
    current: number;
    total: number;
    currentFile?: string;
  };
}

export default function LoadingSpinner({ message = '처리 중...', fullScreen = false, progress }: LoadingSpinnerProps) {
  const progressPercent = progress && progress.total > 0 
    ? ((progress.current + 1) / progress.total) * 100 
    : 0;

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
          </div>
        )}
      </div>
    </div>
  );
}
