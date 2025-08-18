// boot.js - jsフォルダ内のスクリプトを可能な限り読み込み、続いてengine/appを起動
(function(){
  const CANDIDATES = [
    'cards.js',
    'deck.js',
    'rules.js',
    'ai.js',
    'effects.js',
    'helpers.js',
    'utils.js'
  ];

  function loadClassic(src){
    return new Promise((resolve)=>{
      const el = document.createElement('script');
      el.src = src; el.async = false;
      el.onload = () => resolve({src, ok:true, mode:'classic'});
      el.onerror = () => resolve({src, ok:false, mode:'classic'});
      document.head.appendChild(el);
    });
  }

  async function loadModuleOrClassic(path){
    try {
      const m = await import(`./${path}`);
      // cards.js のエクスポートをグローバルへ橋渡し
      if (path === 'cards.js') {
        if (!window.Cards) {
          window.Cards = m.Cards || m.default || m;
        }
      } else {
        const key = path.replace(/\.js$/,'').replace(/(^|[-_])(\w)/g, (_, __, c)=> c.toUpperCase());
        if (!window[key]) window[key] = m.default || m;
      }
      return { src: path, ok: true, mode: 'module' };
    } catch (e) {
      // ESMで読めない/存在しない場合、クラシックで試行
      return await loadClassic(`js/${path}`);
    }
  }

  async function main(){
    // 可能な限り候補を読み込む（順序保持）
    for (const name of CANDIDATES){
      /* eslint no-await-in-loop: off */
      await loadModuleOrClassic(name);
    }
    // コアはクラシック読み込み（アプリ本体）
    await loadClassic('js/engine.js');
    await loadClassic('js/app.js');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main, {once:true});
  else main();
})();
