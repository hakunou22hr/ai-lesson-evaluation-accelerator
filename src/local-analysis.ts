import {focusDraft, focuses, perspectives, type Evidence, type Focus, type Item, type Lesson, type Report, type Rubric, type Turn} from './domain.ts'

import {dialogueObservation,relevantScene,explanationPattern as responseReason,rationalePattern as rationale,studentLabel as student,summarizeDialogue} from './dialogue.ts'
const comparison = /比べ|比較|共通点|相違点|違い|変化/
const reflection = /振り返|見直|次は|最初は|やり直|考え直/
const excluded = new Set('単元 授業 本時 目標 学習 必要 自分 用語 手順 課題 対応 知識 技能 判断 表現 記録 方法 支援 生徒 児童 教師 状況 確認 成果 具体 条件 場面 内容 説明 理由 使用 活用 できる でき する させる 使える 用いる 用い 振り返る'.split(' '))
const segmenter = typeof Intl.Segmenter==='function' ? new Intl.Segmenter('ja',{granularity:'word'}) : undefined

function terms(text:string) {
  const normalized=text.normalize('NFKC').toLowerCase()
  const words=segmenter ? Array.from(segmenter.segment(normalized),part=>part.isWordLike?part.segment:'') : normalized.match(/[一-龯々]{2,}|[ァ-ヶー]{2,}|[a-z]{2,}/g)||[]
  return [...new Set(words.filter(w=>w.length>=2&&/[一-龯々ァ-ヶa-z]/.test(w)&&!excluded.has(w)))].slice(0,60)
}
function quote(turn:Turn):Evidence {
  return {id:turn.id,time:turn.time,quote:Array.from(turn.text).slice(0,120).join('')}
}
function reference(turn:Turn) {
  return `行${turn.id}${turn.time?'（'+turn.time+'）':''}`
}
function candidates(turns:Turn[],words:string[],marker?:RegExp) {
  return turns.map(turn=>{
    const normalized=turn.text.normalize('NFKC').toLowerCase()
    const matches=words.filter(word=>normalized.includes(word)).length
    return {turn,score:matches?matches+(marker?.test(normalized)?2:0):0}
  }).filter(item=>item.score>0).sort((a,b)=>b.score-a.score||a.turn.id-b.turn.id).slice(0,3).map(item=>quote(item.turn))
}
function unknown(name:string,reason:string,improvement:string,evidence:Evidence[]=[]):Item {
  return {name,grade:'判定不能',reason,improvement,evidence}
}
export function localReport(lesson:Lesson,rubrics:Rubric[],focus:Focus[],turns:Turn[]):Report {
  const learners=turns.filter(t=>student.test(t.speaker.trim()))
  const conversation=summarizeDialogue(turns)
  const byId=new Map(turns.map(turn=>[turn.id,turn]))
  const questions=conversation.scenes.filter(scene=>scene.kind==='question').map(scene=>byId.get(scene.prompt.id)!)
  const exchanges=conversation.scenes.flatMap(scene=>scene.kind==='question'&&scene.response?[{
    question:byId.get(scene.prompt.id)!,answer:byId.get(scene.response.id)!,
    followUp:scene.followUp?byId.get(scene.followUp.id):undefined,
  }]:[])
  const counts={reason:0,comparison:0,other:0}
  const goalTerms=terms(lesson.goal)
  let goalMatches=0
  for(const turn of questions){
    if(rationale.test(turn.text)) counts.reason++
    else if(comparison.test(turn.text)) counts.comparison++
    else counts.other++
    if(goalTerms.some(term=>turn.text.normalize('NFKC').toLowerCase().includes(term))) goalMatches++
  }
  const matched=exchanges.find(exchange=>rationale.test(exchange.question.text)&&responseReason.test(exchange.answer.text))
  const firstExchange=exchanges.find(exchange=>exchange.followUp)||exchanges[0]
  const learning=perspectives.map((name,index)=>{
    const rubric=rubrics.find(row=>row.name===name)
    const relevant=index===2 ? learners.filter(t=>reflection.test(t.text)).slice(0,3).map(quote) :
      candidates(learners,terms([rubric?.lesson,rubric?.B,lesson.goal,lesson.unit].filter(Boolean).join('。')),index===1?responseReason:undefined)
    const reason=index===2?'継続的な取組や学習方法の調整は、複数の授業での記録が必要です。':
      relevant.length?'規準や目標の語句を含む発言候補があります。発言の正確さと規準を満たすかは、成果物や活動記録と照合してください。':'評価規準に照合できる児童・生徒の発言候補を確認できませんでした。'
    const scene=relevantScene(conversation.scenes,relevant)
    return unknown(name,reason+(scene?' '+dialogueObservation(scene):''),rubric?.support||'ワークシートや活動記録を確認してください。',relevant)
  })
  const teaching=focus.map(row=>{
    if(matched&&row.name===focuses[1]&&row.B===focusDraft([row.name])[0].B) return {
      name:row.name,grade:'B' as const,
      reason:`${reference(matched.question)}の根拠を尋ねる発問の直後に、${reference(matched.answer)}で理由を示す表現がありました。この場面に限定した参考判定です。`,
      improvement:'どの資料や測定値がその理由を支えるかも尋ねる。',
      evidence:[quote(matched.question),quote(matched.answer)],
    }
    const related=row.name===focuses[1]?questions.slice(0,3).map(quote):
      row.name===focuses[3]&&firstExchange?.followUp?[quote(firstExchange.answer),quote(firstExchange.followUp)]:
      candidates(turns,terms(row.name+'。'+row.B))
    return unknown(row.name,related.length?'関連する発言候補を抽出しました。授業記録と設定した規準を照合してください。':'この観点を判定できる発言候補が見つかりませんでした。','該当場面の前後の発言や活動記録を確認してください。',related)
  })
  return {mode:'local',learning,teaching,conversation,
    questions:`教師と明示された発問候補 ${questions.length}件。理由・根拠 ${counts.reason}件、比較 ${counts.comparison}件、その他 ${counts.other}件。目標の語句を含む候補 ${goalMatches}件。`+(questions[0]?` 最初の候補は${reference(questions[0])}です。`:''),
    dialogue:`発問・指示 ${conversation.questions+conversation.instructions}件、児童・生徒の応答候補 ${conversation.responses}件。`+(firstExchange?` 例：${reference(firstExchange.question)}→${reference(firstExchange.answer)}${firstExchange.followUp?'→'+reference(firstExchange.followUp)+'（教師の次の発問）':''}。`:' 話者ラベルと記録の範囲を確認してください。'),
    outcomes:`発言 ${turns.length}行を確認しました。児童・生徒と明示された発言 ${learners.length}行。各観点の候補から実際に確認できた成果を記入してください。`,
    improvements:conversation.signals.clarification?'疑問やつまずきを示す反応候補があります。直前の指示・問いのうち、どの言葉や手順を補うと進めそうかを確認してください。':matched?'根拠を問う発問と応答の候補がありました。続く発言で、どの根拠が結論を支えるかを確認してください。':'理由を示す応答の候補は抽出できませんでした。活動や成果物も見て、根拠を述べる機会があったか確認してください。',
    examples:'「どの観察や資料から、そう考えましたか？」「別の考えと比べて、共通点は何ですか？」',
    next:conversation.signals.clarification?'指示を一手順ずつ伝え、児童・生徒に最初にすることを自分の言葉で言い直してもらう。':'授業の最後に結論・根拠・見直した点を一つずつ書く時間を設け、次時の活動につなげる。',
  }
}
