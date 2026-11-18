import {reactionLabels} from './dialogue'
import type {Lesson,Report,Source,Item} from './domain'
import {reportModes,sections} from './domain'
const W=794,H=1123,M=47,BOTTOM=1055
let loaded:Promise<FontFace>|undefined
function font() {
  loaded ??= new FontFace('Report Japanese',`url(${import.meta.env.BASE_URL}NotoSansCJKjp-Regular.otf)`).load().then(face=>{document.fonts.add(face);return face}).catch(error=>{loaded=undefined;throw error})
  return loaded
}
export function filename(l:Lesson) {
  const school={小学校:'小',中学校:'中',高等学校:'高'}[l.school]
  const date=l.date||new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date())
  return `授業評価_${school}${l.grade}_${l.course||l.subject}_${l.unit.slice(0,60)}_${date}.pdf`.replace(/[\\/:*?"<>|]/g,'_')
}
export async function createPdf(lesson:Lesson,report:Report,sources:Source[]) {
  const [{jsPDF}]=await Promise.all([import('jspdf'),font()])
  const pdf=new jsPDF({orientation:'portrait',format:'a4',unit:'mm',compress:true})
  pdf.setProperties({title:'Lesson evaluation report'})
  function render(number:number) {
    const canvas=document.createElement('canvas')
    canvas.width=W*2;canvas.height=H*2
    const ctx=canvas.getContext('2d')!
    ctx.scale(2,2)
    ctx.textBaseline='top'
    ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H)
    let y=57
    const write=(value:string,maxLines=2,size=15,color='#233650',indent=0)=>{
      ctx.font=`${size}px "Report Japanese"`
      ctx.fillStyle=color
      const width=W-2*M-indent
      const lines:string[]=[]
      let line=''
      for(const char of value.replace(/\s+/g,' ').trim()) {
        if(ctx.measureText(line+char).width>width) {lines.push(line);line=char}
        else line+=char
        if(lines.length===maxLines) break
      }
      if(lines.length<maxLines) lines.push(line)
      else {
        let last=lines[maxLines-1]
        while(ctx.measureText(last+'…').width>width) last=last.slice(0,-1)
        lines[maxLines-1]=last+'…'
      }
      for(const text of lines) {
        if(y+size+7>BOTTOM||ctx.measureText(text).width>width) throw Error('PDFの配置検査に失敗しました。')
        ctx.fillText(text,M+indent,y);y+=size+7
      }
    }
    const heading=(label:string)=>{y+=7;write(label,1,18,'#174d81')}
    const row=(item:Item,detail:boolean)=>{
      ctx.fillStyle='#eef4fa';ctx.fillRect(M,y-1,W-2*M,20)
      write(`${item.grade}  ｜  ${item.name}`,1,13,'#123a65',7)
      if(detail) write(item.reason,1,13,'#233650',7)
    }
    const chart=()=>{
      const data=report.conversation
      if(!data) return
      heading('対話の見取り')
      const totals=[['発問候補',data.questions],['指示候補',data.instructions],['応答候補',data.responses]] as const
      totals.forEach(([label,count],i)=>{
        const x=M+i*235
        ctx.fillStyle=['#eaf3fc','#e4f5f4','#eef1fc'][i]
        ctx.fillRect(x,y,224,47)
        ctx.fillStyle='#174d81';ctx.font='15px "Report Japanese"'
        ctx.fillText(label,x+12,y+14)
        ctx.font='23px "Report Japanese"';ctx.fillText(String(count),x+121,y+7)
      })
      y+=54
      if(!data.timed){write('応答の時刻差を計測できる組はありません。',1,13);return}
      write(`応答までの発言開始時刻の差  ｜  計測 ${data.timed}件・中央値 ${data.median?.toFixed(1)}秒`,1,13)
      const max=Math.max(...data.bins,1)
      data.bins.forEach((count,i)=>{
        ctx.font='12px "Report Japanese"';ctx.fillStyle='#233650'
        ctx.fillText(['5秒未満','5〜15秒未満','15秒以上'][i],M,y)
        ctx.fillStyle='#e8f0f7';ctx.fillRect(M+130,y+2,470,11)
        ctx.fillStyle='#2b7895';ctx.fillRect(M+130,y+2,470*count/max,11)
        ctx.fillStyle='#233650';ctx.fillText(`${count}件`,M+615,y)
        y+=17
      })
    }
    const flow=()=>{
      const scene=report.conversation?.scenes.find(value=>value.kind==='instruction'&&value.response)
        ||report.conversation?.scenes.find(value=>value.response)
      if(!scene?.response) return
      heading('対話の流れ｜振り返る場面')
      const detail=scene.reaction?reactionLabels[scene.reaction]:'応答候補'
      const captions=[scene.kind==='instruction'?'教師の指示':'教師の発問','児童・生徒の反応'+(scene.seconds===undefined?'':` · ${scene.seconds}秒`)]
      captions.forEach((caption,i)=>{
        const x=M+i*375
        ctx.fillStyle=i?'#e4f5f4':'#eaf3fc';ctx.fillRect(x,y,325,33)
        ctx.fillStyle='#174d81';ctx.font='14px "Report Japanese"';ctx.fillText(caption,x+11,y+6)
      })
      ctx.fillStyle='#237596';ctx.font='20px "Report Japanese"';ctx.fillText('→',M+337,y+2)
      y+=39
      write(`行${scene.prompt.id} ${scene.prompt.time}「${scene.prompt.quote}」`,1,13)
      write(`行${scene.response.id} ${scene.response.time}（${detail}）「${scene.response.quote}」`,1,13)
    }
    write('AI授業評価 Accelerator',1,14,'#396588')
    y+=8
    write(number===1?'授業評価結果':'授業分析と改善提案',1,30)
    if(number===1) {
      write(`${lesson.school}${lesson.grade}年 ｜ ${lesson.course||lesson.subject} ｜ ${lesson.minutes}分 ｜ ${lesson.date||'授業日未入力'}`,1)
      write(lesson.unit+(lesson.teacher?' ｜ '+lesson.teacher:''),1,19)
      write('本時の目標　'+lesson.goal,2)
      write(reportModes[report.mode]+'・授業研究用',1,13,'#396588')
      chart()
      heading('3観点に関連する学習状況')
      report.learning.forEach(item=>row(item,true))
      heading('授業者が指定した指導上の観点')
      report.teaching.forEach((item,i)=>row(item,i<12-report.teaching.length))
      if(report.teaching.length>6) write('各観点の詳細理由はアプリで確認できます。',1,12)
      heading('授業全体の成果');write(report.outcomes,3)
    } else {
      flow()
      heading('根拠となる重要な発言')
      const quotes=[...new Map([...report.learning,...report.teaching].flatMap(i=>i.evidence).map(e=>[e.id,e])).values()]
      if(!quotes.length) write('評価に使える根拠発言はありません。',1)
      quotes.slice(0,report.conversation?2:4).forEach(e=>write(`行${e.id}${e.time?' '+e.time:''} 「${e.quote}」`,2,13))
      for(const key of ['questions','dialogue','improvements','examples','next'] as const){heading(sections[key]);write(report[key],2,14)}
      heading('自己評価メモ')
      write('残したい働きかけ ___________________　次時に変える指示・問い ___________________',1,13)
      heading('評価上の留意事項')
      write('授業研究・振り返り用。正式な成績や人事評価の資料として自動確定しない。',2,13)
      heading('評価規準の出典')
      for(const source of sources){
        write(`${source.name}（${source.year}年） ${source.section}`,2,12)
        write(source.url,1,11,'#285c85')
      }
    }
    ctx.fillStyle='#597087';ctx.font='12px "Report Japanese"'
    ctx.fillText(`授業研究用　／　${number}・2`,M,H-29)
    pdf.addImage(canvas,'PNG',0,0,210,297,undefined,'FAST')
    canvas.width=0
  }
  render(1);pdf.addPage();render(2)
  if(pdf.getNumberOfPages()!==2||pdf.internal.pageSize.getWidth()<209.9||pdf.internal.pageSize.getHeight()<296.9) throw Error('PDFのページ検査に失敗しました。')
  return pdf
}
