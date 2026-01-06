import { useState } from 'react';
import JobConfigForm from './components/JobConfigForm';
import './styles/app.css';

function App() {
  return (
    <div className="app">
      <div className="app-header">
        <h1 className="app-title">이력서 적합도 평가 시스템</h1>
        <p className="app-description">DOCX 이력서 파일들을 분석하여 채용 공고와의 적합도를 점수화합니다.</p>
      </div>
      <JobConfigForm />
    </div>
  );
}

export default App;
