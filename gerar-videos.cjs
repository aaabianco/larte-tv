#!/usr/bin/env node
/**
 * Transforma playlists de fotos em VÍDEO (o dono, 29/10).
 *
 * O Fire TV Stick (Select/Vega) dorme e põe a tela da Amazon por cima quando
 * só há fotos; com vídeo VISÍVEL tocando ele fica acordado (provado na TV 2).
 * Vídeo escondido atrás das fotos não bastou (TV 1, 29/10).
 *
 * Para cada playlist em grade.json → "videoDaPlaylist", gera
 * video-<playlist>.mp4: cada foto `segundos` s, fade de 1,2 s, 1920x1080,
 * H.264 + faixa de som muda (igual ao vídeo que funcionou), moov no início.
 *
 * Mudou uma foto ou a ordem de uma dessas playlists? Rode de novo e publique.
 *
 *   node gerar-videos.cjs [caminho do ffmpeg.exe]
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const raiz = __dirname;
const ffmpeg = process.argv[2] || process.env.FFMPEG || 'ffmpeg';
const grade = JSON.parse(fs.readFileSync(path.join(raiz, 'grade.json'), 'utf8'));
// Tempo de cada foto NO VÍDEO (o dono, 29/10: 10 s); sem ele, o das fotos.
const seg = Number(grade.videoSegundos) >= 3 ? Number(grade.videoSegundos) : Number(grade.segundos) >= 3 ? Number(grade.segundos) : 15;
const FADE = 1.2;
const FPS = 25;

for (const nome of Object.keys(grade.videoDaPlaylist || {})) {
  const fotos = (grade.playlists || {})[nome];
  if (!fotos || !fotos.length) { console.log(`-- ${nome}: playlist vazia, pulei`); continue; }
  const saida = grade.videoDaPlaylist[nome];
  const args = ['-y', '-hide_banner', '-loglevel', 'error'];
  // Cada foto dura seg + FADE (a sobreposição come FADE de cada transição);
  // a última repete a primeira no fim para o loop não "pular".
  const lista = [...fotos, fotos[0]];
  lista.forEach((f, i) => {
    const dur = i === lista.length - 1 ? FADE : seg + FADE;
    args.push('-loop', '1', '-framerate', String(FPS), '-t', String(dur), '-i', path.join(raiz, f));
  });
  args.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100');
  const prep = lista.map((_, i) =>
    `[${i}:v]scale=1920:1080:force_original_aspect_ratio=decrease:out_range=tv,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0a0a0a,setsar=1,fps=${FPS},format=yuv420p[f${i}]`);
  let atual = 'f0';
  const cadeia = [];
  for (let i = 1; i < lista.length; i++) {
    const out = i === lista.length - 1 ? 'v' : `x${i}`;
    cadeia.push(`[${atual}][f${i}]xfade=transition=fade:duration=${FADE}:offset=${(seg * i).toFixed(2)}[${out}]`);
    atual = out;
  }
  // termina quando o fade da última para a primeira acaba: o loop emenda sem pulo
  const total = seg * fotos.length + FADE;
  args.push('-filter_complex', [...prep, ...cadeia].join(';'),
    '-map', '[v]', '-map', `${lista.length}:a`,
    '-t', String(total),
    '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.0', '-preset', 'medium', '-tune', 'stillimage', '-crf', '24',
    '-pix_fmt', 'yuv420p', '-color_range', 'tv', '-g', String(FPS * 2),
    '-c:a', 'aac', '-b:a', '32k', '-shortest',
    '-movflags', '+faststart', path.join(raiz, saida));
  const t0 = Date.now();
  execFileSync(ffmpeg, args, { stdio: 'inherit' });
  const mb = (fs.statSync(path.join(raiz, saida)).size / 1048576).toFixed(1);
  console.log(`ok ${nome} -> ${saida}: ${fotos.length} fotos, ${total} s, ${mb} MB, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
