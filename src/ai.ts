export const endpoint = (import.meta.env.VITE_AI_ENDPOINT || '').replace(/\/$/,'')
export async function ai<T>(op:string,data:unknown,key:string):Promise<T> {
  const response=await fetch(endpoint+'/evaluate',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},body:JSON.stringify({op,data}),signal:AbortSignal.timeout(85000)})
  if(!response.ok) {
    if(response.status===429) throw Error('利用上限に達しました。時間をおいて再試行してください。')
    if(response.status===403||response.status===401) throw Error('管理者が発行した利用コードと設定を確認してください。')
    if(response.status===413) throw Error('入力が上限を超えています。')
    throw Error('AIサービスに接続できませんでした。時間をおいて再試行してください。')
  }
  return response.json()
}
