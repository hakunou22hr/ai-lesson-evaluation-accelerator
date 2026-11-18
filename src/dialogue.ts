import type {Evidence, Turn} from './domain.ts'

export const teacherLabel = /^(?:教師|教員|先生|teacher)$/i
export const studentLabel = /^(?:(?:児童|生徒|学生)(?:\s*(?:[A-ZＡ-Ｚ]\d*|\d+|［匿名］|[一-龯]{1,6}(?:さん|くん)?)?)|(?:student|pupil)(?:\s*[A-Z0-9]+)?)$/i
export const questionPattern = /[?？]|(?:ですか|ますか|でしょうか|だろうか|かな)[。…]?$/
const instruction = /(?:ください|下さい|しましょう|してみて|しなさい|してね|やってみ|書いて|読んで|開いて|見て|選んで|考えて|話し合って|比べて|確認して)(?:[。！!、\s]|$)|(?:ペア|グループ|班)で.{0,24}(?:話し合|確認|共有)/
export const rationalePattern = /なぜ|どうして|理由|根拠|何をもと|どの(?:データ|測定値)|どこから/
export const explanationPattern = /だから|からです|ためです|ためだ|ので|ことから|によると|が根拠/
const signals = [
  ['疑問・つまずき','clarification',/分から|わから|できない|どういう|どうやって|もう一度|教えて|[？?]/],
  ['説明・根拠','explanation',explanationPattern],
  ['見直し・言い換え','revision',/最初は|考え直|見直|言い換|と思ったけど|だと思っていた/],
  ['短い反応','acknowledgment',/^(?:はい|うん|わかった|分かりました|できました|なるほど|そうです)[。！!\s]*$/],
] as const
export type ReactionKind = typeof signals[number][1] | 'other'
export const reactionLabels:Record<ReactionKind,string> = Object.fromEntries([...signals.map(([label,key])=>[key,label]),['other','その他の発言']]) as Record<ReactionKind,string>
export type DialogueScene = {kind:'question'|'instruction'; prompt:Evidence; response?:Evidence; seconds?:number; reaction?:ReactionKind; followUp?:Evidence}
export type DialogueSummary = {questions:number;instructions:number;responses:number;timed:number;median?:number;bins:number[];signals:Record<ReactionKind,number>;scenes:DialogueScene[]}

function seconds(time:string) {
  if(!time) return undefined
  const parts=time.replace(',','.').split(':').map(Number)
  if(parts.some((part,i)=>!Number.isFinite(part)||part<0||(i>0&&part>=60))) return undefined
  return parts.reduce((total,part)=>total*60+part,0)
}
function evidence(turn:Turn):Evidence {
  return {id:turn.id,time:turn.time,quote:Array.from(turn.text).slice(0,120).join('')}
}
function reaction(text:string):ReactionKind {
  return signals.find(([, ,pattern])=>pattern.test(text))?.[1]||'other'
}
export function summarizeDialogue(turns:Turn[]):DialogueSummary {
  const scenes:DialogueScene[]=[]
  const labels:DialogueSummary['signals']={clarification:0,explanation:0,revision:0,acknowledgment:0,other:0}
  const delays:number[]=[]
  let pending:DialogueScene|undefined
  let questions=0
  let instructions=0
  let responses=0
  for(const turn of turns) {
    const speaker=turn.speaker.trim()
    if(teacherLabel.test(speaker)){
      const kind=questionPattern.test(turn.text)?'question':instruction.test(turn.text)?'instruction':undefined
      if(pending?.response&&kind==='question') pending.followUp=evidence(turn)
      pending=kind?{kind,prompt:evidence(turn)}:undefined
      if(!pending) continue
      scenes.push(pending)
      if(kind==='question') questions++
      else instructions++
    }else if(studentLabel.test(speaker)){
      if(!pending||pending.response) continue
      pending.response=evidence(turn)
      pending.reaction=reaction(turn.text)
      labels[pending.reaction]++
      responses++
      const from=seconds(pending.prompt.time), to=seconds(turn.time)
      if(from!==undefined&&to!==undefined&&to>=from){
        pending.seconds=Math.round((to-from)*1000)/1000
        delays.push(pending.seconds)
      }
    }else pending=undefined
  }
  delays.sort((a,b)=>a-b)
  const mid=Math.floor(delays.length/2)
  const median=delays.length?(delays[mid]+delays[Math.floor((delays.length-1)/2)])/2:undefined
  const bins=[0,0,0]
  for(const delay of delays) bins[delay<5?0:delay<15?1:2]++
  return {questions,instructions,responses,timed:delays.length,median,bins,signals:labels,scenes}
}

export function zoomTranscript(value:string) {
  if(!/^\s*(?:\uFEFF)?WEBVTT\b/.test(value)) return value
  const stamp=/^(\d{2,}:\d{2}(?::\d{2})?[.,]\d{3})\s+-->\s+\d{2,}:\d{2}(?::\d{2})?[.,]\d{3}(?:\s|$)/
  return value.split(/\r?\n[\t ]*\r?\n/).flatMap(block=>{
    const rows=block.split(/\r?\n/)
    if(/^(?:NOTE(?:\s|$)|STYLE\s*$|REGION\s*$)/.test(rows[0])) return []
    const index=rows.findIndex(row=>stamp.test(row.trim()))
    if(index<0) return []
    const start=stamp.exec(rows[index].trim())![1]
    const text=rows.slice(index+1).join('\n').trim().replace(/(?<=[ぁ-龯])\n(?=[ぁ-龯])/g,'').replaceAll('\n',' ').replace(/^<v(?:\.[^ >]+)*\s+([^>]+)>/,'$1：').replace(/<\/?(?:v|c|i|b|u|lang|ruby|rt)\b[^>]*>/g,'')
    return text?[`[${start}] ${text}`]:[]
  }).join('\n')
}
