export const schools = {
  小学校: ['国語','社会','算数','理科','生活','音楽','図画工作','家庭','体育','外国語'],
  中学校: ['国語','社会','数学','理科','音楽','美術','保健体育','技術・家庭','外国語'],
  高等学校: ['国語','地理歴史','公民','数学','理科','保健体育','芸術','外国語','家庭','情報','理数','その他（入力）'],
}
export const courses: Record<string,string[]> = {
  数学:['数学Ⅰ','数学Ⅱ','数学Ⅲ','数学A','数学B','数学C'],
  理科:['科学と人間生活','物理基礎','物理','化学基礎','化学','生物基礎','生物','地学基礎','地学'],
  国語:['現代の国語','言語文化','論理国語','文学国語','国語表現','古典探究'],
  地理歴史:['地理総合','地理探究','歴史総合','日本史探究','世界史探究'],
  公民:['公共','倫理','政治・経済'],
  情報:['情報Ⅰ','情報Ⅱ'],
}
export type Lesson = {school:keyof typeof schools; grade:string; subject:string; course:string; unit:string; goal:string; minutes:string; date:string; teacher:string}
export const empty: Lesson = {school:'中学校',grade:'2',subject:'理科',course:'',unit:'',goal:'',minutes:'50',date:'',teacher:''}
export const demo: Lesson = {...empty,unit:'電流とその利用',goal:'電圧と電流の測定結果から、抵抗が一定のときの比例関係を説明できる。'}
export const math: Lesson = {...empty,school:'高等学校',grade:'2',subject:'数学',course:'数学Ⅱ',unit:'三角関数',goal:'単位円を用いて正弦と余弦の周期性を説明する。'}
export const sample = `[00:02:10] 教師：抵抗を変えずに電圧を２倍にすると、電流はどうなると思いますか？
[00:03:04] 生徒A：電流も２倍になると思います。
[00:12:09] 教師：どの測定値を比べると、その予想を確かめられますか？
[00:13:22] 生徒B：１ボルトで０.１アンペア、２ボルトで０.２アンペアです。
[00:13:50] 教師：３ボルトの結果も使って、同じ説明ができますか？
[00:14:15] 生徒A：３ボルトで０.３アンペアでした。電圧が３倍になると電流も３倍なので、比例しています。
[00:42:05] 教師：抵抗が違う場合にも今回と同じグラフになるか、次の授業で確かめましょう。`
export const perspectives = ['知識・技能','思考・判断・表現','主体的に学習に取り組む態度']
export const focuses = ['本時の目標と授業内容の整合性','教師の発問の質','発問のタイミング','生徒の思考を深める問い返し','説明の分かりやすさ','生徒自身に考えさせる場面','生徒同士の対話','生徒の意見を生かした授業展開','学習活動の構成','課題解決の過程','ICT・視覚教材の活用','時間配分','振り返りの質','学習目標の達成に向けた支援']
const indicators = [
  '目標に関係する問いと活動が結び付き、活動後に目標に戻る',
  '発問が考え方や根拠の説明を促す',
  '応答の後に考える時間を取り、必要な場面で発問する',
  '生徒の言葉を拾い、根拠や別の可能性を問う',
  '説明の要点を整理し、生徒が自分の言葉で確認できる',
  '教師が答えを示す前に、生徒が予想や考えを述べる',
  '生徒が互いの考えを参照し、共通点や違いを検討する',
  '生徒の意見を引用し、その意見を次の活動に結び付ける',
  '各活動が前の活動の結果を受けて進む',
  '予想、検証、修正の過程が発言に現れる',
  '教材の視覚情報を参照した考え方が発言に現れる',
  '各活動の時間と活動の目的の関係を確認できる',
  '生徒の振り返りに学んだことと根拠が含まれる',
  'つまずきに応じた支援の後に、生徒の応答を確認する',
]
export type Rubric = {name:string; unit:string; lesson:string; A:string; B:string; C:string; scene:string; method:string; support:string}
export const fields = {unit:'単元の評価規準',lesson:'本時の評価規準',A:'A｜十分満足できる',B:'B｜おおむね満足できる',C:'C｜努力を要する',scene:'評価場面',method:'評価資料・方法',support:'Cに対する支援'} as const
export type Source = {name:string; year:string; section:string; url:string; note:string}
const mext = 'https://www.mext.go.jp'
const curriculumFiles = {小学校:'01',中学校:'02',高等学校:'03'}
const commentaryPages = {小学校:'1387014',中学校:'1387016',高等学校:'1407074'}
const nier = 'https://www.nier.go.jp/kaihatsu/shidousiryou.html'
export function sources(lesson:Lesson): Source[] {
  const year = lesson.school === '高等学校' ? '2018' : '2017'
  const science = lesson.school === '中学校' && lesson.subject === '理科' && /電流/.test(lesson.unit)
  const trig = lesson.school === '高等学校' && lesson.course === '数学Ⅱ' && /三角関数/.test(lesson.unit)
  return [
    {name:lesson.school+'学習指導要領',year,section:science?'第2章 第4節 理科 第1分野 (3) 電流とその利用':trig?'第2章 第4節 数学 第2款 数学Ⅱ (3) 三角関数':'教科・科目の該当箇所は未確認',url:`${mext}/content/20230120-mxt_kyoiku02-100002604_${curriculumFiles[lesson.school]}.pdf`,note:science?'電流と電圧の関係を見いだして理解する内容を参照（要約）。':trig?'一般角の三角関数とその性質に関する内容を参照（要約）。':'資料一覧から該当箇所を確認してください。'},
    {name:lesson.school+'学習指導要領解説 '+(trig?'数学編・理数編':lesson.subject+'編'),year,section:science?'第1分野 (3) 電流とその利用':trig?'数学Ⅱ (3) 三角関数':'該当箇所は未確認',url:mext+(science?'/content/20260730-mxt_kyoiku01-100002608_05.pdf':trig?'/content/20260115-mxt_kyoiku02-100002620_04.pdf':`/a_menu/shotou/new-cs/${commentaryPages[lesson.school]}.htm`),note:science||trig?'文部科学省の教科別解説。':'資料一覧で教科別の該当箇所を確認してください。'},
    {name:'「指導と評価の一体化」のための学習評価に関する参考資料',year:lesson.school==='高等学校'?'2021':'2020',section:lesson.school+' '+lesson.subject+'／内容のまとまりごとの評価規準を作成する際の手順',url:science?'https://www.nier.go.jp/kaihatsu/pdf/hyouka/r020326_mid_rika.pdf':trig?'https://www.nier.go.jp/kaihatsu/pdf/hyouka/r030820_hig_suugaku.pdf':nier,note:'評価規準作成と3観点の考え方を参照。個別事例への対応は未確認。'},
  ]
}
export function drafts(l:Lesson): Rubric[] {
  const science = l.school==='中学校' && l.subject==='理科' && /電流/.test(l.unit)
  const trig = l.school==='高等学校' && l.course==='数学Ⅱ' && /三角関数/.test(l.unit)
  const knowledge = science?'測定した電圧と電流の対応を表やグラフに整理し、比例関係を述べる':trig?'単位円上の点の座標と正弦・余弦を対応させ、周期を示す':'「'+l.goal+'」に必要な用語・手順を用いて課題に取り組む'
  const thinking = science?'複数の測定値を比較し、電圧と電流が比例する理由を数値で説明する':trig?'一周後に点が同じ座標に戻ることを根拠に周期性を説明する':'「'+l.goal+'」に対する自分の考えを根拠とともに説明する'
  const items = [
    [knowledge,'扱った条件と結果を結び付け、別の例にも適用できる','整理に必要な用語や手順が使えていない','個別課題','ワークシート・操作記録','整理済みの例を示し、一つの条件から再試行する'],
    [thinking,'複数の根拠を関連付けて説明し、条件が変わる場合も検討する','結論と根拠の対応が示せていない','結果の比較と説明','発言と記述・成果物','「どのデータがその説明を支えるか」と尋ねる'],
    ['自分の取り組みを振り返り、理解を進めるために方法を見直す','見直しの理由を明示し、次の課題でも自ら方法を調整する','支援を受けても方法の見直しが記録から確認できない','単元内の複数回の振り返り','振り返りの変化・再試行の記録','取り組みの前後を比較する振り返り欄を設ける'],
  ]
  return items.map(([lesson,A,C,scene,method,support],i)=>({name:perspectives[i],unit:`「${l.unit}」の学習を通して、${lesson}。`,lesson,A,B:lesson,C,scene,method,support}))
}
export type Focus = {name:string; A:string; B:string; C:string}
export function focusDraft(names:string[]): Focus[] {
  return names.map(name=>{
    const indicator=indicators[focuses.indexOf(name)] || `「${name}」に対応する授業場面で、意図した指導行動が確認できる`
    return {name,A:`${indicator}。加えて、生徒の後続の応答や活動にどうつながったかを具体的に確認できる。`,B:indicator+'。',C:'関連する場面の記録は十分にあるが、'+indicator+'という状態には至っていない。'}
  })
}
export type Turn = {id:number; time:string; speaker:string; text:string}
export function parseTurns(text:string): Turn[] {
  return text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map((line,id)=>{
    const time = /^(?:\[|［|【|\()?((?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?)(?:\]|］|】|\))?\s*/.exec(line)
    const rest = time ? line.slice(time[0].length) : line
    const speaker = /^([^:：]{1,24})[:：]\s*(.+)$/.exec(rest)
    return {id:id+1,time:time?.[1]||'',speaker:speaker?.[1]||'',text:speaker?.[2]||rest||line}
  })
}
export function anonymize(text:string, names:string) {
  const detected = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|(?:\+81[- ]?|0)\d{1,4}[-ー ]\d{1,4}[-ー ]\d{4}|[一-龯々]{2,6}(?=さん|くん|君|様)/g
  let result=text.replace(detected,'［匿名］')
  for(const name of names.split(/[、,\n]/).map(n=>n.trim()).filter(Boolean).sort((a,b)=>b.length-a.length)) result=result.replaceAll(name,'［匿名］')
  return result
}
export function chunks(turns:Turn[], limit=10000): Turn[][] {
  const result:Turn[][]=[]
  let group:Turn[]=[]
  let length=0
  for(const turn of turns) {
    const size=JSON.stringify(turn).length
    if(group.length && length+size>limit) {result.push(group);group=[];length=0}
    group.push(turn)
    length+=size
  }
  if(group.length) result.push(group)
  return result
}
export type Grade = 'A'|'B'|'C'|'判定不能'
export type Evidence = {id:number; quote:string; time:string}
export type Item = {name:string; grade:Grade; reason:string; improvement:string; evidence:Evidence[]}
export type Report = {learning:Item[]; teaching:Item[]; questions:string; dialogue:string; outcomes:string; improvements:string; examples:string; next:string; mode:'demo'|'local'|'ai'}
export const reportModes = {demo:'デモ評価',local:'端末内分析',ai:'AI分析'} as const
export const sections = {questions:'発問の分析',dialogue:'生徒との対話',outcomes:'授業の成果',improvements:'改善点',examples:'具体的な改善発問・活動例',next:'次時への提案'} as const
export function evidence(value:unknown, turns:Turn[], limit=3):Evidence[] {
  if(!Array.isArray(value)) return []
  return value.flatMap(entry=>{
    if(!entry || typeof entry.quote!=='string' || !entry.quote.trim()) return []
    const turn=turns.find(t=>t.id===entry.id)
    return turn?.text.includes(entry.quote) ? [{id:turn.id,quote:entry.quote,time:turn.time}] : []
  }).slice(0,limit)
}
export function normalizeItem(value:Partial<Item>|undefined,name:string,turns:Turn[],learningIndex=-1):Item {
  let verified=evidence(value?.evidence,turns)
  if(learningIndex>=0) verified=verified.filter(e=>/^(?:生徒|児童|学生|student|pupil)/i.test(turns.find(t=>t.id===e.id)?.speaker||''))
  const grade=verified.length && learningIndex!==2 && ['A','B','C'].includes(value?.grade||'') ? value!.grade! : '判定不能'
  return {name,grade,evidence:verified,reason:grade==='判定不能'?(learningIndex===2?'継続的な取組と学習の調整を確認するには、複数回の振り返り・再試行の記録が必要です。':verified.length&&value?.reason?value.reason:'記録から評価に必要な根拠を確認できません。'):(value?.reason||'根拠発言を参照してください。'),improvement:value?.improvement||'対応する場面の発言やワークシートを確認してください。'}
}
