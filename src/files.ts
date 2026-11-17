export async function readFile(file:File):Promise<string> {
  if(file.size>15*1024*1024) throw Error('ファイルは15 MB以内にしてください。')
  const extension=file.name.split('.').pop()?.toLowerCase()
  if(extension==='txt') return file.text()
  if(extension==='docx') {
    const {extractRawText}=await import('mammoth')
    return (await extractRawText({arrayBuffer:await file.arrayBuffer()})).value
  }
  if(extension==='csv') {
    const {default:parse}=await import('papaparse')
    const result=parse.parse<string[]>(await file.text(),{skipEmptyLines:'greedy'})
    if(result.errors.length) throw Error('CSVの区切りや引用符を確認してください。')
    const headers=result.data[0]?.map(h=>h.trim().toLowerCase())||[]
    const time=headers.findIndex(h=>/^(時刻|時間|timestamp|time)$/.test(h))
    const role=headers.findIndex(h=>/^(話者|発言者|speaker|role)$/.test(h))
    const body=headers.findIndex(h=>/^(発言|発言内容|文字起こし|本文|text|utterance)$/.test(h))
    if(body<0) return result.data.map(row=>row.join(' ')).join('\n')
    return result.data.slice(1).map(row=>[row[time]?'['+row[time]+']':'',row[role]?row[role]+'：':'',row[body]||''].filter(Boolean).join(' ')).join('\n')
  }
  if(extension==='pdf') {
    const pdfjs=await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc=(await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
    const pdf=await pdfjs.getDocument({data:await file.arrayBuffer(),isEvalSupported:false}).promise
    try {
      const result=[]
      for(let page=1;page<=pdf.numPages;page++) {
        const content=await (await pdf.getPage(page)).getTextContent()
        result.push(content.items.map(item=>'str' in item?item.str+(item.hasEOL?'\n':''):'').join(''))
      }
      return result.join('\n')
    } finally {await pdf.destroy()}
  }
  throw Error('TXT、DOCX、CSV、テキスト付きPDFを選択してください。')
}
