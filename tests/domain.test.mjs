import {test} from 'node:test'
import assert from 'node:assert/strict'
import {anonymize,chunks,demo,drafts,evidence,focusDraft,focuses,math,normalizeItem,parseTurns,sample,sources} from '../src/domain.ts'
import {localReport} from '../src/local-analysis.ts'
import worker from '../worker/index.ts'

test('中2理科、高校数学Ⅱの規準と資料',()=>{
  assert.match(drafts(demo)[0].B,/電圧と電流/)
  assert.match(drafts(math)[1].B,/周期性/)
  assert.match(sources(demo)[0].section,/電流/)
  assert.match(sources(math)[0].section,/三角関数/)
})
test('話者、時刻、引用を原文に照合する',()=>{
  const turns=parseTurns(sample)
  assert.equal(turns[0].speaker,'教師')
  assert.equal(turns[1].speaker,'生徒A')
  assert.equal(parseTurns('話者のない発言')[0].speaker,'')
  assert.deepEqual(evidence([{id:1,quote:'架空の引用'}],turns),[])
  assert.equal(evidence([{id:1,quote:'抵抗を変えず',time:'99:99'}],turns)[0].time,'00:02:10')
  assert.equal(normalizeItem({grade:'C'},'項目',turns).grade,'判定不能')
  assert.equal(normalizeItem({grade:'A',evidence:[{id:1,quote:'抵抗を変えず'}]},'知識',turns,0).grade,'判定不能')
})
test('分割が末尾を含む全行を維持する',()=>{
  const turns=parseTurns(Array.from({length:450},(_,i)=>`生徒：記録${i}`.repeat(8)).join('\n'))
  const parts=chunks(turns,3000)
  assert.ok(parts.length>10)
  assert.deepEqual(parts.flat(),turns)
  assert.ok(parts.every(part=>part.reduce((sum,t)=>sum+JSON.stringify(t).length,0)<=3000))
})
test('端末内分析は長い独自の授業記録の末尾まで確認する',()=>{
  const turns=parseTurns([
    ...Array.from({length:950},(_,i)=>`話者未確定の発言 ${i}`),
    '[18:21] 教師：なぜ電流は電圧に比例するのですか？',
    '[18:26] 生徒A：電圧が倍になると電流も倍になったからです。',
    '教師：ほかの測定値と比べるとどうですか？',
  ].join('\n'))
  const focus=focusDraft([focuses[1],focuses[10]])
  const report=localReport(demo,drafts(demo),focus,turns)
  assert.equal(report.mode,'local')
  assert.match(report.questions,/発問候補 2件/)
  assert.match(report.dialogue,/行951.*行952.*行953/)
  assert.match(report.outcomes,/953行/)
  assert.equal(report.teaching[0].grade,'B')
  assert.deepEqual(report.teaching[0].evidence.map(e=>e.time),['18:21','18:26'])
  assert.equal(report.teaching[1].grade,'判定不能')
  assert.equal(report.learning[0].evidence[0].id,952)
  assert.ok(report.learning.every(item=>item.grade==='判定不能'))
  for(const entry of [...report.teaching,...report.learning].flatMap(item=>item.evidence)){
    assert.ok(turns[entry.id-1].text.includes(entry.quote))
  }
  const changed=localReport(demo,drafts(demo),[{...focus[0],B:'生徒同士で議論を深める。'}],turns)
  assert.equal(changed.teaching[0].grade,'判定不能')
})
test('話者不明の発言から発問・応答を推定しない',()=>{
  const report=localReport(demo,drafts(demo),focusDraft([focuses[1]]),parseTurns('なぜ電流は電圧に比例するのですか？\n電圧が倍になると電流も倍になったからです。'))
  assert.match(report.questions,/発問候補 0件/)
  assert.equal(report.teaching[0].grade,'判定不能')
  assert.ok(report.learning.every(item=>!item.evidence.length))
})
test('匿名化',()=>{
  assert.equal(anonymize('山田太郎さん a@example.test','山田太郎'),'［匿名］さん ［匿名］')
})
test('Worker は管理者設定、利用コード、利用上限を強制する',async()=>{
  const env={APP_ORIGIN:'https://class.example',AI_ENABLED:'true',ACCESS_CODE:'test-code',OPENAI_API_KEY:'mock',SCHOOL_LIMIT:{limit:()=>({success:false})}}
  const call=(key='test-code',overrides={})=>worker.fetch(new Request('https://worker.example/evaluate',{method:'POST',headers:{Origin:env.APP_ORIGIN,Authorization:'Bearer '+key},body:'{}'}),{...env,...overrides})
  assert.equal((await call('test-code',{AI_ENABLED:'false'})).status,403)
  assert.equal((await call('wrong')).status,401)
  assert.equal((await call()).status,429)
  const original=globalThis.fetch
  globalThis.fetch=async()=>new Response(null,{status:503})
  try{
    const request=new Request('https://worker.example/evaluate',{method:'POST',headers:{Origin:env.APP_ORIGIN,Authorization:'Bearer test-code'},body:JSON.stringify({op:'extract',data:{}})})
    assert.equal((await worker.fetch(request,{...env,SCHOOL_LIMIT:{limit:()=>({success:true})}})).status,502)
  }finally{globalThis.fetch=original}
})

test('Zoom VTTの指示、反応の種類、時刻差を抽出する',async()=>{
  const {zoomTranscript,summarizeDialogue}=await import('../src/dialogue.ts')
  const text=zoomTranscript(`WEBVTT

1
00:00:10.100 --> 00:00:12.000
<v 教師>理由を書いて
ください。</v>

2
00:00:14.500 --> 00:00:15.300
生徒A: どう書けばいいですか？

3
00:00:17.000 --> 00:00:19.000
教師: なぜ同じだと思いましたか？

4
00:00:25.000 --> 00:00:28.000
生徒A: 電圧を倍にすると電流も倍になったからです。
`)
  const result=summarizeDialogue(parseTurns(text))
  assert.equal(result.instructions,1)
  assert.equal(result.questions,1)
  assert.equal(result.responses,2)
  assert.deepEqual(result.bins,[1,1,0])
  assert.equal(result.median,6.2)
  assert.equal(result.scenes[0].reaction,'clarification')
  assert.equal(result.scenes[1].reaction,'explanation')
  assert.equal(result.scenes[0].followUp.time,'00:00:17.000')
})
test('話者不明を挟んだ場合や逆順の時刻を計測対象にしない',async()=>{
  const {summarizeDialogue}=await import('../src/dialogue.ts')
  const result=summarizeDialogue(parseTurns('[00:10] 教師：考えてください。\n話者不明の発言\n[00:15] 生徒：はい。\n[00:20] 教師：なぜですか？\n[00:19] 生徒：理由は電圧です。'))
  assert.equal(result.responses,1)
  assert.equal(result.timed,0)
  assert.equal(result.median,undefined)
})
