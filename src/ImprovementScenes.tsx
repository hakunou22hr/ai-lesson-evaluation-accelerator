import type {ImprovementScene} from './domain'
import {ReadMore} from './ReadMore'

export function ImprovementCard({scene,children}:{scene:ImprovementScene;children?:React.ReactNode}) {
  const first=scene.evidence[0]
  return <article className="result improvement-scene">
    <h4>{scene.title}</h4>
    {first&&<p className="muted">行{first.id}{first.time&&` · ${first.time}`}</p>}
    <dl>
      <dt>次回変えること</dt><dd><ReadMore text={scene.change}/></dd>
      <dt>その場で使う問い</dt><dd><ReadMore text={scene.question}/></dd>
      <dt>改善を確かめる方法</dt><dd><ReadMore text={scene.check}/></dd>
    </dl>
    <details><summary>残したい働きかけと根拠を見る</summary>
      <ReadMore text={scene.keep}/>
      {scene.evidence.map((entry,i)=><blockquote key={i}>行{entry.id} {entry.time}「{entry.quote}」</blockquote>)}
    </details>
    {children}
  </article>
}
