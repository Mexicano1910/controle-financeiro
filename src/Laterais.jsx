// Logo da CODECOR TECH nas laterais (só aparece em telas largas, como no computador)
export default function Laterais() {
  const lado = c => (
    <aside className={'lado ' + c} aria-hidden="true">
      <img src="/logo-lateral.png" alt="" />
      <small>desenvolvido por</small>
      <span>CODECOR TECH</span>
    </aside>
  );
  return <>{lado('esq')}{lado('dir')}</>;
}
