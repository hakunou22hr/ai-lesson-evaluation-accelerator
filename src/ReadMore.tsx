import {useEffect,useId,useRef,useState} from 'react'

export function ReadMore({text}:{text:string}) {
  const [open,setOpen]=useState(false)
  const [overflow,setOverflow]=useState(false)
  const content=useRef<HTMLDivElement>(null)
  const id=useId()
  useEffect(()=>{
    const element=content.current
    if(!element) return
    const measure=()=>setOverflow(element.scrollHeight>parseFloat(getComputedStyle(element).lineHeight)*10+1)
    measure()
    const observer=new ResizeObserver(measure)
    observer.observe(element)
    return ()=>observer.disconnect()
  },[text,open])
  return <div className="long-text">
    <div id={id} ref={content} className={open?'':'long-text-preview'}>{text}</div>
    {overflow&&<button type="button" className="text-button" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(!open)}>{open?'閉じる':'続きを見る'}</button>}
  </div>
}
