/**
 * Q-Net API 연동 모듈
 * 
 * 국가자격증 검색을 제공합니다.
 * 
 * 주의: Q-Net API는 HTTP만 지원하므로, HTTPS 페이지에서 사용하려면
 * 서버 사이드 프록시를 통해 호출해야 합니다.
 */

export interface QNetCertification {
  jmfldnm: string; // 종목명 (자격증명)
  [key: string]: any; // 기타 필드
}

/**
 * Q-Net API 키
 */
const QNET_API_KEY = process.env.QNET_API_KEY || '62577f38999a14613f5ded0c9b01b6ce6349e437323ebb4422825c429189ae5f';

/**
 * 국가자격증 검색
 * 
 * @param apiKey Q-Net API 키 (선택사항)
 * @param proxyUrl 서버 프록시 URL (HTTPS 환경에서 사용 시 필수)
 * @returns 자격증 목록
 */
export async function searchCertifications(
  apiKey?: string,
  proxyUrl?: string
): Promise<string[]> {
  const key = apiKey || QNET_API_KEY;
  const url = `http://openapi.q-net.or.kr/api/service/rest/InquiryListNationalQualifcationSVC/getList?ServiceKey=${key}`;
  
  try {
    let response: Response;
    
    // 프록시 URL이 제공되면 프록시를 통해 호출
    if (proxyUrl) {
      response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });
    } else {
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
    
    const certifications: string[] = [];
    
    itemList.forEach((item: QNetCertification) => {
      if (item.jmfldnm) {
        certifications.push(item.jmfldnm.trim());
      }
    });
    
    return certifications;
  } catch (error) {
    console.error('[Q-Net] Certification search error:', error);
    throw error;
  }
}
