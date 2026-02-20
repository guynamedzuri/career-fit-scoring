#!/usr/bin/env node
/**
 * 회사용 인증서(cert) 파일 생성
 * cert 내용: signature=zuri;AZURE_OPENAI_API_KEY=...;QNET_API_KEY=...; 등
 * 'encryptkey'를 키로 AES-256-CBC 암호화하여 파일로 저장.
 *
 * 사용법:
 *   .env 파일이 있으면 해당 디렉터리에서:
 *     node scripts/create-cert.js [출력파일경로]
 *   또는 환경 변수로 값 지정 후 실행
 *
 * 출력 기본값: company_cert.enc (현재 디렉터리)
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ENCRYPT_KEY_STRING = 'encryptkey';
const SIGNATURE_VALUE = 'zuri';

const IV_LENGTH = 16;
const KEY_LENGTH = 32;

function deriveKey(keyString) {
  return crypto.createHash('sha256').update(keyString, 'utf8').digest();
}

function encrypt(plainText, keyString) {
  const key = deriveKey(keyString);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, encrypted]);
}

function buildCertContent(env) {
  const pairs = [
    `signature=${SIGNATURE_VALUE}`,
    `AZURE_OPENAI_API_KEY=${env.AZURE_OPENAI_API_KEY || ''}`,
    `AZURE_OPENAI_ENDPOINT=${env.AZURE_OPENAI_ENDPOINT || ''}`,
    `AZURE_OPENAI_DEPLOYMENT=${env.AZURE_OPENAI_DEPLOYMENT || ''}`,
    `AZURE_OPENAI_API_VERSION=${env.AZURE_OPENAI_API_VERSION || ''}`,
    `QNET_API_KEY=${env.QNET_API_KEY || ''}`,
    `CAREERNET_API_KEY=${env.CAREERNET_API_KEY || ''}`,
  ];
  return pairs.join(';');
}

function loadEnvFromFile(envPath) {
  const env = {};
  if (!fs.existsSync(envPath)) return env;
  const content = fs.readFileSync(envPath, 'utf-8').replace(/^\uFEFF/, '');
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const m = t.match(/^([^=]+)=(.*)$/);
    if (m) {
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      env[m[1].trim()] = v;
    }
  }
  return env;
}

function main() {
  const outPath = process.argv[2] || path.join(process.cwd(), 'company_cert.enc');

  let env = { ...process.env };
  const projectRoot = path.resolve(__dirname, '..');
  const envPath = path.join(projectRoot, '.env');
  const fromFile = loadEnvFromFile(envPath);
  if (Object.keys(fromFile).length) {
    console.log('[create-cert] Using .env from:', envPath);
    env = { ...env, ...fromFile };
  }

  const content = buildCertContent(env);
  if (!env.AZURE_OPENAI_API_KEY && !content.includes('AZURE_OPENAI_API_KEY=sk-')) {
    console.warn('[create-cert] AZURE_OPENAI_API_KEY is empty in .env – cert will contain empty value.');
  }
  const encrypted = encrypt(content, ENCRYPT_KEY_STRING);
  fs.writeFileSync(outPath, encrypted);
  console.log('[create-cert] Written:', outPath, '(' + encrypted.length + ' bytes)');
}

main();
