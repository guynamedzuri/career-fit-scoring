#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
이력서 양식(resume_form.docx)을 베이스로 더미 이력서를 생성하는 스크립트

사용법:
    python3 scripts/generate_dummy_resume.py [--count N] [--output-dir DIR] [--use-ai]
    
옵션:
    --count N: 생성할 더미 이력서 개수 (기본값: 1)
    --output-dir DIR: 출력 디렉토리 (기본값: ./dummy_resumes)
    --use-ai: AI를 사용해서 자기소개서 생성 (선택적, Azure OpenAI 필요)
"""

import sys
import json
import os
import random
import argparse
import uuid
import requests
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Optional

# Windows에서 한글 경로 처리
if sys.platform == 'win32':
    import locale
    if sys.stdout.encoding != 'utf-8':
        try:
            sys.stdout.reconfigure(encoding='utf-8')
            sys.stderr.reconfigure(encoding='utf-8')
        except:
            pass

try:
    from docx import Document
    from docx.shared import Pt, RGBColor
    from docx.enum.text import WD_ALIGN_PARAGRAPH
except ImportError:
    print("ERROR: python-docx 라이브러리가 필요합니다.")
    print("설치 방법: pip3 install python-docx")
    sys.exit(1)

# 랜덤 데이터 생성용 리스트
KOREAN_SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '류', '전', 
                    '문', '양', '배', '백', '허', '유', '남', '심', '노', '하', '곽', '성', '차', '주', '우', '구', '신', '라', '선', '설',
                    '방', '마', '길', '위', '연', '표', '명', '기', '반', '왕', '옥', '육', '인', '맹', '제', '모', '남궁', '사공', '선우', '독고']
KOREAN_GIVEN_NAMES = ['민준', '서준', '도윤', '예준', '시우', '하준', '주원', '지호', '준서', '건우',
                      '서연', '서윤', '지우', '서현', '민서', '하은', '예은', '윤서', '채원', '지원',
                      '현우', '준혁', '지훈', '성민', '준영', '민수', '현준', '성현', '민호', '준호',
                      '지원', '수진', '지은', '수빈', '민지', '예진', '지현', '혜진', '은지', '수정',
                      '동현', '성훈', '민성', '재현', '태현', '준수', '승현', '영수', '정우', '상우',
                      '혜원', '유진', '지안', '서영', '다은', '예나', '소영', '혜린', '윤지', '가은',
                      '건희', '우진', '태준', '민규', '준혁', '현수', '승우', '민재', '태민', '준민',
                      '수아', '지유', '서아', '나은', '하린', '예린', '채은', '소은', '은서', '다인']

KOREAN_NAMES_ENGLISH = ['Minjun', 'Seojun', 'Doyoon', 'Yejun', 'Siwoo', 'Hajun', 'Juwon', 'Jiho', 'Junseo', 'Geonwoo',
                        'Seoyeon', 'Seoyoon', 'Jiwoo', 'Seohyun', 'Minseo', 'Haeun', 'Yeeun', 'Yoonseo', 'Chaewon', 'Jiwon']

UNIVERSITIES = ['서울대학교', '연세대학교', '고려대학교', '한양대학교', '성균관대학교', '중앙대학교', 
                '경희대학교', '한국외국어대학교', '이화여자대학교', '서강대학교', '동국대학교', '건국대학교',
                '홍익대학교', '인하대학교', '아주대학교', '부산대학교', '경북대학교', '전남대학교']

MAJORS = ['컴퓨터공학', '전기전자공학', '기계공학', '화학공학', '산업공학', '경영학', '경제학', '회계학',
          '마케팅', '심리학', '사회학', '영어영문학', '국어국문학', '수학', '물리학', '화학', '생물학',
          '건축학', '토목공학', '환경공학', '식품영양학', '간호학', '의학', '법학', '행정학']

COMPANIES = ['삼성전자', 'LG전자', 'SK하이닉스', '현대자동차', '기아', '네이버', '카카오', 'LG화학',
             '포스코', '한화', '롯데', 'CJ', '두산', 'GS', 'KT', 'SK텔레콤', 'LG유플러스',
             '신한은행', 'KB금융', '하나은행', '우리은행', 'NH농협은행', 'IBK기업은행',
             '삼성SDI', 'LG디스플레이', '아모레퍼시픽', '한진', '대한항공', '아시아나항공',
             '한국전력', '한국가스공사', '한국수력원자력', '한국조선해양', '현대중공업']

DEPARTMENTS = ['개발팀', '기획팀', '마케팅팀', '영업팀', '인사팀', '재무팀', '회계팀', '품질관리팀',
               '생산팀', '연구개발팀', '디자인팀', '고객서비스팀', 'IT팀', '전략기획팀', '해외사업팀']

POSITIONS = ['사원', '주임', '대리', '과장', '차장', '부장', '상무', '전무', '이사', '상임이사',
             '연구원', '선임연구원', '책임연구원', '수석연구원', '프로', '시니어프로']

CERTIFICATES = ['정보처리기사', '컴퓨터활용능력 1급', '토익', '토플', '한국어능력시험', '전기기사',
                '전기산업기사', '기계기사', '건축기사', '토목기사', '환경기사', '화학기사',
                '산업안전기사', '품질경영기사', '공인회계사', '세무사', '변리사', '법무사',
                '간호사', '의사', '약사', '영양사', '사회복지사', '보육교사']

LANGUAGES = ['TOEIC', 'TOEFL', 'IELTS', 'OPIc', 'TEPS', 'JPT', 'JLPT', 'HSK', 'DELE', 'DELF']

CITIES = ['서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시', '대전광역시', '울산광역시',
          '경기도', '강원도', '충청북도', '충청남도', '전라북도', '전라남도', '경상북도', '경상남도', '제주특별자치도']

DISTRICTS = {
    '서울특별시': ['강남구', '강동구', '강북구', '강서구', '관악구', '광진구', '구로구', '금천구', '노원구', '도봉구'],
    '부산광역시': ['해운대구', '사하구', '금정구', '강서구', '연제구', '수영구', '사상구', '기장군'],
    '경기도': ['수원시', '성남시', '고양시', '용인시', '부천시', '안산시', '안양시', '남양주시', '화성시', '평택시']
}

MILITARY_STATUS = ['현역', '보충역', '면제', '해당없음']


def generate_korean_name() -> tuple:
    """한국 이름 생성 (한글, 한문, 영문)"""
    surname = random.choice(KOREAN_SURNAMES)
    given_name = random.choice(KOREAN_GIVEN_NAMES)
    korean_name = f"{surname}{given_name}"
    english_name = random.choice(KOREAN_NAMES_ENGLISH)
    return korean_name, english_name


def generate_birth_date() -> str:
    """생년월일 생성 (1990-2000년 사이)"""
    year = random.randint(1990, 2000)
    month = random.randint(1, 12)
    day = random.randint(1, 28)
    return f"{year}.{month:02d}.{day:02d}"


def generate_email(name: str) -> str:
    """이메일 주소 생성"""
    domains = ['gmail.com', 'naver.com', 'daum.net', 'hanmail.net', 'kakao.com']
    numbers = random.randint(100, 999)
    return f"{name.lower()}{numbers}@{random.choice(domains)}"


def generate_phone() -> str:
    """전화번호 생성"""
    middle = random.randint(1000, 9999)
    last = random.randint(1000, 9999)
    return f"010-{middle}-{last}"


def generate_address() -> str:
    """주소 생성"""
    city = random.choice(CITIES)
    if city in DISTRICTS:
        district = random.choice(DISTRICTS[city])
        street = random.randint(1, 999)
        return f"{city} {district} 테헤란로 {street}"
    else:
        return f"{city} 중앙로 {random.randint(1, 999)}"


def generate_salary() -> str:
    """희망연봉 생성"""
    base = random.choice([3000, 3500, 4000, 4500, 5000, 5500, 6000])
    return f"{base}만원"


def generate_education() -> List[Dict]:
    """학력 정보 생성 (고등학교 + 대학교/대학원, 최대 3개)"""
    educations = []
    
    # 항상 고등학교 포함
    high_school_city = random.choice(CITIES).replace('시', '').replace('도', '').replace('특별시', '').replace('광역시', '').replace('특별자치도', '')
    high_school_name = f"{high_school_city}고등학교"
    hs_start_year = random.randint(2010, 2015)
    hs_end_year = hs_start_year + 3
    
    educations.append({
        'start': f"{hs_start_year}.{random.randint(1, 3):02d}",
        'end': f"{hs_end_year}.{random.randint(1, 12):02d}",
        'school': high_school_name,
        'major': '',
        'gpa': '',
        'location': random.choice(CITIES),
        'graduation': '졸업'
    })
    
    # 대학교 또는 대학원 추가 (1-2개)
    count = random.randint(1, 2)
    for i in range(count):
        if i == 0:  # 최종 학력
            level = random.choice(['대학교', '대학원'])
            if level == '대학원':
                degree = random.choice(['석사', '박사'])
            else:
                degree = '학사'
        else:
            level = random.choice(['전문대학', '대학교'])
            degree = '학사' if level == '대학교' else ''
        
        university = random.choice(UNIVERSITIES) if level != '전문대학' else random.choice(['서울과학기술대학교', '인천대학교', '한국산업기술대학교'])
        major = random.choice(MAJORS)
        
        # 고등학교 졸업 후 연속적으로 입학
        prev_end_year = int(educations[-1]['end'].split('.')[0])
        start_year = prev_end_year + random.randint(0, 1)  # 고등학교 졸업 직후 또는 1년 후
        
        if level == '대학원':
            end_year = start_year + random.randint(2, 3)
        elif level == '전문대학':
            end_year = start_year + 2
        else:  # 대학교
            end_year = start_year + 4
        
        gpa = f"{random.uniform(3.0, 4.5):.2f}/4.5"
        location = random.choice(CITIES)
        graduation = random.choice(['졸업', '졸업예정', '수료'])
        
        educations.append({
            'start': f"{start_year}.{random.randint(1, 3):02d}",
            'end': f"{end_year}.{random.randint(1, 12):02d}",
            'school': university,
            'major': major,
            'gpa': gpa,
            'location': location,
            'graduation': graduation
        })
    
    return educations


def generate_career() -> List[Dict]:
    """경력 정보 생성 (1-4개)"""
    count = random.randint(1, 4)
    careers = []
    
    for i in range(count):
        company = random.choice(COMPANIES)
        department = random.choice(DEPARTMENTS)
        position = random.choice(POSITIONS)
        
        start_year = random.randint(2018, 2023)
        start_month = random.randint(1, 12)
        
        # 퇴사일 (현재 재직 중일 수도 있음)
        if random.random() < 0.3:  # 30% 확률로 재직 중
            end_year = 2025
            end_month = random.randint(1, 12)
            end_date = f"{end_year}.{end_month:02d}"
        else:
            end_year = random.randint(start_year + 1, 2024)
            end_month = random.randint(1, 12)
            end_date = f"{end_year}.{end_month:02d}"
        
        salary = random.randint(3000, 8000)
        reason = random.choice(['개인사정', '이직', '계약만료', '회사사정', '전직희망'])
        
        careers.append({
            'start': f"{start_year}.{start_month:02d}",
            'end': end_date,
            'company': company,
            'department': department,
            'position': position,
            'salary': f"{salary}만원",
            'reason': reason
        })
    
    return careers


def generate_certificates() -> List[Dict]:
    """자격증 정보 생성 (0-5개)"""
    count = random.randint(0, 5)
    certs = []
    
    for _ in range(count):
        cert_name = random.choice(CERTIFICATES)
        grade = random.choice(['1급', '2급', '기사', '산업기사', '990점', '850점', '750점', 'N1', 'N2'])
        issuer = random.choice(['한국산업인력공단', '대한상공회의소', '한국어능력시험원', 'ETS', '영국문화원'])
        date = f"{random.randint(2020, 2024)}.{random.randint(1, 12):02d}"
        
        certs.append({
            'name': cert_name,
            'grade': grade,
            'issuer': issuer,
            'date': date
        })
    
    return certs


def generate_languages() -> List[Dict]:
    """어학 정보 생성 (0-3개)"""
    count = random.randint(0, 3)
    languages = []
    
    for _ in range(count):
        lang = random.choice(LANGUAGES)
        if lang in ['TOEIC', 'TOEFL', 'IELTS', 'TEPS']:
            score = random.choice(['990', '950', '900', '850', '800', '750'])
        elif lang == 'OPIc':
            score = random.choice(['AL', 'IH', 'IM', 'IL'])
        elif lang in ['JLPT', 'HSK']:
            score = random.choice(['N1', 'N2', 'N3', 'HSK6', 'HSK5', 'HSK4'])
        else:
            score = random.choice(['A', 'B', 'C'])
        
        date = f"{random.randint(2020, 2024)}.{random.randint(1, 12):02d}"
        
        languages.append({
            'name': lang,
            'score': score,
            'date': date
        })
    
    return languages


def load_env_file():
    """환경 변수 파일(.env) 로드"""
    env_vars = {}
    env_path = Path('.env')
    
    if env_path.exists():
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    env_vars[key.strip()] = value.strip().strip('"').strip("'")
    
    return env_vars


def call_azure_openai(prompt: str, system_prompt: str = None, max_tokens: int = 1000, temperature: float = 0.7) -> Optional[str]:
    """Azure OpenAI API 호출"""
    env_vars = load_env_file()
    
    api_key = env_vars.get('AZURE_OPENAI_API_KEY') or os.getenv('AZURE_OPENAI_API_KEY')
    endpoint = env_vars.get('AZURE_OPENAI_ENDPOINT') or os.getenv('AZURE_OPENAI_ENDPOINT') or 'https://roar-mjm4cwji-swedencentral.openai.azure.com/'
    deployment = env_vars.get('AZURE_OPENAI_DEPLOYMENT') or os.getenv('AZURE_OPENAI_DEPLOYMENT') or 'gpt-4o'
    api_version = env_vars.get('AZURE_OPENAI_API_VERSION') or os.getenv('AZURE_OPENAI_API_VERSION') or '2024-12-01-preview'
    
    if not api_key:
        return None
    
    url = f"{endpoint.rstrip('/')}/openai/deployments/{deployment}/chat/completions?api-version={api_version}"
    
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})
    
    try:
        response = requests.post(
            url,
            headers={
                "api-key": api_key,
                "Content-Type": "application/json"
            },
            json={
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature
            },
            timeout=60
        )
        
        if response.status_code == 200:
            result = response.json()
            if 'choices' in result and len(result['choices']) > 0:
                return result['choices'][0]['message']['content'].strip()
        else:
            print(f"  WARNING: Azure OpenAI API 오류: {response.status_code} - {response.text[:200]}")
            return None
    except Exception as e:
        print(f"  WARNING: AI 호출 실패: {e}")
        return None
    
    return None


def generate_resume_data_with_ai(character_description: str = None, field_description: str = None) -> Optional[Dict]:
    """AI를 사용해서 이력서의 모든 데이터를 JSON 형식으로 생성
    
    Args:
        character_description: 캐릭터 배경 설명 (예: "중위권 대학의 애매한 성적, 공대 졸업 생산직 진출")
        field_description: 채용분야 설명 (예: "부품생산팀 PRESS분야 채용. 담당업무는 일반프레스(40~80톤) 설비 양산 운영...")
    """
    system_prompt = """당신은 이력서 작성 전문가입니다. 한국의 현실적이고 맥락 있는 이력서 데이터를 JSON 형식으로 생성해주세요.
반드시 유효한 JSON 형식으로만 응답하고, 다른 설명은 포함하지 마세요."""

    # 공통 프롬프트: LS오토모티브 회사 정보
    company_info = """
지원 회사 정보:
- 회사명: LS오토모티브
- 사업 분야: 자동차 인터페이스 제작 (창문, 의자조절 연동 스위치, 램프, 방향지시등레버 등)
- 이력서는 이 회사에 지원하는 것으로 작성해주세요.
"""

    character_context = ""
    if character_description:
        character_context = f"\n\n중요: 다음 캐릭터 배경에 맞게 이력서를 생성해주세요:\n{character_description}\n\n이 배경에 맞게 학교명, 학점, 전공, 회사명, 부서, 직위, 연봉 등을 현실적으로 설정해주세요."

    field_context = ""
    if field_description:
        field_context = f"\n\n중요: 다음 채용분야에 맞게 이력서를 생성해주세요:\n{field_description}\n\n이 채용분야에 적합한 경력, 전공, 자격증 등을 포함하여 현실적으로 설정해주세요."

    prompt = company_info + """다음 형식의 JSON으로 한국인 이력서 데이터를 생성해주세요. 모든 데이터는 현실적이고 일관성 있게 만들어주세요.

중요: 이름(name)은 매번 완전히 다른 이름을 사용해주세요. 이전에 생성한 이름과 중복되지 않도록 다양한 한국 이름을 사용해주세요.""" + character_context + field_context + """

{{
  "basicInfo": {{
    "name": "한글이름 (예: 김민준)",
    "nameEnglish": "영문이름 (예: Minjun Kim)",
    "birthDate": "생년월일 (예: 1995.03.15)",
    "email": "이메일주소 (예: minjun.kim@gmail.com)",
    "phone": "이동전화 (예: 010-1234-5678)",
    "phoneHome": "자택전화 (예: 02-1234-5678)",
    "address": "주소 (예: 서울특별시 강남구 테헤란로 123)",
    "desiredSalary": "희망연봉 (예: 4000만원)",
    "militaryService": "병역사항 (예: 현역, 보충역, 면제, 해당없음 중 하나)"
  }},
  "education": [
    {{
      "start": "입학년월 (예: 2014.03)",
      "end": "졸업년월 (예: 2018.02)",
      "school": "학교명 (예: 서울대학교)",
      "major": "전공명 (예: 컴퓨터공학과)",
      "gpa": "학점 (예: 3.85/4.5)",
      "location": "소재지 (예: 서울특별시)",
      "graduation": "졸업구분 (예: 졸업, 졸업예정, 수료 중 하나)"
    }}
  ],
  "careers": [
    {{
      "start": "입사년월 (예: 2018.03)",
      "end": "퇴사년월 또는 재직중 (예: 2024.12 또는 재직중)",
      "company": "회사명 (예: 삼성전자)",
      "department": "근무부서 (예: 개발팀)",
      "position": "직위 (예: 선임연구원)",
      "salary": "연봉 (예: 5000만원)",
      "reason": "이직사유 (예: 개인사정, 이직, 계약만료, 회사사정, 전직희망 중 하나)"
    }}
  ]
}}

다음 조건을 만족해야 합니다:
1. 학력은 1-3개 (최종 학력은 대학교 또는 대학원)
2. 경력은 1-4개 (일부는 재직중일 수 있음)
3. 모든 날짜는 일관성 있게 (예: 대학교 졸업 후 바로 취업)
4. 연봉은 경력에 따라 합리적으로 증가
5. 회사명, 학교명은 실제와 유사하게
6. 반드시 유효한 JSON만 출력 (설명 없이)"""

    ai_result = call_azure_openai(prompt, system_prompt, max_tokens=2000, temperature=0.8)
    
    if not ai_result:
        return None
    
    # JSON 파싱 시도 (코드 블록이나 마크다운 제거)
    try:
        # ```json 또는 ``` 제거
        cleaned_result = ai_result.strip()
        if cleaned_result.startswith('```'):
            lines = cleaned_result.split('\n')
            cleaned_result = '\n'.join(lines[1:-1]) if len(lines) > 2 else cleaned_result
            if cleaned_result.startswith('json'):
                cleaned_result = cleaned_result[4:].strip()
        
        data = json.loads(cleaned_result)
        return data
    except json.JSONDecodeError as e:
        print(f"  WARNING: JSON 파싱 실패: {e}")
        print(f"  AI 응답: {ai_result[:500]}")
        return None


def generate_self_introduction(use_ai: bool = False, name: str = "", career_info: List[Dict] = None, field_description: str = None) -> List[str]:
    """자기소개서 생성 (4개 항목)
    
    Args:
        use_ai: AI 사용 여부
        name: 이름
        career_info: 경력 정보
        field_description: 채용분야 설명
    """
    topics = [
        "지원동기 및 입사 후 포부",
        "성장과정 및 강점",
        "협업 경험 및 리더십",
        "직무 관련 경험 및 역량"
    ]
    
    introductions = []
    
    if use_ai:
        # 공통 프롬프트: LS오토모티브 회사 정보
        company_info = """
지원 회사 정보:
- 회사명: LS오토모티브
- 사업 분야: 자동차 인터페이스 제작 (창문, 의자조절 연동 스위치, 램프, 방향지시등레버 등)
"""
        
        for i, topic in enumerate(topics):
            # AI로 생성
            system_prompt = "당신은 이력서 작성 전문가입니다. 자연스럽고 전문적인 자기소개서를 작성해주세요."
            
            career_summary = ""
            if career_info and len(career_info) > 0:
                career_summary = f"\n\n주요 경력:\n"
                for career in career_info[:3]:
                    career_summary += f"- {career['company']} {career['department']} {career['position']} ({career['start']} ~ {career['end']})\n"
            
            field_info = ""
            if field_description:
                field_info = f"\n\n채용분야 정보:\n{field_description}\n\n이 채용분야에 맞게 자기소개서를 작성해주세요."
            
            prompt = company_info + f"""다음 주제에 대해 자기소개서를 작성해주세요. 200-300자 정도로 자연스럽고 전문적으로 작성해주세요.

주제: {topic}
이름: {name}
{career_summary}{field_info}

자기소개서 내용만 작성해주세요. 주제나 제목은 포함하지 마세요."""

            ai_result = call_azure_openai(prompt, system_prompt)
            if ai_result:
                introductions.append(ai_result)
            else:
                # AI 실패 시 기본 텍스트
                intro = f"{name}입니다. {topic}에 대해 말씀드리겠습니다. 저는 {random.choice(COMPANIES) if career_info else '다양한 기업'}에서 {random.randint(1, 5)}년간 근무하며 다양한 프로젝트를 수행했습니다. 이를 통해 {random.choice(['커뮤니케이션', '문제해결', '기획', '개발', '마케팅'])} 역량을 키웠으며, 귀사에서도 이러한 경험을 바탕으로 기여하고 싶습니다."
                introductions.append(intro)
        return introductions
    else:
        # 기본 더미 텍스트
        for topic in topics:
            intro = f"{topic}에 대한 답변입니다. 저는 {random.choice(COMPANIES)}에서 {random.randint(1, 5)}년간 근무하며 다양한 프로젝트를 수행했습니다. 이를 통해 {random.choice(['커뮤니케이션', '문제해결', '기획', '개발', '마케팅'])} 역량을 키웠으며, 귀사에서도 이러한 경험을 바탕으로 기여하고 싶습니다."
            introductions.append(intro)
        return introductions


def generate_career_detail(use_ai: bool = False, career: Dict = None) -> str:
    """경력기술서 상세 내용 생성"""
    if not career:
        return ""
    
    if use_ai:
        system_prompt = "당신은 이력서 작성 전문가입니다. 경력기술서를 전문적이고 구체적으로 작성해주세요."
        
        prompt = f"""다음 경력 정보를 바탕으로 경력기술서를 작성해주세요. 300-400자 정도로 구체적이고 전문적으로 작성해주세요.

회사명: {career['company']}
부서: {career['department']}
직위: {career['position']}
근무기간: {career['start']} ~ {career['end']}
연봉: {career['salary']}

경력기술서에는 다음 내용을 포함해주세요:
- 주요 업무 내용
- 담당했던 프로젝트나 성과
- 습득한 역량이나 전문성
- 구체적인 업무 사례

경력기술서 내용만 작성해주세요. 회사명이나 기간 등은 포함하지 마세요."""

        ai_result = call_azure_openai(prompt, system_prompt)
        if ai_result:
            return ai_result
        else:
            # AI 실패 시 기본 텍스트
            return f"{career['company']} {career['department']}에서 {career['position']}으로 근무하며 다양한 업무를 수행했습니다. 주요 업무는 {random.choice(['프로젝트 관리', '개발', '기획', '마케팅', '영업', '품질관리'])}였으며, 이를 통해 전문성을 키웠습니다."
    else:
        # 기본 더미 텍스트
        return f"{career['company']} {career['department']}에서 {career['position']}으로 근무하며 다양한 업무를 수행했습니다. 주요 업무는 {random.choice(['프로젝트 관리', '개발', '기획', '마케팅', '영업', '품질관리'])}였으며, 이를 통해 전문성을 키웠습니다."


def extract_char_keywords(character_description: str) -> str:
    """char 설명에서 핵심 키워드 추출하여 파일명용 짧은 문자열 생성"""
    if not character_description:
        return ""
    
    keywords = []
    char_lower = character_description.lower()
    
    # 학력 키워드
    if '고졸' in character_description:
        keywords.append('고졸')
    elif '대졸(2~3년제)' in character_description or '전문대' in character_description or '2~3년제' in character_description:
        keywords.append('전문대')
    elif '대졸(4년제)' in character_description or '4년제' in character_description:
        keywords.append('대졸4년')
    elif '대졸' in character_description:
        keywords.append('대졸')
    
    # 전공 키워드 (순서 중요: 제외 조건을 먼저 체크)
    if '비공학' in character_description or ('공학과' in character_description and '제외' in character_description) or '공학과는' in character_description:
        keywords.append('비공학')
    elif '기계과' in character_description or '기계공학' in character_description:
        keywords.append('기계')
    elif '공학' in character_description:
        keywords.append('공학')
    
    # 거주지 키워드
    if '지방' in character_description:
        keywords.append('지방')
    elif '서울' in character_description or '수도권' in character_description:
        keywords.append('수도권')
    
    # 직무 키워드
    if '영업' in character_description:
        keywords.append('영업')
    elif '생산직' in character_description:
        keywords.append('생산')
    elif '연구직' in character_description:
        keywords.append('연구')
    
    # 연차 키워드
    if '1~2년차' in character_description or '1-2년차' in character_description:
        keywords.append('1-2년')
    elif '3~5년차' in character_description or '3-5년차' in character_description:
        keywords.append('3-5년')
    elif '3년차' in character_description:
        keywords.append('3년')
    
    # 연봉 키워드
    if '3000 초반' in character_description or '3000초반' in character_description:
        keywords.append('연봉3천초')
    elif '3000 중후반' in character_description or '3000중후반' in character_description:
        keywords.append('연봉3천중후')
    elif '4000' in character_description:
        keywords.append('연봉4천')
    
    if keywords:
        return '_' + '_'.join(keywords)
    else:
        # 키워드가 없으면 해시값의 앞 4자리 사용
        import hashlib
        hash_val = hashlib.md5(character_description.encode()).hexdigest()[:4]
        return f'_{hash_val}'


def fill_resume_form(template_path: str, output_path: str, use_ai: bool = False, character_description: str = None, field_description: str = None):
    """이력서 양식에 더미 데이터 채우기
    
    Args:
        template_path: 템플릿 파일 경로
        output_path: 출력 파일 경로
        use_ai: AI 사용 여부
        character_description: 캐릭터 배경 설명 (AI 사용 시)
        field_description: 채용분야 설명 (AI 사용 시)
    """
    try:
        doc = Document(template_path)
        
        # 테이블 찾기
        tables = doc.tables
        if len(tables) < 6:
            print(f"WARNING: 예상된 테이블 개수(6개)보다 적습니다: {len(tables)}개")
        
        # 더미 데이터 생성
        if use_ai:
            # AI로 모든 데이터 생성
            if character_description:
                print(f"  AI로 이력서 데이터 생성 중 (캐릭터: {character_description[:30]}...)...", end=' ')
            else:
                print("  AI로 이력서 데이터 생성 중...", end=' ')
            ai_data = generate_resume_data_with_ai(character_description, field_description)
            if ai_data:
                # AI 생성 데이터 사용
                basic_info = ai_data.get('basicInfo', {})
                korean_name = basic_info.get('name', '')
                english_name = basic_info.get('nameEnglish', '')
                birth_date = basic_info.get('birthDate', '')
                email = basic_info.get('email', '')
                phone = basic_info.get('phone', '')
                address = basic_info.get('address', '')
                salary = basic_info.get('desiredSalary', '')
                military = basic_info.get('militaryService', '')
                
                educations = ai_data.get('education', [])
                careers = ai_data.get('careers', [])
                
                # 최신순으로 정렬 (졸업년월 기준 내림차순)
                educations.sort(key=lambda x: (
                    int(x.get('end', '0.0').split('.')[0]) * 100 + int(x.get('end', '0.0').split('.')[1]) if '.' in x.get('end', '0.0') else 0
                ), reverse=True)
                
                # 경력 최신순으로 정렬 (시작년월 기준 내림차순, 재직중은 가장 최신으로 처리)
                careers.sort(key=lambda x: (
                    # 재직중이면 매우 큰 값으로 처리하여 최상단에 배치
                    999999 if '재직중' in str(x.get('end', '')) else
                    int(x.get('start', '0.0').split('.')[0]) * 100 + int(x.get('start', '0.0').split('.')[1]) if '.' in x.get('start', '0.0') else 0
                ), reverse=True)
                
                print("완료")
            else:
                # AI 실패 시 기본 생성 방식으로 폴백
                print("실패, 기본 생성 방식 사용")
                korean_name, english_name = generate_korean_name()
                birth_date = generate_birth_date()
                email = generate_email(korean_name)
                phone = generate_phone()
                address = generate_address()
                salary = generate_salary()
                military = random.choice(MILITARY_STATUS)
                educations = generate_education()
                careers = generate_career()
                
                # 최신순으로 정렬 (졸업년월 기준 내림차순)
                educations.sort(key=lambda x: (
                    int(x.get('end', '0.0').split('.')[0]) * 100 + int(x.get('end', '0.0').split('.')[1]) if '.' in x.get('end', '0.0') else 0
                ), reverse=True)
                
                # 경력 최신순으로 정렬 (시작년월 기준 내림차순, 재직중은 가장 최신으로 처리)
                careers.sort(key=lambda x: (
                    # 재직중이면 매우 큰 값으로 처리하여 최상단에 배치
                    999999 if '재직중' in str(x.get('end', '')) else
                    int(x.get('start', '0.0').split('.')[0]) * 100 + int(x.get('start', '0.0').split('.')[1]) if '.' in x.get('start', '0.0') else 0
                ), reverse=True)
        else:
            # 기본 랜덤 생성
            korean_name, english_name = generate_korean_name()
            birth_date = generate_birth_date()
            email = generate_email(korean_name)
            phone = generate_phone()
            address = generate_address()
            salary = generate_salary()
            military = random.choice(MILITARY_STATUS)
            educations = generate_education()
            careers = generate_career()
            
            # 최신순으로 정렬 (졸업년월 기준 내림차순)
            educations.sort(key=lambda x: (
                int(x.get('end', '0.0').split('.')[0]) * 100 + int(x.get('end', '0.0').split('.')[1]) if '.' in x.get('end', '0.0') else 0
            ), reverse=True)
            
            # 경력 최신순으로 정렬 (시작년월 기준 내림차순, 재직중은 가장 최신으로 처리)
            careers.sort(key=lambda x: (
                # 재직중이면 매우 큰 값으로 처리하여 최상단에 배치
                999999 if '재직중' in str(x.get('end', '')) else
                int(x.get('start', '0.0').split('.')[0]) * 100 + int(x.get('start', '0.0').split('.')[1]) if '.' in x.get('start', '0.0') else 0
            ), reverse=True)
        
        # 자격증과 어학은 항상 랜덤 생성 (AI 옵션 없음)
        certificates = generate_certificates()
        languages = generate_languages()
        
        # AI로 자기소개서 생성
        if use_ai:
            print("  AI로 자기소개서 생성 중...", end=' ')
        self_intros = generate_self_introduction(use_ai, korean_name, careers, field_description)
        if use_ai:
            print("완료")
        
        # Table 0: 기본 정보 (새 양식: 기존 table1이 table0이 됨)
        if len(tables) > 0:
            table0 = tables[0]
            try:
                # (1,1): 한글이름, 한문이름 (Python 인덱스: rows[1].cells[1])
                if len(table0.rows) > 1 and len(table0.rows[1].cells) > 1:
                    table0.rows[1].cells[1].text = f"{korean_name}"
                
                # (1,5): 희망연봉 (Python 인덱스: rows[1].cells[5])
                if len(table0.rows) > 1 and len(table0.rows[1].cells) > 5:
                    table0.rows[1].cells[5].text = salary
                
                # (2,1): 영문이름 (Python 인덱스: rows[2].cells[1])
                if len(table0.rows) > 2 and len(table0.rows[2].cells) > 1:
                    table0.rows[2].cells[1].text = english_name
                
                # (3,1): 생년월일 (Python 인덱스: rows[3].cells[1])
                if len(table0.rows) > 3 and len(table0.rows[3].cells) > 1:
                    table0.rows[3].cells[1].text = birth_date
                
                # (3,4): 이메일 (Python 인덱스: rows[3].cells[4])
                if len(table0.rows) > 3 and len(table0.rows[3].cells) > 4:
                    table0.rows[3].cells[4].text = email
                
                # (4,1): 주소 (Python 인덱스: rows[4].cells[1])
                if len(table0.rows) > 4 and len(table0.rows[4].cells) > 1:
                    table0.rows[4].cells[1].text = address
                
                # (5,1): 연락처 (기존 자택전화 자리, 이제 하나만 사용) (Python 인덱스: rows[5].cells[1])
                if len(table0.rows) > 5 and len(table0.rows[5].cells) > 1:
                    table0.rows[5].cells[1].text = phone
                
                # (6,1): 병역사항 (기존 이동전화 자리) (Python 인덱스: rows[6].cells[1])
                if len(table0.rows) > 6 and len(table0.rows[6].cells) > 1:
                    table0.rows[6].cells[1].text = military
            except Exception as e:
                print(f"WARNING: Table 0 처리 중 오류: {e}")
        
        # Table 1: 학력 (새 양식: 기존 table2가 table1이 됨)
        if len(tables) > 1:
            table1 = tables[1]
            try:
                # row 2부터 7까지 (최대 6개) (Python 인덱스: rows[2]~rows[7])
                for i, edu in enumerate(educations[:6]):
                    row_idx = i + 2  # row 2부터 시작 (Python 인덱스: rows[2])
                    if len(table1.rows) > row_idx:
                        row = table1.rows[row_idx]
                        if len(row.cells) > 0:
                            row.cells[0].text = edu['start']  # 입학년월
                        if len(row.cells) > 1:
                            row.cells[1].text = edu['end']  # 졸업년월
                        if len(row.cells) > 2:
                            row.cells[2].text = edu['school']  # 학교명
                        if len(row.cells) > 3:
                            row.cells[3].text = edu['major']  # 전공명
                        if len(row.cells) > 4:
                            row.cells[4].text = edu['gpa']  # 학점
                        if len(row.cells) > 5:
                            row.cells[5].text = edu['location']  # 소재지
                        if len(row.cells) > 6:
                            row.cells[6].text = edu['graduation']  # 졸업구분
            except Exception as e:
                print(f"WARNING: Table 1 처리 중 오류: {e}")
        
        # Table 2: 경력 (새 양식: 기존 table3이 table2가 됨)
        if len(tables) > 2:
            table2 = tables[2]
            try:
                # row 2부터 6까지 (최대 5개) (Python 인덱스: rows[2]~rows[6])
                for i, career in enumerate(careers[:5]):
                    row_idx = i + 2  # row 2부터 시작 (Python 인덱스: rows[2])
                    if len(table2.rows) > row_idx:
                        row = table2.rows[row_idx]
                        if len(row.cells) > 0:
                            row.cells[0].text = career['start']  # 입사년월
                        if len(row.cells) > 1:
                            row.cells[1].text = career['end']  # 퇴사년월
                        if len(row.cells) > 2:
                            row.cells[2].text = career['company']  # 회사명
                        if len(row.cells) > 3:
                            row.cells[3].text = career['department']  # 근무부서
                        if len(row.cells) > 4:
                            row.cells[4].text = career['position']  # 직위
                        if len(row.cells) > 5:
                            row.cells[5].text = career['salary']  # 연봉
                        if len(row.cells) > 6:
                            row.cells[6].text = career['reason']  # 이직사유
            except Exception as e:
                print(f"WARNING: Table 2 처리 중 오류: {e}")
        
        # Table 3: 어학/자격증/해외연수/수상경력 (새 양식: 기존 table4가 table3이 됨)
        if len(tables) > 3:
            table3 = tables[3]
            try:
                # 어학 (row 2-4, cell 0-2) (Python 인덱스: rows[2]~rows[4])
                for i, lang in enumerate(languages[:3]):
                    row_idx = i + 2  # row 2부터 (Python 인덱스: rows[2])
                    if len(table3.rows) > row_idx:
                        row = table3.rows[row_idx]
                        if len(row.cells) > 0:
                            row.cells[0].text = lang['name']  # 어학종류
                        if len(row.cells) > 1:
                            row.cells[1].text = lang['score']  # 점수/등급
                        if len(row.cells) > 2:
                            row.cells[2].text = lang['date']  # 취득일자
                
                # 자격증 (row 2-4, cell 3-5) (Python 인덱스: rows[2]~rows[4])
                for i, cert in enumerate(certificates[:3]):
                    row_idx = i + 2  # row 2부터 (Python 인덱스: rows[2])
                    if len(table3.rows) > row_idx:
                        row = table3.rows[row_idx]
                        if len(row.cells) > 3:
                            row.cells[3].text = cert['name']  # 자격증 이름
                        if len(row.cells) > 4:
                            row.cells[4].text = cert['grade']  # 등급/점수
                        if len(row.cells) > 5:
                            row.cells[5].text = cert['issuer']  # 발행기관
            except Exception as e:
                print(f"WARNING: Table 3 처리 중 오류: {e}")
        
        # Table 4: 자기소개서 (새 양식: 기존 table5가 table4가 됨)
        if len(tables) > 4:
            table4 = tables[4]
            try:
                # (1,1) / (3,1) / (5,1) / (7,1) (Python 인덱스: rows[1].cells[1], rows[3].cells[1], etc.)
                intro_positions = [(1, 1), (3, 1), (5, 1), (7, 1)]
                for i, (row_idx, cell_idx) in enumerate(intro_positions):
                    if len(table4.rows) > row_idx and len(table4.rows[row_idx].cells) > cell_idx:
                        if i < len(self_intros):
                            table4.rows[row_idx].cells[cell_idx].text = self_intros[i]
            except Exception as e:
                print(f"WARNING: Table 4 처리 중 오류: {e}")
        
        # Table 5: 경력기술 (새 양식: 기존 table6이 table5가 됨)
        if len(tables) > 5:
            table5 = tables[5]
            try:
                # 경력 개수만큼 경력기술 작성
                # dataRowIndex: 2, 6, 10, 14 (Python 인덱스: rows[2], rows[6], rows[10], rows[14])
                # detailRowIndex: 4, 8, 12, 16 (Python 인덱스: rows[4], rows[8], rows[12], rows[16])
                data_row_indices = [2, 6, 10, 14]
                detail_row_indices = [4, 8, 12, 16]
                
                for i, career in enumerate(careers[:4]):
                    data_row_idx = data_row_indices[i]
                    detail_row_idx = detail_row_indices[i]
                    
                    # 경력 정보 (row 2, 6, 10, 14)
                    if len(table5.rows) > data_row_idx:
                        row = table5.rows[data_row_idx]
                        if len(row.cells) > 0:
                            row.cells[0].text = career['start']
                        if len(row.cells) > 1:
                            row.cells[1].text = career['end']
                        if len(row.cells) > 2:
                            row.cells[2].text = career['company']
                        if len(row.cells) > 3:
                            row.cells[3].text = career['department']
                        if len(row.cells) > 4:
                            row.cells[4].text = career['position']
                        if len(row.cells) > 5:
                            row.cells[5].text = career['salary']
                        if len(row.cells) > 6:
                            row.cells[6].text = career['reason']
                    
                    # 상세 내용 (row 4, 8, 12, 16)
                    if len(table5.rows) > detail_row_idx:
                        detail_row = table5.rows[detail_row_idx]
                        if len(detail_row.cells) > 0:
                            if use_ai:
                                detail_text = generate_career_detail(use_ai, career)
                            else:
                                detail_text = f"{career['company']} {career['department']}에서 {career['position']}으로 근무하며 다양한 업무를 수행했습니다. 주요 업무는 {random.choice(['프로젝트 관리', '개발', '기획', '마케팅', '영업', '품질관리'])}였으며, 이를 통해 전문성을 키웠습니다."
                            detail_row.cells[0].text = detail_text
            except Exception as e:
                print(f"WARNING: Table 6 처리 중 오류: {e}")
        
        # 저장
        doc.save(output_path)
        return korean_name  # 이름 반환
        
    except Exception as e:
        print(f"ERROR: 더미 이력서 생성 실패: {e}")
        import traceback
        traceback.print_exc()
        return None


def main():
    parser = argparse.ArgumentParser(description='더미 이력서 생성기')
    parser.add_argument('--count', type=int, default=1, help='생성할 더미 이력서 개수 (기본값: 1)')
    parser.add_argument('--output-dir', type=str, default='./generated_resumes', help='출력 디렉토리 (기본값: ./generated_resumes)')
    parser.add_argument('--use-ai', action='store_true', help='AI를 사용해서 자기소개서 및 경력기술서 생성 (선택적, Azure OpenAI 필요)')
    parser.add_argument('--char', '--character', type=str, default=None, dest='character', help='캐릭터 배경 설명 (예: "중위권 대학의 애매한 성적, 공대 졸업 생산직 진출") - AI 사용 시에만 적용')
    parser.add_argument('--field', type=str, default=None, dest='field', help='채용분야 설명 (예: "부품생산팀 PRESS분야 채용. 담당업무는 일반프레스(40~80톤) 설비 양산 운영...") - AI 사용 시에만 적용')
    parser.add_argument('--template', type=str, default='resume_form.docx', help='템플릿 파일 경로 (기본값: resume_form.docx)')
    
    args = parser.parse_args()
    
    # 템플릿 파일 확인
    template_path = os.path.normpath(args.template)
    if not os.path.exists(template_path):
        print(f"ERROR: 템플릿 파일을 찾을 수 없습니다: {template_path}")
        sys.exit(1)
    
    # 출력 디렉토리 생성
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # AI 사용 여부 확인
    if args.use_ai:
        env_vars = load_env_file()
        api_key = env_vars.get('AZURE_OPENAI_API_KEY') or os.getenv('AZURE_OPENAI_API_KEY')
        if not api_key:
            print("WARNING: Azure OpenAI API 키가 설정되지 않았습니다.")
            print("  .env 파일에 AZURE_OPENAI_API_KEY를 설정하거나 --use-ai 옵션을 제거하세요.")
            print("  AI 없이 생성합니다...")
            args.use_ai = False
    
    # 캐릭터 설명이 있는데 AI를 사용하지 않는 경우 경고
    if args.character and not args.use_ai:
        print("WARNING: --char 옵션은 --use-ai와 함께 사용해야 합니다.")
        print("  --use-ai 옵션을 추가하거나 --char 옵션을 제거하세요.")
        args.character = None
    
    # 채용분야 설명이 있는데 AI를 사용하지 않는 경우 경고
    if args.field and not args.use_ai:
        print("WARNING: --field 옵션은 --use-ai와 함께 사용해야 합니다.")
        print("  --use-ai 옵션을 추가하거나 --field 옵션을 제거하세요.")
        args.field = None
    
    print(f"템플릿: {template_path}")
    print(f"출력 디렉토리: {output_dir}")
    print(f"생성 개수: {args.count}")
    print(f"AI 사용: {'예' if args.use_ai else '아니오'}")
    if args.character:
        print(f"캐릭터 배경: {args.character}")
    if args.field:
        print(f"채용분야: {args.field[:60]}..." if len(args.field) > 60 else f"채용분야: {args.field}")
    print()
    
    # 더미 이력서 생성
    success_count = 0
    for i in range(args.count):
        print(f"[{i+1}/{args.count}] 생성 중...", end=' ')
        
        # 임시 파일로 먼저 생성
        temp_path = output_dir / f"temp_{uuid.uuid4().hex[:8]}.docx"
        name = fill_resume_form(template_path, str(temp_path), args.use_ai, args.character, args.field)
        
        if name:
            # 이름_고유번호[char키워드].docx 형식으로 저장
            unique_id = uuid.uuid4().hex[:8]
            
            # char 정보에서 키워드 추출
            char_keywords = extract_char_keywords(args.character) if args.character else ""
            
            output_filename = f"{name}_{unique_id}{char_keywords}.docx"
            output_path = output_dir / output_filename
            
            # 파일명 중복 체크
            counter = 1
            while output_path.exists():
                output_filename = f"{name}_{unique_id}{char_keywords}_{counter}.docx"
                output_path = output_dir / output_filename
                counter += 1
            
            # 임시 파일을 최종 파일명으로 이동
            temp_path.rename(output_path)
            print(f"✓ 완료: {output_filename}")
            success_count += 1
        else:
            if temp_path.exists():
                temp_path.unlink()
            print("✗ 실패")
    
    print()
    print(f"완료: {success_count}/{args.count}개 생성됨")
    print(f"출력 위치: {output_dir.absolute()}")


if __name__ == '__main__':
    main()
