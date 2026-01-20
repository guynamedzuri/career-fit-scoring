import '../styles/loading-spinner.css';

interface LoadingSpinnerProps {
  message?: string;
  fullScreen?: boolean;
}

export default function LoadingSpinner({ message = '처리 중...', fullScreen = false }: LoadingSpinnerProps) {
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
      </div>
    </div>
  );
}
