<img src="frontend/public/favicon.svg" width="128" alt="WhatEat" />

# WhatEat
## 개요
식사 메뉴가 고민 될 때, 현재 위치를 기반으로 주변 음식점을 무작위로 추천해주는 위치 기반 음식점 추천 서비스입니다


## 배포

[https://whateat.onrender.com](https://whateat.onrender.com/)

## 주요 기능

- 현재 위치·검색 위치 기반 음식점 추천
- 검색 반경(100~500m) 및 음식 카테고리 필터
- 카카오 지도 표시 및 추천 기록
- 좋아요 목록 관리·목록 내 무작위 추천
- 추천 제외 음식점 관리
- 카카오 로그인 및 회원 탈퇴

## 기술 스택

| 구분 | 기술 |
| --- | --- |
| 프론트엔드 | ![React 19](https://img.shields.io/badge/React_19-20232A?logo=react&logoColor=61DAFB) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white) ![Vite 7](https://img.shields.io/badge/Vite_7-646CFF?logo=vite&logoColor=white) |
| 백엔드 | ![NestJS 11](https://img.shields.io/badge/NestJS_11-E0234E?logo=nestjs&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white) |
| 데이터베이스 | ![MongoDB](https://img.shields.io/badge/MongoDB-47A248?logo=mongodb&logoColor=white) ![Mongoose](https://img.shields.io/badge/Mongoose-880000?logo=mongoose&logoColor=white) |
| 외부 API | ![Kakao Maps](https://img.shields.io/badge/Kakao_Maps-FFCD00?logo=kakao&logoColor=black) ![Kakao Local](https://img.shields.io/badge/Kakao_Local-FFCD00?logo=kakao&logoColor=black) ![Kakao Login](https://img.shields.io/badge/Kakao_Login-FFCD00?logo=kakao&logoColor=black) |
| 배포 | ![Render](https://img.shields.io/badge/Render-000000?logo=render&logoColor=white) |

## 설치 및 실행

필요 환경: Node.js 20.19 이상(20.x) 또는 22.12 이상, npm, MongoDB, 카카오 앱 키.

#### 1. 패키지 설치

프로젝트 루트에서 실행:

```cmd
npm --prefix frontend ci
npm --prefix backend ci
```

#### 2. 환경변수 설정

`frontend/.env`

| 환경변수 | 필요한 값 |
| --- | --- |
| `VITE_API_BASE_URL` | 백엔드 주소 (로컬: `http://localhost:3000`) |
| `VITE_KAKAO_JAVASCRIPT_KEY` | 카카오 앱 JavaScript 키 |

`backend/.env`

| 환경변수 | 필요한 값 |
| --- | --- |
| `MONGODB_URI` | MongoDB 연결 문자열 |
| `KAKAO_REST_API_KEY` | 카카오 앱 REST API 키 |
| `KAKAO_CLIENT_SECRET` | 카카오 로그인 Client Secret |
| `KAKAO_ADMIN_KEY` | 같은 카카오 앱의 Admin 키 (사용자 연결 해제 API 권한 필요) |
| `KAKAO_REDIRECT_URI` | 카카오 로그인 콜백 주소 (로컬: `http://localhost:3000/auth/kakao/callback`) |
| `FRONTEND_ORIGIN` | 프론트엔드 주소 (로컬: `http://localhost:5173`) |

#### 3. 실행

프로젝트 루트에서 터미널 두 개로 각각 실행:

`backend`
```cmd
npm run start:backend
```

`frontend`
```cmd
npm --prefix frontend run dev
```

## 라이센스
이 프로젝트는 [MIT LICENSE](LICENSE)를 따릅니다.
