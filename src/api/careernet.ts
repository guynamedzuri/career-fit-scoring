/**
 * 커리어넷 API 연동 모듈
 * 
 * 직종 검색, 학과 검색, 직종 상세 정보 조회 등을 제공합니다.
 */

export interface CareerNetJob {
  job: string; // 직종명
  jobdicSeq: string; // 직종 코드
  aptd_type_code?: string; // 직종 aptd_type_code
  summary?: string;
  profession?: string;
  similarJob?: string; // 유사 직업 목록 (쉼표로 구분)
}

export interface CareerNetJobDetail {
  capacity_major?: {
    content?: Array<{
      capacity?: string; // 관련 자격증 목록
      major?: Array<{
        MAJOR_NM?: string; // 학과명
        MAJOR_SEQ?: string; // 학과 코드
        RNUM?: string;
        CNTNTS_URL?: string;
        TOTAL_CNT?: string;
      }>;
    }>;
  };
}

export interface CareerNetMajor {
  facilName?: string; // 학과명 (쉼표로 구분된 여러 학과)
  majorSeq?: string;
  majorNm?: string;
}

// API 응답 타입 정의
interface CareerNetApiResponse {
  dataSearch?: {
    content?: any[] | any;
  };
}

interface CareerNetJobItem {
  job?: string;
  jobdicSeq?: string;
  aptd_type_code?: string;
  summary?: string;
  profession?: string;
  similarJob?: string;
}

interface CareerNetMajorItem {
  facilName?: string;
  majorSeq?: string;
  majorNm?: string;
}

/**
 * 커리어넷 API 키 (환경 변수에서 가져오거나 직접 설정)
 */
const CAREERNET_API_KEY = process.env.CAREERNET_API_KEY || '83ae558eb34c7d75e2bde972db504fd5';

/**
 * 직종 검색
 * 
 * @param apiKey 커리어넷 API 키 (선택사항, 기본값 사용)
 * @returns 직종 목록
 */
export async function searchJobs(apiKey?: string): Promise<CareerNetJob[]> {
  const key = apiKey || CAREERNET_API_KEY;
  const url = `https://www.career.go.kr/cnet/openapi/getOpenApi?apiKey=${key}&svcType=api&svcCode=JOB&gubun=job_dic_list&thisPage=1&perPage=9999`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json() as CareerNetApiResponse;
    
    if (!data || !data.dataSearch || !data.dataSearch.content) {
      return [];
    }
    
    const jobs: CareerNetJob[] = [];
    const contentList = Array.isArray(data.dataSearch.content) 
      ? data.dataSearch.content 
      : [data.dataSearch.content];
    
    contentList.forEach((item: CareerNetJobItem) => {
      if (item.job && item.jobdicSeq) {
        jobs.push({
          job: item.job,
          jobdicSeq: item.jobdicSeq,
          aptd_type_code: item.aptd_type_code,
          summary: item.summary,
          profession: item.profession,
          similarJob: item.similarJob,
        });
      }
    });
    
    return jobs;
  } catch (error) {
    console.error('[CareerNet] Job search error:', error);
    throw error;
  }
}

/**
 * 직종 상세 정보 조회
 * 
 * @param jobdicSeq 직종 코드
 * @param apiKey 커리어넷 API 키 (선택사항)
 * @returns 직종 상세 정보
 */
export async function getJobDetail(jobdicSeq: string, apiKey?: string): Promise<CareerNetJobDetail | null> {
  const key = apiKey || CAREERNET_API_KEY;
  const url = `https://www.career.go.kr/cnet/openapi/getOpenApi?apiKey=${key}&svcType=api&svcCode=JOB_VIEW&jobdicSeq=${jobdicSeq}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const xmlText = await response.text();
    
    // XML 파싱
    // 브라우저 환경에서는 DOMParser 사용, Node.js 환경에서는 xml2js 같은 라이브러리 필요
    let capacityList: string[] = [];
    let majorList: Array<{ MAJOR_NM?: string; MAJOR_SEQ?: string }> = [];
    
    // 브라우저 환경 체크 (DOMParser는 브라우저 전용)
    if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
      // 브라우저 환경
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      
      // capacity_major > content > capacity (관련 자격증)
      const capacityElements = xmlDoc.querySelectorAll('capacity_major > content > capacity');
      capacityElements.forEach((el: Element) => {
        if (el.textContent) {
          const capacityText = el.textContent.trim();
          if (capacityText) {
            // 쉼표로 구분된 자격증 목록 파싱
            const certs = capacityText.split(',').map((c: string) => c.trim()).filter((c: string) => c);
            capacityList.push(...certs);
          }
        }
      });
      
      // capacity_major > content > major > content (관련 학과)
      const majorElements = xmlDoc.querySelectorAll('capacity_major > content > major > content');
      majorElements.forEach((el: Element) => {
        const majorNm = el.querySelector('MAJOR_NM')?.textContent?.trim();
        const majorSeq = el.querySelector('MAJOR_SEQ')?.textContent?.trim();
        if (majorNm || majorSeq) {
          majorList.push({
            MAJOR_NM: majorNm,
            MAJOR_SEQ: majorSeq,
          });
        }
      });
    } else {
      // Node.js 환경에서는 정규식으로 간단 파싱 (정확한 파싱은 xml2js 권장)
      const capacityMatches = xmlText.match(/<capacity[^>]*>([^<]*)<\/capacity>/g);
      if (capacityMatches) {
        capacityMatches.forEach(match => {
          const content = match.replace(/<\/?capacity[^>]*>/g, '').trim();
          if (content) {
            const certs = content.split(',').map(c => c.trim()).filter(c => c);
            capacityList.push(...certs);
          }
        });
      }
      
      const majorNmMatches = xmlText.match(/<MAJOR_NM[^>]*>([^<]*)<\/MAJOR_NM>/g);
      const majorSeqMatches = xmlText.match(/<MAJOR_SEQ[^>]*>([^<]*)<\/MAJOR_SEQ>/g);
      if (majorNmMatches && majorSeqMatches) {
        for (let i = 0; i < Math.min(majorNmMatches.length, majorSeqMatches.length); i++) {
          const majorNm = majorNmMatches[i].replace(/<\/?MAJOR_NM[^>]*>/g, '').trim();
          const majorSeq = majorSeqMatches[i].replace(/<\/?MAJOR_SEQ[^>]*>/g, '').trim();
          if (majorNm || majorSeq) {
            majorList.push({ MAJOR_NM: majorNm, MAJOR_SEQ: majorSeq });
          }
        }
      }
    }
    
    const result: CareerNetJobDetail = {
      capacity_major: {
        content: []
      }
    };
    
    if (capacityList.length > 0 || majorList.length > 0) {
      result.capacity_major = {
        content: [{
          capacity: capacityList.join(', '),
          major: majorList,
        }]
      };
    }
    
    return result;
  } catch (error) {
    console.error('[CareerNet] Job detail error:', error);
    return null;
  }
}

/**
 * 학과 검색
 * 
 * @param gubun 구분 ('univ_list' 또는 'high_list')
 * @param apiKey 커리어넷 API 키 (선택사항)
 * @returns 학과 목록
 */
export async function searchMajors(gubun: string = 'univ_list', apiKey?: string): Promise<CareerNetMajor[]> {
  const key = apiKey || CAREERNET_API_KEY;
  const url = `https://www.career.go.kr/cnet/openapi/getOpenApi?apiKey=${key}&svcType=api&svcCode=MAJOR&contentType=json&gubun=${encodeURIComponent(gubun)}&thisPage=1&perPage=9999`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json() as CareerNetApiResponse;
    
    if (!data || !data.dataSearch || !data.dataSearch.content) {
      return [];
    }
    
    const majors: CareerNetMajor[] = [];
    const contentList = Array.isArray(data.dataSearch.content) 
      ? data.dataSearch.content 
      : [data.dataSearch.content];
    
    contentList.forEach((item: CareerNetMajorItem) => {
      if (item.facilName) {
        // facilName은 쉼표로 구분된 여러 학과명을 포함할 수 있음
        const facilNames = item.facilName.split(',').map((name: string) => name.trim()).filter((name: string) => name);
        facilNames.forEach((name: string) => {
          majors.push({
            facilName: name,
            majorSeq: item.majorSeq,
            majorNm: name,
          });
        });
      }
    });
    
    return majors;
  } catch (error) {
    console.error('[CareerNet] Major search error:', error);
    throw error;
  }
}
