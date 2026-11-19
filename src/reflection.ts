import {dialogueObservation,rationalePattern,summarizeDialogue,teacherLabel,studentLabel} from './dialogue.ts'
import type {Report,Turn} from './domain.ts'

export function reflectionReport(turns:Turn[]):Report {
  const conversation=summarizeDialogue(turns)
  const hasTeacher=turns.some(turn=>teacherLabel.test(turn.speaker.trim()))
  const hasStudent=turns.some(turn=>studentLabel.test(turn.speaker.trim()))
  const scene=conversation.scenes.find(item=>item.sameLearner&&item.followUpResponse)
    ||conversation.scenes.find(item=>item.response&&rationalePattern.test(item.prompt.quote))
    ||conversation.scenes.find(item=>item.response)
  const focus='問い返しの後、生徒の説明に理由や根拠が加わったか'
  const missing=!hasTeacher||!hasStudent?'話者を確認し、発言者の役割を教師・生徒に割り当ててください。':
    '生徒本人の予想、結果、言い直した説明を、同じ話者の記録やワークシートで照合してください。'
  const question='最初はどう考えましたか。いま見た事実や数値のうち、どれが根拠ですか。'
  const observation=scene?dialogueObservation(scene):
    !hasTeacher||!hasStudent?'教師と生徒の役割がそろっている発言を確認できませんでした。':'教師の働きかけと、それに対応する生徒の発言を結び付けられませんでした。'
  return {
    mode:'local',reflectionFocus:focus,learning:[],teaching:[],conversation,
    questions:`発問候補 ${conversation.questions}件、指示候補 ${conversation.instructions}件。`,
    dialogue:observation,outcomes:scene?`行${scene.prompt.id}の働きかけに続き、行${scene.response!.id}に生徒の発言が記録されています。 ${observation}`:observation,
    improvements:missing,examples:question,next:scene?'解説の前に、同じ生徒へ問い返し、最初と最後の説明を残す。':missing,
    improvementScenes:scene?[{
      source:'local',title:'最初の応答のあとに根拠を確かめる',
      keep:rationalePattern.test(scene.prompt.quote)?'理由や根拠を尋ねる問いを残す。':'生徒に自分の言葉で応答する機会を残す。',
      change:'教師の説明に入る前に最初に答えた生徒へ戻り、理由を具体的に言い直してもらう。',
      question,check:'同じ生徒の前後の発言を並べ、観察した事実や数値が根拠として加わったかを見る。',
      evidence:[scene.prompt,scene.response!,...(scene.followUp?[scene.followUp]:[]),...(scene.followUpResponse?[scene.followUpResponse]:[])],
    }]:[],
  }
}
