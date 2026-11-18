import {reactionLabels,summarizeDialogue,zoomTranscript} from './dialogue'
import {useState,type ReactNode} from 'react'
import {createRoot} from 'react-dom/client'
import {Activity,ArrowLeft,ArrowRight,BookOpen,Check,ChevronRight,ClipboardList,Download,FileText,FlaskConical,History,Settings,ShieldCheck,Sparkles,Upload} from 'lucide-react'
import {anonymize,chunks,courses,demo,drafts,empty,evidence,fields,focusDraft,focuses,math,normalizeItem,parseTurns,perspectives,reportModes,sample,schools,sections,sources,type Focus,type Grade,type Item,type Lesson,type Report,type Rubric,type Turn} from './domain'
import {ai,endpoint} from './ai'
import {localReport} from './local-analysis'
import {readFile} from './files'
import {createPdf,filename} from './pdf'
import './style.css'

const steps=['授業情報','評価規準','追加観点','文字起こし','授業分析','PDF出力']
const titles=['授業情報を入力','評価規準を確認','重点的に見たい観点を追加','授業の文字起こしを読み込む','授業分析と評価','評価レポートを出力']
const descriptions=['授業の基本情報と本時の目標を入力してください。入力内容をもとに評価規準の案を作成します。','3観点の規準案を授業に合わせて修正し、承認してください。','授業者の指導方法について、今回の振り返りで重視する項目を選べます。','授業の発言記録を読み込み、時刻・話者・匿名化の内容を確認します。','記録と確定した評価規準を照合します。結果は確認・修正できます。','評価結果と改善提案をA4縦・2ページのPDFにまとめます。']
const grades:Grade[]=['A','B','C','判定不能']
const rubricKeys=Object.keys(fields) as (keyof typeof fields)[]
type Saved={id:string; date:string; lesson:Lesson;rubrics:Rubric[];focus:Focus[];original:Report;report:Report}
function load<T,>(key:string,fallback:T):T {try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
const setLocal=(key:string,value:unknown)=>localStorage.setItem(key,JSON.stringify(value))
const textError=(error:unknown)=>error instanceof Error?error.message:'処理中にエラーが発生しました。'
const filled=<T extends object>(draft:T,candidate:unknown,keys:readonly (keyof T)[]):T=>{
  if(!candidate||typeof candidate!=='object') throw Error('AIの回答形式を確認できませんでした。再試行してください。')
  const result={...draft}
  for(const key of keys){
    const value=(candidate as T)[key]
    if(typeof value!=='string'||!value.trim()) throw Error('AIの回答に不足があります。再試行してください。')
    result[key]=value
  }
  return result
}
function Field({name,children,required=false,wide=false}:{name:string;children:ReactNode;required?:boolean;wide?:boolean}) {
  return <label className={wide?'field wide':'field'}><span>{name} {required&&<small className="required">必須</small>}</span>{children}</label>
}
function App(){
  const [lesson,setLesson]=useState<Lesson>(empty)
  const [step,setStep]=useState(0)
  const [rubrics,setRubrics]=useState<Rubric[]>([])
  const [selected,setSelected]=useState<string[]>([])
  const [custom,setCustom]=useState('')
  const [focus,setFocus]=useState<Focus[]>([])
  const [approved,setApproved]=useState(false)
  const [rubricApproved,setRubricApproved]=useState(false)
  const [text,setText]=useState('')
  const [turns,setTurns]=useState<Turn[]>([])
  const [speakerToMap,setSpeakerToMap]=useState('')
  const [names,setNames]=useState('')
  const [checked,setChecked]=useState(false)
  const [report,setReport]=useState<Report|null>(null)
  const [original,setOriginal]=useState<Report|null>(null)
  const [records,setRecords]=useState(()=>load<Saved[]>('lesson-history-v1',[]))
  const [modal,setModal]=useState<'settings'|'history'|null>(null)
  const [mode,setMode]=useState<'local'|'ai'>('local')
  const [key,setKey]=useState('')
  const [consent,setConsent]=useState(false)
  const [busy,setBusy]=useState('')
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [recordId,setRecordId]=useState('')
  const [editing,setEditing]=useState(false)
  const curriculum=sources(lesson)
  const valid=!!(lesson.unit.trim()&&lesson.goal.trim()&&lesson.subject.trim()&&Number(lesson.minutes)>0&&Number(lesson.minutes)<=600)
  const namesSelected=[...selected,...custom.split('\n').map(s=>s.trim()).filter(Boolean).slice(0,2)]
  const maxStep=report?5:approved?(turns.length?4:3):rubricApproved?2:rubrics.length?1:0
  const move=(next:number)=>{setStep(next);setError('');setNotice('');window.scrollTo({top:0,behavior:'smooth'})}
  const run=async(label:string,task:()=>Promise<void>|void)=>{
    setBusy(label);setError('');setNotice('')
    try{await task()}catch(e){setError(textError(e))}finally{setBusy('')}
  }
  const invalidate=()=>{setApproved(false);setReport(null);setOriginal(null)}
  const reset=(next:Lesson,transcript='')=>{
    setLesson(next);setRubrics([]);setRubricApproved(false);setFocus([]);setCustom('');setSelected([]);setText(transcript);setTurns(parseTurns(transcript));setNames('');setChecked(false);setEditing(false);setRecordId('');invalidate();move(0)
  }
  const change=(patch:Partial<Lesson>)=>{setLesson(prev=>({...prev,...patch}));setRubrics([]);setRubricApproved(false);invalidate()}
  const changeTranscript=(value:string)=>{setSpeakerToMap('');const normalized=zoomTranscript(value);setText(normalized);setTurns(parseTurns(normalized));setChecked(false);setReport(null);setOriginal(null)}
  const normalizeFocus=()=>focusDraft([...new Set(namesSelected)])
  const generate=()=>run('評価規準を生成中…',async()=>{
    if(!valid) throw Error('単元名・本時の目標・授業時間を確認してください。')
    const draft=drafts(lesson)
    if(mode==='ai') {
      const response=await ai<{items:unknown[]}>('rubric',{lesson:{...lesson,teacher:'',date:''},sources:curriculum,draft},key)
      setRubrics(draft.map((item,i)=>filled(item,response.items?.[i],rubricKeys)))
    } else setRubrics(draft)
    setRubricApproved(false);invalidate();move(1)
  })
  const generateFocus=()=>run('追加観点の規準を生成中…',async()=>{
    const draft=normalizeFocus()
    if(mode==='ai'&&draft.length){
      const result=await ai<{items:unknown[]}>('focus',{goal:lesson.goal,draft},key)
      setFocus(draft.map((item,i)=>filled(item,result.items?.[i],['A','B','C'])))
    }else setFocus(draft)
    invalidate()
  })
  const importFile=(file?:File)=>{if(file) void run('ファイルを読み込み中…',async()=>{
    const loaded=await readFile(file)
    if(!loaded.trim()) throw Error('テキストを抽出できませんでした。画像PDFの場合は文字起こしを貼り付けてください。')
    changeTranscript(loaded)
  })}
  const analyze=()=>run('授業分析を準備中…',async()=>{
    if(!approved||!turns.length) throw Error('評価基準の確定と文字起こしの入力が必要です。')
    if(turns.some(t=>t.text.length>7500)) throw Error('1行が長すぎます。意味のまとまりで改行してください（1行7500文字以内）。')
    if(text.length>100000) throw Error('文字起こしは10万文字以内にしてください。')
    const learning=perspectives
    let result:Report
    if(mode==='local') result=localReport(lesson,rubrics,focus,turns)
    else {
      if(!checked||!consent) throw Error('送信前に匿名化と外部送信条件を確認してください。')
      const batches=chunks(turns)
      const context={goal:lesson.goal,rubrics,focus}
      const findings=[]
      for(const [index,part] of batches.entries()){
        setBusy(`文字起こしを分析中（${index+1}/${batches.length}区間）…`)
        const chunk=await ai<{summary:string;evidence:unknown}>('extract',{...context,turns:part},key)
        findings.push({range:[part[0].id,part.at(-1)!.id],summary:typeof chunk.summary==='string'?chunk.summary.slice(0,600):'',evidence:evidence(chunk.evidence,part,12)})
      }
      setBusy('全区間の結果を統合中…')
      const draft=await ai<Report>('integrate',{...context,findings},key)
      const allowed=findings.flatMap(f=>f.evidence)
      const verify=(item:Item|undefined)=>item&&({...item,evidence:Array.isArray(item.evidence)?item.evidence.filter(e=>e&&typeof e.quote==='string'&&allowed.some(candidate=>candidate.id===e.id&&candidate.quote.includes(e.quote))):[],reason:typeof item.reason==='string'?item.reason:'',improvement:typeof item.improvement==='string'?item.improvement:''})
      result={...draft,mode:'ai',learning:learning.map((name,i)=>normalizeItem(verify(draft.learning?.[i]),name,turns,i)),teaching:focus.map(({name},i)=>normalizeItem(verify(draft.teaching?.[i]),name,turns))}
      for(const field of Object.keys(sections) as (keyof typeof sections)[]) if(typeof result[field]!=='string') result[field]='確認できる所見がありません。'
    }
    const withDialogue={...result,conversation:result.conversation??summarizeDialogue(turns)}
    setReport(withDialogue);setOriginal(withDialogue)
  })
  const editItem=(type:'learning'|'teaching',index:number,patch:Partial<Item>)=>setReport(prev=>prev&&({...prev,[type]:prev[type].map((item,i)=>i===index?{...item,...patch}:item)}))
  const save=()=>run('履歴を保存中…',()=>{
    if(!report) return
    const id=recordId||crypto.randomUUID()
    const forHistory=(value:Report):Report=>value.conversation?{...value,conversation:{...value.conversation,scenes:value.conversation.scenes.filter(scene=>scene.response).slice(0,5)}}:value
    const entry:Saved={id,date:new Date().toISOString(),lesson,rubrics,focus,original:forHistory(original||report),report:forHistory(report)}
    const next=[entry,...records.filter(r=>r.id!==id)].slice(0,30)
    setLocal('lesson-history-v1',next);setRecords(next);setRecordId(id);setNotice('評価履歴をこのブラウザーに保存しました。')
  })
  const restore=(item:Saved)=>{
    setLesson(item.lesson);setRubrics(item.rubrics);setFocus(item.focus);setSelected(item.focus.map(f=>f.name).filter(n=>focuses.includes(n)));setCustom(item.focus.map(f=>f.name).filter(n=>!focuses.includes(n)).join('\n'));setApproved(true);setRubricApproved(true);setText('');setTurns([]);setNames('');setChecked(false);setEditing(false);setOriginal(item.original);setReport(item.report);setRecordId(item.id);setModal(null);move(5)
  }
  const download=()=>run('PDFを作成・検査中…',async()=>{
    if(!report) return
    const pdf=await createPdf(lesson,report,curriculum)
    pdf.save(filename(lesson));setNotice('A4縦・2ページのPDFを作成しました。')
  })
  const preset=(kind:'science'|'math')=>{setMode('local');reset(kind==='math'?math:demo,kind==='science'?sample:'');setNotice(kind==='science'?'架空の理科授業と文字起こしを読み込みました。':'数学Ⅱのサンプル授業を読み込みました。')}
  return <>
    <header className="header"><div className="wrap header-inner">
      <a className="brand" href="./"><span className="brand-icon"><Activity size={23}/></span><span>AI授業評価 <b>Accelerator</b><small>授業研究・授業改善支援システム</small></span></a>
      <div className="tools"><button className="ghost" onClick={()=>setModal('history')} disabled={!!busy}><History size={17}/> <span>履歴</span></button><button className="ghost" onClick={()=>setModal('settings')} disabled={!!busy}><Settings size={17}/> <span>設定</span></button></div>
    </div></header>
    <section className="hero"><div className="wrap hero-inner"><div><p className="eyebrow"><span/> 授業研究ワークスペース</p><h1>授業評価ワークスペース</h1><p>授業の目標と記録から、次の授業につながる振り返りを。</p></div><span className="mode"><FlaskConical size={16}/> {mode==='local'?'端末内分析・APIキー不要':'本番AIモード'}</span></div></section>
    <main className="wrap">
      <nav className="steps" aria-label="進行状況">{steps.map((label,index)=><button key={label} type="button" disabled={index>maxStep||!!busy} onClick={()=>move(index)} aria-current={index===step?'step':undefined} className={index===step?'active':index<step?'complete':''}><span>{index<step?<Check size={14}/>:index+1}</span>{label}{index<5&&<ChevronRight className="step-arrow" size={15}/>}</button>)}</nav>
      <div className="layout">
        <section className="panel workspace">
          <div className="step-title"><span className="step-icon">{[<BookOpen/>,<ClipboardList/>,<Sparkles/>,<Upload/>,<Activity/>,<FileText/>][step]}</span><div><div className="kicker">STEP 0{step+1} / 06</div><h2>{titles[step]}</h2></div></div>
          <p className="description">{descriptions[step]}</p>
          {error&&<p className="alert error" role="alert">{error}</p>}
          {notice&&<p className="alert" role="status">{notice}</p>}
          {busy&&<p className="alert progress" role="status">{busy}</p>}
          <fieldset disabled={!!busy} className="page-content">
          {step===0&&<>
            <div className="form-grid">
            <Field name="校種" required><select value={lesson.school} onChange={e=>{const school=e.target.value as Lesson['school'];change({school,grade:'1',subject:schools[school][0],course:''})}}>{Object.keys(schools).map(s=><option key={s}>{s}</option>)}</select></Field>
            <Field name="学年" required><select value={lesson.grade} onChange={e=>change({grade:e.target.value})}>{Array.from({length:lesson.school==='小学校'?6:3},(_,i)=><option key={i} value={i+1}>{i+1}年</option>)}</select></Field>
            <Field name="教科" required><select value={schools[lesson.school].includes(lesson.subject)?lesson.subject:'その他（入力）'} onChange={e=>change({subject:e.target.value==='その他（入力）'?'':e.target.value,course:''})}>{schools[lesson.school].map(s=><option key={s}>{s}</option>)}</select></Field>
            {lesson.school==='高等学校'&&!schools[lesson.school].includes(lesson.subject)&&<Field name="教科名" required><input value={lesson.subject} onChange={e=>change({subject:e.target.value})}/></Field>}
            {lesson.school==='高等学校'&&<Field name="科目"><input list="courses" value={lesson.course} maxLength={60} onChange={e=>change({course:e.target.value})}/><datalist id="courses">{courses[lesson.subject]?.map(s=><option key={s}>{s}</option>)}</datalist></Field>}
            <Field name="授業時間" required><input type="number" min="1" max="600" list="minutes" value={lesson.minutes} onChange={e=>change({minutes:e.target.value})}/><datalist id="minutes"><option value="45"/><option value="50"/></datalist></Field>
            <Field name="単元名" required wide><input maxLength={100} placeholder="例：電流とその利用" value={lesson.unit} onChange={e=>change({unit:e.target.value})}/></Field>
            <Field name="本時の目標" required wide><textarea maxLength={500} placeholder="授業の終わりに、児童・生徒が何をできるようになるかを入力" value={lesson.goal} onChange={e=>change({goal:e.target.value})}/></Field>
            <Field name="授業日（任意）"><input type="date" value={lesson.date} onChange={e=>change({date:e.target.value})}/></Field>
            <Field name="授業者名（任意）"><input maxLength={60} placeholder="匿名のまま利用できます" value={lesson.teacher} onChange={e=>change({teacher:e.target.value})}/></Field>
            </div>
            <div className="actions"><button className="secondary" onClick={()=>void run('設定を保存中…',()=>{setLocal('last-lesson-v1',{...lesson,teacher:''});setNotice('授業設定を保存しました。')})}>授業設定を保存</button><button className="primary" onClick={generate}><Sparkles size={17}/> 評価規準を生成 <ArrowRight size={17}/></button></div>
          </>}
          {step===1&&<>
            <details className="source" open><summary>参照資料と確認範囲</summary>{curriculum.map(s=><p key={s.name}><a href={s.url} target="_blank" rel="noreferrer">{s.name}（{s.year}年）</a><br/>{s.section}。{s.note}</p>)}</details>
            <p className="muted">以下は本時に合わせた規準案です。資料欄は参照箇所と要約を示します。</p>
            <table className="matrix"><thead><tr><th>内容</th>{rubrics.map(r=><th key={r.name}>{r.name}</th>)}</tr></thead><tbody>{rubricKeys.map(field=><tr key={field}><th scope="row">{fields[field]}</th>{rubrics.map((r,i)=><td key={r.name} data-label={r.name}><textarea aria-label={r.name+' '+fields[field]} maxLength={600} value={r[field]} onChange={e=>{setRubrics(prev=>prev.map((v,j)=>j===i?{...v,[field]:e.target.value}:v));setRubricApproved(false);invalidate()}}/></td>)}</tr>)}</tbody></table>
            <div className="actions"><button className="secondary" onClick={()=>move(0)}><ArrowLeft size={16}/> 戻る</button><button className="primary" onClick={()=>rubrics.every(r=>rubricKeys.every(f=>r[f].trim()))?(setRubricApproved(true),move(2)):setError('評価規準の空欄を入力してください。')}>規準を承認して進む <ArrowRight size={16}/></button></div>
          </>}
          {step===2&&<>
            <div className="choices">{focuses.map(name=><label key={name}><input type="checkbox" checked={selected.includes(name)} onChange={e=>{setSelected(e.target.checked?[...selected,name]:selected.filter(s=>s!==name));setFocus([]);invalidate()}}/>{name}</label>)}</div>
            <Field name="自由記述（任意・最大2項目、1行につき1項目）"><textarea maxLength={300} value={custom} onChange={e=>{setCustom(e.target.value);setFocus([]);invalidate()}} placeholder="例：生徒の誤答をどのように授業に生かしたか"/></Field>
            {namesSelected.length>0&&<button className="secondary" onClick={generateFocus}><Sparkles size={16}/> 追加観点の規準を生成</button>}
            {focus.map((f,i)=><details className="source" key={f.name} open={i===0}><summary>{f.name}</summary>{(['A','B','C'] as const).map(g=><Field name={g} key={g}><textarea value={f[g]} maxLength={350} onChange={e=>{setFocus(prev=>prev.map((v,j)=>j===i?{...v,[g]:e.target.value}:v));invalidate()}}/></Field>)}</details>)}
            <div className="actions"><button className="secondary" onClick={()=>move(1)}><ArrowLeft size={16}/> 戻る</button><button className="primary" onClick={()=>{if(custom.split('\n').filter(s=>s.trim()).length>2){setError('自由記述は2項目までです。');return}if(namesSelected.length&&(!focus.length||focus.some(f=>!f.A.trim()||!f.B.trim()||!f.C.trim()))){setError('追加観点の規準を生成し、A・B・Cを確認してください。');return}setApproved(true);move(3)}}>評価基準を確定 <ArrowRight size={16}/></button></div>
          </>}
          {step===3&&<>
            <label className="drop" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();importFile(e.dataTransfer.files[0])}}><Upload size={24}/><strong>ファイルを選択、またはドラッグ＆ドロップ</strong><span>Zoom VTT・TXT・DOCX・CSV・テキスト付きPDF / 最大15 MB</span><input type="file" accept=".vtt,.txt,.docx,.csv,.pdf" onChange={e=>{importFile(e.target.files?.[0]);e.target.value=''}}/></label>
            <Field name="文字起こしテキスト"><textarea className="transcript" value={text} onChange={e=>changeTranscript(e.target.value)} placeholder="[00:02:10] 教師：授業の発言を貼り付けてください。"/></Field>
            <p className="stats">{text.length.toLocaleString()}文字 ／ {turns.length.toLocaleString()}行 ／ 時刻{turns.some(t=>t.time)?'あり':'なし'} ／ 話者ラベル{turns.some(t=>t.speaker)?'あり':'なし'}</p>
            <Field name="匿名化する名前（任意・読点または改行区切り）"><input value={names} onChange={e=>{setNames(e.target.value);setChecked(false)}} placeholder="例：山田太郎、鈴木花子"/></Field>
            <button className="secondary" onClick={()=>{const next=anonymize(text,names);const oldTurns=turns;changeTranscript(next);setTurns(parseTurns(next).map((turn,i)=>({...turn,speaker:anonymize(oldTurns[i]?.speaker||turn.speaker,names)})));setNotice(next===text?'自動検出による置換箇所はありません。本文を目視で確認してください。':'検出・指定した箇所を置換しました。本文を目視で確認してください。')}}><ShieldCheck size={16}/> 匿名化を適用</button>
            {turns.some(turn=>turn.speaker)&&<details className="source">
              <summary>Zoomの話者名をまとめて変更</summary>
              <Field name="元の話者名"><select value={speakerToMap} onChange={e=>setSpeakerToMap(e.target.value)}><option value="">選択してください</option>{[...new Set(turns.map(turn=>turn.speaker).filter(Boolean))].map(speaker=><option key={speaker}>{speaker}</option>)}</select></Field>
              <div className="choices">{['教師','生徒','話者不明'].map(role=><button type="button" className="secondary" disabled={!speakerToMap} key={role} onClick={()=>{
                const assigned=role==='生徒'?`生徒${1+Math.max(0,...turns.map(turn=>Number(/^生徒(\d+)$/.exec(turn.speaker)?.[1]||0)))}`:role==='話者不明'?'':role
                setTurns(previous=>previous.map(turn=>turn.speaker===speakerToMap?{...turn,speaker:assigned}:turn))
                setSpeakerToMap('');setChecked(false);setReport(null);setOriginal(null)
              }}>{role}に変更</button>)}</div>
            </details>}
            {!!turns.length&&<details className="source"><summary>発言者の確認・修正</summary><div className="turns">{turns.map(t=><div key={t.id}><span>行{t.id} {t.time}</span><input aria-label={'行'+t.id+'の発言者'} maxLength={60} placeholder="話者不明" value={t.speaker} onChange={e=>{setTurns(prev=>prev.map(v=>v.id===t.id?{...v,speaker:e.target.value}:v));setChecked(false);setReport(null);setOriginal(null)}}/><span>{t.text}</span></div>)}</div></details>}
            {mode==='ai'&&<label className="check"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/>本文・話者・評価規準の個人情報を除去し、送信してよいことを確認しました</label>}
            <div className="actions"><button className="secondary" onClick={()=>move(2)}><ArrowLeft size={16}/> 戻る</button><button className="primary" disabled={!turns.length||(mode==='ai'&&!checked)} onClick={()=>move(4)}>分析へ進む <ArrowRight size={16}/></button></div>
          </>}
          {step===4&&<>
            <div className="actions analysis-actions"><button className="primary" disabled={!turns.length} onClick={analyze}><Sparkles size={16}/> {mode==='ai'?'AI授業分析を開始':'端末内分析を開始'}</button>{report&&<button className="secondary" onClick={()=>setEditing(!editing)}>{editing?'編集を閉じる':'評価を修正'}</button>}</div>
            {report&&<>
              <p className="muted">{reportModes[report.mode]}結果。授業研究用の所見です。{report.mode==='local'&&' 発言候補と参考判定を確認してから、必要に応じて評価を修正してください。'}</p>
              {report.conversation&&<section className="result conversation">
                <h3>教師の働きかけと児童・生徒の反応</h3>
                <div className="conversation-totals">
                  <span><b>{report.conversation.questions}</b> 発問候補</span>
                  <span><b>{report.conversation.instructions}</b> 指示候補</span>
                  <span><b>{report.conversation.responses}</b> 応答候補</span>
                </div>
                <p>応答までの発言開始時刻の差 {report.conversation.timed}件{report.conversation.median===undefined?'（計測対象なし）':`・中央値 ${report.conversation.median.toFixed(1)}秒`}</p>
                {report.conversation.timed>0&&<div className="timing-chart" aria-label="応答までの時刻差の分布">{['5秒未満','5〜15秒未満','15秒以上'].map((label,i)=><div key={label}><span>{label}</span><meter min={0} max={report.conversation!.timed} value={report.conversation!.bins[i]}/><span>{report.conversation!.bins[i]}件</span></div>)}</div>}
                <p className="muted">発言の順序と話者ラベルから候補を抽出しています。時刻差は発言開始から次の発言開始までです。説明や疑問は理解を振り返る手がかりです。</p>
                <p>反応の手がかり　{Object.entries(report.conversation.signals).filter(([,count])=>count>0).map(([key,count])=>`${reactionLabels[key as keyof typeof reactionLabels]} ${count}件`).join(' ／ ')||'該当なし'}</p>
                <details><summary>指示・発問と反応の原文を見る</summary>
                  {report.conversation.scenes.map(scene=><article className="exchange" key={scene.prompt.id}>
                    <b>{scene.kind==='instruction'?'指示候補':'発問候補'}</b>
                    <blockquote>行{scene.prompt.id} {scene.prompt.time}「{scene.prompt.quote}」</blockquote>
                    {scene.response?<><b>児童・生徒の反応候補 · {reactionLabels[scene.reaction||'other']}{scene.seconds===undefined?'':` · ${scene.seconds}秒`}</b><blockquote>行{scene.response.id} {scene.response.time}「{scene.response.quote}」</blockquote></>:<p>対応する応答は記録から確認できませんでした。</p>}
                    {scene.followUp&&<blockquote>続く発問　行{scene.followUp.id} {scene.followUp.time}「{scene.followUp.quote}」</blockquote>}
                  </article>)}
                </details>
              </section>}
              {(['learning','teaching'] as const).map(group=><section key={group}><h3>{group==='learning'?'3観点に関連する学習状況':'授業者が指定した指導上の観点'}</h3>
                {!report[group].length&&<p>追加観点はありません。</p>}
                {report[group].map((item,i)=><article className="result" key={item.name}><h4><span className={'grade '+(grades.indexOf(item.grade)<3?item.grade:'unknown')}>{item.grade}</span>{item.name}</h4>
                {editing?<><Field name="判定"><select value={item.grade} onChange={e=>editItem(group,i,{grade:e.target.value as Grade})}>{grades.map(g=><option key={g}>{g}</option>)}</select></Field><Field name="評価理由"><textarea value={item.reason} onChange={e=>editItem(group,i,{reason:e.target.value})}/></Field><Field name="改善提案"><textarea value={item.improvement} onChange={e=>editItem(group,i,{improvement:e.target.value})}/></Field></>:<><p>{item.reason}</p><p><b>改善提案</b>　{item.improvement}</p></>}
                {item.evidence.map(e=><blockquote key={e.id+e.quote}>行{e.id} {e.time}「{e.quote}」</blockquote>)}</article>)}</section>)}
              {(Object.keys(sections) as (keyof typeof sections)[]).map(field=><article className="result" key={field}>{editing?<Field name={sections[field]}><textarea value={report[field]} onChange={e=>setReport({...report,[field]:e.target.value})}/></Field>:<><h4>{sections[field]}</h4><p>{report[field]}</p></>}</article>)}
            </>}
            <div className="actions"><button className="secondary" onClick={()=>move(3)}><ArrowLeft size={16}/> 戻る</button><button className="primary" disabled={!report} onClick={()=>move(5)}>レポートへ進む <ArrowRight size={16}/></button></div>
          </>}
          {step===5&&report&&<>
            <div className="report-preview"><FileText size={34}/><div><h3>{lesson.unit}</h3><p>{lesson.school}{lesson.grade}年・{lesson.course||lesson.subject}　／　{reportModes[report.mode]}</p><p className="muted">A4縦・2ページ</p></div></div>
            <ol className="page-list"><li>授業評価結果・各観点の判定・授業の成果</li><li>根拠発言・対話と発問・改善提案・参照資料</li></ol>
            <p className="muted">履歴はこのブラウザーに保存します。文字起こし全文は保存対象外です。評価に含まれる引用、対話例（最大5件）、授業者名は残ります。</p>
            <div className="actions"><button className="secondary" onClick={()=>move(4)}><ArrowLeft size={16}/> 評価へ戻る</button><button className="secondary" onClick={save}><History size={16}/> 履歴を保存</button><button className="primary" onClick={download}><Download size={16}/> PDFをダウンロード</button></div>
          </>}
          </fieldset>
        </section>
        <aside>
          <section className="panel side demo-side"><span className="side-icon"><FlaskConical size={20}/></span><h3>サンプルで試す</h3><p>架空の授業情報を読み込み、評価規準やPDF出力を確認できます。</p><button className="secondary" disabled={!!busy} onClick={()=>preset('science')}>中2 理科｜電流とその利用 <ChevronRight size={16}/></button><button className="secondary" disabled={!!busy} onClick={()=>preset('math')}>高校 数学Ⅱ｜三角関数 <ChevronRight size={16}/></button><button className="text-button" disabled={!!busy} onClick={()=>{const saved=load<Lesson|null>('last-lesson-v1',null);if(saved) reset(saved);else setNotice('保存済みの授業設定はありません。')}}><History size={15}/> 前回の授業設定を読み込む</button></section>
          <section className="panel side protection"><div><ShieldCheck size={20}/><h3>授業データの取り扱い</h3></div><p>端末内分析では授業データを外部に送信しません。本番AIを利用する場合は、学校の方針に従い送信前に匿名化してください。</p></section>
        </aside>
      </div>
    </main>
    <footer className="wrap footer">AI授業評価 Accelerator <span>授業の振り返りと改善のために</span></footer>
    {modal&&<div className="overlay" onClick={()=>setModal(null)}><section className="panel dialog" role="dialog" aria-modal="true" aria-label={modal==='settings'?'設定':'評価履歴'} onClick={e=>e.stopPropagation()}>
      <div className="dialog-head"><h2>{modal==='settings'?'設定':'評価履歴'}</h2><button className="secondary" autoFocus onClick={()=>setModal(null)}>閉じる</button></div>
      {modal==='settings'?<>
        <p>端末内分析はAPIキー不要です。授業記録はブラウザー内で処理されます。</p>
        <p>本番AIは学校管理のCloudflare Worker経由でOpenAI APIに送信します。APIの利用費用と利用上限があります。</p>
        <p>アプリは送信本文をサーバーに保存しません。API側の保持は通常最大30日（不正利用監視・契約等による例外あり）。APIデータは既定でモデル学習に使われません。削除の問い合わせは学校管理者に連絡してください。 <a target="_blank" rel="noreferrer" href="https://platform.openai.com/docs/guides/your-data">OpenAIのデータ管理</a></p>
        {endpoint?<><Field name="管理者が発行した利用コード"><input type="password" value={key} onChange={e=>setKey(e.target.value)} autoComplete="off"/></Field><label className="check"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>学校の承認を受け、個人情報を除いた授業目標・評価規準・文字起こしの外部送信条件を確認しました</label><button className="primary" disabled={!key.trim()||!consent} onClick={()=>{setMode('ai');setRubrics([]);setRubricApproved(false);invalidate();setChecked(false);setModal(null);move(0)}}>本番AIモードに切り替え</button></>:<p className="alert">この公開版の本番AIは未設定です。</p>}
        {mode==='ai'&&<button className="secondary" onClick={()=>{setMode('local');setKey('');setConsent(false);setRubrics([]);setRubricApproved(false);invalidate();setModal(null);move(0)}}>端末内分析に切り替え</button>}
      </>:<>
        <p className="muted">このブラウザーに明示的に保存した履歴（最大30件）。</p>
        {!records.length&&<p>保存した評価はありません。</p>}
        {records.map(item=><div className="history-row" key={item.id}><button className="secondary" onClick={()=>restore(item)}>{item.lesson.unit}　{new Date(item.date).toLocaleDateString('ja-JP',{timeZone:'Asia/Tokyo'})}</button><button className="secondary" onClick={()=>{try{const next=records.filter(r=>r.id!==item.id);setLocal('lesson-history-v1',next);setRecords(next)}catch{setError('履歴を削除できませんでした。');setModal(null)}}}>削除</button></div>)}
      </>}
    </section></div>}
  </>
}
createRoot(document.getElementById('root')!).render(<App/>)
