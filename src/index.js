"use strict";
/**
 * Career Fit Scoring Algorithm
 *
 * 커리어넷 API를 활용한 지원자 적합도 점수 산출 알고리즘
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_RESUME_MAPPING = exports.mapResumeDataToApplicationData = exports.findColumnByText = exports.findRowByText = exports.getCellValue = exports.extractTablesFromDocx = exports.ADDITIONAL_NATIONAL_CERTIFICATES = exports.parseAdditionalNationalCertificates = exports.parseOfficialCertificates = exports.searchCertifications = exports.searchMajors = exports.getJobDetail = exports.searchJobs = exports.extractEducations = exports.extractCareers = exports.extractCertifications = exports.calculateGpaScore = exports.calculateRelatedMajorScore = exports.calculateAllScores = exports.calculateTotalScore = exports.calculateEducationScore = exports.calculateCareerScore = exports.calculateCertificationScore = void 0;
// 점수 계산 함수들
var scoring_1 = require("./scoring");
Object.defineProperty(exports, "calculateCertificationScore", { enumerable: true, get: function () { return scoring_1.calculateCertificationScore; } });
Object.defineProperty(exports, "calculateCareerScore", { enumerable: true, get: function () { return scoring_1.calculateCareerScore; } });
Object.defineProperty(exports, "calculateEducationScore", { enumerable: true, get: function () { return scoring_1.calculateEducationScore; } });
Object.defineProperty(exports, "calculateTotalScore", { enumerable: true, get: function () { return scoring_1.calculateTotalScore; } });
Object.defineProperty(exports, "calculateAllScores", { enumerable: true, get: function () { return scoring_1.calculateAllScores; } });
Object.defineProperty(exports, "calculateRelatedMajorScore", { enumerable: true, get: function () { return scoring_1.calculateRelatedMajorScore; } });
Object.defineProperty(exports, "calculateGpaScore", { enumerable: true, get: function () { return scoring_1.calculateGpaScore; } });
Object.defineProperty(exports, "extractCertifications", { enumerable: true, get: function () { return scoring_1.extractCertifications; } });
Object.defineProperty(exports, "extractCareers", { enumerable: true, get: function () { return scoring_1.extractCareers; } });
Object.defineProperty(exports, "extractEducations", { enumerable: true, get: function () { return scoring_1.extractEducations; } });
// API 연동 함수들
var careernet_1 = require("./api/careernet");
Object.defineProperty(exports, "searchJobs", { enumerable: true, get: function () { return careernet_1.searchJobs; } });
Object.defineProperty(exports, "getJobDetail", { enumerable: true, get: function () { return careernet_1.getJobDetail; } });
Object.defineProperty(exports, "searchMajors", { enumerable: true, get: function () { return careernet_1.searchMajors; } });
var qnet_1 = require("./api/qnet");
Object.defineProperty(exports, "searchCertifications", { enumerable: true, get: function () { return qnet_1.searchCertifications; } });
// 자격증 파싱 함수들
var certificateParser_1 = require("./certificateParser");
Object.defineProperty(exports, "parseOfficialCertificates", { enumerable: true, get: function () { return certificateParser_1.parseOfficialCertificates; } });
Object.defineProperty(exports, "parseAdditionalNationalCertificates", { enumerable: true, get: function () { return certificateParser_1.parseAdditionalNationalCertificates; } });
Object.defineProperty(exports, "ADDITIONAL_NATIONAL_CERTIFICATES", { enumerable: true, get: function () { return certificateParser_1.ADDITIONAL_NATIONAL_CERTIFICATES; } });
// DOCX 파싱 함수들
var docxParser_1 = require("./docxParser");
Object.defineProperty(exports, "extractTablesFromDocx", { enumerable: true, get: function () { return docxParser_1.extractTablesFromDocx; } });
Object.defineProperty(exports, "getCellValue", { enumerable: true, get: function () { return docxParser_1.getCellValue; } });
Object.defineProperty(exports, "findRowByText", { enumerable: true, get: function () { return docxParser_1.findRowByText; } });
Object.defineProperty(exports, "findColumnByText", { enumerable: true, get: function () { return docxParser_1.findColumnByText; } });
// 이력서 매핑 함수들
var resumeMapping_1 = require("./resumeMapping");
Object.defineProperty(exports, "mapResumeDataToApplicationData", { enumerable: true, get: function () { return resumeMapping_1.mapResumeDataToApplicationData; } });
Object.defineProperty(exports, "DEFAULT_RESUME_MAPPING", { enumerable: true, get: function () { return resumeMapping_1.DEFAULT_RESUME_MAPPING; } });
