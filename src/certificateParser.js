"use strict";
/**
 * 공인민간자격증 및 추가 국가자격증 파싱 유틸리티
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADDITIONAL_NATIONAL_CERTIFICATES = void 0;
exports.parseOfficialCertificates = parseOfficialCertificates;
exports.parseAdditionalNationalCertificates = parseAdditionalNationalCertificates;
/**
 * 공인민간자격증 파일에서 자격증 목록 추출
 * @param fileContent 탭으로 구분된 테이블 데이터
 * @returns 자격증 이름 배열 (예: ["세무회계 1급", "세무회계 2급", "세무회계 3급"])
 */
function parseOfficialCertificates(fileContent) {
    const certificates = [];
    const lines = fileContent.split('\n');
    // 헤더 라인 스킵 (첫 번째 라인)
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line)
            continue;
        // 탭으로 분리
        const columns = line.split('\t');
        // E열(인덱스 4): 자격명, F열(인덱스 5): 등급명
        if (columns.length >= 6) {
            let certName = columns[4]?.trim() || '';
            let gradeName = columns[5]?.trim() || '';
            // 따옴표 제거 (CSV 형식에서 따옴표로 감싸진 경우)
            if (gradeName.startsWith('"') && gradeName.endsWith('"')) {
                gradeName = gradeName.slice(1, -1);
            }
            if (certName.startsWith('"') && certName.endsWith('"')) {
                certName = certName.slice(1, -1);
            }
            if (!certName)
                continue;
            // 등급명 처리
            if (!gradeName || gradeName === '등급없음' || gradeName === '없음') {
                // 등급이 없으면 자격명만 추가
                certificates.push(certName);
            }
            else if (gradeName === '단일등급') {
                // 단일등급인 경우
                certificates.push(`${certName} 단일등급`);
            }
            else {
                // 등급명을 쉼표로 분리하고 각 등급별로 조합
                const grades = gradeName.split(',').map(g => g.trim()).filter(g => g);
                if (grades.length > 0) {
                    grades.forEach(grade => {
                        certificates.push(`${certName} ${grade}`);
                    });
                }
                else {
                    // 등급명이 있지만 파싱이 안 된 경우 자격명만 추가
                    certificates.push(certName);
                }
            }
        }
    }
    return certificates;
}
/**
 * 추가 국가자격증 리스트 파싱
 * @param certList 줄바꿈으로 구분된 자격증 이름 리스트
 * @returns 자격증 이름 배열
 */
function parseAdditionalNationalCertificates(certList) {
    return certList
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
}
/**
 * 추가 국가자격증 리스트 (Q-Net API로 불러오지 못하는 국가자격증)
 */
exports.ADDITIONAL_NATIONAL_CERTIFICATES = `
전파통신기사
전파통신산업기사
전파통신기능사
전파전자통신기사
전파전자통신산업기사
전파전자통신기능사
무선설비기사
무선설비산업기사
무선설비기능사
무선설비산업기사(구:기능사1급)
육상무선통신사
제한무선통신사
특수무선(무선전화 병)
항공무선통신사
특수무선(국내무선)
해상무선통신사
특수무선기사(레이다)
특수무선기사(레이다 을)
특수무선기사(다중무선)
제1급아마추어무선기사
제2급아마추어무선기사
제3급아마추어무선기사(전신급)
제3급아마추어무선기사(전화급)
제4급아마추어무선기사
전파전자기사
전파전자산업기사
전파전자기능사
정보통신기술사
정보통신기사
정보통신산업기사
방송통신기사
방송통신산업기사
방송통신기능사
통신설비기능장
통신선로산업기사
통신선로기능사
통신선로산업기사(구:기능사1급)
통신기기기능사
정보관리기술사
정보보안기사
정보보안산업기사
`.trim();
