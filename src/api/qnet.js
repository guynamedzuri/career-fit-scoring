"use strict";
/**
 * Q-Net API 연동 모듈
 *
 * 국가자격증 검색을 제공합니다.
 *
 * 주의: Q-Net API는 HTTP만 지원하므로, HTTPS 페이지에서 사용하려면
 * 서버 사이드 프록시를 통해 호출해야 합니다.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchCertifications = searchCertifications;
/**
 * Q-Net API 키
 */
const getApiKey = () => {
    // Node.js 환경 또는 Vite에서 define으로 주입된 환경 변수
    try {
        if (typeof process !== 'undefined' && process.env && process.env.QNET_API_KEY) {
            return process.env.QNET_API_KEY;
        }
    }
    catch (e) {
        // process가 정의되지 않은 경우 무시
    }
    // 기본값 (Vite의 define으로 주입되거나 기본값 사용)
    return '62577f38999a14613f5ded0c9b01b6ce6349e437323ebb4422825c429189ae5f';
};
const QNET_API_KEY = getApiKey();
/**
 * 국가자격증 검색
 *
 * @param apiKey Q-Net API 키 (선택사항)
 * @param proxyUrl 서버 프록시 URL (HTTPS 환경에서 사용 시 필수)
 * @returns 자격증 목록
 */
async function searchCertifications(apiKey, proxyUrl) {
    const key = apiKey || QNET_API_KEY;
    const url = `http://openapi.q-net.or.kr/api/service/rest/InquiryListNationalQualifcationSVC/getList?ServiceKey=${key}`;
    try {
        let response;
        // 프록시 URL이 제공되면 프록시를 통해 호출
        if (proxyUrl) {
            response = await fetch(proxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url }),
            });
        }
        else {
            // 직접 호출 (HTTP 환경에서만 가능)
            response = await fetch(url);
        }
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (!data || !data.response || !data.response.body || !data.response.body.items) {
            return [];
        }
        const items = data.response.body.items;
        const itemList = Array.isArray(items.item) ? items.item : (items.item ? [items.item] : []);
        const certifications = [];
        itemList.forEach((item) => {
            if (item.jmfldnm) {
                certifications.push(item.jmfldnm.trim());
            }
        });
        return certifications;
    }
    catch (error) {
        console.error('[Q-Net] Certification search error:', error);
        throw error;
    }
}
