const nodemailer = require('nodemailer');

function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function v(state, key, fallback = '미입력') {
  const val = state[key];
  return (val !== undefined && val !== null && String(val).trim() !== '') ? val : fallback;
}

function money(n) {
  return (Number(n) || 0).toLocaleString('ko-KR') + '원';
}

function computeCompletion(state) {
  const fields = [
    {key:'company',label:'업체명'},{key:'representative',label:'대표자 성명'},
    {key:'industry',label:'업종'},{key:'region',label:'지역'},{key:'applyType',label:'신청유형'},
    {key:'itemSummary',label:'사업 아이템 요약'},{key:'currentProcess',label:'현재 업무 프로세스'},
    {key:'painPoint',label:'핵심 문제'},{key:'aiNeed',label:'AI 도입 필요성'},
    {key:'aiMethod',label:'AI 적용 방식'},{key:'targetCustomer',label:'핵심 고객'},
    {key:'customerProblem',label:'고객 문제'},{key:'differentiation',label:'차별화 요소'},
    {key:'bmImprovement',label:'BM 개선'},{key:'month1',label:'1개월차 실행계획'},
    {key:'month2',label:'2개월차 실행계획'},{key:'month3',label:'3개월차 실행계획'},
    {key:'capacity',label:'수행역량'},{key:'totalBudget',label:'총사업비'},
  ];
  const empty = fields.filter(f => !String(state[f.key] || '').trim());
  return { total: fields.length, filled: fields.length - empty.length, empty };
}

function buildEmailHtml(state) {
  const company = v(state, 'company');
  const rep = v(state, 'representative');
  const industry = v(state, 'industry');
  const region = v(state, 'region');
  const applyType = v(state, 'applyType');
  const tools = (state.multi?.aiTools || []).join(', ') || '미입력';
  const tech = (state.multi?.aiTech || []).join(', ') || '미입력';
  const total = Number(state.totalBudget) || 0;
  const gov = Math.floor(total * 0.8);
  const self = total - gov;
  const kpis = [
    { name: v(state,'kpi1'), base: v(state,'kpi1Base'), target: v(state,'kpi1Target') },
    { name: v(state,'kpi2'), base: v(state,'kpi2Base'), target: v(state,'kpi2Target') },
    { name: v(state,'kpi3'), base: v(state,'kpi3Base'), target: v(state,'kpi3Target') },
  ].filter(k => k.name !== '미입력');

  const scoreMap = state.scores || {};
  const weights = { fit1:15, fit2:15, growth1:20, growth2:20, cap1:15, cap2:15 };
  const scoreLabels = {
    fit1:'AI 전략 명확성', fit2:'업무 적용 가능성',
    growth1:'사업모델 개선', growth2:'시장성·지속성장',
    cap1:'참여의지·수행역량', cap2:'계획 구체성'
  };
  const totalScore = Object.entries(weights).reduce((acc, [k,w]) => {
    return acc + Math.round((Number(scoreMap[k]||0)/5)*w);
  }, 0);

  const docs = (state.docs || []);
  const budgets = (state.budgetItems || []).filter(x => x.description || x.amount);

  const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  const completion = computeCompletion(state);
  const pct = Math.round(completion.filled / completion.total * 100);
  const pctColor = pct >= 80 ? '#138a62' : pct >= 50 ? '#b7791f' : '#c53b3b';
  const barColor = pct >= 80 ? '#138a62' : pct >= 50 ? '#f6ad55' : '#c53b3b';

  const section = (title, content) => `
    <div style="margin-bottom:20px">
      <div style="background:#0b1f3a;color:#fff;padding:8px 14px;border-radius:8px 8px 0 0;font-size:13px;font-weight:700">${title}</div>
      <div style="border:1px solid #e3e8f0;border-top:0;border-radius:0 0 8px 8px;padding:14px;background:#fff;font-size:13px;line-height:1.7">${content}</div>
    </div>`;

  const row = (label, value) => `<tr><td style="color:#667085;width:140px;padding:4px 8px 4px 0;vertical-align:top">${esc(label)}</td><td style="padding:4px 0;color:#172033">${esc(value) || '미입력'}</td></tr>`;

  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"></head><body style="font-family:system-ui,-apple-system,sans-serif;background:#f5f7fb;padding:24px;margin:0">
<div style="max-width:680px;margin:auto">
  <div style="background:linear-gradient(120deg,#0b1f3a,#2f63ff);color:#fff;padding:24px;border-radius:14px;margin-bottom:16px">
    <div style="font-size:20px;font-weight:900;margin-bottom:4px">혁신 소상공인 AI 활용지원 저장 백업</div>
    <div style="opacity:.75;font-size:13px">저장 시각: ${now}</div>
  </div>
  <div style="background:#fff;border:1px solid #e3e8f0;border-radius:12px;padding:16px;margin-bottom:20px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <b style="font-size:14px;color:#172033">작성 완성도</b>
      <span style="font-size:24px;font-weight:900;color:${pctColor}">${pct}%</span>
    </div>
    <div style="background:#edf0f5;border-radius:999px;height:10px;overflow:hidden;margin-bottom:10px">
      <div style="width:${pct}%;height:100%;background:${barColor};border-radius:999px"></div>
    </div>
    <div style="font-size:12px;color:#667085;margin-bottom:${completion.empty.length ? '8px' : '0'}">필수 ${completion.total}개 항목 중 ${completion.filled}개 입력됨</div>
    ${completion.empty.length ? `<div style="font-size:12px;color:#c53b3b;background:#fff4f4;border:1px solid #ffc9c9;border-radius:8px;padding:8px 10px"><b>미입력 항목 (${completion.empty.length}개):</b> ${completion.empty.map(f => f.label).join(' · ')}</div>` : '<div style="font-size:12px;color:#138a62;background:#eefaf6;border:1px solid #bfe6d6;border-radius:8px;padding:8px 10px"><b>모든 필수 항목 입력 완료</b></div>'}
  </div>

  ${section('기업 기본정보', `<table style="border-collapse:collapse;width:100%">
    ${row('업체명', company)} ${row('대표자', rep)}
    ${row('업종', industry)} ${row('지역', region)}
    ${row('신청유형', applyType)} ${row('활용 AI', tools)}
  </table>`)}

  ${section('AI 활용모델', `<table style="border-collapse:collapse;width:100%">
    ${row('아이템 요약', v(state,'itemSummary'))}
    ${row('현재 프로세스', v(state,'currentProcess'))}
    ${row('핵심 문제', v(state,'painPoint'))}
    ${row('AI 도입 필요성', v(state,'aiNeed'))}
    ${row('AI 적용 방식', v(state,'aiMethod'))}
    ${row('AI 기술', tech)}
  </table>`)}

  ${section(`성과지표(KPI)`, kpis.length ? kpis.map(k =>
    `<div style="margin-bottom:8px"><b>${k.name}</b>: ${k.base} → <span style="color:#2f63ff">${k.target}</span></div>`
  ).join('') : '미입력')}

  ${section('사업모델·시장성', `<table style="border-collapse:collapse;width:100%">
    ${row('핵심 고객', v(state,'targetCustomer'))}
    ${row('고객 문제', v(state,'customerProblem'))}
    ${row('차별화 요소', v(state,'differentiation'))}
    ${row('BM 개선', v(state,'bmImprovement'))}
    ${row('수익모델', v(state,'revenueModel'))}
  </table>`)}

  ${section('실행계획', `<table style="border-collapse:collapse;width:100%">
    ${row('1개월차', v(state,'month1'))}
    ${row('2개월차', v(state,'month2'))}
    ${row('3개월차', v(state,'month3'))}
    ${row('수행역량', v(state,'capacity'))}
    ${row('위험·대응', v(state,'risks'))}
  </table>`)}

  ${section('예산', `
    <div style="margin-bottom:10px"><b>총사업비:</b> ${money(total)} / 정부지원 상한: ${money(gov)} / 자부담: ${money(self)}</div>
    ${budgets.length ? `<table style="border-collapse:collapse;width:100%"><thead><tr style="background:#f7f9fc"><th style="padding:6px 8px;text-align:left;font-size:12px">항목</th><th style="padding:6px 8px;text-align:left;font-size:12px">내용</th><th style="padding:6px 8px;text-align:right;font-size:12px">금액</th></tr></thead><tbody>` +
    budgets.map(b => `<tr><td style="padding:6px 8px;border-top:1px solid #e3e8f0">${esc(b.category)}</td><td style="padding:6px 8px;border-top:1px solid #e3e8f0">${esc(b.description)||'-'}</td><td style="padding:6px 8px;border-top:1px solid #e3e8f0;text-align:right">${money(b.amount)}</td></tr>`).join('') +
    `</tbody></table>` : '세부항목 없음'}`)}

  ${section(`서류평가 준비도 (${totalScore}/100점)`, Object.entries(weights).map(([k,w]) => {
    const raw = Number(scoreMap[k]||0);
    const s = Math.round(raw/5*w);
    const pct = Math.round(s/w*100);
    return `<div style="margin-bottom:8px"><span style="display:inline-block;width:160px;color:#344054">${scoreLabels[k]}</span> <span style="display:inline-block;width:180px;background:#edf0f5;border-radius:999px;height:8px;vertical-align:middle"><span style="display:block;width:${pct}%;height:100%;background:#2f63ff;border-radius:999px"></span></span> <span style="color:#2f63ff;font-weight:700;margin-left:8px">${s}/${w}</span></div>`;
  }).join(''))}

  ${section('제출서류 체크', docs.length ? docs.map(d => `✅ ${d}`).join('<br>') : '미체크')}

  <div style="text-align:center;color:#667085;font-size:11px;margin-top:20px">
    이 메일은 2026 혁신 소상공인 AI 활용지원 템플릿 빌더에서 자동 발송됐습니다.<br>
    공식 서비스가 아닙니다. 최종 제출 전 공식 공고문을 반드시 확인하세요.
  </div>
</div>
</body></html>`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.GMAIL_APP_PASSWORD) {
    return res.status(500).json({ error: 'GMAIL_APP_PASSWORD env var not set' });
  }

  const state = req.body || {};
  const company = v(state, 'company', '작성 중');
  const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  const { filled, total } = computeCompletion(state);
  const pctSubject = Math.round(filled / total * 100);

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'dltkddlf231@gmail.com',
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });

  try {
    await transporter.sendMail({
      from: '"AI 활용지원 대시보드" <dltkddlf231@gmail.com>',
      to: 'dltkddlf231@gmail.com',
      subject: `[AI 활용지원 저장] ${company} · ${pctSubject}% 완성 · ${now}`,
      html: buildEmailHtml(state)
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('sendMail error:', err.message);
    res.status(500).json({ error: 'mail_failed', detail: err.message });
  }
};
