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
KOREAN_SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '류', '전']
KOREAN_GIVEN_NAMES = ['민준', '서준', '도윤', '예준', '시우', '하준', '주원', '지호', '준서', '건우',
                      '서연', '서윤', '지우', '서현', '민서', '하은', '예은', '윤서', '채원', '지원']

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
    """학력 정보 생성 (1-3개)"""
    count = random.randint(1, 3)
    educations = []
    
    for i in range(count):
        if i == 0:  # 최종 학력
            level = random.choice(['대학교', '대학원'])
            if level == '대학원':
                degree = random.choice(['석사', '박사'])
            else:
                degree = '학사'
        else:
            level = random.choice(['고등학교', '전문대학'])
            degree = ''
        
        university = random.choice(UNIVERSITIES) if level != '고등학교' else f"{random.choice(CITIES).replace('시', '').replace('도', '')}고등학교"
        major = random.choice(MAJORS) if level != '고등학교' else ''
        
        start_year = random.randint(2015, 2020)
        end_year = start_year + (4 if level == '대학교' else 2 if level == '전문대학' else 3 if level == '대학원' else 0)
        
        if level == '고등학교':
            end_year = start_year + 3
        
        gpa = f"{random.uniform(3.0, 4.5):.2f}/4.5" if level != '고등학교' else ''
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


def generate_self_introduction() -> List[str]:
    """자기소개서 생성 (4개 항목)"""
    topics = [
        "지원동기 및 입사 후 포부",
        "성장과정 및 강점",
        "협업 경험 및 리더십",
        "직무 관련 경험 및 역량"
    ]
    
    introductions = []
    for topic in topics:
        # 간단한 더미 텍스트 생성 (실제로는 AI를 사용할 수 있음)
        intro = f"{topic}에 대한 답변입니다. 저는 {random.choice(COMPANIES)}에서 {random.randint(1, 5)}년간 근무하며 다양한 프로젝트를 수행했습니다. 이를 통해 {random.choice(['커뮤니케이션', '문제해결', '기획', '개발', '마케팅'])} 역량을 키웠으며, 귀사에서도 이러한 경험을 바탕으로 기여하고 싶습니다."
        introductions.append(intro)
    
    return introductions


def fill_resume_form(template_path: str, output_path: str, use_ai: bool = False):
    """이력서 양식에 더미 데이터 채우기"""
    try:
        doc = Document(template_path)
        
        # 테이블 찾기
        tables = doc.tables
        if len(tables) < 6:
            print(f"WARNING: 예상된 테이블 개수(6개)보다 적습니다: {len(tables)}개")
        
        # 더미 데이터 생성
        korean_name, english_name = generate_korean_name()
        birth_date = generate_birth_date()
        email = generate_email(korean_name)
        phone = generate_phone()
        phone_home = generate_phone()
        address = generate_address()
        salary = generate_salary()
        military = random.choice(MILITARY_STATUS)
        
        educations = generate_education()
        careers = generate_career()
        certificates = generate_certificates()
        languages = generate_languages()
        self_intros = generate_self_introduction()
        
        # Table 1: 기본 정보
        if len(tables) > 0:
            table1 = tables[0]
            try:
                # 1,1: 한글이름, 한문이름
                if len(table1.rows) > 0 and len(table1.rows[0].cells) > 0:
                    table1.rows[0].cells[0].text = f"{korean_name}"
                
                # 1,5: 희망연봉
                if len(table1.rows[0].cells) > 4:
                    table1.rows[0].cells[4].text = salary
                
                # 2,1: 영문이름
                if len(table1.rows) > 1:
                    table1.rows[1].cells[0].text = english_name
                
                # 3,1: 생년월일
                if len(table1.rows) > 2:
                    table1.rows[2].cells[0].text = birth_date
                
                # 3,4: 이메일
                if len(table1.rows) > 2 and len(table1.rows[2].cells) > 3:
                    table1.rows[2].cells[3].text = email
                
                # 4,1: 주소
                if len(table1.rows) > 3:
                    table1.rows[3].cells[0].text = address
                
                # 5,1: 자택전화
                if len(table1.rows) > 4:
                    table1.rows[4].cells[0].text = phone_home
                
                # 6,1: 이동전화
                if len(table1.rows) > 5:
                    table1.rows[5].cells[0].text = phone
                
                # 8,1~5: 병역
                if len(table1.rows) > 7:
                    for i in range(5):
                        if len(table1.rows[7].cells) > i:
                            table1.rows[7].cells[i].text = military if i == 0 else ''
            except Exception as e:
                print(f"WARNING: Table 1 처리 중 오류: {e}")
        
        # Table 2: 학력
        if len(tables) > 1:
            table2 = tables[1]
            try:
                # row 2부터 7까지 (최대 6개)
                for i, edu in enumerate(educations[:6]):
                    row_idx = i + 1  # row 2부터 시작
                    if len(table2.rows) > row_idx:
                        row = table2.rows[row_idx]
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
                print(f"WARNING: Table 2 처리 중 오류: {e}")
        
        # Table 3: 경력
        if len(tables) > 2:
            table3 = tables[2]
            try:
                # row 2부터 6까지 (최대 5개)
                for i, career in enumerate(careers[:5]):
                    row_idx = i + 1  # row 2부터 시작
                    if len(table3.rows) > row_idx:
                        row = table3.rows[row_idx]
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
                print(f"WARNING: Table 3 처리 중 오류: {e}")
        
        # Table 4: 어학/자격증/해외연수/수상경력
        if len(tables) > 3:
            table4 = tables[3]
            try:
                # 어학 (row 2-4, cell 0-2)
                for i, lang in enumerate(languages[:3]):
                    row_idx = i + 1  # row 2부터
                    if len(table4.rows) > row_idx:
                        row = table4.rows[row_idx]
                        if len(row.cells) > 0:
                            row.cells[0].text = lang['name']  # 어학종류
                        if len(row.cells) > 1:
                            row.cells[1].text = lang['score']  # 점수/등급
                        if len(row.cells) > 2:
                            row.cells[2].text = lang['date']  # 취득일자
                
                # 자격증 (row 2-4, cell 3-5)
                for i, cert in enumerate(certificates[:3]):
                    row_idx = i + 1  # row 2부터
                    if len(table4.rows) > row_idx:
                        row = table4.rows[row_idx]
                        if len(row.cells) > 3:
                            row.cells[3].text = cert['name']  # 자격증 이름
                        if len(row.cells) > 4:
                            row.cells[4].text = cert['grade']  # 등급/점수
                        if len(row.cells) > 5:
                            row.cells[5].text = cert['issuer']  # 발행기관
            except Exception as e:
                print(f"WARNING: Table 4 처리 중 오류: {e}")
        
        # Table 5: 자기소개서
        if len(tables) > 4:
            table5 = tables[4]
            try:
                # 1,1 / 3,1 / 5,1 / 7,1
                intro_positions = [(0, 0), (2, 0), (4, 0), (6, 0)]
                for i, (row_idx, cell_idx) in enumerate(intro_positions):
                    if len(table5.rows) > row_idx and len(table5.rows[row_idx].cells) > cell_idx:
                        if i < len(self_intros):
                            table5.rows[row_idx].cells[cell_idx].text = self_intros[i]
            except Exception as e:
                print(f"WARNING: Table 5 처리 중 오류: {e}")
        
        # Table 6: 경력기술 (선택적)
        if len(tables) > 5:
            table6 = tables[5]
            try:
                # 경력 개수만큼 경력기술 작성
                for i, career in enumerate(careers[:4]):
                    block_start_row = i * 4  # 각 경력당 4행씩
                    if len(table6.rows) > block_start_row + 1:
                        # row 2, 6, 10, 14에 경력 정보
                        row = table6.rows[block_start_row + 1]
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
                        
                        # row 4, 8, 12, 16에 상세 내용
                        if len(table6.rows) > block_start_row + 3:
                            detail_row = table6.rows[block_start_row + 3]
                            if len(detail_row.cells) > 0:
                                detail_text = f"{career['company']} {career['department']}에서 {career['position']}으로 근무하며 다양한 업무를 수행했습니다. 주요 업무는 {random.choice(['프로젝트 관리', '개발', '기획', '마케팅', '영업', '품질관리'])}였으며, 이를 통해 전문성을 키웠습니다."
                                detail_row.cells[0].text = detail_text
            except Exception as e:
                print(f"WARNING: Table 6 처리 중 오류: {e}")
        
        # 저장
        doc.save(output_path)
        print(f"✓ 생성 완료: {output_path}")
        return True
        
    except Exception as e:
        print(f"ERROR: 더미 이력서 생성 실패: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    parser = argparse.ArgumentParser(description='더미 이력서 생성기')
    parser.add_argument('--count', type=int, default=1, help='생성할 더미 이력서 개수 (기본값: 1)')
    parser.add_argument('--output-dir', type=str, default='./dummy_resumes', help='출력 디렉토리 (기본값: ./dummy_resumes)')
    parser.add_argument('--use-ai', action='store_true', help='AI를 사용해서 자기소개서 생성 (선택적)')
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
    
    print(f"템플릿: {template_path}")
    print(f"출력 디렉토리: {output_dir}")
    print(f"생성 개수: {args.count}")
    print(f"AI 사용: {'예' if args.use_ai else '아니오'}")
    print()
    
    # 더미 이력서 생성
    success_count = 0
    for i in range(args.count):
        output_filename = f"dummy_resume_{i+1:03d}.docx"
        output_path = output_dir / output_filename
        
        print(f"[{i+1}/{args.count}] 생성 중...", end=' ')
        if fill_resume_form(template_path, str(output_path), args.use_ai):
            success_count += 1
    
    print()
    print(f"완료: {success_count}/{args.count}개 생성됨")
    print(f"출력 위치: {output_dir.absolute()}")


if __name__ == '__main__':
    main()
