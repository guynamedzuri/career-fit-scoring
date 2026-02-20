#!/usr/bin/env node
/**
 * 회사용 인증서(cert) 파일 생성
 * cert 내용: signature=zuri;AZURE_OPENAI_API_KEY=...;QNET_API_KEY=...; 등
 * 'encryptkey'를 키로 AES-256-CBC 암호화하여 파일로 저장.
 *
 * 사용법:
 *   node scripts/create-cert.js <키목록.txt> [출력.enc]
 *
 * 키목록.txt 형식 (.env와 동일): 한 줄에 KEY=VALUE, # 주석, 빈 줄 무시
 *   AZURE_OPENAI_API_KEY=sk-...
 *   AZURE_OPENAI_ENDPOINT=https://...
 *   QNET_API_KEY=...
 *   CAREERNET_API_KEY=...
 *
 * 출력 기본값: company_cert.enc (현재 디렉터리)
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ENCRYPT_KEY_STRING = 'encryptkey';
const SIGNATURE_VALUE = 'zuri';

const IV_LENGTH = 16;

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

/** KEY=VALUE 형식의 txt 파일 파싱 (.env 형식) */
function loadKeysFromTxt(txtPath) {
  const env = {};
  if (!fs.existsSync(txtPath)) {
    console.error('[create-cert] 파일을 찾을 수 없습니다:', txtPath);
    process.exit(1);
  }
  const content = fs.readFileSync(txtPath, 'utf-8').replace(/^\uFEFF/, '');
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
  const txtPath = process.argv[2];
  const outPath = process.argv[3] || path.join(process.cwd(), 'company_cert.enc');

  if (!txtPath) {
    console.error('사용법: node scripts/create-cert.js <키목록.txt> [출력.enc]');
    console.error('  키목록.txt: KEY=VALUE 형식 (한 줄에 하나, # 주석 가능)');
    process.exit(1);
  }

  const resolvedTxt = path.isAbsolute(txtPath) ? txtPath : path.resolve(process.cwd(), txtPath);
  const env = loadKeysFromTxt(resolvedTxt);
  console.log('[create-cert] 읽은 파일:', resolvedTxt, '→ 키', Object.keys(env).length, '개');

  const content = buildCertContent(env);
  if (!env.AZURE_OPENAI_API_KEY || !env.AZURE_OPENAI_API_KEY.trim()) {
    console.warn('[create-cert] AZURE_OPENAI_API_KEY가 비어 있습니다. cert에는 빈 값이 들어갑니다.');
  }
  const encrypted = encrypt(content, ENCRYPT_KEY_STRING);
  const resolvedOut = path.isAbsolute(outPath) ? outPath : path.resolve(process.cwd(), outPath);
  fs.writeFileSync(resolvedOut, encrypted);
  console.log('[create-cert] 생성 완료:', resolvedOut, '(' + encrypted.length + ' bytes)');
}

main();
