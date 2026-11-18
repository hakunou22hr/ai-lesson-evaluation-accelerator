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

test('確認待ちと根拠不足を区別し、次の応答を原文付きで関連づける',async()=>{
  const {assessmentStatus}=await import('../src/domain.ts')
  const {summarizeDialogue,dialogueObservation,relevantScene}=await import('../src/dialogue.ts')
  const lines='[00:01] 教師：どうなりますか？\n[00:05] 生徒A：電流が増えます。\n[00:08] 教師：どの測定値を根拠にしましたか？\n[00:12] 生徒A：電圧が倍で電流も倍だったからです。'
  const turns=parseTurns(lines)
  const report=localReport(demo,drafts(demo),[],turns)
  const scene=report.conversation.scenes[0]
  assert.equal(scene.sameLearner,true)
  assert.equal(scene.followUpResponse.time,'00:12')
  assert.equal(scene.followUpResponse.quote,turns[3].text)
  assert.match(dialogueObservation(scene),/同じ話者ラベル/)
  assert.equal(relevantScene(report.conversation.scenes,[scene.followUpResponse]),scene)
  assert.equal(assessmentStatus(report.learning[0]),'確認待ち')
  assert.equal(assessmentStatus(report.learning[2]),'根拠不足')
  const other=summarizeDialogue(parseTurns(lines.replace('生徒A：電圧','生徒B：電圧'))).scenes[0]
  assert.equal(other.sameLearner,false)
  const noName=summarizeDialogue(parseTurns(lines.replaceAll('生徒A','生徒'))).scenes[0]
  assert.equal(noName.sameLearner,false)
})

test('ChatGPTの評価案を原文・時刻・観点と照合する',async()=>{
  const {chatRequest,readChatResult,chatFields}=await import('../src/chatgpt.ts')
  const turns=parseTurns('[00:10] 教師：どの値を比べましたか？\n[00:12] 生徒A：電圧が２倍なので電流も２倍です。')
  const rubrics=drafts(demo)
  const focus=focusDraft([focuses[0]])
  const request=chatRequest({...demo,teacher:'波田太郎'},rubrics,focus,turns)
  assert.match(request,/どの値を比べましたか/)
  assert.ok(!request.includes('波田太郎'))
  const row=(name)=>({name,grade:'判定不能',reason:'規準を確認します。',missing:'ワークシート',improvement:'どの値が根拠ですか？',evidence:[]})
  const input={version:1,learning:rubrics.map(r=>row(r.name)),teaching:focus.map(f=>row(f.name)),...Object.fromEntries(chatFields.map(key=>[key,'所見']))}
  Object.assign(input.learning[0],{grade:'B',evidence:[{id:1,time:'00:10',quote:'どの値を比べましたか？'},{id:2,time:'00:12',quote:'電流も２倍です。'}]})
  const encoded=JSON.stringify(input)
  const output=readChatResult(encoded,focus,turns)
  assert.equal(output.learning[0].grade,'B')
  assert.equal(output.learning[0].source,'chatgpt')
  assert.equal(output.learning[0].evidence.length,2)
  assert.deepEqual(output.improvementScenes,[])
  const scene={title:'測定後の問い返し',keep:'予想を聞く',change:'結果を見てもう一度説明する',question:'どの測定値が根拠ですか？',check:'同じ生徒の前後の発言を比べる',evidence:[{id:2,time:'00:12',quote:'電流も２倍です。'}]}
  const withScene={...input,improvementScenes:[scene]}
  assert.deepEqual(readChatResult(JSON.stringify(withScene),focus,turns).improvementScenes,[scene])
  assert.throws(()=>readChatResult(JSON.stringify({...withScene,improvementScenes:[{...scene,evidence:[{...scene.evidence[0],time:'00:13'}]}]}),focus,turns),/改善案1.*照合できません/)
  assert.throws(()=>readChatResult(JSON.stringify({...withScene,improvementScenes:[scene,scene,scene,scene]}),focus,turns),/3件以内/)

  assert.throws(()=>readChatResult(encoded.replace('00:12','00:13'),focus,turns),/照合できません/)
  assert.throws(()=>readChatResult(encoded.replace('電流も２倍です。','元にない発言'),focus,turns),/照合できません/)
  assert.deepEqual(readChatResult(encoded,[],turns).ignored,[focus[0].name])
  const extra=focusDraft([focuses[1]])[0]
  const partial=readChatResult(encoded,[extra,...focus],turns)
  assert.deepEqual(partial.missing,[extra.name])
  assert.equal(partial.teaching[0],undefined)
  assert.equal(partial.teaching[1].name,focus[0].name)
  const duplicate=JSON.parse(encoded)
  duplicate.teaching.push(duplicate.teaching[0])
  assert.throws(()=>readChatResult(JSON.stringify(duplicate),focus,turns),/重複/)
  input.learning[0].evidence.pop()
  assert.throws(()=>readChatResult(JSON.stringify(input),focus,turns),/根拠が不足/)
})

test('ヘッダーのないZoom抜粋から長い話者ラベルと発言を取り込む',async()=>{
  const {zoomTranscript,summarizeDialogue}=await import('../src/dialogue.ts')
  const extracted=zoomTranscript('146\r\n01:47:24.550 --> 01:47:29.100\r\nSpeaker 1 (remote-classroom-instructor): これ何でそう思いましたか？\r\n\r\n147\r\n01:47:29.830 --> 01:47:31.000\r\nSpeaker 3 (local-classroom-participant): ただ入れていって支えてるだけだから。')
  const turns=parseTurns(extracted)
  assert.deepEqual(turns.map(t=>t.speaker),['Speaker 1 (remote-classroom-instructor)','Speaker 3 (local-classroom-participant)'])
  assert.equal(turns[1].text,'ただ入れていって支えてるだけだから。')
  assert.equal(summarizeDialogue(turns).responses,0)
  const assigned=turns.map((t,i)=>({...t,speaker:i?'生徒1':'教師'}))
  const scene=summarizeDialogue(assigned).scenes[0]
  assert.equal(scene.seconds,5.28)
  assert.equal(scene.response.time,'01:47:29.830')
  assert.equal(zoomTranscript('通常の発言\n教師：ここを見てください。'),'通常の発言\n教師：ここを見てください。')
})

test('物理基礎の浮力では測定値を使う規準を提示する',()=>{
  const rules=drafts({...math,subject:'理科',course:'物理基礎',unit:'圧力',goal:'浮力を理解'})
  assert.match(rules[1].B,/二つの測定結果を比較/)
  assert.match(rules[1].C,/本人の説明も記録/)
})
