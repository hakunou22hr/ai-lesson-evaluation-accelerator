import {ReadMore} from './ReadMore'
import {useState} from 'react'
import {assessmentStatus,sections,type Focus,type Lesson,type Report,type Rubric,type Turn} from './domain'
import {chatFields,chatRequest,readChatResult,type ChatResult} from './chatgpt'

type Props={lesson:Lesson;rubrics:Rubric[];focus:Focus[];turns:Turn[];baseline:Report;current:Report;apply:(report:Report)=>void}

export function ChatComparison({lesson,rubrics,focus,turns,baseline,current,apply}:Props) {
  const [request,setRequest]=useState('')
  const [raw,setRaw]=useState('')
  const [candidate,setCandidate]=useState<ChatResult>()
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')
  const copy=async()=>{
    const payload=chatRequest(lesson,rubrics,focus,turns)
    setRequest(payload);setError('');setMessage('')
    try{await navigator.clipboard.writeText(payload);setMessage('分析依頼をコピーしました。内容を確認し、ChatGPTに貼り付けてください。')}
    catch{setMessage('下の分析依頼文を選択してコピーしてください。')}
  }
  const read=()=>{
    setError('');setMessage('')
    try{setCandidate(readChatResult(raw,focus,turns));setMessage('引用と時刻を照合しました。所見と発問例は比較欄で確認し、採用する項目を選んでください。')}
    catch(e){setCandidate(undefined);setError(e instanceof Error?e.message:'結果を取り込めませんでした。')}
  }
  return <section className="result chat-compare">
    <h3>ChatGPTの評価案と比較</h3>
    <p>この画面で分析依頼をコピーし、ChatGPTに貼り付けます。返されたJSONを下に貼り戻してください。</p>
    <p className="muted">依頼文には確定した評価規準と文字起こしが含まれます。引用を照合できるよう、氏名などは文字起こし画面で匿名化してからコピーしてください。ChatGPTに貼る前に、所属先のルールに沿って送信内容を確認してください。</p>
    <button type="button" className="secondary" onClick={copy}>ChatGPTへの分析依頼をコピー</button>
    {request&&<label className="field chat-input">分析依頼文<textarea value={request} readOnly onFocus={e=>e.target.select()}/></label>}
    <label className="field chat-input">ChatGPTの分析結果（JSON）<textarea value={raw} onChange={e=>{setRaw(e.target.value);setCandidate(undefined);setMessage('');setError('')}}/></label>
    <button type="button" className="secondary" disabled={!raw.trim()} onClick={read}>結果を照合して比較</button>
    {message&&<p role="status">{message}</p>}
    {error&&<p className="alert error" role="alert">{error}</p>}
    {candidate&&<>
      {(['learning','teaching'] as const).flatMap(group=>candidate[group].map((item,index)=>{
        const local=baseline[group][index]
        const adopted=current[group][index]?.source==='chatgpt'
        return <article className="exchange" key={group+index}>
          <h4>{item.name}</h4>
          <div className="chat-columns">
            <div><b>端末内分析 · {assessmentStatus(local)}</b><ReadMore text={local.reason}/><ReadMore text={local.improvement}/>{local.evidence.map((entry,i)=><blockquote key={i}>行{entry.id} {entry.time}「{entry.quote}」</blockquote>)}</div>
            <div><b>ChatGPTの評価案 · {assessmentStatus(item)}</b><ReadMore text={item.reason}/>{item.missing&&<ReadMore text={`確認したい資料　${item.missing}`}/>}<ReadMore text={`次の問い返し　${item.improvement}`}/>
              {item.evidence.map((entry,i)=><blockquote key={i}>行{entry.id} {entry.time}「{entry.quote}」</blockquote>)}</div>
          </div>
          <div className="actions">
            <button type="button" className="secondary" onClick={()=>apply({...current,[group]:current[group].map((entry,i)=>i===index?item:entry)})}>{adopted?'この観点の評価案を再適用':'この観点の評価案を採用'}</button>
            {adopted&&<button type="button" className="secondary" onClick={()=>apply({...current,[group]:current[group].map((entry,i)=>i===index?local:entry)})}>端末内の評価に戻す</button>}
          </div>
        </article>
      }))}
      <details><summary>授業全体の所見・改善案を比較</summary>
        {chatFields.map(field=><div className="exchange" key={field}><h4>{sections[field]}</h4><div className="chat-columns"><div><b>端末内分析</b><ReadMore text={baseline[field]}/></div><div><b>ChatGPTの評価案</b><ReadMore text={candidate[field]}/></div></div></div>)}
        <button type="button" className="secondary" onClick={()=>{const source=current.chatNotes?baseline:candidate;apply({...current,...Object.fromEntries(chatFields.map(field=>[field,source[field]])),chatNotes:!current.chatNotes})}}>{current.chatNotes?'端末内の全体所見に戻す':'全体所見を採用'}</button>
      </details>
    </>}
  </section>
}
