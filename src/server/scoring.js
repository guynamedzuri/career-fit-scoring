/**
 * 서버 사이드 점수 계산 모듈 (Node.js)
 * 
 * 클라이언트 사이드와 동일한 로직을 JavaScript로 구현
 */

/**
 * 재직 기간 계산 함수 (년월 차이 기반)
 */
function calculateEmploymentPeriod(startDate, endDate) {
  const yearDiff = endDate.getFullYear() - startDate.getFullYear();
  const monthDiff = endDate.getMonth() - startDate.getMonth();
  let totalMonths = yearDiff * 12 + monthDiff;
  
  if (endDate.getDate() < startDate.getDate()) {
    totalMonths -= 1;
  }
  
  if (totalMonths < 0) totalMonths = 0;
  
  return { totalMonths };
}

/**
 * 자격증 이름 정규화
 */
function normalizeCertName(name) {
  return name.toLowerCase().trim().replace(/\s+/g, '');
}

/**
 * 자격증 매칭 점수 계산
 */
function calculateMatchScore(cert, target) {
  const certNorm = normalizeCertName(cert);
  const targetNorm = normalizeCertName(target);
  
  if (certNorm === targetNorm) {
    return 1.0;
  }
  
  if (certNorm.includes(targetNorm) || targetNorm.includes(certNorm)) {
    const shorter = Math.min(certNorm.length, targetNorm.length);
    const longer = Math.max(certNorm.length, targetNorm.length);
    return 0.8 + (shorter / longer) * 0.2;
  }
  
  const certWords = certNorm.split(/[^가-힣a-z0-9]+/).filter(w => w.length >= 2);
  const targetWords = targetNorm.split(/[^가-힣a-z0-9]+/).filter(w => w.length >= 2);
  
  if (certWords.length > 0 && targetWords.length > 0) {
    const commonWords = certWords.filter(w => targetWords.includes(w));
    if (commonWords.length > 0) {
      const matchRatio = commonWords.length / Math.max(certWords.length, targetWords.length);
      return Math.min(0.7, matchRatio * 0.7);
    }
  }
  
  return 0;
}

/**
 * 자격증 점수 계산
 */
function calculateCertificationScore(params) {
  const { applicantCertifications, requiredCertifications, relatedCertifications } = params;
  
  let score = 0;
  
  if (requiredCertifications.length === 0) {
    score += 5;
  } else if (requiredCertifications.length === 1) {
    const matchedRequired = applicantCertifications.filter(cert => 
      requiredCertifications.some(req => calculateMatchScore(cert, req) >= 0.5)
    );
    if (matchedRequired.length >= 1) {
      score += 5;
    }
  } else {
    const matchedRequired = applicantCertifications.filter(cert => 
      requiredCertifications.some(req => calculateMatchScore(cert, req) >= 0.5)
    );
    if (matchedRequired.length >= 2) {
      score += 5;
    } else if (matchedRequired.length === 1) {
      score += 3;
    }
  }
  
  const nonRequiredRelated = relatedCertifications.filter(rel => {
    return !requiredCertifications.some(req => calculateMatchScore(rel, req) >= 0.7);
  });
  
  if (nonRequiredRelated.length > 0) {
    const matchedRelated = applicantCertifications.filter(cert => {
      return nonRequiredRelated.some(rel => calculateMatchScore(cert, rel) >= 0.5);
    });
    if (matchedRelated.length >= 3) {
      score += 3;
    } else if (matchedRelated.length === 2) {
      score += 2;
    } else if (matchedRelated.length === 1) {
      score += 1;
    }
  }
  
  const totalCertCount = applicantCertifications.length;
  if (totalCertCount >= 7) {
    score += 2;
  } else if (totalCertCount >= 4) {
    score += 1;
  }
  
  return Math.min(score, 10);
}

/**
 * 경력 점수 계산
 */
function calculateCareerScore(applicantCareers, jobAptdCode, jobdicSeq, applicantAge) {
  if (!applicantCareers || applicantCareers.length === 0) {
    return 0;
  }
  
  let relatedJobScore = 0;
  let careerDurationScore = 0;
  
  if (jobAptdCode || jobdicSeq) {
    let hasRelatedJob = false;
    let hasExactJob = false;
    
    applicantCareers.forEach(career => {
      if (jobdicSeq && career.jobTypeCode && career.jobTypeCode === jobdicSeq) {
        hasExactJob = true;
      }
      if (jobAptdCode && career.jobTypeAptdCode && career.jobTypeAptdCode === jobAptdCode) {
        hasRelatedJob = true;
      }
    });
    
    if (hasExactJob) {
      relatedJobScore = 10;
    } else if (hasRelatedJob) {
      relatedJobScore = 5;
    }
  }
  
  let maxCareerDuration = 0;
  let hasValidCareer = false;
  
  applicantCareers.forEach(career => {
    if (career.startDate) {
      const start = new Date(career.startDate);
      const end = career.endDate ? new Date(career.endDate) : (career.employmentStatus === '재직중' ? new Date() : null);
      
      if (end) {
        hasValidCareer = true;
        const period = calculateEmploymentPeriod(start, end);
        const days = period.totalMonths * 30;
        maxCareerDuration = Math.max(maxCareerDuration, days);
      }
    }
  });
  
  if (hasValidCareer && maxCareerDuration > 0 && applicantAge > 20) {
    const workingPeriodYears = applicantAge - 20;
    const workingPeriodDays = workingPeriodYears * 365.25;
    const ratio = maxCareerDuration / workingPeriodDays;
    
    if (ratio >= 0.8) {
      careerDurationScore = 10;
    } else if (ratio >= 0.6) {
      careerDurationScore = 8;
    } else if (ratio >= 0.3) {
      careerDurationScore = 6;
    } else if (ratio > 0) {
      careerDurationScore = 3;
    } else {
      careerDurationScore = 0;
    }
  }
  
  return relatedJobScore + careerDurationScore;
}

/**
 * 학력 점수 계산
 */
function calculateEducationScore(applicantEducations, jobMajorNm, jobMajorSeq, jobRelatedMajors) {
  if (!applicantEducations || applicantEducations.length === 0) {
    return 0;
  }
  
  let educationDegreeScore = 0;
  applicantEducations.forEach(edu => {
    let score = 0;
    switch (edu.degreeType) {
      case '고졸':
        score = 1;
        break;
      case '전문학사':
      case '학사':
        score = 3;
        break;
      case '석사':
      case '박사':
        score = 5;
        break;
    }
    educationDegreeScore = Math.max(educationDegreeScore, score);
  });
  
  const relatedMajorScore = calculateRelatedMajorScore(applicantEducations, jobMajorNm, jobMajorSeq, jobRelatedMajors);
  const gpaScore = calculateGpaScore(applicantEducations);
  
  return Math.min(educationDegreeScore + relatedMajorScore + gpaScore, 20);
}

function calculateRelatedMajorScore(applicantEducations, jobMajorNm, jobMajorSeq, jobRelatedMajors) {
  if (!applicantEducations || applicantEducations.length === 0) {
    return 0;
  }
  
  const relatedMajors = [];
  if (jobRelatedMajors && jobRelatedMajors.length > 0) {
    relatedMajors.push(...jobRelatedMajors);
  } else if (jobMajorNm || jobMajorSeq) {
    relatedMajors.push({
      majorNm: jobMajorNm || '',
      majorSeq: jobMajorSeq || ''
    });
  }
  
  if (relatedMajors.length === 0) {
    return 0;
  }
  
  let hasMajorNmMatch = false;
  let hasMajorSeqMatch = false;
  
  applicantEducations.forEach(edu => {
    relatedMajors.forEach(jobMajor => {
      if (jobMajor.majorNm && edu.majorNm && 
          edu.majorNm.trim() === jobMajor.majorNm.trim()) {
        hasMajorNmMatch = true;
      }
      if (jobMajor.majorSeq && edu.majorSeq && 
          edu.majorSeq === jobMajor.majorSeq) {
        if (!jobMajor.majorNm || !edu.majorNm || 
            edu.majorNm.trim() !== jobMajor.majorNm.trim()) {
          hasMajorSeqMatch = true;
        }
      }
    });
  });
  
  if (hasMajorNmMatch) {
    return 10;
  } else if (hasMajorSeqMatch) {
    return 7;
  }
  
  return 0;
}

function calculateGpaScore(applicantEducations) {
  if (!applicantEducations || applicantEducations.length === 0) {
    return 0;
  }
  
  let maxGpaScore = 0;
  applicantEducations.forEach(edu => {
    if (edu.gpa !== undefined && edu.maxGpa !== undefined && edu.maxGpa > 0) {
      const percentage = (edu.gpa / edu.maxGpa) * 100;
      let score = 0;
      if (percentage >= 88) {
        score = 5;
      } else if (percentage >= 66) {
        score = 2;
      }
      maxGpaScore = Math.max(maxGpaScore, score);
    }
  });
  
  return maxGpaScore;
}

/**
 * 총점 계산
 */
function calculateTotalScore(certificationScore, careerScore, educationScore, weights) {
  const totalWeight = weights.certification + weights.career + weights.education;
  if (totalWeight === 0) {
    return 0;
  }
  
  const certWeighted = (certificationScore / 10) * (weights.certification / totalWeight) * 100;
  const careerWeighted = (careerScore / 20) * (weights.career / totalWeight) * 100;
  const educationWeighted = (educationScore / 20) * (weights.education / totalWeight) * 100;
  
  return Math.round((certWeighted + careerWeighted + educationWeighted) * 10) / 10;
}

/**
 * 지원자 점수 통합 계산
 */
function calculateApplicantScores(applicationData, job) {
  if (!job?.aiMetadata) {
    return null;
  }
  
  const getAge = (birthDate) => {
    if (!birthDate) return 0;
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };
  
  const applicantCertifications = extractCertifications(applicationData);
  const certificationScore = calculateCertificationScore({
    applicantCertifications,
    requiredCertifications: job.aiMetadata.requiredCertifications || [],
    relatedCertifications: job.aiMetadata.relatedCertifications || [],
  });
  
  const applicantCareers = extractCareers(applicationData);
  const applicantAge = getAge(applicationData.birthDate) || 0;
  const careerScore = calculateCareerScore(
    applicantCareers,
    job.aiMetadata.jobAptdCode,
    job.aiMetadata.jobdicSeq,
    applicantAge
  );
  
  const applicantEducations = extractEducations(applicationData);
  const educationScore = calculateEducationScore(
    applicantEducations,
    job.aiMetadata.relatedMajorNm,
    job.aiMetadata.relatedMajorSeq,
    job.aiMetadata.relatedMajors
  );
  
  const weights = job.aiMetadata.scoringWeights || {
    certification: 1,
    career: 1,
    education: 1,
  };
  
  const totalScore = calculateTotalScore(
    certificationScore,
    careerScore,
    educationScore,
    weights
  );
  
  return {
    certificationScore,
    careerScore,
    educationScore,
    totalScore,
  };
}

function extractCertifications(applicationData) {
  const certifications = [];
  for (let i = 1; i <= 10; i++) {
    const certName = applicationData[`certificateName${i}`];
    if (certName && certName.trim()) {
      certifications.push(certName.trim());
    }
  }
  return certifications;
}

function extractCareers(applicationData) {
  const careers = [];
  for (let i = 1; i <= 5; i++) {
    const startDate = applicationData[`careerStartDate${i}`];
    const endDate = applicationData[`careerEndDate${i}`];
    const employmentStatus = applicationData[`careerEmploymentStatus${i}`];
    const jobTypeName = applicationData[`careerJobType${i}`];
    const jobTypeAptdCode = applicationData[`careerJobTypeAptdCode${i}`];
    const jobTypeCode = applicationData[`careerJobTypeCode${i}`];
    const companyName = applicationData[`careerCompanyName${i}`];
    const department = applicationData[`careerDepartment${i}`];
    const position = applicationData[`careerPosition${i}`];
    
    if (startDate) {
      careers.push({
        jobTypeName: jobTypeName || undefined,
        jobTypeAptdCode: jobTypeAptdCode || undefined,
        jobTypeCode: jobTypeCode || undefined,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        employmentStatus: employmentStatus || undefined,
        companyName: companyName || undefined,
        department: department || undefined,
        position: position || undefined,
      });
    }
  }
  return careers;
}

function extractEducations(applicationData) {
  const educations = [];
  
  if (applicationData.highSchoolGraduationType === '졸업' || applicationData.highSchoolGraduationType === '검정고시') {
    educations.push({
      degreeType: '고졸',
      schoolName: applicationData.highSchoolName || undefined,
      graduationType: applicationData.highSchoolGraduationType || undefined,
    });
  }
  
  for (let i = 1; i <= 5; i++) {
    const degreeType = applicationData[`universityDegreeType${i}`];
    const graduationType = applicationData[`universityGraduationType${i}`];
    const schoolName = applicationData[`universityName${i}`];
    
    if (degreeType && graduationType) {
      const gpaStr = applicationData[`universityGPA${i}`];
      const gpaMaxStr = applicationData[`universityGPAMax${i}`];
      const gpa = gpaStr ? parseFloat(String(gpaStr).trim()) : undefined;
      const maxGpa = gpaMaxStr ? parseFloat(String(gpaMaxStr).trim()) : undefined;
      
      for (let major = 1; major <= 4; major++) {
        const majorName = applicationData[`universityMajor${i}_${major}`];
        if (majorName && majorName.trim()) {
          educations.push({
            degreeType: degreeType === '전문학사' ? '전문학사' : '학사',
            schoolName: schoolName || undefined,
            graduationType: graduationType || undefined,
            majorSeq: applicationData[`universityMajorSeq${i}_${major}`] || undefined,
            majorNm: applicationData[`universityMajorNm${i}_${major}`] || undefined,
            gpa: gpa,
            maxGpa: maxGpa,
          });
        }
      }
    }
  }
  
  for (let i = 1; i <= 5; i++) {
    const degreeType = applicationData[`graduateSchoolDegreeType${i}`];
    const graduationType = applicationData[`graduateSchoolGraduationType${i}`];
    const schoolName = applicationData[`graduateSchoolName${i}`];
    
    if (degreeType && graduationType) {
      const gpaStr = applicationData[`graduateSchoolGPA${i}`];
      const gpaMaxStr = applicationData[`graduateSchoolGPAMax${i}`];
      const gpa = gpaStr ? parseFloat(String(gpaStr).trim()) : undefined;
      const maxGpa = gpaMaxStr ? parseFloat(String(gpaMaxStr).trim()) : undefined;
      
      for (let major = 1; major <= 4; major++) {
        const majorName = applicationData[`graduateSchoolMajor${i}_${major}`];
        if (majorName && majorName.trim()) {
          educations.push({
            degreeType: degreeType === '석사' ? '석사' : '박사',
            schoolName: schoolName || undefined,
            graduationType: graduationType || undefined,
            majorSeq: applicationData[`graduateSchoolMajorSeq${i}_${major}`] || undefined,
            majorNm: applicationData[`graduateSchoolMajorNm${i}_${major}`] || undefined,
            gpa: gpa,
            maxGpa: maxGpa,
          });
        }
      }
    }
  }
  
  return educations;
}

module.exports = {
  calculateCertificationScore,
  calculateCareerScore,
  calculateEducationScore,
  calculateTotalScore,
  calculateApplicantScores,
  extractCertifications,
  extractCareers,
  extractEducations,
};
