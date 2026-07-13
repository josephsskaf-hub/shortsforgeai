// KINEO-SEO-COMPARE-2026-07-11 — captura o padrão de URL "/compare/*" e
// canaliza pro sistema programático já indexado em /alternatives/heygen
// (evita conteúdo duplicado disputando a mesma keyword).
import { redirect } from 'next/navigation'

export default function CompareHeyGenRedirect() {
  redirect('/alternatives/heygen')
}
