// Simple but rich-ish Canvas FX engine for attacks and impacts
export class FX {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.effects = [];
    this.running = false;
    this.last = 0;
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(640, Math.floor(rect.width));
    this.canvas.height = Math.max(360, Math.floor(rect.height));
  }

  attack(fromEl, toEl, opts={}) {
    const a = centerOf(fromEl, this.canvas);
    const b = centerOf(toEl, this.canvas);
    const color = opts.color || '#ff5577';
    // beam effect followed by particles
    this.effects.push(beam(a, b, color));
    this.effects.push(spark(a, color));
    this.effects.push(spark(b, color));
    this.start();
  }

  impactAtEl(el, opts={}) {
    const p = centerOf(el, this.canvas);
    const color = opts.color || '#ffaa33';
    this.effects.push(ring(p, color));
    this.effects.push(explosion(p, color));
    this.start();
  }

  start(){ if (!this.running) { this.running = true; this.last = performance.now(); requestAnimationFrame(this.tick); } }
  stop(){ this.running = false; }

  tick = (t) => {
    if (!this.running) return;
    const dt = Math.min(32, t - this.last); this.last = t;
    const ctx = this.ctx; const W=this.canvas.width, H=this.canvas.height;
    ctx.clearRect(0,0,W,H);
    this.effects = this.effects.filter(e => { e.update(dt); e.draw(ctx); return !e.dead; });
    if (this.effects.length === 0) { this.stop(); return; }
    requestAnimationFrame(this.tick);
  }
}

function centerOf(el, canvas){
  const r = el.getBoundingClientRect();
  const cr = canvas.getBoundingClientRect();
  const x = (r.left + r.right)/2 - cr.left;
  const y = (r.top + r.bottom)/2 - cr.top;
  return { x, y };
}

// Effects
function beam(a, b, color){
  const life = 300; let t=0; const width=12;
  return {
    update(dt){ t+=dt; if (t>life) this.dead=true; },
    draw(ctx){
      const p = t/life; const w = width*(1-p);
      const grad = ctx.createLinearGradient(a.x,a.y,b.x,b.y);
      grad.addColorStop(0, color);
      grad.addColorStop(1, '#ffffff');
      ctx.save(); ctx.globalAlpha = 0.7*(1-p);
      ctx.lineWidth = Math.max(1,w);
      ctx.strokeStyle = grad;
      ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
      ctx.restore();
    }
  };
}

function ring(p, color){
  const life=500; let t=0; const r0=8, r1=80;
  return {
    update(dt){ t+=dt; if(t>life) this.dead=true; },
    draw(ctx){ const k=t/life; const r=r0+(r1-r0)*k; ctx.save(); ctx.globalAlpha=0.6*(1-k); ctx.strokeStyle=color; ctx.lineWidth=3*(1-k); ctx.beginPath(); ctx.arc(p.x,p.y,r,0,Math.PI*2); ctx.stroke(); ctx.restore(); }
  };
}

function explosion(p, color){
  const n=24; const parts = new Array(n).fill(0).map(()=>({
    x:p.x,y:p.y, vx:(Math.random()*2-1)*2, vy:(Math.random()*2-1)*2, life: 500+Math.random()*300, t:0, r:2+Math.random()*2
  }));
  return {
    update(dt){ parts.forEach(o=>{ o.t+=dt; o.x+=o.vx*dt*0.2; o.y+=o.vy*dt*0.2; if(o.t>o.life) o.dead=true; }); if (parts.every(o=>o.dead)) this.dead=true; },
    draw(ctx){ parts.forEach(o=>{ if(o.dead) return; const k=o.t/o.life; ctx.save(); ctx.globalAlpha=0.9*(1-k); ctx.fillStyle=color; ctx.beginPath(); ctx.arc(o.x,o.y,o.r*(1-k),0,Math.PI*2); ctx.fill(); ctx.restore(); }); }
  };
}

function spark(p, color){
  let t=0; const life=200; return { update(dt){ t+=dt; if(t>life) this.dead=true; }, draw(ctx){ const k=t/life; ctx.save(); ctx.globalAlpha=1-k; ctx.fillStyle=color; ctx.beginPath(); ctx.arc(p.x,p.y,4*(1-k),0,Math.PI*2); ctx.fill(); ctx.restore(); } };
}
