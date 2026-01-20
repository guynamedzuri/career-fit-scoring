"use strict";
/**
 * 자격증 점수 산출 알고리즘
 *
 * 이 알고리즘은 지원자의 자격증이 채용 직종과 얼마나 관련이 있는지 체크하여 점수를 산출합니다.
 * AI 비용 절감을 위해 알고리즘 기반으로만 작동하며, 자격증, 경력, 학력을 세분야로 나누어 평가합니다.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateCertificationScore = calculateCertificationScore;
exports.calculateTotalScore = calculateTotalScore;
exports.calculateCareerScore = calculateCareerScore;
exports.calculateEducationScore = calculateEducationScore;
exports.calculateRelatedMajorScore = calculateRelatedMajorScore;
exports.calculateGpaScore = calculateGpaScore;
exports.calculateAllScores = calculateAllScores;
exports.extractCertifications = extractCertifications;
exports.extractCareers = extractCareers;
exports.extractEducations = extractEducations;
/**
 * 자격증 이름 정규화 (공백 제거, 소문자 변환)
 */
function normalizeCertName(name) {
    return name.toLowerCase().trim().replace(/\s+/g, '');
}
/**
 * 자격증 매칭 점수 계산 (0-1 사이의 값)
 * 부분 일치, 키워드 일치 등을 고려하여 더 정확한 매칭 수행
 */
function calculateMatchScore(cert, target) {
    const certNorm = normalizeCertName(cert);
    const targetNorm = normalizeCertName(target);
    // 완전 일치
    if (certNorm === targetNorm) {
        return 1.0;
    }
    // 한쪽이 다른 쪽을 완전히 포함하는 경우
    if (certNorm.includes(targetNorm) || targetNorm.includes(certNorm)) {
        // 포함 비율에 따라 점수 조정
        const shorter = Math.min(certNorm.length, targetNorm.length);
        const longer = Math.max(certNorm.length, targetNorm.length);
        return 0.8 + (shorter / longer) * 0.2;
    }
    // 키워드 일치 (공통 단어 찾기)
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
 * 자격증 점수 계산 (10점 만점)
 *
 * 점수 체계:
 * - 필수 자격증: 2개 이상 일치 시 5점, 1개 일치 시 3점
 * - 관련 자격증: 3개 이상 일치 시 3점, 2개 일치 시 2점, 1개 일치 시 1점
 * - 총 자격증 개수: 7개 이상 시 2점, 4개 이상 시 1점
 * - 최대 10점
 */
function calculateCertificationScore(params) {
    const { applicantCertifications, requiredCertifications, relatedCertifications } = params;
    let score = 0;
    // 1. 필수 자격증 점수 (가장 높은 우선순위)
    if (requiredCertifications.length === 0) {
        // 필수 자격증이 없으면 모두에게 5점 부여
        score += 5;
    }
    else if (requiredCertifications.length === 1) {
        // 필수 자격증이 1개면 1개만 일치해도 5점
        const matchedRequired = applicantCertifications.filter(cert => requiredCertifications.some(req => {
            const matchScore = calculateMatchScore(cert, req);
            return matchScore >= 0.5; // 50% 이상 일치하면 매칭으로 간주
        }));
        if (matchedRequired.length >= 1) {
            score += 5; // 1개 이상 일치 = 5점
        }
    }
    else {
        // 필수 자격증이 2개 이상이면 기존 로직
        const matchedRequired = applicantCertifications.filter(cert => requiredCertifications.some(req => {
            const matchScore = calculateMatchScore(cert, req);
            return matchScore >= 0.5; // 50% 이상 일치하면 매칭으로 간주
        }));
        if (matchedRequired.length >= 2) {
            score += 5; // 2개 이상 일치 = 5점
        }
        else if (matchedRequired.length === 1) {
            score += 3; // 1개 일치 = 3점
        }
    }
    // 2. 관련 자격증 점수 (필수 자격증과 중복되지 않는 것만)
    const nonRequiredRelated = relatedCertifications.filter(rel => {
        const relNorm = normalizeCertName(rel);
        return !requiredCertifications.some(req => {
            const reqNorm = normalizeCertName(req);
            return calculateMatchScore(rel, req) >= 0.7; // 70% 이상 일치하면 중복으로 간주
        });
    });
    if (nonRequiredRelated.length > 0) {
        const matchedRelated = applicantCertifications.filter(cert => {
            return nonRequiredRelated.some(rel => {
                const matchScore = calculateMatchScore(cert, rel);
                return matchScore >= 0.5; // 50% 이상 일치하면 매칭으로 간주
            });
        });
        if (matchedRelated.length >= 3) {
            score += 3; // 3개 이상 = 3점
        }
        else if (matchedRelated.length === 2) {
            score += 2; // 2개 = 2점
        }
        else if (matchedRelated.length === 1) {
            score += 1; // 1개 = 1점
        }
    }
    // 3. 총 자격증 개수 점수 (다양성 보너스)
    const totalCertCount = applicantCertifications.length;
    if (totalCertCount >= 7) {
        score += 2; // 7개 이상 = 2점
    }
    else if (totalCertCount >= 4) {
        score += 1; // 4개 이상 = 1점
    }
    // 최대 10점 제한
    return Math.min(score, 10);
}
/**
 * 최종 평가 점수 계산
 *
 * 세분야(자격증, 경력, 학력) 점수를 비중에 따라 가중 평균하여 총점을 계산합니다.
 * 이 점수는 알고리즘 기반으로만 계산되며, AI 비용을 절감하기 위해 자동화된 심사에 사용됩니다.
 *
 * @param certificationScore 자격증 점수 (10점 만점)
 * @param careerScore 경력 점수 (20점 만점)
 * @param educationScore 학력 점수 (20점 만점)
 * @param weights 비중 설정
 * @returns 총점 (100점 만점)
 */
function calculateTotalScore(certificationScore, careerScore, educationScore, weights) {
    const totalWeight = weights.certification + weights.career + weights.education;
    if (totalWeight === 0) {
        return 0;
    }
    // 각 점수를 비중에 따라 계산
    // 자격증은 10점 만점, 경력과 학력은 20점 만점
    const certWeighted = (certificationScore / 10) * (weights.certification / totalWeight) * 100;
    const careerWeighted = (careerScore / 20) * (weights.career / totalWeight) * 100;
    const educationWeighted = (educationScore / 20) * (weights.education / totalWeight) * 100;
    return Math.round((certWeighted + careerWeighted + educationWeighted) * 10) / 10; // 소수점 첫째자리까지 반올림
}
/**
 * 경력 점수 계산 (20점 만점)
 *
 * 점수 체계:
 * - 관련 직종 점수 (10점 만점):
 *   - 한 번이라도 관련 직종(aptd_type_code가 같은)이면 5점
 *   - 완전 동일한 직종(jobdicSeq가 같은)이면 10점
 * - 경력 기간 점수 (10점 만점):
 *   - 가장 긴 경력 하나를 선택
 *   - 그 기간을 (나이-20년)으로 나눔
 *   - 80% 이상 = 10점, 60% 이상 80% 미만 = 8점, 30% 이상 60% 미만 = 6점, 0% 초과 30% 미만 = 3점, 0% (무경력) = 0점
 *
 * @param applicantCareers 지원자의 경력 목록
 * @param jobAptdCode 채용 공고의 직종 aptd_type_code
 * @param jobdicSeq 채용 공고의 직종 jobdicSeq
 * @param applicantAge 지원자의 나이
 * @returns 경력 점수 (20점 만점)
 */
function calculateCareerScore(applicantCareers, jobAptdCode, jobdicSeq, applicantAge) {
    if (!applicantCareers || applicantCareers.length === 0) {
        return 0;
    }
    let relatedJobScore = 0; // 관련 직종 점수 (0-10점)
    let careerDurationScore = 0; // 경력 기간 점수 (0-10점)
    // 1. 관련 직종 점수 계산
    if (jobAptdCode || jobdicSeq) {
        let hasRelatedJob = false; // aptd_type_code가 같은 직종이 있는지
        let hasExactJob = false; // jobdicSeq가 완전히 같은 직종이 있는지
        applicantCareers.forEach(career => {
            // 완전 동일한 직종 확인 (jobdicSeq 비교)
            if (jobdicSeq && career.jobTypeCode && career.jobTypeCode === jobdicSeq) {
                hasExactJob = true;
            }
            // 관련 직종 확인 (aptd_type_code 비교)
            if (jobAptdCode && career.jobTypeAptdCode && career.jobTypeAptdCode === jobAptdCode) {
                hasRelatedJob = true;
            }
        });
        if (hasExactJob) {
            relatedJobScore = 10; // 완전 동일한 직종 = 10점
        }
        else if (hasRelatedJob) {
            relatedJobScore = 5; // 관련 직종 = 5점
        }
    }
    // 재직 기간 계산 함수 (년월 차이 기반)
    const calculateEmploymentPeriod = (startDate, endDate) => {
        // 년월 차이 계산
        const yearDiff = endDate.getFullYear() - startDate.getFullYear();
        const monthDiff = endDate.getMonth() - startDate.getMonth();
        let totalMonths = yearDiff * 12 + monthDiff;
        // 일(day) 비교: 퇴직일의 day가 입사일의 day보다 낮으면 1개월 빼기
        if (endDate.getDate() < startDate.getDate()) {
            totalMonths -= 1;
        }
        // 음수 방지
        if (totalMonths < 0)
            totalMonths = 0;
        return { totalMonths };
    };
    // 2. 경력 기간 점수 계산
    // 가장 긴 경력 하나를 찾기
    let maxCareerDuration = 0; // 일 단위 (대략적으로 개월수 * 30)
    let hasValidCareer = false; // 유효한 경력(시작일이 있는)이 있는지 여부
    applicantCareers.forEach(career => {
        if (career.startDate) {
            const start = new Date(career.startDate);
            const end = career.endDate ? new Date(career.endDate) : (career.employmentStatus === '재직중' ? new Date() : null);
            if (end) {
                hasValidCareer = true;
                // 새로운 기간 계산 로직 사용
                const period = calculateEmploymentPeriod(start, end);
                // 일수로 변환 (대략적으로, 정확도는 중요하지 않음 - 비율 계산용)
                const days = period.totalMonths * 30;
                maxCareerDuration = Math.max(maxCareerDuration, days);
            }
        }
    });
    // 유효한 경력이 없거나 경력 기간이 0인 경우 경력 기간 점수는 0점
    if (hasValidCareer && maxCareerDuration > 0 && applicantAge > 20) {
        // 노동 가능 기간 (나이 - 20년)을 일 단위로 계산
        const workingPeriodYears = applicantAge - 20;
        const workingPeriodDays = workingPeriodYears * 365.25; // 윤년 고려
        // 비율 계산
        const ratio = maxCareerDuration / workingPeriodDays;
        // 구간별 점수 부여
        if (ratio >= 0.8) {
            careerDurationScore = 10; // 80% 이상 = 10점
        }
        else if (ratio >= 0.6) {
            careerDurationScore = 8; // 60% 이상 80% 미만 = 8점
        }
        else if (ratio >= 0.3) {
            careerDurationScore = 6; // 30% 이상 60% 미만 = 6점
        }
        else if (ratio > 0) {
            careerDurationScore = 3; // 0% 초과 30% 미만 = 3점
        }
        else {
            careerDurationScore = 0; // 0% (무경력) = 0점
        }
    }
    return relatedJobScore + careerDurationScore; // 총 20점 만점
}
/**
 * 학력 점수 계산 (20점 만점)
 *
 * 점수 체계:
 * - 학력 점수: 고졸 1점, 대졸(전문학사/학사) 3점, 석사/박사 5점 (최대 5점)
 * - 관련 학과 점수: MAJOR_NM 일치 10점, MAJOR_SEQ만 일치 7점 (최대 10점)
 * - 학점 점수: 88% 이상 5점, 66% 이상 88% 미만 2점, 그 이하 0점 (최대 5점)
 * - 총 20점 만점 (학력 점수 + 관련 학과 점수 + 학점 점수 합산)
 *
 * @param applicantEducations 지원자의 학력 목록
 * @param jobMajorNm 채용 공고의 직종 관련 학과명 (MAJOR_NM)
 * @param jobMajorSeq 채용 공고의 직종 관련 학과 코드 (MAJOR_SEQ)
 * @returns 학력 점수 (20점 만점)
 */
function calculateEducationScore(applicantEducations, jobMajorNm, jobMajorSeq, jobRelatedMajors) {
    if (!applicantEducations || applicantEducations.length === 0) {
        return 0;
    }
    // 1. 학력 점수 계산 (최고 학력 기준)
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
    // 2. 관련 학과 점수 계산
    const relatedMajorScore = calculateRelatedMajorScore(applicantEducations, jobMajorNm, jobMajorSeq, jobRelatedMajors);
    // 3. 학점 점수 계산
    const gpaScore = calculateGpaScore(applicantEducations);
    // 4. 합산 (학력 점수 최대 5점 + 관련 학과 점수 최대 10점 + 학점 점수 최대 5점 = 총 20점 만점)
    const totalScore = educationDegreeScore + relatedMajorScore + gpaScore;
    return Math.min(totalScore, 20); // 최대 20점 제한
}
/**
 * 관련 학과 점수 계산 (10점 만점)
 *
 * 점수 체계:
 * - 여러 전공 중 하나라도 공고의 채용 직종과 MAJOR_NM이 동일한 경우: 10점
 * - MAJOR_SEQ만 동일한 경우: 7점
 * - MAJOR_NM이 같으면 MAJOR_SEQ는 필연적으로 같으므로, 둘 다 같은 경우는 10점으로 처리
 * - 각각은 중복되지 않게 처리
 * - 채용 직종 관련 학과가 여러 개인 경우, 지원자 학과 중 하나라도 일치하면 점수 부여
 *
 * @param applicantEducations 지원자의 학력 목록
 * @param jobMajorNm 채용 공고의 직종 관련 학과명 (MAJOR_NM) - 하위 호환성용
 * @param jobMajorSeq 채용 공고의 직종 관련 학과 코드 (MAJOR_SEQ) - 하위 호환성용
 * @param jobRelatedMajors 채용 공고의 직종 관련 학과 목록 (여러 개 가능)
 * @returns 관련 학과 점수 (10점 만점)
 */
function calculateRelatedMajorScore(applicantEducations, jobMajorNm, jobMajorSeq, jobRelatedMajors) {
    if (!applicantEducations || applicantEducations.length === 0) {
        return 0;
    }
    // jobRelatedMajors가 있으면 우선 사용, 없으면 하위 호환성을 위해 단일 값 사용
    const relatedMajors = [];
    if (jobRelatedMajors && jobRelatedMajors.length > 0) {
        relatedMajors.push(...jobRelatedMajors);
    }
    else if (jobMajorNm || jobMajorSeq) {
        // 하위 호환성: 단일 값이 있으면 배열로 변환
        relatedMajors.push({
            majorNm: jobMajorNm || '',
            majorSeq: jobMajorSeq || ''
        });
    }
    if (relatedMajors.length === 0) {
        return 0;
    }
    let hasMajorNmMatch = false; // MAJOR_NM 일치 여부
    let hasMajorSeqMatch = false; // MAJOR_SEQ만 일치 여부 (MAJOR_NM은 다른 경우)
    // 지원자의 모든 학과를 순회
    applicantEducations.forEach(edu => {
        // 채용 직종의 모든 관련 학과와 비교
        relatedMajors.forEach(jobMajor => {
            // MAJOR_NM 일치 확인
            if (jobMajor.majorNm && edu.majorNm &&
                edu.majorNm.trim() === jobMajor.majorNm.trim()) {
                hasMajorNmMatch = true;
            }
            // MAJOR_SEQ만 일치 확인 (MAJOR_NM이 다른 경우만)
            if (jobMajor.majorSeq && edu.majorSeq &&
                edu.majorSeq === jobMajor.majorSeq) {
                // MAJOR_NM이 다르거나 없는 경우만 카운트
                if (!jobMajor.majorNm || !edu.majorNm ||
                    edu.majorNm.trim() !== jobMajor.majorNm.trim()) {
                    hasMajorSeqMatch = true;
                }
            }
        });
    });
    // 점수 계산 (중복 방지, MAJOR_NM 일치가 우선순위 높음)
    if (hasMajorNmMatch) {
        return 10; // MAJOR_NM 일치 = 10점
    }
    else if (hasMajorSeqMatch) {
        return 7; // MAJOR_SEQ만 일치 = 7점
    }
    return 0;
}
/**
 * 학점 점수 계산 (5점 만점)
 *
 * 점수 체계:
 * - 학점/만점 기준으로 백분율 계산
 * - 88% 이상: 5점
 * - 66% 이상 88% 미만: 2점
 * - 그 이하: 0점
 *
 * @param applicantEducations 지원자의 학력 목록
 * @returns 학점 점수 (5점 만점, 최고 학력의 학점 기준)
 */
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
                score = 5; // 88% 이상 = 5점
            }
            else if (percentage >= 66) {
                score = 2; // 66% 이상 88% 미만 = 2점
            }
            else {
                score = 0; // 그 이하 = 0점
            }
            maxGpaScore = Math.max(maxGpaScore, score);
        }
    });
    return maxGpaScore;
}
/**
 * 지원자의 모든 점수를 통합 계산하는 함수
 *
 * applicationData와 job 정보를 받아서 자격증, 경력, 학력 점수를 모두 계산하고 총점을 반환합니다.
 * 모든 페이지에서 동일한 계산 방식을 사용하도록 통합된 함수입니다.
 *
 * @param applicationData 지원서 데이터
 * @param job 채용 공고 정보
 * @returns 계산된 점수 정보
 */
function calculateAllScores(applicationData, job) {
    if (!job?.aiMetadata) {
        return null;
    }
    // 나이 계산
    const getAge = (birthDate) => {
        if (!birthDate)
            return 0;
        const birth = new Date(birthDate);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        return age;
    };
    // 자격증 점수 계산
    const applicantCertifications = extractCertifications(applicationData);
    const certificationScore = calculateCertificationScore({
        applicantCertifications,
        requiredCertifications: job.aiMetadata.requiredCertifications || [],
        relatedCertifications: job.aiMetadata.relatedCertifications || [],
    });
    // 경력 점수 계산
    const applicantCareers = extractCareers(applicationData);
    const applicantAge = getAge(applicationData.birthDate) || 0;
    const careerScore = calculateCareerScore(applicantCareers, job.aiMetadata.jobAptdCode, job.aiMetadata.jobdicSeq, applicantAge);
    // 학력 점수 계산
    const applicantEducations = extractEducations(applicationData);
    const educationScore = calculateEducationScore(applicantEducations, job.aiMetadata.relatedMajorNm, job.aiMetadata.relatedMajorSeq, job.aiMetadata.relatedMajors);
    // 총점 계산
    const weights = job.aiMetadata.scoringWeights || {
        certification: 1,
        career: 1,
        education: 1,
    };
    const totalScore = calculateTotalScore(certificationScore, careerScore, educationScore, weights);
    return {
        certificationScore,
        careerScore,
        educationScore,
        totalScore,
    };
}
/**
 * 지원자의 자격증 목록 추출 (applicationData에서)
 *
 * @param applicationData 지원서 데이터 객체
 * @returns 자격증 이름 배열
 */
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
/**
 * 지원자의 경력 목록 추출 (applicationData에서)
 *
 * @param applicationData 지원서 데이터 객체
 * @returns 경력 정보 배열
 */
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
        // 시작일이 있으면 경력으로 간주
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
/**
 * 지원자의 학력 목록 추출 (applicationData에서)
 *
 * @param applicationData 지원서 데이터 객체
 * @returns 학력 정보 배열
 */
function extractEducations(applicationData) {
    const educations = [];
    // 고등학교 (고졸)
    if (applicationData.highSchoolGraduationType === '졸업' || applicationData.highSchoolGraduationType === '검정고시') {
        educations.push({
            degreeType: '고졸',
            schoolName: applicationData.highSchoolName || undefined,
            graduationType: applicationData.highSchoolGraduationType || undefined,
        });
    }
    // 대학교 (전문학사/학사)
    for (let i = 1; i <= 5; i++) {
        const degreeType = applicationData[`universityDegreeType${i}`];
        const graduationType = applicationData[`universityGraduationType${i}`];
        const schoolName = applicationData[`universityName${i}`];
        if (degreeType && graduationType) {
            // 학점 정보 추출
            const gpaStr = applicationData[`universityGPA${i}`];
            const gpaMaxStr = applicationData[`universityGPAMax${i}`];
            const gpa = gpaStr ? parseFloat(String(gpaStr).trim()) : undefined;
            const maxGpa = gpaMaxStr ? parseFloat(String(gpaMaxStr).trim()) : undefined;
            // 전공 정보 추출 (최대 4개)
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
    // 대학원 (석사/박사)
    for (let i = 1; i <= 5; i++) {
        const degreeType = applicationData[`graduateSchoolDegreeType${i}`];
        const graduationType = applicationData[`graduateSchoolGraduationType${i}`];
        const schoolName = applicationData[`graduateSchoolName${i}`];
        if (degreeType && graduationType) {
            // 학점 정보 추출
            const gpaStr = applicationData[`graduateSchoolGPA${i}`];
            const gpaMaxStr = applicationData[`graduateSchoolGPAMax${i}`];
            const gpa = gpaStr ? parseFloat(String(gpaStr).trim()) : undefined;
            const maxGpa = gpaMaxStr ? parseFloat(String(gpaMaxStr).trim()) : undefined;
            // 전공 정보 추출 (최대 4개)
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
