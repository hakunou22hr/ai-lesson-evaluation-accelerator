import {dialogueObservation,reactionLabels} from './dialogue'
import type {Lesson,Report,Source,Item} from './domain'
import {assessmentStatus,reportModes,sections} from './domain'
const W=794,H=1123,M=47,BOTTOM=1055,CONTENT=W-2*M
const grades = {
  A:{ink:'#155b49',fill:'#e6f4ed',bar:'#31866d'},
  B:{ink:'#184f87',fill:'#e8f1fd',bar:'#3879b8'},
  C:{ink:'#863e12',fill:'#fff0df',bar:'#b86c35'},
  確認待ち:{ink:'#654b10',fill:'#fff5d8',bar:'#a4822c'},
  根拠不足:{ink:'#465366',fill:'#edf0f4',bar:'#728195'},
}
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
    const write=(value:string,maxLines=2,size=15,color='#233650',indent=0,width=CONTENT-indent)=>{
      ctx.font=`${size}px "Report Japanese"`
      ctx.fillStyle=color
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
    const box=(x:number,top:number,width:number,height:number,fill:string,stroke='#dce5ef')=>{
      if(x<M||x+width>W-M||top+height>BOTTOM) throw Error('PDFの配置検査に失敗しました。')
      ctx.beginPath();ctx.roundRect(x,top,width,height,9)
      ctx.fillStyle=fill;ctx.fill()
      ctx.strokeStyle=stroke;ctx.stroke()
    }
    const distribution=()=>{
      const items=[...report.learning,...report.teaching]
      if(!items.length) return
      heading('判定の内訳')
      const keys=Object.keys(grades) as (keyof typeof grades)[]
      const counts=keys.map(grade=>items.filter(item=>assessmentStatus(item)===grade).length)
      let x=M
      counts.forEach((count,index)=>{
        if(!count) return
        const width=CONTENT*count/items.length
        ctx.fillStyle=grades[keys[index]].bar
        ctx.fillRect(x,y,width,14)
        x+=width
      })
      y+=20
      keys.forEach((grade,index)=>{
        const x=M+index*140
        ctx.fillStyle=grades[grade].bar;ctx.fillRect(x,y+5,10,10)
        ctx.fillStyle=grades[grade].ink;ctx.font='13px "Report Japanese"'
        ctx.fillText(`${grade}　${counts[index]}件`,x+16,y)
      })
      y+=24
    }
    const evaluationCards=(items:Item[],columns:number,expanded:boolean)=>{
      const gap=10,width=(CONTENT-gap*(columns-1))/columns
      const height=expanded?142:57
      let top=y
      items.forEach((item,i)=>{
        if(i&&i%columns===0) top+=height+gap
        const x=M+(i%columns)*(width+gap)
        const inset=x-M+12
        const status=assessmentStatus(item)
        const tone=grades[status]
        box(x,top,width,height,'#fcfdff')
        box(x+11,top+7,expanded?72:68,21,tone.fill,tone.fill)
        y=top+8
        write(status,1,12,tone.ink,inset+7,expanded?57:53)
        if(expanded){
          y=top+32
          write(item.name,2,14,'#143956',inset,width-24)
          y=top+76
          write(item.reason,2,12,'#394c62',inset,width-24)
          y=top+115
          const lead=item.evidence[0]
          write(lead?`根拠  行${lead.id}${lead.time?' · '+lead.time:''}`:'根拠発言の記載なし',1,11,'#536d86',inset,width-24)
        }else if(columns===3){
          y=top+8
          const lead=item.evidence[0]
          if(lead) write(`根拠  行${lead.id}`,1,11,'#536d86',inset+74,width-98)
          y=top+31
          write(item.name,1,12,'#143956',inset,width-24)
        }else{
          y=top+8
          write(item.name,1,12,'#143956',inset+74,width-98)
          y=top+31
          write(item.reason,1,11,'#394c62',inset,width-24)
        }
      })
      if(items.length) y=top+height+3
    }
    const noteCards=(cards:readonly (readonly [string,string])[],height:number)=>{
      const width=(CONTENT-12)/2
      const top=y
      cards.forEach(([label,body],index)=>{
        const x=M+index*(width+12)
        box(x,top,width,height,index===0?'#edf5fc':'#eaf5f0')
        y=top+8
        write(label,1,14,'#174d81',x-M+12,width-24)
        write(body,2,12,'#233650',x-M+12,width-24)
      })
      y=top+height+6
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
      const scene=report.conversation?.scenes.find(value=>value.followUpResponse)
        ||report.conversation?.scenes.find(value=>value.kind==='instruction'&&value.response)
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
      if(scene.followUp&&scene.followUpResponse){
        write(`教師の次の発問  行${scene.followUp.id} ${scene.followUp.time}「${scene.followUp.quote}」`,1,12)
        write(`次の応答  行${scene.followUpResponse.id} ${scene.followUpResponse.time}「${scene.followUpResponse.quote}」`,1,12)
        write(dialogueObservation(scene),1,11,'#536d86')
      }
    }
    write('AI授業評価 Accelerator',1,14,'#396588')
    y+=8
    write(number===1?'授業評価結果':'授業分析と改善提案',1,30)
    if(number===1) {
      write(`${lesson.school}${lesson.grade}年 ｜ ${lesson.course||lesson.subject} ｜ ${lesson.minutes}分 ｜ ${lesson.date||'授業日未入力'}`,1)
      write(lesson.unit+(lesson.teacher?' ｜ '+lesson.teacher:''),1,19)
      write('本時の目標　'+lesson.goal,2)
      write(reportModes[report.mode]+(report.chatNotes||[...report.learning,...report.teaching].some(item=>item.source==='chatgpt')?'・ChatGPT評価案を反映':'')+'・授業研究用',1,13,'#396588')
      distribution()
      heading('3観点に関連する学習状況')
      evaluationCards(report.learning,3,true)
      if(report.teaching.length){
        heading('授業者が指定した指導上の観点')
        evaluationCards(report.teaching,report.teaching.length>10?3:2,false)
        if(report.teaching.length>10) write('各観点の理由は分析画面で確認できます。',1,11,'#536d86')
      }
      heading('授業全体の成果');write(report.outcomes,3)
    } else {
      chart()
      flow()
      const completeFlow=report.conversation?.scenes.some(scene=>scene.followUpResponse)
      const quotes=[...new Map([...report.learning,...report.teaching].flatMap(i=>i.evidence).map(e=>[e.id,e])).values()]
      if(!completeFlow){
        heading('根拠となる重要な発言')
        if(!quotes.length) write('評価に使える根拠発言はありません。',1)
        quotes.slice(0,report.conversation?2:4).forEach(e=>write(`行${e.id}${e.time?' '+e.time:''} 「${e.quote}」`,2,13))
      }
      heading('発問と応答の概要')
      write(report.questions,1,12)
      write(report.dialogue,1,12)
      heading('対話から考える改善')
      const adopted=[...report.learning,...report.teaching].find(item=>item.source==='chatgpt')
      noteCards([[sections.improvements,report.improvements],[!report.chatNotes&&adopted?'採用した問い返し例':sections.examples,!report.chatNotes&&adopted?adopted.improvement:report.examples]],76)
      heading(sections.next);write(report.next,2,13)
      heading('自己評価メモ')
      noteCards([['残したい働きかけ','________________________________'],['次時に変える指示・問い','________________________________']],62)
      write('授業研究・振り返り用。正式な成績や人事評価の資料として自動確定しない。',1,11)
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
