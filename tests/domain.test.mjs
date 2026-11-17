import {test} from 'node:test'
import assert from 'node:assert/strict'
import {anonymize,chunks,demo,demoReport,drafts,evidence,focusDraft,focuses,math,normalizeItem,parseTurns,sample,sources} from '../src/domain.ts'
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
test('追加観点と判定不能をデモ結果へ反映する',()=>{
  const report=demoReport(parseTurns(sample),focusDraft([focuses[1],focuses[10]]))
  assert.equal(report.teaching[0].grade,'B')
  assert.equal(report.teaching[1].grade,'判定不能')
  assert.equal(report.learning[2].grade,'判定不能')
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
