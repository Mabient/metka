// Minimal QR encoder: byte mode, ECC level M, versions 1–20.
const QR = (() => {
  const ECC_CPB = [-1,10,16,26,18,24,16,18,22,22,26,30,22,22,24,24,28,28,26,26,26];
  const NUM_BLK = [-1,1,1,1,2,2,4,4,4,5,5,5,8,9,9,10,10,11,13,14,16];
  const rawModules = v => { let r = (16*v+128)*v+64; if (v >= 2) { const n = Math.floor(v/7)+2; r -= (25*n-10)*n-55; if (v >= 7) r -= 36; } return r; };
  const dataCodewords = v => Math.floor(rawModules(v)/8) - ECC_CPB[v]*NUM_BLK[v];
  const gmul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z & 0xFF; };
  const rsDivisor = deg => { const r = new Array(deg).fill(0); r[deg-1] = 1; let root = 1; for (let i = 0; i < deg; i++) { for (let j = 0; j < r.length; j++) { r[j] = gmul(r[j], root); if (j+1 < r.length) r[j] ^= r[j+1]; } root = gmul(root, 2); } return r; };
  const rsRemainder = (data, div) => { const r = div.map(() => 0); for (const b of data) { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => { r[i] ^= gmul(c, f); }); } return r; };
  const bit = (x, i) => ((x >>> i) & 1) !== 0;

  function encode(text) {
    const bytes = Array.from(new TextEncoder().encode(text));
    let ver = 1;
    for (; ver <= 20; ver++) { const cc = ver < 10 ? 8 : 16; if (4 + cc + bytes.length*8 <= dataCodewords(ver)*8) break; }
    if (ver > 20) throw new Error("Text too long for QR");
    const cap = dataCodewords(ver)*8;
    const bb = [];
    const push = (val, len) => { for (let i = len-1; i >= 0; i--) bb.push((val >>> i) & 1); };
    push(4, 4); push(bytes.length, ver < 10 ? 8 : 16); bytes.forEach(b => push(b, 8));
    push(0, Math.min(4, cap - bb.length)); push(0, (8 - bb.length % 8) % 8);
    for (let p = 0xEC; bb.length < cap; p ^= 0xEC ^ 0x11) push(p, 8);
    const data = []; for (let i = 0; i < bb.length; i += 8) { let v = 0; for (let j = 0; j < 8; j++) v = (v << 1) | bb[i+j]; data.push(v); }

    // ECC + interleave
    const nb = NUM_BLK[ver], el = ECC_CPB[ver], raw = Math.floor(rawModules(ver)/8);
    const nShort = nb - raw % nb, shortLen = Math.floor(raw/nb), div = rsDivisor(el);
    const blocks = []; let k = 0;
    for (let i = 0; i < nb; i++) { const d = data.slice(k, k + shortLen - el + (i < nShort ? 0 : 1)); k += d.length; const ecc = rsRemainder(d, div); if (i < nShort) d.push(0); blocks.push(d.concat(ecc)); }
    const cw = [];
    for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - el || j >= nShort) cw.push(b[i]); });

    const size = ver*4 + 17;
    const mod = Array.from({length: size}, () => new Array(size).fill(false));
    const fn = Array.from({length: size}, () => new Array(size).fill(false));
    const set = (x, y, d) => { mod[y][x] = d; fn[y][x] = true; };
    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    const finder = (x, y) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)), xx = x+dx, yy = y+dy; if (xx >= 0 && xx < size && yy >= 0 && yy < size) set(xx, yy, d !== 2 && d !== 4); } };
    finder(3, 3); finder(size-4, 3); finder(3, size-4);
    let align = [];
    if (ver > 1) { const n = Math.floor(ver/7)+2, step = Math.ceil((ver*4+4)/(n*2-2))*2; align = [6]; for (let p = size-7; align.length < n; p -= step) align.splice(1, 0, p); }
    align.forEach((ax, i) => align.forEach((ay, j) => { const n = align.length; if ((i === 0 && j === 0) || (i === 0 && j === n-1) || (i === n-1 && j === 0)) return; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ax+dx, ay+dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); }));
    const drawFormat = mask => {
      const d = (0 << 3) | mask; let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      const b = ((d << 10) | r) ^ 0x5412;
      for (let i = 0; i <= 5; i++) set(8, i, bit(b, i));
      set(8, 7, bit(b, 6)); set(8, 8, bit(b, 7)); set(7, 8, bit(b, 8));
      for (let i = 9; i < 15; i++) set(14-i, 8, bit(b, i));
      for (let i = 0; i < 8; i++) set(size-1-i, 8, bit(b, i));
      for (let i = 8; i < 15; i++) set(8, size-15+i, bit(b, i));
      set(8, size-8, true);
    };
    drawFormat(0);
    if (ver >= 7) { let r = ver; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25); const b = (ver << 12) | r; for (let i = 0; i < 18; i++) { const a = size-11+i%3, c = Math.floor(i/3); set(a, c, bit(b, i)); set(c, a, bit(b, i)); } }

    let i = 0;
    for (let right = size-1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
        const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size-1-vert : vert;
        if (!fn[y][x] && i < cw.length*8) { mod[y][x] = bit(cw[i >>> 3], 7 - (i & 7)); i++; }
      }
    }
    const maskFn = [
      (x,y)=>(x+y)%2===0, (x,y)=>y%2===0, (x,y)=>x%3===0, (x,y)=>(x+y)%3===0,
      (x,y)=>(Math.floor(x/3)+Math.floor(y/2))%2===0, (x,y)=>x*y%2+x*y%3===0,
      (x,y)=>(x*y%2+x*y%3)%2===0, (x,y)=>((x+y)%2+x*y%3)%2===0];
    const applyMask = m => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && maskFn[m](x, y)) mod[y][x] = !mod[y][x]; };
    const penalty = () => {
      let p = 0, dark = 0;
      for (let y = 0; y < size; y++) { let run = 1; for (let x = 1; x < size; x++) { if (mod[y][x] === mod[y][x-1]) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; } }
      for (let x = 0; x < size; x++) { let run = 1; for (let y = 1; y < size; y++) { if (mod[y][x] === mod[y-1][x]) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; } }
      for (let y = 0; y < size-1; y++) for (let x = 0; x < size-1; x++) { const c = mod[y][x]; if (c === mod[y][x+1] && c === mod[y+1][x] && c === mod[y+1][x+1]) p += 3; }
      mod.forEach(r => r.forEach(c => { if (c) dark++; }));
      return p + Math.floor(Math.abs(dark*20 - size*size*10) / (size*size)) * 10;
    };
    let best = 0, bestP = Infinity;
    for (let m = 0; m < 8; m++) { applyMask(m); drawFormat(m); const p = penalty(); if (p < bestP) { bestP = p; best = m; } applyMask(m); }
    applyMask(best); drawFormat(best);
    return { size, get: (x, y) => mod[y][x] };
  }
  return { encode };
})();
if (typeof module !== "undefined") module.exports = QR;
