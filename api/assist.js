const Anthropic = require('@anthropic-ai/sdk');

const FIELD_META = {
  itemSummary:     { label: '사업 아이템 한 줄 요약',      format: '한 문장 30~60자. AI를 어떤 업무에 어떻게 적용해 어떤 문제를 해결하는지 명확히.' },
  currentProcess:  { label: '현재 핵심 업무 프로세스',      format: '"A → B → C" 형식으로 3~5단계. 각 단계에 담당자나 소요시간 포함.' },
  painPoint:       { label: '현장의 핵심 문제',              format: '수치와 사례 포함 2~4문장. 구체적인 손실·지연·오류를 포함.' },
  aiNeed:          { label: 'AI 도입 필요성과 목표',         format: '기존 방식의 한계 + AI 도입 후 달라지는 점 2~3문장.' },
  aiMethod:        { label: 'AI 적용 지점과 방식',           format: '어느 업무 단계에 어떤 AI 기술(RAG·프롬프트·자동화 등)을 어떻게 쓰는지 2~3문장.' },
  targetCustomer:  { label: '핵심 고객',                     format: '고객군과 규모 1~2문장.' },
  customerProblem: { label: '고객이 겪는 문제',              format: '구매·이용 과정의 불편과 비용 2~3문장.' },
  differentiation: { label: '차별화 요소',                   format: '경쟁 대비 구체적 차별점 2~3개, 각 1~2문장.' },
  bmImprovement:   { label: 'AI 적용 후 사업모델 개선',     format: '원가 절감, 신규서비스, 재구매율 등 구체적 수치 포함 2~3문장.' },
  revenueModel:    { label: '수익모델',                      format: '현재 수익 구조와 AI 도입 후 변화 1~2문장.' },
  month1:          { label: '1개월차 실행계획',              format: '요구사항 정의·데이터 정비·설계·공급사 선정 중심. 산출물 명시. 3~5줄.' },
  month2:          { label: '2개월차 실행계획',              format: '개발·연계·시제품·내부테스트·교육 중심. 산출물 명시. 3~5줄.' },
  month3:          { label: '3개월차 실행계획',              format: '현장실증·KPI 측정·개선·상용화 중심. 산출물 명시. 3~5줄.' },
  capacity:        { label: '대표자·팀 수행역량',            format: '업력·현장경험·보유고객·기술협력사·참여시간 중심 2~4문장.' },
  risks:           { label: '주요 위험과 대응',              format: '위험 3가지와 각 대응책을 항목별로 작성.' },
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' });
  }

  const { field, state = {} } = req.body || {};
  const meta = FIELD_META[field];
  if (!meta) return res.status(400).json({ error: 'Unknown field: ' + field });

  const ctx = [
    `업종: ${state.industry || '미입력'}`,
    `지역: ${state.region || '미입력'}`,
    `신청유형: ${state.applyType || '미입력'}`,
    state.itemSummary    ? `사업 아이템: ${state.itemSummary}` : null,
    state.currentProcess ? `현재 프로세스: ${state.currentProcess}` : null,
    state.painPoint      ? `핵심 문제: ${state.painPoint}` : null,
    state.aiNeed         ? `AI 도입 필요성: ${state.aiNeed}` : null,
    state.aiMethod       ? `AI 적용방식: ${state.aiMethod}` : null,
    state.targetCustomer ? `핵심 고객: ${state.targetCustomer}` : null,
    state.customerProblem? `고객 문제: ${state.customerProblem}` : null,
  ].filter(Boolean).join('\n');

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    system: `당신은 2026 혁신 소상공인 AI 활용지원 사업 신청서 작성을 돕는 보조 도우미입니다.
신청자가 입력한 정보를 바탕으로 해당 필드의 작성 초안을 만듭니다.

규칙:
- 사실이나 수치를 지어내지 마세요. 예시 수치가 필요하면 반드시 [수정 필요: 실제 수치로 교체]를 붙이세요.
- 지정된 형식과 분량을 지키세요.
- 필드 내용만 출력하세요. 제목·설명·안내문을 붙이지 마세요.
- 한국어로만 작성하세요.`,
    messages: [{
      role: 'user',
      content: `다음 필드의 초안을 작성해 주세요.

필드: ${meta.label}
형식: ${meta.format}

[신청자 현재 입력값]
${ctx}

"${meta.label}" 필드 내용만 작성하세요.`
    }]
  });

  const suggestion = message.content[0]?.text?.trim() || '';
  res.status(200).json({ suggestion });
};
